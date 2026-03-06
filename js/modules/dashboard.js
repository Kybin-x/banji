/* ============================================================
   dashboard.js — 首页渲染（按角色区分）
   班级管理系统 v1.0

   依赖：config.js / utils.js / supabase.js / layout.js / auth.js
   ============================================================ */

'use strict';

/**
 * 入口：根据角色渲染对应首页
 */
async function renderDashboard(session) {
  const container = document.getElementById('page-content');
  if (!container) return;

  switch (session.role) {
    case 'teacher': await renderTeacherDashboard(container, session); break;
    case 'cadre':   await renderCadreDashboard(container, session);   break;
    case 'student': await renderStudentDashboard(container, session);  break;
    case 'parent':  await renderParentDashboard(container, session);   break;
    default:        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❓</div><div class="empty-state-title">未知角色</div></div>';
  }
}

/* ============================================================
   一、班主任首页
   ============================================================ */
async function renderTeacherDashboard(container, session) {
  // 先渲染骨架，再异步填充
  container.innerHTML = buildTeacherSkeleton();

  const [attData, pointData, dormData, noticeData, studentCount] = await Promise.all([
    fetchTodayAttendance(session.classId),
    fetchWeekPoints(session.classId),
    fetchDormRanking(session.classId),
    fetchRecentNotices(session.classId),
    fetchStudentCount(session.classId),
  ]);

  container.innerHTML = buildTeacherHTML(session, attData, pointData, dormData, noticeData, studentCount);
}

function buildTeacherSkeleton() {
  return `
    <div class="page-header">
      <h1>工作台概览</h1>
      <p>加载中...</p>
    </div>
    <div class="grid-stats">
      ${[1,2,3,4].map(() => `<div class="skeleton" style="height:110px;border-radius:16px;"></div>`).join('')}
    </div>
    <div class="grid-2">
      <div class="skeleton" style="height:300px;border-radius:16px;"></div>
      <div class="skeleton" style="height:300px;border-radius:16px;"></div>
    </div>`;
}

