/* ============================================================
   fund.js — 班费管理模块
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _fundSession = null;
let _records     = [];   // 全部收支记录
let _filtered    = [];
let _editingId   = null;

/* ---------- 统计 ---------- */
function calcFundStat(records) {
  const income  = records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  return { income, expense, balance: income - expense };
}

/* ============================================================
   入口
   ============================================================ */
async function initFund(session) {
  _fundSession = session;
  const el = document.getElementById('page-content');
  if (!el) return;

  const canEdit = ['teacher'].includes(session.role);
  const canView = ['teacher','cadre'].includes(session.role);

  // 权限检查
  if (!canView) {
    el.innerHTML = `
      <div class="empty-state" style="padding:80px 0;">
        <div class="empty-state-icon">🔒</div>
        <div class="empty-state-title">暂无权限</div>
        <div class="empty-state-desc">班费管理仅对班主任和班干部开放</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1>班费管理</h1>
          <p>收支记账、余额统计、明细导出</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary btn-sm" onclick="exportFund()">📤 导出明细</button>
          ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="showFundModal()">+ 记一笔</button>` : ''}
        </div>
      </div>
    </div>

    <!-- 统计卡片（动态渲染） -->
    <div id="fund-stat-cards" class="grid-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;"></div>

    <!-- 标签页 -->
    <div class="sub-tabs" id="fund-tabs">
      <div class="sub-tab active" data-tab="all">📋 全部记录</div>
      <div class="sub-tab" data-tab="income">💰 收入</div>
      <div class="sub-tab" data-tab="expense">💸 支出</div>
      <div class="sub-tab" data-tab="chart">📊 统计图表</div>
    </div>

    <!-- 工具栏 -->
    <div class="card" style="margin-bottom:16px;padding:14px 20px;">
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="month" class="form-input" style="width:160px"
            id="fund-filter-month" value="${formatDate(new Date()).slice(0,7)}"
            onchange="applyFundFilter()">
          <select class="form-select" style="width:130px" id="fund-filter-type" onchange="applyFundFilter()">
            <option value="">全部类型</option>
            ${FUND_CATEGORIES.income.map(c=>`<option value="income:${c}">${c}</option>`).join('')}
            ${FUND_CATEGORIES.expense.map(c=>`<option value="expense:${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <div class="search-input">
            <span class="search-icon">🔍</span>
            <input class="form-input" style="width:200px" id="fund-search"
              placeholder="搜索摘要"
              oninput="debounce(applyFundFilter, 250)()">
          </div>
        </div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="card" id="fund-list-card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>日期</th>
              <th>类型</th>
              <th>分类</th>
              <th>金额（元）</th>
              <th>摘要</th>
              <th>经手人</th>
              ${canEdit ? '<th>操作</th>' : ''}
            </tr>
          </thead>
          <tbody id="fund-tbody">
            <tr><td colspan="7" class="table-empty">加载中…</td></tr>
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px;">
        <div style="font-size:13px;color:var(--text-muted);" id="fund-table-info"></div>
        <div id="fund-pagination" class="pagination"></div>
      </div>
    </div>

    <!-- 收支 Modal -->
    ${canEdit ? `
    <div class="modal-overlay" id="modal-fund">
      <div class="modal modal-sm">
        <div class="modal-header">
          <div class="modal-title" id="modal-fund-title">记一笔</div>
          <button class="modal-close" onclick="closeModal('modal-fund')">✕</button>
        </div>
        <div class="modal-body">

          <!-- 收/支切换 -->
          <div class="sub-tabs" id="fund-type-tabs" style="margin-bottom:16px;">
            <div class="sub-tab active" data-tab="income" style="flex:1;text-align:center;"
              onclick="setFundType('income')">💰 收入</div>
            <div class="sub-tab" data-tab="expense" style="flex:1;text-align:center;"
              onclick="setFundType('expense')">💸 支出</div>
          </div>

          <div class="form-group">
            <label class="form-label">金额（元）<span class="required">*</span></label>
            <input type="number" class="form-input" id="f-amount" min="0" step="0.01" placeholder="如：100.00">
          </div>
          <div class="form-group">
            <label class="form-label">分类 <span class="required">*</span></label>
            <select class="form-select" id="f-category">
              <option value="">请选择</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">日期</label>
            <input type="date" class="form-input" id="f-date" value="${formatDate(new Date())}">
          </div>
          <div class="form-group">
            <label class="form-label">摘要 <span class="required">*</span></label>
            <input class="form-input" id="f-desc" placeholder="如：班费收取、购置文具…">
          </div>
          <div class="form-group">
            <label class="form-label">凭证图片（可选）</label>
            <input type="file" accept="image/*" class="form-input" id="f-receipt" style="font-size:12px;">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('modal-fund')">取消</button>
          <button class="btn btn-primary" id="btn-save-fund" onclick="saveFundRecord()">保存</button>
        </div>
      </div>
    </div>` : ''}
  `;

  initModalClose();
  initSubTabs('fund-tabs', switchFundTab);

  // 初始化收支类型为 income
  setFundType('income');

  await loadFundRecords();
}

/* ============================================================
   数据加载
   ============================================================ */
async function loadFundRecords() {
  const { data, error } = await DB.query('fund_records', {
    match: { class_id: _fundSession.classId },
    order: { col: 'date', asc: false },
  });
  _records  = (data && data.length > 0) ? data : MOCK_FUND_RECORDS;
  _filtered = [..._records];
  renderStatCards();
  renderFundTable(_filtered);
}

/* ============================================================
   统计卡片
   ============================================================ */
function renderStatCards() {
  const el = document.getElementById('fund-stat-cards');
  if (!el) return;

  const { income, expense, balance } = calcFundStat(_filtered);

  el.innerHTML = `
    ${renderStatCard('💰', 'green',  formatMoney(income),  '累计收入', '', '')}
    ${renderStatCard('💸', 'red',    formatMoney(expense), '累计支出', '', '')}
    ${renderStatCard('🏦', balance >= 0 ? 'teal' : 'gold',
                          formatMoney(balance), '当前余额',
                          balance >= 0 ? '健康' : '⚠️注意', 'neutral')}
  `;
}

/* ============================================================
   筛选 & 标签切换
   ============================================================ */
let _activeTab = 'all';

function switchFundTab(tab) {
  _activeTab = tab;
  if (tab === 'chart') { renderChartPanel(); return; }
  applyFundFilter();
}

function applyFundFilter() {
  const month    = document.getElementById('fund-filter-month')?.value || '';
  const typeVal  = document.getElementById('fund-filter-type')?.value || '';
  const kw       = (document.getElementById('fund-search')?.value || '').trim().toLowerCase();
  const [typeF, catF] = typeVal.split(':');

  _filtered = _records.filter(r => {
    const matchTab    = _activeTab === 'all' || r.type === _activeTab;
    const matchMonth  = !month  || r.date.startsWith(month);
    const matchType   = !typeF  || r.type === typeF;
    const matchCat    = !catF   || r.category === catF;
    const matchKw     = !kw     || (r.description || r.desc || '').toLowerCase().includes(kw);
    return matchTab && matchMonth && matchType && matchCat && matchKw;
  });

  renderStatCards();
  renderFundTable(_filtered);
}

/* ============================================================
   渲染表格
   ============================================================ */
const FUND_PAGE_SIZE = 20;
let _fundPage = 1;

function renderFundTable(records) {
  const tbody = document.getElementById('fund-tbody');
  const info  = document.getElementById('fund-table-info');
  const pgWrap = document.getElementById('fund-pagination');
  if (!tbody) return;

  const canEdit = ['teacher'].includes(_fundSession?.role);
  const total   = records.length;
  const pages   = Math.ceil(total / FUND_PAGE_SIZE) || 1;
  const start   = (_fundPage - 1) * FUND_PAGE_SIZE;
  const page    = records.slice(start, start + FUND_PAGE_SIZE);

  if (info) info.textContent = `共 ${total} 条记录`;

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">${renderTableEmpty('暂无记录')}</td></tr>`;
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }

  const { income, expense } = calcFundStat(records);
  // 底部汇总行
  const summary = `
    <tr style="background:rgba(14,165,233,0.06);font-weight:600;">
      <td colspan="3" style="text-align:right;font-size:12px;color:var(--text-muted);">本页合计</td>
      <td>
        <span style="color:var(--color-green);">+${formatMoney(income)}</span>
        <span style="color:var(--text-muted);margin:0 6px;">/</span>
        <span style="color:var(--color-red-light);">-${formatMoney(expense)}</span>
      </td>
      <td colspan="${canEdit ? 3 : 2}"></td>
    </tr>`;

  tbody.innerHTML = page.map(r => `
    <tr id="fund-row-${r.id}">
      <td>${escHtml(r.date)}</td>
      <td>
        <span class="badge ${r.type === 'income' ? 'badge-success' : 'badge-danger'}">
          ${r.type === 'income' ? '💰 收入' : '💸 支出'}
        </span>
      </td>
      <td>${escHtml(r.category || '其他')}</td>
      <td class="td-num" style="font-weight:700;color:${r.type === 'income' ? 'var(--color-green)' : 'var(--color-red-light)'};">
        ${r.type === 'income' ? '+' : '-'}${formatMoney(Number(r.amount))}
      </td>
      <td>${escHtml(r.description || r.desc || '—')}</td>
      <td>${escHtml(r.recorder_name || r.handler || '—')}</td>
      ${canEdit ? `<td>
        <span style="color:var(--color-teal);cursor:pointer;font-size:12px;margin-right:8px;"
          onclick="editFundRecord('${r.id}')">编辑</span>
        <span style="color:var(--color-red-light);cursor:pointer;font-size:12px;"
          onclick="deleteFundRecord('${r.id}')">删除</span>
      </td>` : ''}
    </tr>`).join('') + summary;

  // 分页
  if (pgWrap) {
    let html = `<button class="page-btn" onclick="fundGoPage(${_fundPage-1})" ${_fundPage===1?'disabled':''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button class="page-btn ${i===_fundPage?'active':''}" onclick="fundGoPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="fundGoPage(${_fundPage+1})" ${_fundPage===pages?'disabled':''}>›</button>`;
    pgWrap.innerHTML = html;
  }
}

function fundGoPage(p) {
  const pages = Math.ceil(_filtered.length / FUND_PAGE_SIZE) || 1;
  if (p < 1 || p > pages) return;
  _fundPage = p;
  renderFundTable(_filtered);
}

/* ============================================================
   图表统计面板
   ============================================================ */
function renderChartPanel() {
  const panel = document.getElementById('fund-list-card');
  if (!panel) return;

  // 按月聚合
  const monthMap = {};
  _records.forEach(r => {
    const m = r.date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { income: 0, expense: 0 };
    if (r.type === 'income')  monthMap[m].income  += Number(r.amount);
    if (r.type === 'expense') monthMap[m].expense += Number(r.amount);
  });
  const months  = Object.keys(monthMap).sort();
  const maxVal  = Math.max(...months.map(m => Math.max(monthMap[m].income, monthMap[m].expense)), 1);

  // 按分类聚合（支出）
  const catMap = {};
  _records.filter(r => r.type === 'expense').forEach(r => {
    const cat = r.category || '其他';
    catMap[cat] = (catMap[cat] || 0) + Number(r.amount);
  });
  const cats    = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catMax  = cats[0]?.[1] || 1;

  panel.innerHTML = `
    <div class="grid-2">
      <!-- 月度收支柱状图 -->
      <div class="card">
        <div class="card-header"><div class="card-title">📊 月度收支对比</div></div>
        <div style="display:flex;align-items:flex-end;gap:16px;height:160px;padding:10px 0;">
          ${months.map(m => {
            const d     = monthMap[m];
            const ih    = Math.round(d.income  / maxVal * 140);
            const eh    = Math.round(d.expense / maxVal * 140);
            const label = m.slice(5) + '月';
            return `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
                <div style="font-size:10px;color:var(--color-green);font-weight:600;">
                  +${formatMoney(d.income)}
                </div>
                <div style="width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px;height:120px;">
                  <div title="收入 ${formatMoney(d.income)}"
                    style="flex:1;height:${ih}px;min-height:2px;background:var(--color-green);opacity:0.8;border-radius:3px 3px 0 0;transition:height 0.6s ease;">
                  </div>
                  <div title="支出 ${formatMoney(d.expense)}"
                    style="flex:1;height:${eh}px;min-height:2px;background:var(--color-red-light);opacity:0.8;border-radius:3px 3px 0 0;transition:height 0.6s ease;">
                  </div>
                </div>
                <div style="font-size:10px;color:var(--text-muted);">${label}</div>
              </div>`;
          }).join('') || '<div style="margin:auto;color:var(--text-muted);font-size:13px;">暂无数据</div>'}
        </div>
        <div style="display:flex;gap:16px;justify-content:center;font-size:11px;color:var(--text-muted);margin-top:4px;">
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--color-green);border-radius:2px;margin-right:4px;"></span>收入</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:var(--color-red-light);border-radius:2px;margin-right:4px;"></span>支出</span>
        </div>
      </div>

      <!-- 支出分类排行 -->
      <div class="card">
        <div class="card-header"><div class="card-title">💸 支出分类占比</div></div>
        ${cats.length === 0
          ? '<div class="empty-state" style="border:none;padding:20px;"><div class="empty-state-desc">暂无支出数据</div></div>'
          : cats.map(([cat, amt], i) => {
              const colors = ['teal','gold','purple','orange','green','red'];
              return `
                <div class="progress-labeled" style="margin-bottom:12px;">
                  <div class="progress-labeled-header">
                    <span class="label">${escHtml(cat)}</span>
                    <span class="value">${formatMoney(amt)}</span>
                  </div>
                  <div class="progress">
                    <div class="progress-bar ${colors[i % colors.length]}"
                      style="width:${round(amt / catMax * 100, 0)}%"></div>
                  </div>
                </div>`;
            }).join('')}
      </div>
    </div>

    <!-- 余额走势 -->
    <div class="card" style="margin-top:16px;">
      <div class="card-header"><div class="card-title">🏦 余额走势</div></div>
      <div style="display:flex;align-items:center;gap:12px;overflow-x:auto;padding-bottom:8px;">
        ${buildBalanceTrend()}
      </div>
    </div>
  `;
}

function buildBalanceTrend() {
  // 按日期排序，计算累计余额
  const sorted  = [..._records].sort((a, b) => a.date.localeCompare(b.date));
  let   balance = 0;
  const points  = sorted.map(r => {
    balance += r.type === 'income' ? Number(r.amount) : -Number(r.amount);
    return { date: r.date, balance, type: r.type, desc: r.description || r.desc };
  });

  if (!points.length) return '<div style="color:var(--text-muted);font-size:13px;padding:20px;">暂无数据</div>';

  const maxB = Math.max(...points.map(p => Math.abs(p.balance)), 1);

  return points.slice(-12).map(p => {
    const h   = Math.round(Math.abs(p.balance) / maxB * 80);
    const pos = p.balance >= 0;
    return `
      <div style="flex:0 0 auto;text-align:center;min-width:60px;">
        <div style="font-size:11px;font-weight:600;color:${pos?'var(--color-green)':'var(--color-red-light)'};">
          ${formatMoney(p.balance)}
        </div>
        <div style="height:${h+6}px;min-height:6px;background:${pos?'var(--color-green)':'var(--color-red-light)'};
          opacity:0.7;border-radius:3px;margin:4px 8px;transition:height 0.6s ease;">
        </div>
        <div style="font-size:9px;color:var(--text-muted);">${p.date.slice(5)}</div>
        <div style="font-size:9px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px;">
          ${escHtml((p.desc||'').slice(0,4))}
        </div>
      </div>`;
  }).join('');
}

/* ============================================================
   Modal 操作
   ============================================================ */
let _currentFundType = 'income';

function setFundType(type) {
  _currentFundType = type;
  // 更新 tab 样式
  document.querySelectorAll('#fund-type-tabs .sub-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === type);
  });
  // 更新分类选项
  const sel = document.getElementById('f-category');
  if (!sel) return;
  const cats = FUND_CATEGORIES[type] || [];
  sel.innerHTML = '<option value="">请选择分类</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  // 更新按钮颜色
  const btn = document.getElementById('btn-save-fund');
  if (btn) {
    btn.style.background = type === 'income'
      ? 'linear-gradient(135deg,var(--color-green),#059669)'
      : 'linear-gradient(135deg,var(--color-red-light),#dc2626)';
  }
}

