/* ============================================================
   auth.js — 登录 / 登出 / 权限校验 / Session 管理
   班级管理系统 v1.0

   依赖：config.js / utils.js / supabase.js
   ============================================================ */

'use strict';

/* ============================================================
   一、Session 管理（localStorage）
   ============================================================ */

/**
 * 保存登录 Session
 * @param {{ userId, role, name, classId, classNo, avatarGradient }} session
 */
function saveSession(session) {
  Storage.set(STORAGE_KEYS.session, {
    ...session,
    loginAt: Date.now(),
  });
}

/**
 * 读取当前 Session
 * @returns {object|null}
 */
function getSession() {
  return Storage.get(STORAGE_KEYS.session, null);
}

/**
 * 清除 Session
 */
function clearSession() {
  Storage.remove(STORAGE_KEYS.session);
  Storage.remove(STORAGE_KEYS.role);
}

/**
 * 检查 Session 是否有效（简单有效期检测：24小时）
 */
function isSessionValid() {
  const s = getSession();
  if (!s || !s.loginAt) return false;
  const expired = Date.now() - s.loginAt > 24 * 60 * 60 * 1000;
  return !expired;
}

/* ============================================================
   二、页面守卫 — 未登录跳转到登录页
   ============================================================ */

/**
 * 在每个 pages/*.html 的顶部调用，确保已登录
 * 未登录则跳转到 index.html
 */
function requireAuth() {
  if (!isSessionValid()) {
    window.location.href = ROUTES.login;
    return null;
  }
  return getSession();
}

/**
 * 权限检查：当前角色是否拥有指定功能
 * @param {'teacher'|'cadre'|'student'|'parent'} requiredRole
 * @param {string[]} allowedRoles  允许访问的角色数组
 */
function hasPermission(allowedRoles) {
  const s = getSession();
  if (!s) return false;
  return allowedRoles.includes(s.role);
}

/**
 * 仅允许班主任访问
 */
function requireTeacher() {
  if (!hasPermission(['teacher'])) {
    Toast.error('此功能仅班主任可操作');
    return false;
  }
  return true;
}

/**
 * 班主任或班干部可访问
 */
function requireManager() {
  if (!hasPermission(['teacher', 'cadre'])) {
    Toast.error('权限不足');
    return false;
  }
  return true;
}

/* ============================================================
   三、登录逻辑
   ============================================================ */

/**
 * 执行登录
 * @param {string} phone    - 手机号（账号）
 * @param {string} password - 密码
 * @param {string} role     - 前端选择的角色（用于辅助校验）
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function doLogin(phone, password, role) {
  if (!Validate.required(phone)) return { ok: false, error: '请输入账号' };
  if (!Validate.required(password)) return { ok: false, error: '请输入密码' };

  /* --- 演示模式（DEMO_MODE = true 时使用 mock 数据，无需 Supabase 账号） --- */
  if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
    return doMockLogin(phone, password, role);
  }

  /* --- 真实登录 --- */
  const { data, error } = await Auth.signIn(phone, password);
  if (error) {
    // 把 Supabase 原始错误翻译为中文，方便排查
    const msg = error.message || '';
    if (msg.includes('Email not confirmed') || msg.includes('not confirmed')) {
      return { ok: false, error: '账号未完成邮件确认，请在 Supabase 控制台 Authentication → 设置中关闭「Email Confirm」，或在 Users 页面手动确认该用户' };
    }
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      return { ok: false, error: '账号或密码错误（请确认邮箱格式为 手机号@cms.local）' };
    }
    // 其他情况显示原始错误，方便调试
    return { ok: false, error: `登录失败：${msg}` };
  }

  // 从 users 表获取角色和班级信息
  const profile = await UserAPI.getCurrent();
  if (!profile) {
    await Auth.signOut();
    return { ok: false, error: '用户档案不存在，请在 SQL Editor 执行 INSERT INTO users … 语句后重试' };
  }

  // 校验角色与前端选择是否一致
  if (profile.role !== role) {
    await Auth.signOut();
    return { ok: false, error: `该账号角色为「${ROLES[profile.role]?.label || profile.role}」，请重新选择左侧角色` };
  }

  // 保存 Session
  saveSession({
    userId:         data.user.id,
    role:           profile.role,
    name:           profile.display_name || phone,
    classId:        profile.class_id,
    classNo:        profile.class_no || '—',
    avatarGradient: ROLES[profile.role]?.avatarGradient || '',
    isFirstLogin:   profile.is_first_login || false,
  });

  return { ok: true, isFirstLogin: profile.is_first_login };
}

