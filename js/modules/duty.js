/* ============================================================
   duty.js — 值日管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _dutySession = null;

async function initPage(session) {
  _dutySession = session;
  const canEdit = ['teacher','cadre'].includes(session.role);

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>值日管理</h1><p>值日分组、轮值安排、完成登记</p></div>
    ${canEdit ? `
    <div class="page-header-actions">
      <button class="btn btn-secondary btn-sm" onclick="openGroupModal()">✏️ 编辑分组</button>
      <button class="btn btn-primary btn-sm"   onclick="openDutyRecord()">✅ 登记完成情况</button>
    </div>` : ''}
  </div>

  <div class="grid-2">
    <!-- 本周值日安排 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📅 本周值日安排</div>
        <select class="form-select" id="duty-week-sel" onchange="loadDutySchedule()"
                style="width:120px;padding:5px 10px;font-size:12px;">
          <option value="this">本周</option>
          <option value="next">下周</option>
          <option value="last">上周</option>
        </select>
      </div>
      <div id="duty-schedule-list">
        <div class="skeleton" style="height:240px;"></div>
      </div>
    </div>

    <!-- 值日组列表 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">👥 值日小组</div>
        ${canEdit ? `<span class="card-action" onclick="openGroupModal()">管理分组</span>` : ''}
      </div>
      <div id="duty-groups-list">
        <div class="skeleton" style="height:200px;"></div>
      </div>
    </div>
  </div>

  <!-- 本周完成情况 -->
  <div class="card">
    <div class="card-header">
      <div class="card-title">📋 本周值日记录</div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>日期</th><th>值日组</th><th>成员</th><th>完成情况</th><th>备注</th>${canEdit?'<th>操作</th>':''}</tr></thead>
        <tbody id="duty-records-tbody"><tr><td colspan="6" class="table-empty">加载中...</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- 分组 Modal -->
  <div class="modal-overlay" id="duty-group-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title">管理值日分组</div>
        <button class="modal-close" onclick="closeModal('duty-group-modal')">✕</button>
      </div>
      <div class="modal-body">
        <p class="text-secondary text-sm" style="margin-bottom:12px;">
          系统将自动按顺序轮值，每组值日一周
        </p>
        <div id="duty-groups-editor">
          <div class="skeleton" style="height:160px;"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('duty-group-modal')">取消</button>
        <button class="btn btn-primary"   onclick="saveDutyGroups()">保存分组</button>
      </div>
    </div>
  </div>

  <!-- 完成登记 Modal -->
  <div class="modal-overlay" id="duty-record-modal">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title">登记值日完成情况</div>
        <button class="modal-close" onclick="closeModal('duty-record-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">日期</label>
          <input class="form-input" type="date" id="duty-rec-date" value="${formatDate(new Date())}">
        </div>
        <div class="form-group">
          <label class="form-label">完成情况</label>
          <select class="form-select" id="duty-rec-status">
            <option value="done">✅ 完成良好</option>
            <option value="partial">⚠️ 部分完成</option>
            <option value="fail">❌ 未完成</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <input class="form-input" id="duty-rec-remark" placeholder="可选">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('duty-record-modal')">取消</button>
        <button class="btn btn-primary"   onclick="saveDutyRecord()">保存</button>
      </div>
    </div>
  </div>`;

  initModalClose();
  await loadDutyData();
}

async function loadDutyData() {
  const db = getSupabase();
  if (!db || !_dutySession?.classId) { renderMockDutyData(); return; }

  const { data: groups } = await db.from('duty_groups')
    .select('id, group_no, member_names, current_week_no')
    .eq('class_id', _dutySession.classId)
    .order('group_no');

  const { data: records } = await db.from('duty_records')
    .select('date, group_no, status, remark')
    .eq('class_id', _dutySession.classId)
    .order('date', { ascending: false })
    .limit(20);

  renderDutyGroups(groups || []);
  renderDutySchedule(groups || []);
  renderDutyRecords(records || []);
}

function renderMockDutyData() {
  const groups = [
    { group_no:1, member_names:'张三、李四、王五', current_week_no:2 },
    { group_no:2, member_names:'赵六、孙七、周八', current_week_no:3 },
    { group_no:3, member_names:'吴九、郑十、钱一', current_week_no:4 },
    { group_no:4, member_names:'孙二、李三、王四', current_week_no:5 },
    { group_no:5, member_names:'赵五、周六、吴七', current_week_no:6 },
  ];
  renderDutyGroups(groups);
  renderDutySchedule(groups);
  document.getElementById('duty-records-tbody').innerHTML =
    `<tr><td colspan="6" class="table-empty">演示模式：暂无真实记录</td></tr>`;
}

function renderDutyGroups(groups) {
  const el = document.getElementById('duty-groups-list');
  if (!el) return;
  if (groups.length === 0) {
    el.innerHTML = `<div class="empty-state" style="border:none;padding:20px;"><div class="empty-state-desc">尚未创建值日分组</div></div>`;
    return;
  }
  el.innerHTML = groups.map(g => `
    <div class="duty-group-item">
      <div class="duty-group-num">${g.group_no}</div>
      <div class="duty-group-info">
        <div class="duty-group-name">第 ${g.group_no} 组</div>
        <div class="duty-group-members">${escHtml(g.member_names || '待分配')}</div>
      </div>
    </div>`).join('');
}

function renderDutySchedule(groups) {
  const el = document.getElementById('duty-schedule-list');
  if (!el || !groups.length) { if(el) el.innerHTML=`<div class="empty-state" style="border:none;padding:20px;"><div class="empty-state-desc">暂无排班数据</div></div>`; return; }

  const sem = getCurrentSemester();
  const wk  = sem ? calcWeekNo(sem.startDate) : 1;

  // 本周值日组（按轮转）
  const thisGroupIdx = (wk - 1) % groups.length;
  const weekdays = ['周一','周二','周三','周四','周五'];

  el.innerHTML = weekdays.map((day, i) => {
    const g = groups[(thisGroupIdx + Math.floor(i / 5)) % groups.length];
    return `
      <div class="duty-group-item">
        <div class="duty-group-num" style="background:rgba(14,165,233,0.1);border-color:rgba(14,165,233,0.2);">${day}</div>
        <div class="duty-group-info">
          <div class="duty-group-name">第 ${g.group_no} 组值日</div>
          <div class="duty-group-members">${escHtml(g.member_names || '待分配')}</div>
        </div>
      </div>`;
  }).join('');
}

function renderDutyRecords(records) {
  const tbody = document.getElementById('duty-records-tbody');
  if (!tbody) return;
  const canEdit = ['teacher','cadre'].includes(_dutySession?.role);
  tbody.innerHTML = records.length === 0
    ? `<tr><td colspan="6" class="table-empty">本周暂无记录</td></tr>`
    : records.map(r => {
        const statusMap = { done:['badge-success','完成良好'], partial:['badge-warning','部分完成'], fail:['badge-danger','未完成'] };
        const [cls, label] = statusMap[r.status] || ['badge-neutral', r.status];
        return `<tr>
          <td style="font-family:var(--font-display)">${escHtml(r.date)}</td>
          <td>第 ${r.group_no} 组</td>
          <td style="color:var(--text-muted)">—</td>
          <td>${renderBadge(label, cls)}</td>
          <td style="color:var(--text-muted)">${escHtml(r.remark||'—')}</td>
          ${canEdit?`<td><span class="btn btn-ghost btn-sm" style="color:var(--color-red-light)">删除</span></td>`:''}
        </tr>`;
      }).join('');
}

function openGroupModal() { openModal('duty-group-modal'); }
function openDutyRecord() { openModal('duty-record-modal'); }

async function saveDutyRecord() {
  const date   = document.getElementById('duty-rec-date')?.value;
  const status = document.getElementById('duty-rec-status')?.value;
  const remark = document.getElementById('duty-rec-remark')?.value.trim();
  const db = getSupabase();
  if (!db) { Toast.info('演示模式，保存成功'); closeModal('duty-record-modal'); return; }
  const { error } = await db.from('duty_records').insert({
    class_id: _dutySession.classId, date, status, remark: remark||null,
    recorder_id: _dutySession.userId,
  });
  if (error) { Toast.error('保存失败'); return; }
  Toast.success('值日记录已保存');
  closeModal('duty-record-modal');
  await loadDutyData();
}

function saveDutyGroups() {
  Toast.info('分组管理功能完整实现敬请期待');
  closeModal('duty-group-modal');
}

function loadDutySchedule() {}
