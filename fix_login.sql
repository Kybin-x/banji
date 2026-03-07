-- ============================================================
--  班主任登录问题修复脚本
--  在 Supabase 控制台 → SQL Editor 中执行全部内容
--  执行前请将下方三处「替换」改为你的实际值
-- ============================================================


-- ============================================================
-- 第 1 步：确认 Auth 用户（解决 Email not confirmed 问题）
-- 将 YOUR_USER_UUID 替换为你在 Authentication → Users 中看到的 UUID
-- ============================================================
update auth.users
set
  email_confirmed_at = now(),
  confirmation_sent_at = now()
where id = 'e1817820-cf93-4760-a7df-67df2c33ab92';   -- ← 你的 UUID


-- ============================================================
-- 第 2 步：确保 classes 表有对应班级（幂等操作）
-- ============================================================
insert into classes (id, name, dept, teacher_name, teacher_phone, motto, student_count)
values (
  '00000000-0000-0000-0000-000000000001',
  '24电商6班',
  '电子商务专业',
  '寇亚彬',
  '13416276892',
  '团结拼搏，勇争第一',
  50
)
on conflict (id) do update set
  teacher_name  = excluded.teacher_name,
  teacher_phone = excluded.teacher_phone;


-- ============================================================
-- 第 3 步：确保 users 表有班主任记录（幂等操作）
-- ============================================================
insert into users (id, class_id, role, display_name, phone, class_no, is_first_login)
values (
  'e1817820-cf93-4760-a7df-67df2c33ab92',   -- ← 你的 UUID（与第1步相同）
  '00000000-0000-0000-0000-000000000001',
  'teacher',
  '寇亚彬',
  '13416276892',
  '24电商6班',
  false
)
on conflict (id) do update set
  role         = excluded.role,
  display_name = excluded.display_name,
  phone        = excluded.phone,
  class_no     = excluded.class_no;


-- ============================================================
-- 第 4 步：确保 semesters 表有本学期数据
-- ============================================================
insert into semesters (class_id, name, start_date, total_weeks, is_current)
values (
  '00000000-0000-0000-0000-000000000001',
  '2025-2026学年第二学期',
  '2026-02-24',
  20,
  true
)
on conflict do nothing;


-- ============================================================
-- 验证：执行后应能查到你的用户记录
-- ============================================================
select
  u.id,
  u.display_name,
  u.role,
  u.class_no,
  a.email,
  a.email_confirmed_at,
  a.last_sign_in_at
from users u
join auth.users a on a.id = u.id
where u.id = 'e1817820-cf93-4760-a7df-67df2c33ab92';


-- ============================================================
-- 完成！刷新登录页，输入以下信息登录：
--   账号：13416276892
--   密码：kyb@123456（你在 Add user 时设置的密码）
--   角色：班主任
-- ============================================================