function buildTeacherHTML(session, att, points, dorms, notices, totalStudents) {
  const today = formatDateCN(new Date());
  const total  = totalStudents || 50;
  const present = total - att.length;               // 异常记录条数即为非正常出勤
  const lateCount   = att.filter(r => r.status === 'late').length;
  const absentCount = att.filter(r => r.status === 'absent').length;
  const leaveCount  = att.filter(r => !['late','absent'].includes(r.status)).length;

  return `
  <div class="page-header">
    <h1>工作台概览</h1>
    <p>今日 ${today}，全班共 ${total} 名学生</p>
  </div>

  <!-- 快捷操作 -->
  <div class="quick-actions" style="grid-template-columns:repeat(5,1fr);">
    ${quickBtn('📋','考勤登记','attendance.html')}
    ${quickBtn('📊','成绩管理','score.html')}
    ${quickBtn('⭐','积分登记','points.html')}
    ${quickBtn('📢','发布通知','notice.html')}
    ${quickBtn('⚙️','系统设置','settings.html')}
  </div>

  <!-- 统计卡片 -->
  <div class="grid-stats">
    ${renderStatCard('👥','teal', total,   '班级总人数',    '',  '')}
    ${renderStatCard('✅','green', present, '今日出勤',  formatPercent(present,total), 'up')}
    ${renderStatCard('⭐','gold',  pointsTotalThisWeek(points), '本周积分总计', '', 'neutral')}
    ${renderStatCard('💰','purple','—',    '班费余额(元)',  '查看', 'neutral')}
  </div>

  <!-- 第一行：考勤 + 积分排行 -->
  <div class="grid-2" style="margin-bottom:16px;">

    <!-- 今日考勤 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📋</span> 今日考勤概况</div>
        <span class="card-action" onclick="navigateTo('attendance.html')">查看详情</span>
      </div>
      <div class="attendance-summary">
        <div class="att-summary-cell present">
          <div class="num">${present}</div><div class="lbl">出勤</div>
        </div>
        <div class="att-summary-cell late">
          <div class="num">${lateCount}</div><div class="lbl">迟到</div>
        </div>
        <div class="att-summary-cell leave">
          <div class="num">${leaveCount}</div><div class="lbl">请假</div>
        </div>
        <div class="att-summary-cell absent">
          <div class="num">${absentCount}</div><div class="lbl">旷课</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>姓名</th><th>状态</th><th>备注</th><th>时间</th></tr></thead>
          <tbody>
            ${att.length === 0
              ? `<tr><td colspan="4" class="table-empty">✅ 全班出勤，暂无异常</td></tr>`
              : att.slice(0, 5).map(r => `
                <tr>
                  <td class="td-name">${escHtml(r.students?.name || '—')}</td>
                  <td>${renderAttBadge(r.status)}</td>
                  <td style="color:var(--text-muted)">${escHtml(r.remark || '—')}</td>
                  <td style="font-family:var(--font-display)">${r.record_time ? formatTime(new Date(r.record_time)) : '—'}</td>
                </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- 本周积分排行 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">🏆</span> 本周积分排行</div>
        <span class="card-action" onclick="navigateTo('points.html')">查看全部</span>
      </div>
      ${buildPointRanking(points)}
    </div>
  </div>

  <!-- 第二行：通知 + 宿舍 -->
  <div class="grid-2">

    <!-- 班级通知 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📢</span> 班级通知</div>
        <span class="card-action" onclick="navigateTo('notice.html')">发布通知</span>
      </div>
      ${buildNoticeList(notices)}
    </div>

    <!-- 宿舍排名 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">🏠</span> 本周宿舍排名</div>
        <span class="card-action" onclick="navigateTo('dorm.html')">查看详情</span>
      </div>
      ${buildDormRanking(dorms)}
    </div>
  </div>`;
}

/* ============================================================
   二、班干部首页
   ============================================================ */
async function renderCadreDashboard(container, session) {
  container.innerHTML = `<div class="page-header"><h1>班干工作台</h1><p>加载中...</p></div>`;

  const [att, myPoints, notices] = await Promise.all([
    fetchTodayAttendance(session.classId),
    fetchMyPointRecords(session.classId, session.userId),
    fetchRecentNotices(session.classId),
  ]);

  const total   = 50; // 可从 Supabase 实时获取
  const present = total - att.length;
  const position = session.position || '班干部';
  const today    = formatDateCN(new Date());

  container.innerHTML = `
  <div class="page-header">
    <h1>班干工作台</h1>
    <p>${escHtml(position)} · ${escHtml(session.classNo || '—')} · ${today}</p>
  </div>

  <div class="grid-stats" style="grid-template-columns:repeat(3,1fr);">
    ${renderStatCard('📋','teal',  present,        '今日出勤人数', '今日', 'neutral')}
    ${renderStatCard('⭐','gold',  myPoints.length,'我已登记次数', '本周', 'neutral')}
    ${renderStatCard('📢','green', '2',             '未读通知',   '',     '')}
  </div>

  <div class="grid-2">
    <!-- 快速积分登记 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">⭐</span> 快速积分登记</div>
        <span class="card-action" onclick="navigateTo('points.html')">更多</span>
      </div>
      <div class="points-quick-grid">
        ${buildQuickPointBtn('✅','课堂纪律良好','+3','positive')}
        ${buildQuickPointBtn('📱','课堂玩手机','-5','negative')}
        ${buildQuickPointBtn('⏰','迟到','-2','negative')}
        ${buildQuickPointBtn('🏃','课间打闹','-3','negative')}
      </div>
    </div>

    <!-- 今日已登记 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📋</span> 今日已登记记录</div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>学生</th><th>事项</th><th>分值</th><th>时间</th></tr></thead>
          <tbody>
            ${myPoints.length === 0
              ? `<tr><td colspan="4" class="table-empty">今日暂无登记记录</td></tr>`
              : myPoints.slice(0,6).map(r => `
                <tr>
                  <td class="td-name">${escHtml(r.students?.name || '—')}</td>
                  <td>${escHtml(r.item_label || '—')}</td>
                  <td class="${r.score >= 0 ? 'score-positive' : 'score-negative'} td-num">
                    ${formatScore(r.score)}
                  </td>
                  <td style="font-family:var(--font-display)">${r.created_at ? formatTime(new Date(r.created_at)) : '—'}</td>
                </tr>`).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 通知 -->
  <div class="card" style="margin-top:0;">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon">📢</span> 班级通知</div>
    </div>
    ${buildNoticeList(notices)}
  </div>`;
}

/* ============================================================
   三、学生首页
   ============================================================ */
async function renderStudentDashboard(container, session) {
  container.innerHTML = `<div class="page-header"><h1>个人主页</h1><p>加载中...</p></div>`;

  const [attStats, scoreData, pointsTotal, notices] = await Promise.all([
    fetchStudentAttStats(session.userId, session.classId),
    fetchStudentLatestScore(session.userId, session.classId),
    fetchStudentPointTotal(session.userId, session.classId),
    fetchRecentNotices(session.classId),
  ]);

  const name     = session.name;
  const initial  = getInitial(name);
  const classNo  = session.classNo || '—';
  const stuNo    = session.studentNo || '—';

  container.innerHTML = `
  <!-- 个人英雄区 -->
  <div class="personal-hero">
    <div class="personal-avatar">${escHtml(initial)}</div>
    <div style="flex:1;min-width:0;">
      <div class="personal-name">${escHtml(name)}</div>
      <div class="personal-meta">学号：${escHtml(stuNo)} · ${escHtml(classNo)}</div>
      <div class="personal-badges">
        ${pointsTotal >= 20
          ? `<span class="personal-badge" style="background:rgba(16,185,129,0.15);color:var(--color-green)">🏅 积分优秀</span>`
          : ''}
        ${attStats.rate >= 0.95
          ? `<span class="personal-badge" style="background:rgba(14,165,233,0.15);color:var(--color-teal-light)">✅ 全勤优秀</span>`
          : ''}
      </div>
    </div>
    <div style="text-align:center;padding:0 20px;flex-shrink:0;">
      <div class="big-num big-num-xl" style="color:var(--color-gold)">
        ${pointsTotal >= 0 ? '+' : ''}${pointsTotal}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">本周积分</div>
    </div>
  </div>

  <!-- 统计卡片 -->
  <div class="grid-stats">
    ${renderStatCard('✅','green', Math.round(attStats.rate * 100) + '%', '本月出勤率', attStats.rate >= 0.95 ? '优秀' : '', attStats.rate >= 0.95 ? 'up' : 'neutral')}
    ${renderStatCard('📊','teal',  scoreData.total || '—', '最近考试总分', scoreData.rank ? `第${scoreData.rank}名` : '', 'neutral')}
    ${renderStatCard('⭐','gold',  (pointsTotal >= 0 ? '+' : '') + pointsTotal, '本周累计积分', '', 'neutral')}
    ${renderStatCard('🏠','purple', attStats.dormScore || '—', '宿舍本周评分', attStats.dormScore >= 90 ? '优秀' : '', attStats.dormScore >= 90 ? 'up' : 'neutral')}
  </div>

  <div class="grid-2">
    <!-- 本月考勤日历 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📅</span> 本月考勤</div>
        <span class="card-action" onclick="navigateTo('attendance.html')">查看全部</span>
      </div>
      ${buildAttCalendar(attStats.records)}
    </div>

    <!-- 成绩 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📊</span> 最近考试成绩</div>
        <span class="card-action" onclick="navigateTo('score.html')">成绩趋势</span>
      </div>
      ${buildScoreRows(scoreData.subjects)}
    </div>
  </div>

  <!-- 通知 -->
  <div class="card">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon">📢</span> 班级通知</div>
    </div>
    ${buildNoticeList(notices)}
  </div>`;
}

/* ============================================================
   四、家长首页
   ============================================================ */
async function renderParentDashboard(container, session) {
  container.innerHTML = `<div class="page-header"><h1>家长查看</h1><p>加载中...</p></div>`;

  const childName = session.childName || session.name.replace('（家长）','');

  const [attRecords, scoreData, notices] = await Promise.all([
    fetchChildAttRecords(session.classId, session.userId),
    fetchChildLatestScore(session.classId, session.userId),
    fetchRecentNotices(session.classId),
  ]);

  container.innerHTML = `
  <!-- 子女信息 -->
  <div class="personal-hero">
    <div class="personal-avatar" style="background:linear-gradient(135deg,#10b981,#059669)">
      ${escHtml(getInitial(childName))}
    </div>
    <div style="flex:1;min-width:0;">
      <div class="personal-name">${escHtml(childName)}</div>
      <div class="personal-meta">${escHtml(session.classNo || '—')}</div>
    </div>
    <div style="text-align:center;padding:0 20px;flex-shrink:0;">
      <div class="big-num big-num-lg" style="color:var(--color-green)">
        ${attRecords.rate !== undefined ? Math.round(attRecords.rate * 100) + '%' : '—'}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">本月出勤率</div>
    </div>
  </div>

  <div class="grid-2">
    <!-- 近期考勤 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📋</span> 近期考勤记录</div>
        <span class="card-action" onclick="navigateTo('attendance.html')">查看全部</span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>日期</th><th>状态</th><th>备注</th></tr></thead>
          <tbody>
            ${attRecords.list && attRecords.list.length > 0
              ? attRecords.list.slice(0,6).map(r => `
                <tr>
                  <td style="font-family:var(--font-display)">${escHtml(r.date || '—')}</td>
                  <td>${renderAttBadge(r.status)}</td>
                  <td style="color:var(--text-muted)">${escHtml(r.remark || '—')}</td>
                </tr>`).join('')
              : `<tr><td colspan="3" class="table-empty">近期全勤，暂无异常</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- 成绩 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="card-title-icon">📊</span> 最近考试成绩</div>
        <span class="card-action" onclick="navigateTo('score.html')">查看详情</span>
      </div>
      ${buildScoreRows(scoreData.subjects)}
    </div>
  </div>

  <!-- 通知 -->
  <div class="card">
    <div class="card-header">
      <div class="card-title"><span class="card-title-icon">📢</span> 班级通知</div>
    </div>
    ${buildNoticeList(notices)}
  </div>`;
}

/* ============================================================
   数据获取函数（Supabase）
   ============================================================ */

/** 今日考勤异常列表 */
async function fetchTodayAttendance(classId) {
  if (!classId) return MOCK_ATT;
  const { data, error } = await DB.query('attendance_records', {
    select: '*, students(name)',
    match:  { class_id: classId, date: formatDate(new Date()) },
    order:  { col: 'created_at', asc: false },
  });
  if (error || !data) return MOCK_ATT;
  return data;
}

/** 本周积分记录（含学生名、按人聚合） */
async function fetchWeekPoints(classId) {
  if (!classId) return MOCK_POINTS;
  const sem  = getCurrentSemester();
  const weekNo = sem ? calcWeekNo(sem.startDate) : null;
  const range  = sem && weekNo ? getWeekRange(sem.startDate, weekNo) : null;

  const db = getSupabase();
  if (!db) return MOCK_POINTS;

  let q = db.from('point_records')
    .select('*, students(name)')
    .eq('class_id', classId);
  if (range) {
    q = q.gte('date', formatDate(range.start))
         .lte('date', formatDate(range.end));
  }
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error || !data) return MOCK_POINTS;
  return data;
}

/** 宿舍排名（取本周平均分前5） */
async function fetchDormRanking(classId) {
  if (!classId) return MOCK_DORMS;
  const { data, error } = await DB.query('dorm_scores', {
    select: 'dorm_no, score, date',
    match:  { class_id: classId },
    order:  { col: 'date', asc: false },
    limit:  50,
  });
  if (error || !data) return MOCK_DORMS;
  // 按 dorm_no 聚合平均分
  const map = {};
  data.forEach(r => {
    if (!map[r.dorm_no]) map[r.dorm_no] = { dorm_no: r.dorm_no, scores: [] };
    map[r.dorm_no].scores.push(r.score);
  });
  return Object.values(map)
    .map(d => ({ dorm_no: d.dorm_no, avg: round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length) }))
    .sort((a,b) => b.avg - a.avg)
    .slice(0,5);
}