function showFundModal() {
  _editingId = null;
  document.getElementById('modal-fund-title').textContent = '记一笔';
  document.getElementById('f-amount').value  = '';
  document.getElementById('f-desc').value    = '';
  document.getElementById('f-date').value    = formatDate(new Date());
  setFundType('income');
  openModal('modal-fund');
}

function editFundRecord(id) {
  const r = _records.find(x => x.id === id);
  if (!r) return;
  _editingId = id;
  document.getElementById('modal-fund-title').textContent = '编辑记录';
  document.getElementById('f-amount').value  = r.amount;
  document.getElementById('f-date').value    = r.date;
  document.getElementById('f-desc').value    = r.description || r.desc || '';
  setFundType(r.type);
  setTimeout(() => {
    const sel = document.getElementById('f-category');
    if (sel) sel.value = r.category || '';
  }, 50);
  openModal('modal-fund');
}

async function saveFundRecord() {
  const amount   = parseFloat(document.getElementById('f-amount')?.value);
  const category = document.getElementById('f-category')?.value;
  const date     = document.getElementById('f-date')?.value;
  const desc     = document.getElementById('f-desc')?.value.trim();

  if (!amount || amount <= 0) { Toast.warning('请输入有效金额'); return; }
  if (!category)              { Toast.warning('请选择分类'); return; }
  if (!desc)                  { Toast.warning('请填写摘要'); return; }

  const record = {
    class_id:     _fundSession.classId,
    type:         _currentFundType,
    amount:       round(amount, 2),
    category,
    date:         date || formatDate(new Date()),
    description:  desc,
    recorder_id:  _fundSession.userId,
    recorder_name: _fundSession.name,
  };

  if (_editingId) {
    const { error } = await DB.update('fund_records', _editingId, record);
    const idx = _records.findIndex(r => r.id === _editingId);
    if (idx > -1) _records[idx] = { ..._records[idx], ...record };
    Toast.success('记录已更新');
  } else {
    const { data, error } = await DB.insert('fund_records', record);
    _records.unshift({ ...record, id: data?.[0]?.id || genId() });
    Toast.success(`已记录：${_currentFundType === 'income' ? '+' : '-'}${formatMoney(amount)} 元`);
  }

  _records.sort((a, b) => b.date.localeCompare(a.date));
  _filtered = [..._records];
  closeModal('modal-fund');
  renderStatCards();
  renderFundTable(_filtered);
}

