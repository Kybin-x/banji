/* ============================================================
   attendance.js — 考勤管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _attSession = null;
let _attDate    = formatDate(new Date());
let _attRecords = []; // 今日异常记录
let _allStudents = [];

async function initPage(session) {
  _attSession = session;
  renderAttPage(session);
  await Promise.all([
    loadStudents(session.classId),
    loadAttRecords(session.classId, _attDate),
  ]);
}

function renderAttPage(session) {
  const isReadonly = session.role === 'parent';
  const isStudent  = session.role === 'student';

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div>
      <h1>考勤管理</h1>
      <p>${isStudent ? '查看个人考勤记录' : isReadonly ? '查看子女考勤' : '登记今日考勤，标记异常出勤'}</p>
    </div>
  </div>

  <div class="sub-tabs" id="att-tabs">
    <div class="sub-tab active" data-tab="today">今日登记</div>
    <div class="sub-tab" data-tab="history">历史查询</div>
    ${!isStudent && !isReadonly ? `<div class="sub-tab" data-tab="stats">统计分析</div>` : ''}
  </div>

  <!-- 今日登记 -->
  <div id="tab-today">
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          📅
          <input type="date" id="att-date" class="form-input"
                 value="${_attDate}" onchange="onDateChange(this.value)"
                 style="width:160px;padding:6px 10px;font-size:13px;">
          <span id="att-week-label" class="text-muted text-sm"></span>
        </div>
        ${!isStudent && !isReadonly
          ? `<button class="btn btn-primary btn-sm" onclick="openAddAbnormal()">＋ 标记异常</button>`
          : ''}
      </div>

      <!-- 出勤概况 -->
      <div class="attendance-summary" id="att-summary"></div>

      <!-- 默认全勤提示 -->
      <div class="att-default-tip" id="att-default-tip">✅ 默认全班出勤，以下为已登记的异常记录</div>

      <!-- 异常列表 -->
      <div class="table-wrap" style="margin-top:14px;">
        <table class="table">
          <thead>
            <tr>
              <th>学生</th><th>学号</th><th>状态</th><th>备注</th>
              <th>记录人</th><th>时间</th>
              ${!isStudent && !isReadonly ? '<th>操作</th>' : ''}
            </tr>
          </thead>
          <tbody id="att-tbody">
            <tr><td colspan="7" class="table-empty">加载中...</td></tr>
          </tbody>
        </table>
      </div>

      ${!isStudent && !isReadonly
        ? `<div style="margin-top:16px;">
            <button class="btn btn-primary" onclick="saveAttendance()">💾 保存考勤记录</button>
          </div>`
        : ''}
    </div>
  </div>

  <!-- 历史查询（占位） -->
  <div id="tab-history" style="display:none;">
    <div class="card">
      <div class="card-header">
        <div class="card-title">📊 考勤历史查询</div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <input type="date" id="hist-start" class="form-input" style="width:160px;">
        <input type="date" id="hist-end"   class="form-input" style="width:160px;">
        <select class="form-select" id="hist-status" style="width:120px;">
          <option value="">全部状态</option>
          <option value="late">迟到</option>
          <option value="absent">旷课</option>
          <option value="sick">病假</option>
          <option value="leave">事假</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="queryHistory()">查询</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>日期</th><th>学生</th><th>状态</th><th>备注</th><th>记录人</th></tr></thead>
          <tbody id="hist-tbody"><tr><td colspan="5" class="table-empty">请选择日期范围后查询</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 统计分析（占位） -->
  <div id="tab-stats" style="display:none;">
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">考勤统计分析</div>
      <div class="empty-state-desc">按周/月汇总出勤率，识别高风险学生</div>
    </div>
  </div>

  <!-- 标记异常 Modal -->
  <div class="modal-overlay" id="att-modal">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title">标记考勤异常</div>
        <button class="modal-close" onclick="closeModal('att-modal')">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="att-edit-id">
        <div class="form-group">
          <label class="form-label">学生 <span class="required">*</span></label>
          <select class="form-select" id="att-student-id">
            <option value="">— 选择学生 —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">考勤状态 <span class="required">*</span></label>
          <select class="form-select" id="att-status">
            <option value="late">迟到</option>
            <option value="absent">旷课</option>
            <option value="sick">病假</option>
            <option value="leave">事假</option>
            <option value="public">公假</option>
            <option value="early">早退</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <input class="form-input" id="att-remark" placeholder="可选说明">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('att-modal')">取消</button>
        <button class="btn btn-primary"   onclick="saveAbnormal()">保存</button>
      </div>
    </div>
  </div>`;

  // 初始化 tab 切换
  initSubTabs('att-tabs', (tab) => {
    ['today','history','stats'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
  });

  // 设置日期标签
  updateWeekLabel(_attDate);
}

/* ---------- 数据加载 ---------- */
async function loadStudents(classId) {
  const { data } = await StudentAPI.getByClass(classId);
  _allStudents = data || [];

  // 填充 modal 选项
  const sel = document.getElementById('att-student-id');
  if (sel) {
    sel.innerHTML = `<option value="">— 选择学生 —</option>` +
      _allStudents.map(s =>
        `<option value="${s.id}">${escHtml(s.name)} (${escHtml(s.student_no || '')})</option>`
      ).join('');
  }
}