/** 最新通知 */
async function fetchRecentNotices(classId) {
  if (!classId) return MOCK_NOTICES;
  const db = getSupabase();
  if (!db) return MOCK_NOTICES;
  const { data, error } = await db.from('notices')
    .select('id, title, created_at, is_pinned, visible_to')
    .eq('class_id', classId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !data) return MOCK_NOTICES;
  return data;
}

/** 班级学生总数 */
async function fetchStudentCount(classId) {
  if (!classId) return 50;
  const db = getSupabase();
  if (!db) return 50;
  const { count } = await db.from('students')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId);
  return count || 50;
}

/** 班干：我今日登记的积分 */
async function fetchMyPointRecords(classId, userId) {
  if (!classId || !userId) return [];
  const { data } = await DB.query('point_records', {
    select: '*, students(name)',
    match:  { class_id: classId, recorder_id: userId, date: formatDate(new Date()) },
    order:  { col: 'created_at', asc: false },
  });
  return data || [];
}

/** 学生：本月考勤统计 */
async function fetchStudentAttStats(userId, classId) {
  const fallback = { rate: 1, records: [], dormScore: null };
  if (!userId || !classId) return { ...fallback, records: MOCK_STUDENT_ATT };

  const db = getSupabase();
  if (!db) return { ...fallback, records: MOCK_STUDENT_ATT };

  // 获取关联的 student_id
  const { data: studentRows } = await db.from('students')
    .select('id').eq('user_id', userId).limit(1);
  const studentId = studentRows?.[0]?.id;
  if (!studentId) return { ...fallback, records: MOCK_STUDENT_ATT };

  const now   = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const end   = formatDate(now);

  const { data } = await db.from('attendance_records')
    .select('date, status, remark')
    .eq('student_id', studentId)
    .gte('date', start)
    .lte('date', end);

  const records = data || [];
  const workDays = countWorkdays(new Date(start), now);
  const absents  = records.filter(r => r.status === 'absent').length;
  const rate     = workDays > 0 ? Math.max(0, (workDays - absents) / workDays) : 1;

  return { rate, records, dormScore: null };
}