async function deleteFundRecord(id) {
  if (!confirm('确定删除该记录？')) return;
  await DB.delete('fund_records', id);
  _records  = _records.filter(r => r.id !== id);
  _filtered = _filtered.filter(r => r.id !== id);
  renderStatCards();
  renderFundTable(_filtered);
  Toast.success('已删除');
}

/* ============================================================
   导出
   ============================================================ */
function exportFund() {
  if (!_filtered.length) { Toast.warning('没有可导出的数据'); return; }

  const { income, expense, balance } = calcFundStat(_filtered);
  const headers = ['日期','类型','分类','金额（元）','摘要','经手人'];
  const rows    = _filtered.map(r => [
    r.date,
    r.type === 'income' ? '收入' : '支出',
    r.category || '',
    r.type === 'income' ? `+${r.amount}` : `-${r.amount}`,
    r.description || r.desc || '',
    r.recorder_name || r.handler || '',
  ]);
  // 汇总行
  rows.push([]);
  rows.push(['汇总','','','','收入合计', formatMoney(income)]);
  rows.push(['',   '','','','支出合计', formatMoney(expense)]);
  rows.push(['',   '','','','当前余额', formatMoney(balance)]);

  exportToExcel([headers, ...rows], `班费明细_${_fundSession?.classNo || ''}`);
}

