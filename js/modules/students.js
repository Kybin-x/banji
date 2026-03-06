/* ============================================================
   students.js — 学生信息管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _session  = null;
let _students = [];
let _searchKw = '';

async function initPage(session) {
  if (!hasPermission(['teacher'])) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">🔒</div>
      <div class="empty-state-title">仅班主任可访问</div></div>`;
    return;
  }
  renderStudentsPage(session);
  await loadStudents(session.classId);
}

function renderStudentsPage(session) {
  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>学生信息管理</h1><p>管理全班学生档案、批量导入导出</p></div>
    <div class="page-header-actions">
      <button class="btn btn-secondary btn-sm" onclick="exportStudents()">📤 导出 Excel</button>
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('import-modal').classList.add('open')">📥 批量导入</button>
      <button class="btn btn-primary btn-sm"   onclick="openAddStudent()">＋ 添加学生</button>
    </div>
  </div>

  <!-- 搜索 + 筛选 -->
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="search-input">
        <span class="search-icon">🔍</span>
        <input class="form-input" id="search-input" placeholder="搜索学号 / 姓名"
               oninput="handleSearch(this.value)" style="width:220px;">
      </div>
      <select class="form-select" id="gender-filter" onchange="filterStudents()" style="width:100px;">
        <option value="">全部性别</option>
        <option value="男">男</option>
        <option value="女">女</option>
      </select>
      <select class="form-select" id="dorm-filter" onchange="filterStudents()" style="width:120px;">
        <option value="">全部住宿</option>
        <option value="住校">住校</option>
        <option value="走读">走读</option>
      </select>
    </div>
    <div class="toolbar-right">
      <span class="text-muted text-sm" id="student-count">共 0 名学生</span>
    </div>
  </div>

  <!-- 表格 -->
  <div class="card" style="padding:0;overflow:hidden;">
    <div class="table-wrap">
      <table class="table" id="students-table">
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" id="check-all" onchange="toggleAll(this)"></th>
            <th>学号</th><th>姓名</th><th>性别</th><th>手机号</th>
            <th>宿舍号</th><th>家长手机</th><th>账号状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody id="students-tbody">
          <tr><td colspan="9" class="table-empty">加载中...</td></tr>
        </tbody>
      </table>
    </div>
    <div class="pagination" id="pagination"></div>
  </div>

  <!-- 添加/编辑 Modal -->
  <div class="modal-overlay" id="student-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="student-modal-title">添加学生</div>
        <button class="modal-close" onclick="closeModal('student-modal')">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="edit-student-id">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div class="form-group">
            <label class="form-label">学号 <span class="required">*</span></label>
            <input class="form-input" id="f-student-no" placeholder="如 2024001">
          </div>
          <div class="form-group">
            <label class="form-label">姓名 <span class="required">*</span></label>
            <input class="form-input" id="f-name" placeholder="学生姓名">
          </div>
          <div class="form-group">
            <label class="form-label">性别</label>
            <select class="form-select" id="f-gender">
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">手机号 <span class="required">*</span></label>
            <input class="form-input" id="f-phone" placeholder="学生手机号（账号）" maxlength="11">
          </div>
          <div class="form-group">
            <label class="form-label">身份证后4位</label>
            <input class="form-input" id="f-id-last4" placeholder="初始密码" maxlength="4">
          </div>
          <div class="form-group">
            <label class="form-label">宿舍号</label>
            <input class="form-input" id="f-dorm" placeholder="填写宿舍号或"走读"">
          </div>
          <div class="form-group" style="grid-column:1/-1;">
            <label class="form-label">家长手机号</label>
            <input class="form-input" id="f-parent-phone" placeholder="家长账号（可留空）" maxlength="11">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('student-modal')">取消</button>
        <button class="btn btn-primary"   onclick="saveStudent()">保存</button>
      </div>
    </div>
  </div>

  <!-- 导入 Modal -->
  <div class="modal-overlay" id="import-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">批量导入学生</div>
        <button class="modal-close" onclick="closeModal('import-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="import-steps">
          <div class="import-step active"><div class="import-step-num">1</div><div class="import-step-label">下载模板</div></div>
          <div class="import-step-line"></div>
          <div class="import-step"><div class="import-step-num">2</div><div class="import-step-label">填写数据</div></div>
          <div class="import-step-line"></div>
          <div class="import-step"><div class="import-step-num">3</div><div class="import-step-label">上传文件</div></div>
        </div>
        <p class="text-secondary text-sm" style="margin-bottom:14px;">
          请先下载模板，按格式填写后上传。支持 .xlsx / .csv 格式。
        </p>
        <button class="btn btn-secondary btn-sm" onclick="downloadTemplate()">📥 下载模板</button>
        <div style="margin-top:16px;">
          <input type="file" id="import-file" accept=".xlsx,.csv" class="form-input" onchange="previewImport(this)">
        </div>
        <div id="import-preview" style="margin-top:12px;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('import-modal')">取消</button>
        <button class="btn btn-primary" id="import-confirm-btn" onclick="confirmImport()" disabled>确认导入</button>
      </div>
    </div>
  </div>`;

  initModalClose();
}

/* ---------- 数据加载 ---------- */
let _classId = '';

