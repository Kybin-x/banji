/* ============================================================
   settings.js — 系统设置
   班级管理系统 v1.0
   ============================================================ */
'use strict';

async function initPage(session) {
  if (!hasPermission(['teacher'])) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state"><div class="empty-state-icon">🔒</div>
      <div class="empty-state-title">仅班主任可访问系统设置</div></div>`;
    return;
  }

  document.getElementById('page-content').innerHTML = `
  <div class="page-header">
    <h1>系统设置</h1>
    <p>配置学期、班级信息、账号权限等参数</p>
  </div>

  <div class="sub-tabs" id="settings-tabs">
    <div class="sub-tab active" data-tab="semester">学期管理</div>
    <div class="sub-tab" data-tab="cadre">班干权限</div>
    <div class="sub-tab" data-tab="items">事项配置</div>
    <div class="sub-tab" data-tab="account">账号管理</div>
  </div>

  <!-- 学期管理 -->
  <div id="tab-semester">
    <div class="card" style="max-width:600px;">
      <div class="card-header"><div class="card-title">📅 学期配置</div></div>
      <div class="form-group">
        <label class="form-label">学期名称 <span class="required">*</span></label>
        <input class="form-input" id="sem-name" placeholder="如：2025-2026学年第二学期" value="${escHtml(loadSem().semesterName||'')}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="form-group">
          <label class="form-label">第1周周一日期 <span class="required">*</span></label>
          <input class="form-input" type="date" id="sem-start" value="${escHtml(loadSem().startDate||'')}">
          <div class="form-hint">学期第一周周一的日期</div>
        </div>
        <div class="form-group">
          <label class="form-label">总周数</label>
          <input class="form-input" type="number" id="sem-weeks" min="1" max="30" value="${loadSem().totalWeeks||20}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">班级名称</label>
        <input class="form-input" id="sem-classno" placeholder="如：24电商6班" value="${escHtml(loadSem().classNo||session?.classNo||'')}">
      </div>
      <button class="btn btn-primary" onclick="saveSemester()">保存学期配置</button>

      <div id="sem-preview" style="margin-top:20px;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary);"></div>
    </div>
  </div>

  <!-- 班干权限 -->
  <div id="tab-cadre" style="display:none;">
    <div class="card" style="max-width:640px;">
      <div class="card-header"><div class="card-title">👥 班干部权限配置</div></div>
      <p class="text-secondary text-sm" style="margin-bottom:16px;">
        设置各班干部可操作的功能模块。班主任始终拥有全部权限。
      </p>
      ${['考勤登记','积分登记','宿舍评分','通知发布','座位管理','值日管理'].map(item => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);">
          <span>${item}</span>
          <label class="form-check" style="margin:0;">
            <input type="checkbox" checked>
            <span class="text-sm text-secondary">允许</span>
          </label>
        </div>`).join('')}
      <button class="btn btn-primary" style="margin-top:16px;" onclick="Toast.success('权限配置已保存')">保存权限配置</button>
    </div>
  </div>

  <!-- 事项配置 -->
  <div id="tab-items" style="display:none;">
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">⭐ 积分事项配置</div></div>
        <p class="text-secondary text-sm" style="margin-bottom:12px;">当前使用系统默认配置，可在此自定义。</p>
        ${DEFAULT_POINT_CATEGORIES.map(cat => `
          <div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:600;color:var(--color-teal-light);margin-bottom:6px;">${escHtml(cat.name)}</div>
            ${cat.items.map(item => `
              <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 8px;background:var(--card-bg);border-radius:6px;margin-bottom:4px;">
                <span style="color:var(--text-secondary)">${escHtml(item.label)}</span>
                <span class="${item.score>=0?'score-positive':'score-negative'} td-num">${formatScore(item.score)}</span>
              </div>`).join('')}
          </div>`).join('')}
        <button class="btn btn-secondary btn-sm" onclick="Toast.info('自定义积分事项功能敬请期待')">自定义事项</button>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🏠 宿舍评分项配置</div></div>
        ${DEFAULT_DORM_SCORE_ITEMS.map(item => `
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 12px;background:var(--card-bg);border-radius:8px;margin-bottom:6px;">
            <span style="color:var(--text-secondary)">${escHtml(item.label)}</span>
            <span class="score-negative td-num">-${item.deduct}</span>
          </div>`).join('')}
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="Toast.info('自定义宿舍评分项功能敬请期待')">自定义评分项</button>
      </div>
    </div>
  </div>

  <!-- 账号管理 -->
  <div id="tab-account" style="display:none;">
    <div class="card" style="max-width:600px;">
      <div class="card-header"><div class="card-title">🔒 账号管理</div></div>
      <p class="text-secondary text-sm" style="margin-bottom:16px;">
        学生和家长账号在"学生信息管理"中自动创建。此处可重置密码或禁用账号。
      </p>
      <div class="form-group">
        <label class="form-label">按学号查找账号</label>
        <div style="display:flex;gap:10px;">
          <input class="form-input" id="acc-search" placeholder="输入学号或手机号" style="flex:1;">
          <button class="btn btn-primary btn-sm" onclick="searchAccount()">查找</button>
        </div>
      </div>
      <div id="acc-result"></div>

      <div class="divider"></div>
      <div class="card-header" style="margin-top:8px;"><div class="card-title">🔑 修改我的密码</div></div>
      <div class="form-group">
        <label class="form-label">新密码</label>
        <input class="form-input" id="new-pwd" type="password" placeholder="至少6位">
      </div>
      <div class="form-group">
        <label class="form-label">确认新密码</label>
        <input class="form-input" id="new-pwd-confirm" type="password" placeholder="再次输入">
      </div>
      <button class="btn btn-primary" onclick="changeMyPassword()">修改密码</button>
    </div>
  </div>`;

  initSubTabs('settings-tabs', (tab) => {
    ['semester','cadre','items','account'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
  });

  updateSemPreview();
  document.getElementById('sem-start')?.addEventListener('change', updateSemPreview);
  document.getElementById('sem-weeks')?.addEventListener('input', updateSemPreview);
}

function loadSem() { return Storage.get(STORAGE_KEYS.semester, {}); }

function saveSemester() {
  const name   = document.getElementById('sem-name')?.value.trim();
  const start  = document.getElementById('sem-start')?.value;
  const weeks  = Number(document.getElementById('sem-weeks')?.value) || 20;
  const classNo = document.getElementById('sem-classno')?.value.trim();

  if (!name || !start) { Toast.warning('请填写学期名称和第1周周一日期'); return; }

  Storage.set(STORAGE_KEYS.semester, { semesterName:name, startDate:start, totalWeeks:weeks, classNo });

  // 同步更新顶栏
  const subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) {
    const wk = calcWeekNo(start);
    subtitleEl.textContent = [classNo, wk?`第${wk}周`:'', formatDateWithWeekday(new Date())].filter(Boolean).join(' · ');
  }

  Toast.success('学期配置已保存');
  updateSemPreview();
}

function updateSemPreview() {
  const start = document.getElementById('sem-start')?.value;
  const weeks = Number(document.getElementById('sem-weeks')?.value) || 20;
  const el    = document.getElementById('sem-preview');
  if (!el || !start) return;
  const wk  = calcWeekNo(start);
  const rng = getWeekRange(start, weeks);
  el.innerHTML = `
    当前周次：<strong>${wk ? '第 '+wk+' 周' : '未开始'}</strong> ·
    学期结束：<strong>${formatDate(rng.end)}</strong>`;
}

async function changeMyPassword() {
  const pwd  = document.getElementById('new-pwd')?.value;
  const pwd2 = document.getElementById('new-pwd-confirm')?.value;
  if (!pwd || pwd.length < 6) { Toast.warning('密码至少6位'); return; }
  if (pwd !== pwd2) { Toast.warning('两次密码不一致'); return; }
  const { error } = await Auth.updatePassword(pwd);
  if (error) { Toast.error('修改失败：'+error.message); return; }
  Toast.success('密码已修改，下次登录生效');
}

function searchAccount() {
  Toast.info('账号查找功能敬请期待');
}
