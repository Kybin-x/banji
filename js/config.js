/* ============================================================
   config.js — 常量 / 角色配置 / 路由表
   班级管理系统 v1.0
   ============================================================ */

'use strict';

/* ---------- 系统基础信息 ---------- */
const APP_CONFIG = {
  name: '班级管理系统',
  version: 'v1.0',
  subName: 'CLASS MANAGEMENT SYSTEM',
};

/* ---------- Supabase 配置（在 supabase.js 中使用） ---------- */
const SUPABASE_CONFIG = {
  url: 'https://mjugidbhmjbochcdnkmr.supabase.co',
  anonKey: 'sb_publishable_08ayrgCPHKzv9azN0IZszQ_l9877HbV',
};

/**
 * 演示模式开关
 * true  = Mock数据，无需Supabase账号，直接用预设账号登录
 * false = 真实Supabase认证（需先在数据库创建用户）
 */
const DEMO_MODE = false;

/* ---------- 路由表（页面路径） ---------- */
const ROUTES = {
  login: '../index.html',
  dashboard: 'dashboard.html',
  students: 'students.html',
  attendance: 'attendance.html',
  score: 'score.html',
  points: 'points.html',
  dorm: 'dorm.html',
  seat: 'seat.html',
  duty: 'duty.html',
  notice: 'notice.html',
  settings: 'settings.html',
};

/* ---------- 页面标题映射 ---------- */
const PAGE_TITLES = {
  'dashboard.html': '工作台',
  'students.html': '学生信息管理',
  'attendance.html': '考勤管理',
  'score.html': '成绩管理',
  'points.html': '积分/量化管理',
  'dorm.html': '宿舍管理',
  'seat.html': '座位管理',
  'duty.html': '值日管理',
  'notice.html': '班级通知',
  'settings.html': '系统设置',
};

/* ---------- 角色定义 ---------- */
const ROLES = {
  teacher: {
    key: 'teacher',
    label: '班主任',
    badgeClass: 'teacher',
    avatarGradient: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
    loginHint: '',
    nav: [
      {
        section: '概览',
        items: [
          { id: 'dashboard', icon: '🏠', label: '工作台', page: 'dashboard.html' },
          { id: 'notice', icon: '📢', label: '班级通知', page: 'notice.html', badge: true },
        ],
      },
      {
        section: '学生管理',
        items: [
          { id: 'students', icon: '👥', label: '学生信息', page: 'students.html' },
          { id: 'attendance', icon: '📋', label: '考勤管理', page: 'attendance.html' },
          { id: 'score', icon: '📊', label: '成绩管理', page: 'score.html' },
          { id: 'points', icon: '⭐', label: '积分/量化', page: 'points.html' },
        ],
      },
      {
        section: '班级管理',
        items: [
          { id: 'dorm', icon: '🏠', label: '宿舍管理', page: 'dorm.html' },
          { id: 'seat', icon: '🪑', label: '座位管理', page: 'seat.html' },
          { id: 'duty', icon: '🧹', label: '值日管理', page: 'duty.html' },
        ],
      },
      {
        section: '系统',
        items: [
          { id: 'settings', icon: '⚙️', label: '系统设置', page: 'settings.html' },
        ],
      },
    ],
  },

  cadre: {
    key: 'cadre',
    label: '班干部',
    badgeClass: 'cadre',
    avatarGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    loginHint: '初始密码：身份证后4位',
    nav: [
      {
        section: '概览',
        items: [
          { id: 'dashboard', icon: '🏠', label: '工作台', page: 'dashboard.html' },
          { id: 'notice', icon: '📢', label: '班级通知', page: 'notice.html', badge: true },
        ],
      },
      {
        section: '我的职责',
        items: [
          { id: 'attendance', icon: '📋', label: '考勤登记', page: 'attendance.html' },
          { id: 'points', icon: '⭐', label: '积分登记', page: 'points.html' },
        ],
      },
    ],
  },

  student: {
    key: 'student',
    label: '学生',
    badgeClass: 'student',
    avatarGradient: 'linear-gradient(135deg, #10b981, #059669)',
    loginHint: '初始密码：身份证后4位',
    nav: [
      {
        section: '我的',
        items: [
          { id: 'dashboard', icon: '🏠', label: '个人主页', page: 'dashboard.html' },
          { id: 'notice', icon: '📢', label: '班级通知', page: 'notice.html', badge: true },
        ],
      },
      {
        section: '查看',
        items: [
          { id: 'attendance', icon: '📋', label: '我的考勤', page: 'attendance.html' },
          { id: 'score', icon: '📊', label: '我的成绩', page: 'score.html' },
          { id: 'points', icon: '⭐', label: '我的积分', page: 'points.html' },
          { id: 'seat', icon: '🪑', label: '座位表', page: 'seat.html' },
          { id: 'duty', icon: '🧹', label: '值日安排', page: 'duty.html' },
        ],
      },
    ],
  },

  parent: {
    key: 'parent',
    label: '家长',
    badgeClass: 'parent',
    avatarGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    loginHint: '初始密码：身份证后4位',
    nav: [
      {
        section: '子女信息',
        items: [
          { id: 'dashboard', icon: '🏠', label: '主页', page: 'dashboard.html' },
          { id: 'notice', icon: '📢', label: '班级通知', page: 'notice.html', badge: true },
          { id: 'attendance', icon: '📋', label: '考勤记录', page: 'attendance.html' },
          { id: 'score', icon: '📊', label: '成绩查询', page: 'score.html' },
        ],
      },
    ],
  },
};