/** 学生：最近考试成绩 */
async function fetchStudentLatestScore(userId, classId) {
  const fallback = { total: null, rank: null, subjects: MOCK_SUBJECTS };
  if (!userId || !classId) return fallback;

  const db = getSupabase();
  if (!db) return fallback;

  const { data: studentRows } = await db.from('students')
    .select('id').eq('user_id', userId).limit(1);
  const studentId = studentRows?.[0]?.id;
  if (!studentId) return fallback;

  const { data } = await db.from('scores')
    .select('*, exams(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return fallback;
  const s = data[0];

  // 构建科目列表（动态字段 subject_scores 为 JSONB）
  const subjects = s.subject_scores
    ? Object.entries(s.subject_scores).map(([name, val]) => ({
        name, score: val.score, max: val.max || 100
      }))
    : MOCK_SUBJECTS;

  return { total: s.total_score, rank: s.rank, subjects };
}

/** 学生：本周积分合计 */
async function fetchStudentPointTotal(userId, classId) {
  if (!userId || !classId) return 0;
  const db = getSupabase();
  if (!db) return 0;

  const { data: studentRows } = await db.from('students')
    .select('id').eq('user_id', userId).limit(1);
  const studentId = studentRows?.[0]?.id;
  if (!studentId) return 0;

  const sem    = getCurrentSemester();
  const weekNo = sem ? calcWeekNo(sem.startDate) : null;
  const range  = sem && weekNo ? getWeekRange(sem.startDate, weekNo) : null;

  let q = db.from('point_records').select('score').eq('student_id', studentId);
  if (range) {
    q = q.gte('date', formatDate(range.start)).lte('date', formatDate(range.end));
  }

  const { data } = await q;
  return (data || []).reduce((sum, r) => sum + (r.score || 0), 0);
}

/** 家长：子女考勤 */
async function fetchChildAttRecords(classId, userId) {
  // 通过 parent_id 关联查 student
  const db = getSupabase();
  if (!db) return { rate: 1, list: [] };

  const { data: studentRows } = await db.from('students')
    .select('id').eq('parent_user_id', userId).limit(1);
  const studentId = studentRows?.[0]?.id;
  if (!studentId) return { rate: 1, list: [] };

  const now   = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

  const { data } = await db.from('attendance_records')
    .select('date, status, remark')
    .eq('student_id', studentId)
    .gte('date', start)
    .order('date', { ascending: false });

  const records  = data || [];
  const workDays = countWorkdays(new Date(start), now);
  const absents  = records.filter(r => r.status === 'absent').length;
  const rate     = workDays > 0 ? Math.max(0, (workDays - absents) / workDays) : 1;

  return { rate, list: records };
}

/** 家长：子女成绩 */
async function fetchChildLatestScore(classId, userId) {
  return fetchStudentLatestScore(userId, classId); // 逻辑相同
}

/* ============================================================
   UI 构建辅助函数
   ============================================================ */

function quickBtn(icon, label, page) {
  return `
    <div class="quick-btn" onclick="navigateTo('${page}')">
      <div class="quick-btn-icon">${icon}</div>
      <div class="quick-btn-label">${label}</div>
    </div>`;
}

function buildQuickPointBtn(icon, name, score, type) {
  return `
    <div class="points-quick-btn ${type}" onclick="navigateTo('points.html')">
      <div class="btn-icon-lg">${icon}</div>
      <div class="btn-name">${escHtml(name)}</div>
      <div class="btn-score">${escHtml(score)} 分</div>
    </div>`;
}

/** 积分排行榜 */
function buildPointRanking(records) {
  if (!records || records.length === 0) {
    return `<div class="empty-state" style="padding:30px;border:none;">
      <div class="empty-state-icon" style="font-size:32px;">⭐</div>
      <div class="empty-state-desc">本周暂无积分记录</div>
    </div>`;
  }

  // 按学生聚合
  const map = {};
  records.forEach(r => {
    const id   = r.student_id;
    const name = r.students?.name || id;
    if (!map[id]) map[id] = { id, name, total: 0, lastItem: '' };
    map[id].total    += (r.score || 0);
    map[id].lastItem  = r.item_label || '';
  });

  const ranked = Object.values(map).sort((a,b) => b.total - a.total).slice(0,5);
  const rankIcons = ['🥇','🥈','🥉'];

  return ranked.map((s, i) => `
    <div class="list-item">
      <span class="rank-num rank-${i+1}">${rankIcons[i] || i+1}</span>
      ${renderListAvatar(s.name)}
      <div class="list-info">
        <div class="list-name">${escHtml(s.name)}</div>
        <div class="list-sub">${escHtml(s.lastItem)}</div>
      </div>
      <div class="list-right">
        <div class="list-value ${s.total >= 0 ? 'text-gold' : 'text-red'}">${formatScore(s.total)}</div>
        <div class="list-label">积分</div>
      </div>
    </div>`).join('');
}

/** 通知列表 */
function buildNoticeList(notices) {
  if (!notices || notices.length === 0) {
    return `<div class="empty-state" style="padding:24px;border:none;">
      <div class="empty-state-desc">暂无通知</div>
    </div>`;
  }
  const colors = ['var(--color-gold)','var(--color-teal)','var(--color-green)','var(--color-purple)','var(--color-orange)'];
  return notices.map((n, i) => `
    <div class="notice-item" onclick="navigateTo('notice.html')">
      <span class="notice-dot" style="background:${colors[i % colors.length]}"></span>
      <div>
        <div class="notice-title">
          ${escHtml(n.title)}
          ${n.is_pinned ? `<span class="badge badge-pin">📌 置顶</span>` : ''}
        </div>
        <div class="notice-meta">${timeAgo(n.created_at)}</div>
      </div>
    </div>`).join('');
}

/** 宿舍排名 */
function buildDormRanking(dorms) {
  if (!dorms || dorms.length === 0) {
    return `<div class="empty-state" style="padding:24px;border:none;">
      <div class="empty-state-desc">暂无宿舍评分数据</div>
    </div>`;
  }
  const rankIcons = ['🥇','🥈','🥉'];
  const colors    = [
    'var(--color-green)',
    'var(--color-teal-light)',
    'var(--color-gold)',
    'var(--text-secondary)',
  ];
  return dorms.map((d, i) => `
    <div class="list-item">
      <span class="rank-num rank-${i+1}">${rankIcons[i] || i+1}</span>
      <div class="list-info">
        <div class="list-name">${escHtml(d.dorm_no)} 宿舍</div>
      </div>
      <div class="list-right">
        <div class="list-value" style="color:${colors[i] || 'var(--text-secondary)'}">
          ${d.avg}
        </div>
        <div class="list-label">平均分</div>
      </div>
    </div>`).join('');
}

/** 考勤日历 */
function buildAttCalendar(records) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const days  = getDaysInMonth(year, month);

  // 构建日期 → 状态 map
  const statusMap = {};
  (records || []).forEach(r => { statusMap[r.date] = r.status; });

  const weekdays = ['一','二','三','四','五','六','日'];
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // 转换为以周一为起点
  const offset = (firstDay + 6) % 7;

  let calHtml = `
    <div class="att-calendar-header">
      ${weekdays.map(d => `<span>${d}</span>`).join('')}
    </div>
    <div class="att-calendar">`;

  // 前置空格
  for (let i = 0; i < offset; i++) {
    calHtml += `<div class="att-day empty"></div>`;
  }

  days.forEach(d => {
    const dateStr = formatDate(d);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isFuture  = d > now;
    let cls = 'empty';
    if (isFuture || isWeekend) {
      cls = 'future';
    } else if (statusMap[dateStr]) {
      cls = statusMap[dateStr] === 'absent' ? 'absent'
          : statusMap[dateStr] === 'late'   ? 'late'
          : ['leave','sick','public'].includes(statusMap[dateStr]) ? 'leave'
          : 'present';
    } else {
      cls = 'present'; // 默认出勤
    }
    calHtml += `<div class="att-day ${cls}">${d.getDate()}</div>`;
  });

  calHtml += `</div>
    <div class="att-legend">
      <div class="att-legend-item"><span class="att-legend-dot" style="background:rgba(16,185,129,0.5)"></span>出勤</div>
      <div class="att-legend-item"><span class="att-legend-dot" style="background:rgba(245,158,11,0.5)"></span>迟到</div>
      <div class="att-legend-item"><span class="att-legend-dot" style="background:rgba(239,68,68,0.5)"></span>旷课</div>
      <div class="att-legend-item"><span class="att-legend-dot" style="background:rgba(14,165,233,0.5)"></span>请假</div>
    </div>`;

  return calHtml;
}

