/* ============================================================
   score.js — 成绩管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _scoreSession = null;

async function initPage(session) {
  _scoreSession = session;
  const isStudent = session.role === 'student';
  const isParent  = session.role === 'parent';

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>成绩管理</h1><p>${isStudent || isParent ? '查看个人/子女成绩' : '导入成绩，分析班级学情'}</p></div>
    ${!isStudent && !isParent
      ? `<div class="page-header-actions">
           <button class="btn btn-secondary btn-sm" onclick="exportScores()">📤 导出</button>
           <button class="btn btn-primary btn-sm"   onclick="openImportScores()">📥 导入成绩</button>
         </div>`
      : ''}
  </div>

  <div class="sub-tabs" id="score-tabs">
    <div class="sub-tab active" data-tab="list">成绩列表</div>
    ${!isStudent && !isParent ? `<div class="sub-tab" data-tab="analysis">班级分析</div>` : ''}
    <div class="sub-tab" data-tab="personal">个人成绩</div>
  </div>

  <!-- 成绩列表 -->
  <div id="tab-list">
    <div class="toolbar">
      <div class="toolbar-left">
        <select class="form-select" id="exam-select" onchange="loadScores()" style="width:240px;">
          <option value="">— 选择考试 —</option>
        </select>
      </div>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="table-wrap">
        <table class="table" id="score-table">
          <thead>
            <tr id="score-thead-row">
              <th>排名</th><th>学号</th><th>姓名</th><th>总分</th>
            </tr>
          </thead>
          <tbody id="score-tbody">
            <tr><td colspan="4" class="table-empty">请先选择考试</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 班级分析 -->
  <div id="tab-analysis" style="display:none;">
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">班级成绩分析</div>
      <div class="empty-state-desc">选择考试后显示：平均分、最高/最低分、各分段分布</div>
    </div>
  </div>

  <!-- 个人成绩 -->
  <div id="tab-personal" style="display:none;">
    <div class="card" id="personal-score-card">
      <div class="empty-state" style="border:none;">
        <div class="empty-state-icon">📈</div>
        <div class="empty-state-desc">选择考试后显示个人成绩详情</div>
      </div>
    </div>
  </div>

  <!-- 导入 Modal -->
  <div class="modal-overlay" id="score-import-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">导入成绩</div>
        <button class="modal-close" onclick="closeModal('score-import-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">考试名称 <span class="required">*</span></label>
          <input class="form-input" id="exam-name-input" placeholder="如：2025-2026学年第二学期期中考试">
        </div>
        <div class="form-group">
          <label class="form-label">考试日期</label>
          <input class="form-input" type="date" id="exam-date-input" value="${formatDate(new Date())}">
        </div>
        <div class="form-group">
          <label class="form-label">成绩文件（.xlsx / .csv）</label>
          <input type="file" class="form-input" id="score-file" accept=".xlsx,.csv">
          <div class="form-hint">格式：学号、姓名、各科目成绩（列标题即科目名）</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('score-import-modal')">取消</button>
        <button class="btn btn-primary"   onclick="confirmScoreImport()">确认导入</button>
      </div>
    </div>
  </div>`;

  initSubTabs('score-tabs', (tab) => {
    ['list','analysis','personal'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
  });

  initModalClose();
  await loadExamList();
}

async function loadExamList() {
  const db = getSupabase();
  if (!db) return;
  const { data } = await db.from('exams')
    .select('id, name, exam_date')
    .eq('class_id', _scoreSession.classId)
    .order('exam_date', { ascending: false });

  const sel = document.getElementById('exam-select');
  if (!sel) return;
  if (!data || data.length === 0) {
    sel.innerHTML = `<option value="">— 暂无考试记录 —</option>`;
    return;
  }
  sel.innerHTML = `<option value="">— 选择考试 —</option>` +
    data.map(e => `<option value="${e.id}">${escHtml(e.name)}（${e.exam_date || ''}）</option>`).join('');
}

async function loadScores() {
  const examId = document.getElementById('exam-select')?.value;
  if (!examId) return;

  const { data, error } = await ScoreAPI.getByExam(examId);
  const tbody = document.getElementById('score-tbody');
  if (!tbody) return;

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">暂无成绩数据</td></tr>`;
    return;
  }

  // 动态表头：从第一条记录的 subject_scores 读取科目
  const subjects = data[0]?.subject_scores ? Object.keys(data[0].subject_scores) : [];
  const thead = document.getElementById('score-thead-row');
  if (thead) {
    thead.innerHTML = `<th>排名</th><th>学号</th><th>姓名</th>` +
      subjects.map(s => `<th>${escHtml(s)}</th>`).join('') +
      `<th>总分</th>`;
  }

  const rankColors = ['color:var(--color-gold)', 'color:#94a3b8', 'color:#cd7f32'];
  tbody.innerHTML = data.map((s, i) => {
    const subjectCells = subjects.map(sub => {
      const val = s.subject_scores?.[sub];
      return `<td class="td-num">${val?.score ?? '—'}</td>`;
    }).join('');
    return `
      <tr>
        <td style="font-weight:800;${rankColors[i]||''}">${i+1}</td>
        <td class="td-num text-muted">${escHtml(s.students?.student_no || '—')}</td>
        <td class="td-name">${escHtml(s.students?.name || '—')}</td>
        ${subjectCells}
        <td class="td-num text-teal" style="font-weight:800">${s.total_score ?? '—'}</td>
      </tr>`;
  }).join('');
}

function openImportScores() { openModal('score-import-modal'); }
function exportScores() { Toast.info('导出功能敬请期待'); }
function confirmScoreImport() {
  Toast.info('成绩导入功能需结合 SheetJS 解析，敬请期待');
  closeModal('score-import-modal');
}