async function loadAttRecords(classId, date) {
  const { data, error } = await AttendanceAPI.getByDate(classId, date);
  if (error) { Toast.error('加载考勤数据失败'); return; }
  _attRecords = data || [];
  renderAttTable();
  renderAttSummary();
}

/* ---------- 渲染 ---------- */
function renderAttTable() {
  const tbody     = document.getElementById('att-tbody');
  const isManager = _attSession && ['teacher','cadre'].includes(_attSession.role);
  if (!tbody) return;

  if (_attRecords.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">✅ 全班出勤，暂无异常记录</td></tr>`;
    return;
  }

  tbody.innerHTML = _attRecords.map(r => `
    <tr>
      <td class="td-name">${escHtml(r.students?.name || '—')}</td>
      <td class="td-num text-muted">${escHtml(r.students?.student_no || '—')}</td>
      <td>${renderAttBadge(r.status)}</td>
      <td style="color:var(--text-secondary)">${escHtml(r.remark || '—')}</td>
      <td style="color:var(--text-muted)">${escHtml(r.recorder_name || '—')}</td>
      <td style="font-family:var(--font-display)">${r.record_time ? formatTime(new Date(r.record_time)) : '—'}</td>
      ${isManager ? `
        <td>
          <span class="btn btn-ghost btn-sm" onclick="openEditAbnormal('${r.id}')">编辑</span>
          <span class="btn btn-ghost btn-sm" style="color:var(--color-red-light)"
                onclick="deleteAbnormal('${r.id}')">删除</span>
        </td>` : ''}
    </tr>`).join('');
}

function renderAttSummary() {
  const el = document.getElementById('att-summary');
  if (!el) return;
  const total   = _allStudents.length || 50;
  const abnCount = _attRecords.length;
  const present  = total - abnCount;
  const late     = _attRecords.filter(r => r.status === 'late').length;
  const absent   = _attRecords.filter(r => r.status === 'absent').length;
  const leave    = abnCount - late - absent;

  el.innerHTML = `
    <div class="att-summary-cell present"><div class="num">${present}</div><div class="lbl">出勤</div></div>
    <div class="att-summary-cell late">  <div class="num">${late}</div>   <div class="lbl">迟到</div></div>
    <div class="att-summary-cell leave"> <div class="num">${leave}</div>  <div class="lbl">请假</div></div>
    <div class="att-summary-cell absent"><div class="num">${absent}</div> <div class="lbl">旷课</div></div>`;
}

/* ---------- 日期切换 ---------- */
async function onDateChange(date) {
  _attDate = date;
  updateWeekLabel(date);
  await loadAttRecords(_attSession.classId, date);
}

