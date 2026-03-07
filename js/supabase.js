/* ============================================================
   supabase.js — Supabase 初始化与 API 封装
   班级管理系统 v1.0

   使用方法：
   1. 在 html 中通过 CDN 引入 Supabase：
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   2. 将 config.js 中 SUPABASE_CONFIG 填入真实的 URL 和 KEY
   ============================================================ */

'use strict';

/* ---------- 初始化客户端 ---------- */
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (typeof supabase === 'undefined') {
    console.error('[supabase.js] Supabase CDN 未加载，请检查 <script> 引入');
    return null;
  }
  _supabase = supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );
  return _supabase;
}

/* ============================================================
   Auth — 认证
   ============================================================ */
const Auth = {
  /**
   * 用手机号+密码登录
   * Supabase 用 email 字段存手机号（phone@cms.local 格式）
   */
  async signIn(phone, password) {
    const db = getSupabase();
    if (!db) return { error: { message: '数据库未连接' } };
    const email = `${phone}@cms.local`;
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  /** 登出 */
  async signOut() {
    const db = getSupabase();
    if (!db) return;
    await db.auth.signOut();
  },

  /** 获取当前登录用户（Supabase auth user） */
  async getUser() {
    const db = getSupabase();
    if (!db) return null;
    const { data: { user } } = await db.auth.getUser();
    return user;
  },

  /** 修改密码 */
  async updatePassword(newPassword) {
    const db = getSupabase();
    if (!db) return { error: { message: '数据库未连接' } };
    return await db.auth.updateUser({ password: newPassword });
  },
};

/* ============================================================
   DB — 通用数据库操作封装
   ============================================================ */
const DB = {
  /**
   * 查询数据
   * @param {string} table   - 表名
   * @param {object} options - { select, match, order, limit, range }
   */
  async query(table, options = {}) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };

    let q = db.from(table).select(options.select || '*');

    if (options.match) {
      Object.entries(options.match).forEach(([k, v]) => {
        q = q.eq(k, v);
      });
    }

    if (options.filters) {
      options.filters.forEach(([col, op, val]) => {
        q = q[op](col, val);
      });
    }

    if (options.order) {
      const { col, asc = true } = options.order;
      q = q.order(col, { ascending: asc });
    }

    if (options.limit) q = q.limit(options.limit);

    if (options.range) {
      const [from, to] = options.range;
      q = q.range(from, to);
    }

    return await q;
  },

  /** 插入单条或多条数据 */
  async insert(table, data) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };
    return await db.from(table).insert(data).select();
  },

  /** 更新数据 */
  async update(table, data, match) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };
    let q = db.from(table).update(data);
    Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); });
    return await q.select();
  },

  /** 删除数据 */
  async delete(table, match) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };
    let q = db.from(table).delete();
    Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); });
    return await q;
  },

  /** 获取单条记录（by id） */
  async getById(table, id) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };
    const { data, error } = await db.from(table).select('*').eq('id', id).single();
    return { data, error };
  },

  /** 批量插入并返回插入结果 */
  async batchInsert(table, rows) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };
    return await db.from(table).insert(rows).select();
  },
};

/* ============================================================
   Storage — 文件存储
   ============================================================ */
const FileStorage = {
  /**
   * 上传文件
   * @param {string} bucket - 存储桶名
   * @param {string} path   - 文件路径（含文件名）
   * @param {File}   file   - File 对象
   */
  async upload(bucket, path, file) {
    const db = getSupabase();
    if (!db) return { data: null, error: { message: '数据库未连接' } };
    return await db.storage.from(bucket).upload(path, file, { upsert: true });
  },

  /**
   * 获取公开 URL
   */
  getPublicUrl(bucket, path) {
    const db = getSupabase();
    if (!db) return '';
    const { data } = db.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || '';
  },

  /**
   * 删除文件
   */
  async remove(bucket, paths) {
    const db = getSupabase();
    if (!db) return;
    return await db.storage.from(bucket).remove(paths);
  },
};

/* ============================================================
   业务 API — 各模块数据操作
   ============================================================ */

