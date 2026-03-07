/* ============================================================
   utils.js — 工具函数库
   日期处理 / 周次计算 / 格式化 / DOM 辅助
   班级管理系统 v1.0
   ============================================================ */

'use strict';

/* ============================================================
   一、日期工具
   ============================================================ */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 格式化为带星期的日期，如 "2026-03-05 周三"
 */
function formatDateWithWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${formatDate(d)} ${weekdays[d.getDay()]}`;
}

/**
 * 格式化为中文日期，如 "2026年3月5日"
 */
function formatDateCN(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 格式化时间为 HH:mm
 */
function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 格式化为 YYYY-MM-DD HH:mm
 */
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * 获取当前日期的 Date 对象（去除时分秒）
 */
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 判断是否是同一天
 */
function isSameDay(a, b) {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

/**
 * 获取指定月份的所有日期（Date 数组）
 */
function getDaysInMonth(year, month) {
  // month: 0-indexed
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days  = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

/**
 * 相对时间描述，如 "3分钟前"、"昨天"
 */
function timeAgo(date) {
  const d     = date instanceof Date ? date : new Date(date);
  const now   = new Date();
  const diff  = Math.floor((now - d) / 1000); // seconds

  if (diff < 60)    return '刚刚';
  if (diff < 3600)  return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 172800) return '昨天';
  return formatDate(d);
}

/* ============================================================
   二、周次工具
   ============================================================ */

/**
 * 根据学期配置计算当前周次
 * @param {string} semesterStart - 第1周周一的日期，如 "2026-02-24"
 * @param {Date}   targetDate    - 目标日期，默认今天
 * @returns {number} 周次（从1开始），超出学期返回 null
 */
function calcWeekNo(semesterStart, targetDate) {
  const start  = new Date(semesterStart);
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate || Date.now());

  // 对齐到周一
  const startMonday = new Date(start);
  startMonday.setHours(0, 0, 0, 0);

  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);

  const diffMs   = targetDay - startMonday;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  return Math.floor(diffDays / 7) + 1;
}

/**
 * 获取指定周次的开始（周一）和结束（周日）日期
 * @param {string} semesterStart - 第1周周一日期
 * @param {number} weekNo        - 周次（从1开始）
 * @returns {{ start: Date, end: Date }}
 */
function getWeekRange(semesterStart, weekNo) {
  const start = new Date(semesterStart);
  start.setHours(0, 0, 0, 0);
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNo - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { start: weekStart, end: weekEnd };
}

/**
 * 获取当前学期配置（从 localStorage 读取）
 */
function getCurrentSemester() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.semester);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 获取当前周次文本，如 "第3周"
 */
function getCurrentWeekText() {
  const sem = getCurrentSemester();
  if (!sem) return '—';
  const wk = calcWeekNo(sem.startDate);
  if (!wk || wk > sem.totalWeeks) return '假期';
  return `第 ${wk} 周`;
}

/**
 * 构建周次选项列表（用于下拉框）
 * @param {string} semesterStart
 * @param {number} totalWeeks
 * @returns {Array<{ value: number, label: string, start: string, end: string }>}
 */
function buildWeekOptions(semesterStart, totalWeeks) {
  const options = [];
  for (let i = 1; i <= totalWeeks; i++) {
    const range = getWeekRange(semesterStart, i);
    options.push({
      value: i,
      label: `第${i}周（${formatDate(range.start)} ~ ${formatDate(range.end)}）`,
      start: formatDate(range.start),
      end:   formatDate(range.end),
    });
  }
  return options;
}

/* ============================================================
   三、数字格式化
   ============================================================ */

/**
 * 格式化积分为 "+12" 或 "-5"
 */
function formatScore(score) {
  return score >= 0 ? `+${score}` : `${score}`;
}

/**
 * 格式化金额为 "¥1,234.56"
 */
function formatMoney(amount) {
  return '¥' + Number(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 格式化百分比，如 "96.5%"
 */
function formatPercent(value, total, decimals = 1) {
  if (!total) return '—';
  return (value / total * 100).toFixed(decimals) + '%';
}

/**
 * 四舍五入到指定小数位
 */
function round(num, decimals = 1) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/* ============================================================
   四、字符串工具
   ============================================================ */

/**
 * 手机号脱敏：138****0001
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/**
 * 身份证脱敏：110***********0001
 */
function maskIdCard(id) {
  if (!id || id.length < 6) return id;
  return id.slice(0, 3) + '*'.repeat(id.length - 7) + id.slice(-4);
}

/**
 * 提取姓名首字（用于头像）
 */
function getInitial(name) {
  return name ? name.charAt(0) : '?';
}

/**
 * 生成随机 ID（用于临时数据）
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   五、DOM 辅助
   ============================================================ */

/**
 * 简化 querySelector
 */
function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 简化 querySelectorAll（返回 Array）
 */
function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * 创建 DOM 元素
 * @param {string} tag
 * @param {object} attrs  - 属性键值对
 * @param {string} html   - innerHTML
 */
function createElement(tag, attrs = {}, html = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  });
  if (html) el.innerHTML = html;
  return el;
}

/**
 * 构建 <select> 的 option HTML
 */
function buildOptions(list, valueKey, labelKey, selected = '') {
  return list.map(item => {
    const val = typeof item === 'object' ? item[valueKey] : item;
    const lbl = typeof item === 'object' ? item[labelKey] : item;
    const sel = val == selected ? ' selected' : '';
    return `<option value="${escHtml(String(val))}"${sel}>${escHtml(String(lbl))}</option>`;
  }).join('');
}

/**
 * HTML 转义（防 XSS）
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 防抖
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流
 */
function throttle(fn, interval = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/* ============================================================
   六、Toast 全局提示
   ============================================================ */

(function initToast() {
  if (document.getElementById('toast-container')) return;
  const container = createElement('div', { id: 'toast-container', class: 'toast-container' });
  document.body.appendChild(container);
})();

/**
 * 显示 Toast 提示
 * @param {string} msg
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration  毫秒，0 = 不自动关闭
 */
function showToast(msg, type = 'info', duration = 3000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = createElement('div', { class: `toast ${type}` },
    `<span class="toast-icon">${icons[type] || 'ℹ️'}</span>
     <span class="toast-msg">${escHtml(msg)}</span>`
  );

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

const Toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error:   (msg, d) => showToast(msg, 'error', d),
  warning: (msg, d) => showToast(msg, 'warning', d),
  info:    (msg, d) => showToast(msg, 'info', d),
};

/* ============================================================
   七、Modal 工具
   ============================================================ */

/**
 * 打开模态框
 */
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

/**
 * 关闭模态框
 */
function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

/**
 * 点击遮罩关闭
 */
function initModalClose() {
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('open');
    });
  });
}

/* ============================================================
   八、数据校验
   ============================================================ */

const Validate = {
  required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
  phone:    (v) => /^1[3-9]\d{9}$/.test(v),
  idCard:   (v) => /^\d{17}[\dXx]$/.test(v),
  number:   (v) => !isNaN(parseFloat(v)) && isFinite(v),
  range:    (v, min, max) => Number(v) >= min && Number(v) <= max,
};

/* ============================================================
   九、本地存储辅助
   ============================================================ */

const Storage = {
  get(key, defaultVal = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : defaultVal;
    } catch {
      return defaultVal;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};