/* ============================================================
   分类配置 & Mock 数据
   ============================================================ */
const FUND_CATEGORIES = {
  income:  ['班费收取','活动募集','补助拨款','个人捐赠','其他收入'],
  expense: ['文具耗材','活动经费','劳动用品','奖品奖励','打印复印','聚餐联欢','应急备用','其他支出'],
};

const MOCK_FUND_RECORDS = [
  { id:'f01', type:'income',  category:'班费收取',  amount:2500, date:'2026-02-25', description:'第二学期班费收取（50人×50元）',   recorder_name:'班主任' },
  { id:'f02', type:'income',  category:'补助拨款',  amount:200,  date:'2026-02-28', description:'学校活动专项补助',                  recorder_name:'班主任' },
  { id:'f03', type:'expense', category:'劳动用品',  amount:85,   date:'2026-03-01', description:'购置清洁用具（拖把、垃圾袋等）',    recorder_name:'生活委员' },
  { id:'f04', type:'expense', category:'文具耗材',  amount:120,  date:'2026-03-03', description:'购买粉笔、板擦、打印纸',            recorder_name:'学习委员' },
  { id:'f05', type:'expense', category:'打印复印',  amount:56,   date:'2026-03-05', description:'期中考试复习资料打印（56份）',      recorder_name:'学习委员' },
  { id:'f06', type:'income',  category:'活动募集',  amount:300,  date:'2026-03-06', description:'春游活动自愿募集',                  recorder_name:'班主任' },
  { id:'f07', type:'expense', category:'活动经费',  amount:450,  date:'2026-03-06', description:'春游门票预定（50人×9元）',         recorder_name:'班主任' },
  { id:'f08', type:'expense', category:'奖品奖励',  amount:200,  date:'2026-02-26', description:'元旦晚会获奖礼品采购',              recorder_name:'文艺委员' },
  { id:'f09', type:'income',  category:'班费收取',  amount:100,  date:'2026-03-04', description:'补收班费（2名同学）',               recorder_name:'班主任' },
  { id:'f10', type:'expense', category:'文具耗材',  amount:38,   date:'2026-03-02', description:'购买荣誉栏装饰材料',                recorder_name:'宣传委员' },
];