/* --- 用户相关 --- */
const UserAPI = {
  /** 获取当前用户的业务信息（从 users 表） */
  async getCurrent() {
    const authUser = await Auth.getUser();
    if (!authUser) return null;
    const { data } = await DB.query('users', {
      match: { id: authUser.id },
    });
    return data?.[0] || null;
  },

  /** 获取用户信息（含角色、班级） */
  async getProfile(userId) {
    const { data } = await DB.query('users', {
      select: '*, classes(name)',
      match:  { id: userId },
    });
    return data?.[0] || null;
  },
};

/* --- 学生相关 --- */
const StudentAPI = {
  /** 获取班级所有学生 */
  async getByClass(classId) {
    return await DB.query('students', {
      match: { class_id: classId },
      order: { col: 'student_no', asc: true },
    });
  },

  /** 搜索学生（按学号或姓名） */
  async search(classId, keyword) {
    const db = getSupabase();
    if (!db) return { data: [], error: null };
    return await db.from('students')
      .select('*')
      .eq('class_id', classId)
      .or(`name.ilike.%${keyword}%,student_no.ilike.%${keyword}%`);
  },

  /** 新增单个学生 */
  async create(studentData) {
    return await DB.insert('students', studentData);
  },

  /** 批量导入学生 */
  async batchCreate(students) {
    return await DB.batchInsert('students', students);
  },

  /** 更新学生信息 */
  async update(id, data) {
    return await DB.update('students', data, { id });
  },

  /** 删除学生 */
  async delete(id) {
    return await DB.delete('students', { id });
  },
};

/* --- 考勤相关 --- */
const AttendanceAPI = {
  /** 获取某日考勤记录（异常列表） */
  async getByDate(classId, date) {
    return await DB.query('attendance_records', {
      select: '*, students(name, student_no)',
      match:  { class_id: classId, date },
    });
  },

  /** 获取某学生某时间段考勤 */
  async getByStudent(studentId, startDate, endDate) {
    const db = getSupabase();
    if (!db) return { data: [], error: null };
    return await db.from('attendance_records')
      .select('*')
      .eq('student_id', studentId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });
  },

  /** 登记单条考勤 */
  async create(record) {
    return await DB.insert('attendance_records', record);
  },

  /** 更新考勤 */
  async update(id, data) {
    return await DB.update('attendance_records', data, { id });
  },

  /** 删除考勤记录 */
  async delete(id) {
    return await DB.delete('attendance_records', { id });
  },
};

/* --- 成绩相关 --- */
const ScoreAPI = {
  /** 获取某次考试的全班成绩 */
  async getByExam(examId) {
    return await DB.query('scores', {
      select: '*, students(name, student_no)',
      match:  { exam_id: examId },
      order:  { col: 'total_score', asc: false },
    });
  },

  /** 批量导入成绩 */
  async batchCreate(scores) {
    return await DB.batchInsert('scores', scores);
  },
};

/* --- 积分相关 --- */
const PointAPI = {
  /** 获取班级积分记录 */
  async getByClass(classId, options = {}) {
    const db = getSupabase();
    if (!db) return { data: [], error: null };
    let q = db.from('point_records')
      .select('*, students(name, student_no)')
      .eq('class_id', classId);

    if (options.startDate) q = q.gte('date', options.startDate);
    if (options.endDate)   q = q.lte('date', options.endDate);
    q = q.order('created_at', { ascending: false });
    return await q;
  },

  /** 登记积分 */
  async create(record) {
    return await DB.insert('point_records', record);
  },

  /** 批量登记积分 */
  async batchCreate(records) {
    return await DB.batchInsert('point_records', records);
  },
};

/* --- 通知相关 --- */
const NoticeAPI = {
  /** 获取班级通知列表 */
  async getByClass(classId) {
    const db = getSupabase();
    if (!db) return { data: [], error: null };
    return await db.from('notices')
      .select('*')
      .eq('class_id', classId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
  },

  /** 发布通知 */
  async create(notice) {
    return await DB.insert('notices', notice);
  },

  /** 更新通知 */
  async update(id, data) {
    return await DB.update('notices', data, { id });
  },

  /** 删除通知 */
  async delete(id) {
    return await DB.delete('notices', { id });
  },
};