/* ---------- 考勤状态映射 ---------- */
const ATTENDANCE_STATUS_MAP = {
  present: { label: '出勤', badgeClass: 'badge-present' },
  late: { label: '迟到', badgeClass: 'badge-late' },
  early: { label: '早退', badgeClass: 'badge-warning' },
  absent: { label: '旷课', badgeClass: 'badge-absent' },
  leave: { label: '事假', badgeClass: 'badge-leave' },
  sick: { label: '病假', badgeClass: 'badge-info' },
  public: { label: '公假', badgeClass: 'badge-neutral' },
};

/* ---------- 积分分类默认配置 ---------- */
const DEFAULT_POINT_CATEGORIES = [
  {
    name: '值日类',
    items: [
      { label: '值日完成', score: +2 },
      { label: '值日优秀', score: +5 },
      { label: '值日未完成', score: -5 },
    ],
  },
  {
    name: '纪律类',
    items: [
      { label: '课堂纪律良好', score: +3 },
      { label: '课堂玩手机', score: -5 },
      { label: '课间打闹', score: -3 },
      { label: '迟到', score: -2 },
      { label: '旷课', score: -10 },
    ],
  },
  {
    name: '作业类',
    items: [
      { label: '作业完成', score: +2 },
      { label: '作业优秀', score: +5 },
      { label: '作业未交', score: -3 },
    ],
  },
  {
    name: '服务类',
    items: [
      { label: '班级服务', score: +5 },
      { label: '帮助同学', score: +3 },
      { label: '拾金不昧', score: +10 },
    ],
  },
];

/* ---------- 宿舍评分项默认配置 ---------- */
const DEFAULT_DORM_SCORE_ITEMS = [
  { label: '整洁卫生', deduct: 5 },
  { label: '物品摆放', deduct: 3 },
  { label: '违规电器', deduct: 10 },
  { label: '晚归/未归', deduct: 10 },
  { label: '噪音扰民', deduct: 5 },
];

/* ---------- 头像颜色池 ---------- */
const AVATAR_COLORS = [
  'linear-gradient(135deg, #0ea5e9, #0369a1)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #f97316, #ea580c)',
  'linear-gradient(135deg, #ef4444, #dc2626)',
];

/* ---------- 本地存储 Key ---------- */
const STORAGE_KEYS = {
  session: 'cms_session',   // 登录 session
  role: 'cms_role',      // 角色
  semester: 'cms_semester',  // 学期配置
};

/* ---------- 工具函数 ---------- */
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
