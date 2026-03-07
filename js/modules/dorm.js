/* ============================================================
   dorm.js — 宿舍管理
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _dormSession = null;

async function initPage(session) {
  _dormSession = session;
  const canEdit = ['teacher','cadre'].includes(session.role);

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>宿舍管理</h1><p>宿舍评分、违纪登记、排名统计</p></div>
    ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openScoreModal()">＋ 登记评分</button>` : ''}
  </div>

  <div class="grid-stats" style="grid-template-columns:repeat(3,1fr);">
    <div id="stat-best"  class="stat-card green"><div class="stat-top"><div class="stat-icon green">🏆</div><span class="stat-trend neutral">第1名</span></div><div class="stat-value">—</div><div class="stat-label">本周最佳宿舍</div></div>
    <div id="stat-count" class="stat-card teal"><div class="stat-top"><div class="stat-icon teal">🏠</div></div><div class="stat-value">—</div><div class="stat-label">宿舍总数</div></div>
    <div id="stat-vio"   class="stat-card red"><div class="stat-top"><div class="stat-icon red">⚠️</div><span class="stat-trend down">本周</span></div><div class="stat-value">—</div><div class="stat-label">违纪次数</div></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏠 宿舍排名</div>
        <select class="form-select" id="dorm-week-sel" onchange="loadDormData()"
                style="width:120px;padding:5px 10px;font-size:12px;">
          <option value="this">本周</option>
          <option value="last">上周</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>排名</th><th>宿舍号</th><th>平均分</th><th>违纪次数</th><th>状态</th></tr></thead>
          <tbody id="dorm-tbody"><tr><td colspan="5" class="table-empty">加载中...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">📋 最近评分记录</div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>日期</th><th>宿舍</th><th>得分</th><th>扣分原因</th></tr></thead>
          <tbody id="dorm-records-tbody"><tr><td colspan="4" class="table-empty">加载中...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 评分 Modal -->
  <div class="modal-overlay" id="dorm-score-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">登记宿舍评分</div>
        <button class="modal-close" onclick="closeModal('dorm-score-modal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">宿舍号 <span class="required">*</span></label>
          <input class="form-input" id="dorm-no-input" placeholder="如 301">
        </div>
        <div class="form-group">
          <label class="form-label">评分日期</label>
          <input class="form-input" type="date" id="dorm-date-input" value="${formatDate(new Date())}">
        </div>
        <div class="form-group">
          <label class="form-label">违纪扣分项（可多选）</label>
          <div id="dorm-deduct-items">
            ${DEFAULT_DORM_SCORE_ITEMS.map(item => `
              <div class="score-check-item" onclick="toggleDeductItem(this, ${item.deduct})">
                <input type="checkbox" class="deduct-check" data-deduct="${item.deduct}"
                       onchange="calcDormScore()" style="pointer-events:none;">
                <span class="item-name">${escHtml(item.label)}</span>
                <span class="item-deduct">-${item.deduct}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">最终得分</label>
          <input class="form-input" id="dorm-final-score" type="number" value="100" min="0" max="100">
          <div class="form-hint">满分100，选择扣分项后自动计算</div>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <input class="form-input" id="dorm-remark" placeholder="可选">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('dorm-score-modal')">取消</button>
        <button class="btn btn-primary"   onclick="saveDormScore()">保存</button>
      </div>
    </div>
  </div>`;

  initModalClose();
  await loadDormData();
}

async function loadDormData() {
  const db = getSupabase();
  if (!db || !_dormSession?.classId) { renderMockDormData(); return; }

  const { data } = await db.from('dorm_scores')
    .select('dorm_no, score, date, remark, deduct_reasons')
    .eq('class_id', _dormSession.classId)
    .order('date', { ascending: false })
    .limit(100);

  const rows = data || [];
  renderDormRankTable(rows);
  renderDormRecords(rows.slice(0,10));
  updateDormStats(rows);
}

function renderMockDormData() {
  const mock = [
    { dorm_no:'303', avg:96.5, vio:0 },
    { dorm_no:'301', avg:93.2, vio:2 },
    { dorm_no:'302', avg:90.8, vio:5 },
  ];
  const tbody = document.getElementById('dorm-tbody');
  if (tbody) {
    const icons = ['🥇','🥈','🥉'];
    const statusMap = [['badge-success','优秀'],['badge-pass','良好'],['badge-warning','一般']];
    tbody.innerHTML = mock.map((d,i) => `
      <tr>
        <td style="font-size:18px;">${icons[i]||i+1}</td>
        <td class="td-name">${escHtml(d.dorm_no)} 宿舍</td>
        <td class="td-num" style="color:var(--color-green)">${d.avg}</td>
        <td class="td-num">${d.vio}</td>
        <td>${renderBadge(statusMap[i]?.[1]||'一般', statusMap[i]?.[0]||'badge-neutral')}</td>
      </tr>`).join('');
  }
  document.getElementById('dorm-records-tbody').innerHTML = `<tr><td colspan="4" class="table-empty">演示模式：暂无真实数据</td></tr>`;
  document.querySelector('#stat-best .stat-value').textContent = '303';
  document.querySelector('#stat-count .stat-value').textContent = '8';
  document.querySelector('#stat-vio .stat-value').textContent = '7';
}

function renderDormRankTable(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.dorm_no]) map[r.dorm_no] = { scores:[], vio:0 };
    map[r.dorm_no].scores.push(r.score);
    if (r.score < 90) map[r.dorm_no].vio++;
  });
  const sorted = Object.entries(map)
    .map(([dorm_no, v]) => ({ dorm_no, avg: round(v.scores.reduce((a,b)=>a+b,0)/v.scores.length), vio: v.vio }))
    .sort((a,b)=>b.avg-a.avg);

  const tbody = document.getElementById('dorm-tbody');
  const icons  = ['🥇','🥈','🥉'];
  if (!tbody) return;
  tbody.innerHTML = sorted.length === 0
    ? `<tr><td colspan="5" class="table-empty">暂无评分数据</td></tr>`
    : sorted.map((d,i) => {
        const status = d.avg>=95 ? ['badge-success','优秀'] : d.avg>=90 ? ['badge-info','良好'] : ['badge-warning','一般'];
        return `<tr>
          <td style="font-size:${i<3?18:14}px;">${icons[i]||i+1}</td>
          <td class="td-name">${escHtml(d.dorm_no)} 宿舍</td>
          <td class="td-num" style="color:${d.avg>=95?'var(--color-green)':d.avg>=90?'var(--color-teal-light)':'var(--color-gold)'}">${d.avg}</td>
          <td class="td-num">${d.vio}</td>
          <td>${renderBadge(status[1], status[0])}</td>
        </tr>`;
      }).join('');

  updateDormStats(null, sorted);
}

function renderDormRecords(rows) {
  const tbody = document.getElementById('dorm-records-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.length === 0
    ? `<tr><td colspan="4" class="table-empty">暂无评分记录</td></tr>`
    : rows.map(r => `<tr>
        <td style="font-family:var(--font-display)">${escHtml(r.date)}</td>
        <td class="td-name">${escHtml(r.dorm_no)} 宿舍</td>
        <td class="td-num" style="color:${r.score>=90?'var(--color-green)':'var(--color-red-light)'}">${r.score}</td>
        <td style="color:var(--text-muted)">${escHtml(r.remark||'—')}</td>
      </tr>`).join('');
}

function updateDormStats(rows, ranked) {
  if (!ranked && rows) {
    const map = {};
    rows.forEach(r => { if (!map[r.dorm_no]) map[r.dorm_no] = []; map[r.dorm_no].push(r.score); });
    ranked = Object.entries(map).map(([dorm_no,scores]) => ({
      dorm_no, avg: round(scores.reduce((a,b)=>a+b,0)/scores.length)
    })).sort((a,b)=>b.avg-a.avg);
  }
  if (!ranked) return;
  const best = ranked[0];
  if (best) document.querySelector('#stat-best .stat-value').textContent = best.dorm_no;
  document.querySelector('#stat-count .stat-value').textContent = ranked.length;
  const vio = (rows||[]).filter(r=>r.score<90).length;
  document.querySelector('#stat-vio .stat-value').textContent = vio;
}

function toggleDeductItem(el, deduct) {
  const cb = el.querySelector('.deduct-check');
  if (cb) { cb.checked = !cb.checked; el.classList.toggle('checked', cb.checked); }
  calcDormScore();
}

function calcDormScore() {
  let total = 0;
  document.querySelectorAll('.deduct-check:checked').forEach(cb => {
    total += Number(cb.dataset.deduct || 0);
  });
  const input = document.getElementById('dorm-final-score');
  if (input) input.value = Math.max(0, 100 - total);
}

function openScoreModal() {
  document.getElementById('dorm-no-input').value = '';
  document.getElementById('dorm-date-input').value = formatDate(new Date());
  document.getElementById('dorm-final-score').value = 100;
  document.getElementById('dorm-remark').value = '';
  document.querySelectorAll('.deduct-check').forEach(cb => { cb.checked = false; cb.closest('.score-check-item')?.classList.remove('checked'); });
  openModal('dorm-score-modal');
}

async function saveDormScore() {
  const dormNo = document.getElementById('dorm-no-input').value.trim();
  const date   = document.getElementById('dorm-date-input').value;
  const score  = Number(document.getElementById('dorm-final-score').value);
  const remark = document.getElementById('dorm-remark').value.trim();

  if (!dormNo) { Toast.warning('请填写宿舍号'); return; }

  const reasons = [];
  document.querySelectorAll('.deduct-check:checked').forEach(cb => {
    reasons.push(cb.parentElement?.querySelector('.item-name')?.textContent);
  });

  const { error } = await DB.insert('dorm_scores', {
    class_id: _dormSession.classId, dorm_no: dormNo,
    date, score, remark: remark||null,
    deduct_reasons: reasons,
    recorder_id: _dormSession.userId,
  });

  if (error) { Toast.error('保存失败：'+error.message); return; }
  Toast.success('宿舍评分已保存');
  closeModal('dorm-score-modal');
  await loadDormData();
}