async function loadStudents(classId) {
  _classId = classId;
  const { data, error } = await StudentAPI.getByClass(classId);
  if (error) { Toast.error('加载学生数据失败'); return; }
  _students = data || [];
  renderTable(_students);
}

/* ---------- 渲染表格 ---------- */
let _page = 1;
const PAGE_SIZE = 20;

function renderTable(list) {
  const tbody = document.getElementById('students-tbody');
  const countEl = document.getElementById('student-count');
  if (!tbody) return;

  countEl && (countEl.textContent = `共 ${list.length} 名学生`);

  const start = (_page - 1) * PAGE_SIZE;
  const paged = list.slice(start, start + PAGE_SIZE);

  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">暂无学生数据</td></tr>`;
    renderPagination(0);
    return;
  }

  tbody.innerHTML = paged.map(s => `
    <tr>
      <td><input type="checkbox" class="row-check" data-id="${s.id}"></td>
      <td class="td-num">${escHtml(s.student_no || '—')}</td>
      <td class="td-name">${escHtml(s.name)}</td>
      <td style="color:var(--text-secondary)">${escHtml(s.gender || '—')}</td>
      <td>${maskPhone(s.phone || '')}</td>
      <td>${escHtml(s.dorm_no || '走读')}</td>
      <td>${maskPhone(s.parent_phone || '')}</td>
      <td>${renderBadge('正常', 'badge-success')}</td>
      <td>
        <span class="btn btn-ghost btn-sm" onclick="openEditStudent('${s.id}')">编辑</span>
        <span class="btn btn-ghost btn-sm" style="color:var(--color-red-light)" onclick="deleteStudent('${s.id}')">删除</span>
      </td>
    </tr>`).join('');

  renderPagination(list.length);
}

