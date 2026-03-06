/* ============================================================
   seat.js — 座位管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _seatSession = null;
let _seatStudents = [];
let _seatData = {};   // { position: studentId }
let _dragSource = null;

async function initPage(session) {
  _seatSession = session;
  const canEdit = session.role === 'teacher';

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>座位管理</h1><p>可视化座位编排，支持拖拽调整</p></div>
    ${canEdit ? `
    <div class="page-header-actions">
      <button class="btn btn-secondary btn-sm" onclick="autoSeat()">🔀 随机排座</button>
      <button class="btn btn-secondary btn-sm" onclick="printSeat()">🖨 打印</button>
      <button class="btn btn-primary btn-sm"   onclick="saveSeat()">💾 保存</button>
    </div>` : ''}
  </div>

  <div class="card">
    <div class="podium-bar">📺 讲台</div>
    <div id="seat-grid" class="seat-grid" style="grid-template-columns:repeat(6,1fr);max-width:680px;margin:0 auto;"></div>
    <div style="text-align:center;margin-top:16px;font-size:12px;color:var(--text-muted)" id="seat-footer">
      共 50 个座位 · 6列 × 9排 ${canEdit ? '· 拖拽学生卡片可交换座位' : ''}
    </div>
  </div>`;

  await loadSeatData(session.classId);
}

async function loadSeatData(classId) {
  const { data: students } = await StudentAPI.getByClass(classId);
  _seatStudents = students || [];

  // 尝试从 Supabase 加载已保存的座位安排
  const db = getSupabase();
  let savedSeats = {};
  if (db && classId) {
    const { data } = await db.from('seat_arrangements')
      .select('position, student_id')
      .eq('class_id', classId)
      .limit(200);
    if (data && data.length > 0) {
      data.forEach(r => { savedSeats[r.position] = r.student_id; });
    }
  }

  // 如果没有保存过，按学号顺序排
  if (Object.keys(savedSeats).length === 0) {
    _seatStudents.forEach((s, i) => { savedSeats[i] = s.id; });
  }
  _seatData = savedSeats;
  renderSeatGrid();
}

function renderSeatGrid() {
  const grid = document.getElementById('seat-grid');
  if (!grid) return;
  const canEdit = _seatSession?.role === 'teacher';
  const total   = Math.max(_seatStudents.length, 50);

  const studentMap = {};
  _seatStudents.forEach(s => { studentMap[s.id] = s; });

  grid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const studentId = _seatData[i];
    const student   = studentId ? studentMap[studentId] : null;
    const cell = document.createElement('div');
    cell.className = `seat-cell ${student ? '' : 'empty-seat'}`;
    cell.dataset.pos = i;

    if (student) {
      const bg = getAvatarColor(student.name);
      cell.innerHTML = `
        <div class="seat-avatar" style="background:${bg}">${escHtml(getInitial(student.name))}</div>
        ${escHtml(student.name)}`;
    } else {
      cell.innerHTML = `<div class="seat-avatar" style="background:rgba(255,255,255,0.05);color:var(--text-muted)">+</div><span style="color:var(--text-muted)">空位</span>`;
    }

    if (canEdit) {
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => {
        _dragSource = i;
        cell.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      cell.addEventListener('dragend', () => cell.classList.remove('dragging'));
      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (_dragSource === null || _dragSource === i) return;
        const tmp = _seatData[_dragSource];
        _seatData[_dragSource] = _seatData[i];
        _seatData[i] = tmp;
        _dragSource = null;
        renderSeatGrid();
      });
    }
    grid.appendChild(cell);
  }

  const footer = document.getElementById('seat-footer');
  if (footer) footer.textContent = `共 ${_seatStudents.length} 名学生，${total} 个座位` + (canEdit ? ' · 拖拽可交换座位' : '');
}

function autoSeat() {
  const ids = _seatStudents.map(s => s.id).sort(() => Math.random()-0.5);
  const newData = {};
  ids.forEach((id, i) => { newData[i] = id; });
  _seatData = newData;
  renderSeatGrid();
  Toast.info('已随机重新排座，点击"保存"确认');
}

async function saveSeat() {
  const db = getSupabase();
  if (!db) { Toast.info('演示模式：座位已在本地更新'); return; }

  // 删除旧数据再批量插入
  await db.from('seat_arrangements').delete().eq('class_id', _seatSession.classId);
  const rows = Object.entries(_seatData).map(([pos, studentId]) => ({
    class_id: _seatSession.classId, position: Number(pos), student_id: studentId,
  }));
  const { error } = await db.from('seat_arrangements').insert(rows);
  if (error) { Toast.error('保存失败：'+error.message); return; }
  Toast.success('座位安排已保存');
}

function printSeat() {
  window.print();
}