/**
 * 登出
 */
async function doLogout() {
  await Auth.signOut();
  clearSession();
  window.location.href = ROUTES.login;
}

/* ============================================================
   四、Mock 登录（演示模式）
   ============================================================ */
const MOCK_USERS = {
  teacher: {
    phone:    '13800000000',
    password: '123456',
    name:     '王雪梅',
    classNo:  '24电商6班',
    classId:  'class_001',
  },
  cadre: {
    phone:    '13800000099',
    password: '0099',
    name:     '李志远',
    classNo:  '24电商6班',
    classId:  'class_001',
    position: '纪律委员',
  },
  student: {
    phone:    '13800000002',
    password: '0002',
    name:     '张丽华',
    classNo:  '24电商6班',
    classId:  'class_001',
    studentNo: '2024002',
  },
  parent: {
    phone:    '13800000100',
    password: '0100',
    name:     '张建国（家长）',
    classNo:  '24电商6班',
    classId:  'class_001',
    childName: '张丽华',
  },
};

function doMockLogin(phone, password, role) {
  const mock = MOCK_USERS[role];
  if (!mock) return { ok: false, error: '角色配置错误' };

  if (phone !== mock.phone) return { ok: false, error: '账号不存在（演示模式）' };
  if (password !== mock.password) return { ok: false, error: '密码错误（演示模式）' };

  saveSession({
    userId:         `mock_${role}_001`,
    role,
    name:           mock.name,
    classId:        mock.classId,
    classNo:        mock.classNo,
    avatarGradient: ROLES[role]?.avatarGradient || '',
    isFirstLogin:   false,
    // 额外字段
    position:   mock.position  || null,
    studentNo:  mock.studentNo || null,
    childName:  mock.childName || null,
  });

  return { ok: true, isFirstLogin: false };
}

/* ============================================================
   五、登录页初始化（index.html 调用）
   ============================================================ */

function initLoginPage() {
  // 如果已登录，直接跳转到首页
  if (isSessionValid()) {
    window.location.href = `pages/${ROUTES.dashboard}`;
    return;
  }

  let selectedRole = 'teacher';

  // 角色选项卡点击
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedRole = tab.dataset.role;

      // 更新提示文字
      const hint = document.getElementById('login-hint');
      if (hint) hint.textContent = ROLES[selectedRole]?.loginHint || '';

      // DEMO_MODE 下切换角色自动预填演示账号
      const userInput = document.getElementById('login-user');
      if (userInput && typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        userInput.value = MOCK_USERS[selectedRole]?.phone || '';
      }
      const passInput = document.getElementById('login-pass');
      if (passInput && typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
        passInput.value = '';
      }
    });
  });

  // 登录按钮
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLoginSubmit);
  }

  // 回车提交
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLoginSubmit();
  });

  async function handleLoginSubmit() {
    const phone    = document.getElementById('login-user')?.value.trim() || '';
    const password = document.getElementById('login-pass')?.value || '';

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    const result = await doLogin(phone, password, selectedRole);

    if (!result.ok) {
      Toast.error(result.error || '登录失败');
      loginBtn.disabled = false;
      loginBtn.textContent = '登 录';
      return;
    }

    // 登录成功，跳转
    loginBtn.textContent = '跳转中...';
    setTimeout(() => {
      window.location.href = `pages/${ROUTES.dashboard}`;
    }, 300);
  }

  // DEMO_MODE=true 时预填演示账号；否则只提示
  const userInput = document.getElementById('login-user');
  if (userInput) {
    if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
      userInput.value       = MOCK_USERS.teacher.phone;
      userInput.placeholder = '演示账号已预填';
    } else {
      userInput.value       = '';
      userInput.placeholder = '请输入手机号';
    }
  }
}