/** 成绩进度条列表 */
function buildScoreRows(subjects) {
  if (!subjects || subjects.length === 0) {
    return `<div class="empty-state" style="padding:24px;border:none;"><div class="empty-state-desc">暂无成绩数据</div></div>`;
  }
  const colors = ['teal','green','gold','purple','orange','teal'];
  return subjects.map((s, i) => `
    <div class="progress-labeled" style="margin-bottom:14px;">
      <div class="progress-labeled-header">
        <span class="label">${escHtml(s.name)}</span>
        <span class="value">${s.score} / ${s.max || 100}</span>
      </div>
      <div class="progress" style="margin-top:5px;">
        <div class="progress-bar ${colors[i % colors.length]}"
             style="width:${((s.score / (s.max||100))*100).toFixed(1)}%"></div>
      </div>
    </div>`).join('');
}

/** 积分总分（week汇总） */
function pointsTotalThisWeek(records) {
  return (records || []).reduce((sum, r) => sum + (r.score || 0), 0);
}

/** 计算工作日数 */
function countWorkdays(start, end) {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/* ============================================================
   Mock 数据（Supabase 未配置或数据为空时使用）
   ============================================================ */
const MOCK_ATT = [
  { student_id: 's1', students: { name: '张三' }, status: 'late',  remark: '7:35到校', record_time: new Date().toISOString() },
  { student_id: 's2', students: { name: '李四' }, status: 'sick',  remark: '感冒请假', record_time: new Date().toISOString() },
];

const MOCK_POINTS = [
  { student_id: 's3', students: { name: '王晓明' }, score: +10, item_label: '值日优秀',   created_at: new Date().toISOString() },
  { student_id: 's4', students: { name: '张丽华' }, score: +5,  item_label: '作业优秀',   created_at: new Date().toISOString() },
  { student_id: 's5', students: { name: '赵建国' }, score: +3,  item_label: '班级服务',   created_at: new Date().toISOString() },
  { student_id: 's6', students: { name: '刘静雯' }, score: -2,  item_label: '迟到',       created_at: new Date().toISOString() },
  { student_id: 's7', students: { name: '陈思远' }, score: +2,  item_label: '作业完成',   created_at: new Date().toISOString() },
];

const MOCK_DORMS = [
  { dorm_no: '303', avg: 96.5 },
  { dorm_no: '301', avg: 93.2 },
  { dorm_no: '302', avg: 90.8 },
];

const MOCK_NOTICES = [
  { id: 'n1', title: '明天春游通知', created_at: new Date().toISOString(), is_pinned: true },
  { id: 'n2', title: '期中考试时间安排', created_at: new Date(Date.now()-4*86400000).toISOString(), is_pinned: false },
  { id: 'n3', title: '第2周值日安排公告', created_at: new Date(Date.now()-3*86400000).toISOString(), is_pinned: false },
];

const MOCK_STUDENT_ATT = [
  { date: formatDate(new Date()), status: 'late' },
  { date: formatDate(new Date(Date.now()-86400000)), status: 'present' },
];

const MOCK_SUBJECTS = [
  { name: '语文',  score: 85, max: 100 },
  { name: '数学',  score: 90, max: 100 },
  { name: '英语',  score: 78, max: 100 },
  { name: '专业课', score: 92, max: 100 },
];