function renderPagination(total) {
  const el = document.getElementById('pagination');
  if (!el) return;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = `<span class="pagination-info">共 ${total} 条</span>`;
  html += `<button class="page-btn" onclick="gotoPage(${_page-1})" ${_page===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - _page) <= 1) {
      html += `<button class="page-btn ${i===_page?'active':''}" onclick="gotoPage(${i})">${i}</button>`;
    } else if (Math.abs(i - _page) === 2) {
      html += `<span class="page-btn" style="cursor:default">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="gotoPage(${_page+1})" ${_page===totalPages?'disabled':''}>›</button>`;
  el.innerHTML = html;
}

function gotoPage(p) {
  _page = p;
  renderTable(getFilteredList());
}

/* ---------- 搜索 & 筛选 ---------- */
const handleSearch = debounce((kw) => {
  _searchKw = kw.trim();
  _page = 1;
  renderTable(getFilteredList());
}, 300);

function filterStudents() {
  _page = 1;
  renderTable(getFilteredList());
}

function getFilteredList() {
  const gender = document.getElementById('gender-filter')?.value || '';
  const dorm   = document.getElementById('dorm-filter')?.value || '';
  return _students.filter(s => {
    const kw = _searchKw.toLowerCase();
    const matchKw = !kw || s.name?.toLowerCase().includes(kw) || s.student_no?.includes(kw);
    const matchG  = !gender || s.gender === gender;
    const matchD  = !dorm || (dorm === '住校' ? s.dorm_no && s.dorm_no !== '走读' : s.dorm_no === '走读');
    return matchKw && matchG && matchD;
  });
}

/* ---------- 添加/编辑 ---------- */
function openAddStudent() {
  document.getElementById('student-modal-title').textContent = '添加学生';
  document.getElementById('edit-student-id').value = '';
  ['student-no','name','phone','id-last4','dorm','parent-phone']
    .forEach(f => { const el = document.getElementById(`f-${f}`); if (el) el.value = ''; });
  document.getElementById('f-gender').value = '男';
  openModal('student-modal');
}

function openEditStudent(id) {
  const s = _students.find(x => x.id === id);
  if (!s) return;
  document.getElementById('student-modal-title').textContent = '编辑学生';
  document.getElementById('edit-student-id').value  = s.id;
  document.getElementById('f-student-no').value     = s.student_no || '';
  document.getElementById('f-name').value           = s.name || '';
  document.getElementById('f-gender').value         = s.gender || '男';
  document.getElementById('f-phone').value          = s.phone || '';
  document.getElementById('f-id-last4').value       = '';
  document.getElementById('f-dorm').value           = s.dorm_no || '';
  document.getElementById('f-parent-phone').value   = s.parent_phone || '';
  openModal('student-modal');
}

async function saveStudent() {
  const id     = document.getElementById('edit-student-id').value;
  const stuNo  = document.getElementById('f-student-no').value.trim();
  const name   = document.getElementById('f-name').value.trim();
  const phone  = document.getElementById('f-phone').value.trim();
  const gender = document.getElementById('f-gender').value;
  const dorm   = document.getElementById('f-dorm').value.trim();
  const parent = document.getElementById('f-parent-phone').value.trim();

  if (!name) { Toast.warning('请填写学生姓名'); return; }
  if (!phone || !Validate.phone(phone)) { Toast.warning('请填写正确的手机号'); return; }

  const payload = {
    student_no: stuNo, name, gender, phone,
    dorm_no: dorm || '走读', parent_phone: parent || null,
    class_id: _classId,
  };

  let result;
  if (id) {
    result = await StudentAPI.update(id, payload);
  } else {
    result = await StudentAPI.create(payload);
  }

  if (result.error) { Toast.error('保存失败：' + result.error.message); return; }

  Toast.success(id ? '学生信息已更新' : '学生添加成功');
  closeModal('student-modal');
  await loadStudents(_classId);
}

async function deleteStudent(id) {
  const s = _students.find(x => x.id === id);
  if (!confirm(`确定要删除学生「${s?.name || id}」吗？此操作不可恢复。`)) return;
  const { error } = await StudentAPI.delete(id);
  if (error) { Toast.error('删除失败'); return; }
  Toast.success('已删除');
  await loadStudents(_classId);
}

/* ---------- 全选 ---------- */
function toggleAll(cb) {
  document.querySelectorAll('.row-check').forEach(c => c.checked = cb.checked);
}

/* ---------- 导出 ---------- */
function exportStudents() {
  exportStudentList(_students, _session?.classNo || '班级');
}

function downloadTemplate() {
  Toast.info('模板下载功能敬请期待');
}

function previewImport(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('import-preview').innerHTML = `
    <div class="badge badge-info">已选择：${escHtml(file.name)}（${(file.size/1024).toFixed(1)} KB）</div>`;
  document.getElementById('import-confirm-btn').disabled = false;
}

async function confirmImport() {
  Toast.info('批量导入功能敬请期待（需结合 SheetJS 解析）');
  closeModal('import-modal');
}
