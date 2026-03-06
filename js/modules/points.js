/* ============================================================
   points.js — 积分/量化管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _pointSession = null;
let _pointStudents = [];

async function initPage(session) {
  _pointSession = session;
  const canEdit = ['teacher','cadre'].includes(session.role);

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>积分/量化管理</h1><p>${canEdit ? '登记积分事项，实时查看排行榜' : '查看个人积分记录'}</p></div>
  </div>

  <div class="sub-tabs" id="point-tabs">
    <div class="sub-tab active" data-tab="ranking">积分排行</div>
    ${canEdit ? `<div class="sub-tab" data-tab="record">登记积分</div>` : ''}
    <div class="sub-tab" data-tab="history">记录查询</div>
  </div>

  <div id="tab-ranking">
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏆 本周积分排行榜</div>
        </div>
        <div id="ranking-list"><div class="skeleton" style="height:200px;"></div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📊 本周积分概况</div></div>
        <div id="point-stats"><div class="skeleton" style="height:120px;"></div></div>
      </div>
    </div>
  </div>

  ${canEdit ? `
  <div id="tab-record" style="display:none;">
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">⭐ 快速登记</div></div>
        <div class="form-group">
          <label class="form-label">选择学生 <span class="required">*</span></label>
          <select class="form-select" id="pt-student-id"><option value="">— 选择学生 —</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">积分事项</label>
          <select class="form-select" id="pt-item" onchange="updateScorePreview()"><option value="">— 选择预设事项 —</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">分值 <span class="required">*</span></label>
          <input class="form-input" id="pt-score" type="number" placeholder="正数加分，负数减分">
          <div class="form-hint" id="pt-score-hint">选择预设事项自动填入分值</div>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <input class="form-input" id="pt-remark" placeholder="可选说明">
        </div>
        <button class="btn btn-primary btn-full" onclick="submitPoint()">登记积分</button>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📋 今日已登记</div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>学生</th><th>事项</th><th>分值</th><th>时间</th></tr></thead>
            <tbody id="today-point-tbody"><tr><td colspan="4" class="table-empty">今日暂无记录</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>` : ''}

  <div id="tab-history" style="display:none;">
    <div class="card">
      <div class="card-header"><div class="card-title">📋 积分记录查询</div></div>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <input type="date" id="pt-hist-start" class="form-input" style="width:160px;">
        <input type="date" id="pt-hist-end"   class="form-input" style="width:160px;">
        <button class="btn btn-primary btn-sm" onclick="queryPointHistory()">查询</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>日期</th><th>学生</th><th>事项</th><th>分值</th><th>记录人</th></tr></thead>
          <tbody id="pt-hist-tbody"><tr><td colspan="5" class="table-empty">请选择日期范围后查询</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>`;

  initSubTabs('point-tabs', (tab) => {
    ['ranking','record','history'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
  });

  await Promise.all([loadPointStudents(session.classId), loadRanking(), loadTodayPoints(session.classId)]);
  buildPointItems();
}

async function loadPointStudents(classId) {
  const { data } = await StudentAPI.getByClass(classId);
  _pointStudents = data || [];
  const sel = document.getElementById('pt-student-id');
  if (sel) sel.innerHTML = `<option value="">— 选择学生 —</option>` +
    _pointStudents.map(s => `<option value="${s.id}">${escHtml(s.name)} (${escHtml(s.student_no||'')})</option>`).join('');
}

function buildPointItems() {
  const sel = document.getElementById('pt-item');
  if (!sel) return;
  let opts = `<option value="">— 选择预设事项 —</option>`;
  DEFAULT_POINT_CATEGORIES.forEach(cat => {
    opts += `<optgroup label="${escHtml(cat.name)}">`;
    cat.items.forEach(item => opts += `<option value="${item.score}" data-label="${escHtml(item.label)}">${escHtml(item.label)}（${formatScore(item.score)}）</option>`);
    opts += `</optgroup>`;
  });
  sel.innerHTML = opts;
}

function updateScorePreview() {
  const sel = document.getElementById('pt-item');
  const val = sel?.value;
  if (val) {
    document.getElementById('pt-score-hint').textContent = `预设分值：${formatScore(Number(val))}`;
    document.getElementById('pt-score').value = val;
  }
}

async function loadRanking() {
  const db = getSupabase();
  if (!db || !_pointSession?.classId) { renderRankingMock(); return; }
  const sem  = getCurrentSemester();
  const wk   = sem ? calcWeekNo(sem.startDate) : null;
  const rng  = sem && wk ? getWeekRange(sem.startDate, wk) : null;
  let q = db.from('point_records').select('student_id, score, item_label, students(name)').eq('class_id', _pointSession.classId);
  if (rng) q = q.gte('date', formatDate(rng.start)).lte('date', formatDate(rng.end));
  const { data } = await q;
  renderRankingList(data || []);
  renderPointStats(data || []);
}

function renderRankingMock() {
  const mock = [
    { student_id:'s1', students:{name:'王晓明'}, score:10 },
    { student_id:'s1', students:{name:'王晓明'}, score:5  },
    { student_id:'s2', students:{name:'张丽华'}, score:8  },
    { student_id:'s3', students:{name:'赵建国'}, score:3  },
  ];
  renderRankingList(mock);
  renderPointStats(mock);
}

function renderRankingList(records) {
  const el = document.getElementById('ranking-list');
  if (!el) return;
  if (!records.length) { el.innerHTML = `<div class="empty-state" style="border:none;padding:30px;"><div class="empty-state-desc">本周暂无积分记录</div></div>`; return; }
  const map = {};
  records.forEach(r => {
    const id = r.student_id;
    if (!map[id]) map[id] = { id, name: r.students?.name||id, total:0 };
    map[id].total += (r.score||0);
  });
  const ranked = Object.values(map).sort((a,b)=>b.total-a.total).slice(0,10);
  const icons = ['🥇','🥈','🥉'];
  el.innerHTML = ranked.map((s,i) => `
    <div class="list-item">
      <span class="rank-num rank-${i+1}">${icons[i]||i+1}</span>
      ${renderListAvatar(s.name)}
      <div class="list-info"><div class="list-name">${escHtml(s.name)}</div></div>
      <div class="list-right"><div class="list-value ${s.total>=0?'text-gold':'text-red'}">${formatScore(s.total)}</div></div>
    </div>`).join('');
}

function renderPointStats(records) {
  const el = document.getElementById('point-stats');
  if (!el) return;
  const total = records.reduce((s,r)=>s+(r.score||0),0);
  const pos   = records.filter(r=>r.score>0).reduce((s,r)=>s+(r.score||0),0);
  const neg   = records.filter(r=>r.score<0).reduce((s,r)=>s+(r.score||0),0);
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">
      <div style="padding:14px;background:rgba(245,158,11,0.1);border-radius:12px;">
        <div class="big-num big-num-md text-gold">${formatScore(total)}</div>
        <div class="text-muted text-xs" style="margin-top:4px;">总积分</div>
      </div>
      <div style="padding:14px;background:rgba(16,185,129,0.1);border-radius:12px;">
        <div class="big-num big-num-md text-green">+${pos}</div>
        <div class="text-muted text-xs" style="margin-top:4px;">加分</div>
      </div>
      <div style="padding:14px;background:rgba(239,68,68,0.1);border-radius:12px;">
        <div class="big-num big-num-md text-red">${neg}</div>
        <div class="text-muted text-xs" style="margin-top:4px;">扣分</div>
      </div>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--text-muted);text-align:center;">本周共 ${records.length} 条记录</div>`;
}

async function loadTodayPoints(classId) {
  const db = getSupabase();
  if (!db || !classId) return;
  const { data } = await db.from('point_records')
    .select('student_id, score, item_label, created_at, students(name)')
    .eq('class_id', classId).eq('date', formatDate(new Date()))
    .order('created_at', { ascending: false });
  const tbody = document.getElementById('today-point-tbody');
  if (!tbody) return;
  const rows = data||[];
  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="4" class="table-empty">今日暂无登记记录</td></tr>`
    : rows.map(r => `<tr>
        <td class="td-name">${escHtml(r.students?.name||'—')}</td>
        <td>${escHtml(r.item_label||'—')}</td>
        <td class="${r.score>=0?'score-positive':'score-negative'} td-num">${formatScore(r.score)}</td>
        <td style="font-family:var(--font-display)">${formatTime(new Date(r.created_at))}</td>
      </tr>`).join('');
}

async function submitPoint() {
  const studentId = document.getElementById('pt-student-id')?.value;
  const itemSel   = document.getElementById('pt-item');
  const scoreStr  = document.getElementById('pt-score')?.value;
  const remark    = document.getElementById('pt-remark')?.value.trim();
  if (!studentId) { Toast.warning('请选择学生'); return; }
  if (!scoreStr)  { Toast.warning('请填写分值'); return; }
  const score = Number(scoreStr);
  if (isNaN(score)) { Toast.warning('分值必须为数字'); return; }
  const itemLabel = itemSel?.options[itemSel.selectedIndex]?.dataset?.label || '自定义';
  const { error } = await PointAPI.create({
    student_id: studentId, class_id: _pointSession.classId,
    date: formatDate(new Date()), score, item_label: itemLabel,
    remark: remark||null, recorder_id: _pointSession.userId,
  });
  if (error) { Toast.error('登记失败：'+error.message); return; }
  Toast.success(`已登记 ${formatScore(score)} 分`);
  ['pt-student-id','pt-item','pt-score','pt-remark'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  await loadTodayPoints(_pointSession.classId);
  await loadRanking();
}

async function queryPointHistory() {
  const start = document.getElementById('pt-hist-start')?.value;
  const end   = document.getElementById('pt-hist-end')?.value;
  if (!start||!end) { Toast.warning('请选择日期范围'); return; }
  const db = getSupabase();
  if (!db) return;
  const { data } = await db.from('point_records')
    .select('date, score, item_label, students(name), recorder_name')
    .eq('class_id', _pointSession.classId).gte('date', start).lte('date', end)
    .order('date', { ascending: false });
  const tbody = document.getElementById('pt-hist-tbody');
  if (!tbody) return;
  const rows = data||[];
  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="5" class="table-empty">该时段暂无记录</td></tr>`
    : rows.map(r => `<tr>
        <td style="font-family:var(--font-display)">${escHtml(r.date)}</td>
        <td class="td-name">${escHtml(r.students?.name||'—')}</td>
        <td>${escHtml(r.item_label||'—')}</td>
        <td class="${r.score>=0?'score-positive':'score-negative'} td-num">${formatScore(r.score)}</td>
        <td style="color:var(--text-muted)">${escHtml(r.recorder_name||'—')}</td>
      </tr>`).join('');
}
