/* ============================================================
   layout.js — 侧边栏渲染 / 导航切换 / 顶栏更新
   班级管理系统 v1.0

   依赖：config.js / utils.js / auth.js
   在每个 pages/*.html 的 <body> 末尾引入并调用 initLayout()
   ============================================================ */

'use strict';

/* ============================================================
   一、布局初始化入口
   ============================================================ */

/**
 * 初始化整个 Layout（每个 pages/*.html 调用一次）
 * @param {object} options
 * @param {string}   options.pageId    - 当前页面标识，如 'dashboard'
 * @param {Function} [options.onReady] - layout 渲染完毕回调
 */
function initLayout(options = {}) {
  const session = requireAuth(); // 未登录则跳转
  if (!session) return;

  const { pageId = '', onReady } = options;

  renderSidebarLogo();
  renderSidebarUser(session);
  renderSidebarNav(session, pageId);
  renderSidebarFooter(session);
  renderTopbar(pageId, session);
  initMobileMenu();

  if (typeof onReady === 'function') onReady(session);
}

/* ============================================================
   二、侧边栏 — Logo
   ============================================================ */
function renderSidebarLogo() {
  const el = document.getElementById('sidebar-logo');
  if (!el) return;
  el.innerHTML = `
    <div class="sidebar-logo-icon">🏫</div>
    <div class="sidebar-logo-text">
      <div class="logo-main">${APP_CONFIG.name}</div>
      <div class="logo-sub">${APP_CONFIG.version}</div>
    </div>
  `;
}

/* ============================================================
   三、侧边栏 — 用户信息
   ============================================================ */
function renderSidebarUser(session) {
  const el = document.getElementById('sidebar-user');
  if (!el) return;

  const initial = getInitial(session.name);
  const roleLabel = ROLES[session.role]?.label || session.role;

  el.innerHTML = `
    <div class="user-avatar"
         style="background: ${session.avatarGradient}">
      ${escHtml(initial)}
    </div>
    <div class="user-info">
      <div class="user-name">${escHtml(session.name)}</div>
      <span class="role-badge ${session.role}">${roleLabel}</span>
    </div>
  `;
}

/* ============================================================
   四、侧边栏 — 导航菜单
   ============================================================ */
function renderSidebarNav(session, currentPageId) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const roleConfig = ROLES[session.role];
  if (!roleConfig) return;

  let html = '';
  roleConfig.nav.forEach(section => {
    html += `<div class="nav-section-label">${section.section}</div>`;
    section.items.forEach(item => {
      const isActive = item.id === currentPageId;
      const badgeHtml = item.badge
        ? `<span class="nav-badge" id="nav-badge-${item.id}">—</span>`
        : '';
      html += `
        <div class="nav-item ${isActive ? 'active' : ''}"
             data-page="${item.page}"
             data-id="${item.id}"
             onclick="navigateTo('${item.page}')">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${badgeHtml}
        </div>
      `;
    });
  });

  nav.innerHTML = html;
}

/* ============================================================
   五、侧边栏 — 底部（学期信息 + 退出按钮）
   ============================================================ */
function renderSidebarFooter(session) {
  const el = document.getElementById('sidebar-footer');
  if (!el) return;

  const sem = getCurrentSemester();
  const semName = sem?.semesterName || '暂未配置学期';
  const weekText = sem ? getCurrentWeekText() : '—';

  el.innerHTML = `
    <div class="semester-info">
      <div class="semester-name">${escHtml(semName)}</div>
      <div class="semester-week">${weekText} · ${escHtml(session.classNo || '—')}</div>
    </div>
    <button class="btn-logout" onclick="handleLogout()">
      🚪 退出登录
    </button>
  `;
}

/* ============================================================
   六、顶栏
   ============================================================ */
function renderTopbar(pageId, session) {
  // 标题
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    const filename = pageId ? `${pageId}.html` : '';
    titleEl.textContent = PAGE_TITLES[filename] || '—';
  }

  // 副标题
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) {
    const sem = getCurrentSemester();
    const weekText = sem ? getCurrentWeekText() : '';
    const classNo  = session.classNo || '';
    const dateStr  = formatDateWithWeekday(new Date());
    subtitleEl.textContent = [classNo, weekText, dateStr].filter(Boolean).join(' · ');
  }

  // 通知红点
  updateNotifDot();
}