function updateWeekLabel(date) {
  const el  = document.getElementById('att-week-label');
  const sem = getCurrentSemester();
  if (!el || !sem) return;
  const wk = calcWeekNo(sem.startDate, new Date(date));
  const wd = ['日','一','二','三','四','五','六'][new Date(date).getDay()];
  el.textContent = wk ? `第${wk}周 周${wd}` : `周${wd}`;
}

/* ---------- 标记异常 ---------- */
function openAddAbnormal() {
  document.getElementById('att-edit-id').value = '';
  document.getElementById('att-student-id').value = '';
  document.getElementById('att-status').value = 'late';
  document.getElementById('att-remark').value = '';
  openModal('att-modal');
}

function openEditAbnormal(id) {
  const r = _attRecords.find(x => x.id === id);
  if (!r) return;
  document.getElementById('att-edit-id').value     = r.id;
  document.getElementById('att-student-id').value  = r.student_id;
  document.getElementById('att-status').value      = r.status;
  document.getElementById('att-remark').value      = r.remark || '';
  openModal('att-modal');
}

async function saveAbnormal() {
  const editId    = document.getElementById('att-edit-id').value;
  const studentId = document.getElementById('att-student-id').value;
  const status    = document.getElementById('att-status').value;
  const remark    = document.getElementById('att-remark').value.trim();

  if (!studentId) { Toast.warning('请选择学生'); return; }

  const payload = {
    student_id:   studentId,
    class_id:     _attSession.classId,
    date:         _attDate,
    status,
    remark:       remark || null,
    recorder_id:  _attSession.userId,
    record_time:  new Date().toISOString(),
  };

  let result;
  if (editId) {
    result = await AttendanceAPI.update(editId, payload);
  } else {
    // 检查是否已存在
    const exists = _attRecords.find(r => r.student_id === studentId);
    if (exists) { Toast.warning('该学生今日已有考勤记录，请编辑已有记录'); return; }
    result = await AttendanceAPI.create(payload);
  }

  if (result.error) { Toast.error('保存失败：' + result.error.message); return; }

  Toast.success('考勤记录已保存');
  closeModal('att-modal');
  await loadAttRecords(_attSession.classId, _attDate);
}

async function deleteAbnormal(id) {
  if (!confirm('确定删除该条考勤记录？')) return;
  const { error } = await AttendanceAPI.delete(id);
  if (error) { Toast.error('删除失败'); return; }
  Toast.success('已删除');
  await loadAttRecords(_attSession.classId, _attDate);
}

async function saveAttendance() {
  Toast.success('今日考勤已保存（异常 ' + _attRecords.length + ' 条，其余默认出勤）');
}

/* ---------- 历史查询 ---------- */
async function queryHistory() {
  const start  = document.getElementById('hist-start')?.value;
  const end    = document.getElementById('hist-end')?.value;
  const status = document.getElementById('hist-status')?.value;

  if (!start || !end) { Toast.warning('请选择查询日期范围'); return; }

  const db = getSupabase();
  if (!db) return;
  let q = db.from('attendance_records')
    .select('date, status, remark, students(name, student_no), recorder_name')
    .eq('class_id', _attSession.classId)
    .gte('date', start).lte('date', end);
  if (status) q = q.eq('status', status);
  q = q.order('date', { ascending: false }).limit(200);

  const { data, error } = await q;
  const tbody = document.getElementById('hist-tbody');
  if (!tbody) return;

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">该时间段暂无记录</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td style="font-family:var(--font-display)">${escHtml(r.date)}</td>
      <td class="td-name">${escHtml(r.students?.name || '—')}</td>
      <td>${renderAttBadge(r.status)}</td>
      <td style="color:var(--text-secondary)">${escHtml(r.remark || '—')}</td>
      <td style="color:var(--text-muted)">${escHtml(r.recorder_name || '—')}</td>
    </tr>`).join('');
}