/* ============================================================
   七、通知红点
   ============================================================ */
function updateNotifDot() {
  const dot = document.getElementById('topbar-notif-dot');
  // 这里简单判断是否有未读通知（从 localStorage 缓存）
  const hasUnread = Storage.get('cms_unread_notice', 0) > 0;
  if (dot) dot.style.display = hasUnread ? 'block' : 'none';
}

/**
 * 更新导航栏 badge 数字
 * @param {string} pageId  - nav item 的 id
 * @param {number} count
 */
function updateNavBadge(pageId, count) {
  const badge = document.getElementById(`nav-badge-${pageId}`);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================================
   八、页面跳转
   ============================================================ */

/**
 * 跳转到指定页面（带过渡动画）
 * @param {string} page - 页面文件名，如 'dashboard.html'
 */
function navigateTo(page) {
  const overlay = document.getElementById('page-transition');
  if (overlay) {
    overlay.classList.add('active');
    setTimeout(() => {
      window.location.href = page;
    }, 280);
  } else {
    window.location.href = page;
  }
}

/* ============================================================
   九、退出登录
   ============================================================ */
async function handleLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  await doLogout();
}

/* ============================================================
   十、移动端菜单
   ============================================================ */
function initMobileMenu() {
  const menuBtn  = document.getElementById('mobile-menu-btn');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('visible');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

/* ============================================================
   十一、子标签页（sub-tabs）切换
   ============================================================ */

/**
 * 初始化页面内 sub-tabs 切换
 * @param {string} tabsWrapperId  - .sub-tabs 的父容器 ID
 * @param {Function} onSwitch     - (tabId) => void 切换回调
 */
function initSubTabs(tabsWrapperId, onSwitch) {
  const wrap = document.getElementById(tabsWrapperId);
  if (!wrap) return;

  wrap.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      wrap.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (typeof onSwitch === 'function') onSwitch(tab.dataset.tab);
    });
  });
}

/* ============================================================
   十二、通用 HTML 模板助手
   ============================================================ */

/**
 * 渲染统计卡片
 */
function renderStatCard(icon, color, value, label, trend = '', trendType = 'neutral') {
  return `
    <div class="stat-card ${color}">
      <div class="stat-top">
        <div class="stat-icon ${color}">${icon}</div>
        ${trend ? `<span class="stat-trend ${trendType}">${trend}</span>` : ''}
      </div>
      <div class="stat-value">${escHtml(String(value))}</div>
      <div class="stat-label">${escHtml(label)}</div>
    </div>
  `;
}

/**
 * 渲染带进度条的科目成绩行
 */
function renderScoreRow(subject, score, max, color = 'teal') {
  const pct = max > 0 ? (score / max * 100).toFixed(1) : 0;
  return `
    <div class="progress-labeled">
      <div class="progress-labeled-header">
        <span class="label">${escHtml(subject)}</span>
        <span class="value">${score} / ${max}</span>
      </div>
      <div class="progress">
        <div class="progress-bar ${color}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

/**
 * 渲染 badge
 */
function renderBadge(text, cls) {
  return `<span class="badge ${cls}">${escHtml(text)}</span>`;
}

/**
 * 渲染考勤状态 badge
 */
function renderAttBadge(status) {
  const map = ATTENDANCE_STATUS_MAP[status] || { label: status, badgeClass: 'badge-neutral' };
  return renderBadge(map.label, map.badgeClass);
}

/**
 * 渲染表格空状态
 */
function renderTableEmpty(msg = '暂无数据') {
  return `<tr><td class="table-empty" colspan="99">${escHtml(msg)}</td></tr>`;
}

/**
 * 渲染列表项头像
 */
function renderListAvatar(name, size = '') {
  const bg = getAvatarColor(name);
  const sizeClass = size ? `list-avatar-${size}` : '';
  return `
    <div class="list-avatar ${sizeClass}" style="background:${bg}">
      ${escHtml(getInitial(name))}
    </div>
  `;
}
