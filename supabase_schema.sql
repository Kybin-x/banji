-- ============================================================
--  班级管理系统 — Supabase 数据库建表脚本
--  执行顺序：在 Supabase Dashboard → SQL Editor 中粘贴全部执行
--  数据库：PostgreSQL（Supabase 托管）
-- ============================================================

-- ============================================================
-- 0. 扩展（Row Level Security 等）
-- ============================================================
-- 启用 UUID 生成
create extension if not exists "pgcrypto";


-- ============================================================
-- 1. 班级表 classes
-- ============================================================
create table if not exists classes (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,               -- 班级名称，如 "24电商6班"
  dept           text,                         -- 专业/系部
  teacher_name   text,                         -- 班主任姓名
  teacher_phone  text,                         -- 班主任联系方式
  motto          text,                         -- 班训
  student_count  int default 50,               -- 全班人数（用于计算出勤率）
  created_at     timestamptz default now()
);

-- 示例班级数据
insert into classes (id, name, dept, teacher_name, teacher_phone, motto, student_count)
values ('00000000-0000-0000-0000-000000000001', '24电商6班', '电子商务专业', '王雪梅', '13800000000', '团结拼搏，勇争第一', 50)
on conflict (id) do nothing;


-- ============================================================
-- 2. 用户信息表 users（关联 Supabase Auth）
-- ============================================================
create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  class_id        uuid references classes(id),
  role            text not null check (role in ('teacher','cadre','student','parent')),
  display_name    text not null,
  phone           text,
  position        text,        -- 班干部职务，如 "纪律委员"
  class_no        text,        -- 冗余存储班级名，方便前端直接用
  is_first_login  boolean default true,
  created_at      timestamptz default now()
);

-- RLS：用户只能查看自己的信息（班主任可查看全班）
alter table users enable row level security;

create policy "users_select_own" on users
  for select using (auth.uid() = id);

create policy "users_select_teacher" on users
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.role = 'teacher' and u.class_id = users.class_id
    )
  );

create policy "users_update_own" on users
  for update using (auth.uid() = id);


-- ============================================================
-- 3. 学生信息表 students
-- ============================================================
create table if not exists students (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  user_id        uuid references users(id),     -- 对应的登录账号（可为空）
  student_no     text not null,                  -- 学号
  name           text not null,
  gender         text check (gender in ('男','女')),
  phone          text,                           -- 本人手机号（用作登录账号）
  id_card        text,                           -- 身份证号（脱敏存储）
  is_boarding    boolean default false,          -- 是否住校
  dorm_no        text,                           -- 宿舍号
  father_name    text,
  father_phone   text,
  mother_name    text,
  mother_phone   text,
  address        text,
  note           text,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  unique (class_id, student_no)
);

alter table students enable row level security;

-- 班主任可全部操作
create policy "students_teacher_all" on students
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = students.class_id)
  );

-- 学生/家长只能读自己/子女
create policy "students_self_select" on students
  for select using (user_id = auth.uid());

-- 班干可读取全班
create policy "students_cadre_select" on students
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'cadre' and u.class_id = students.class_id)
  );

-- 索引
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_no    on students(student_no);


-- ============================================================
-- 4. 学期表 semesters
-- ============================================================
create table if not exists semesters (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  name           text not null,            -- 如 "2025-2026学年第二学期"
  start_date     date not null,            -- 第1周周一
  total_weeks    int default 20,
  is_current     boolean default false,
  created_at     timestamptz default now()
);

alter table semesters enable row level security;
create policy "semesters_class_read" on semesters
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.class_id = semesters.class_id)
  );
create policy "semesters_teacher_all" on semesters
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = semesters.class_id)
  );

-- 示例学期
insert into semesters (class_id, name, start_date, total_weeks, is_current)
values ('00000000-0000-0000-0000-000000000001', '2025-2026学年第二学期', '2026-02-24', 20, true)
on conflict do nothing;


-- ============================================================
-- 5. 考勤记录表 attendance_records
--    默认全员出勤，只记录「异常」（迟到/旷课/请假等）
-- ============================================================
create table if not exists attendance_records (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  student_id     uuid not null references students(id) on delete cascade,
  date           date not null,
  status         text not null check (status in ('late','absent','leave','sick','early','public')),
  note           text,
  recorder_id    uuid references users(id),
  created_at     timestamptz default now(),
  unique (student_id, date, status)   -- 同一天同一状态不重复
);

alter table attendance_records enable row level security;

create policy "att_teacher_cadre_all" on attendance_records
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('teacher','cadre') and u.class_id = attendance_records.class_id)
  );

create policy "att_student_own" on attendance_records
  for select using (
    exists (select 1 from students s where s.id = attendance_records.student_id and s.user_id = auth.uid())
  );

create policy "att_parent_own" on attendance_records
  for select using (
    exists (
      select 1 from students s
      join users u on u.id = auth.uid() and u.role = 'parent'
      where s.id = attendance_records.student_id and s.father_phone = u.phone
    )
  );

create index if not exists idx_att_class_date on attendance_records(class_id, date);
create index if not exists idx_att_student    on attendance_records(student_id);


-- ============================================================
-- 6. 考试表 exams
-- ============================================================
create table if not exists exams (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  semester_id    uuid references semesters(id),
  name           text not null,
  exam_date      date,
  subjects       jsonb,     -- ["语文","数学","英语","专业课"]
  subject_maxes  jsonb,     -- {"语文":100,"数学":100,...}
  created_at     timestamptz default now()
);

alter table exams enable row level security;
create policy "exams_class_read" on exams
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.class_id = exams.class_id)
  );
create policy "exams_teacher_all" on exams
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = exams.class_id)
  );


-- ============================================================
-- 7. 成绩表 scores
-- ============================================================
create table if not exists scores (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references exams(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  score_details   jsonb,       -- {"语文":85,"数学":90,"英语":78,"专业课":92}
  total_score     numeric,
  rank_in_class   int,
  created_at      timestamptz default now(),
  unique (exam_id, student_id)
);

alter table scores enable row level security;
create policy "scores_teacher_cadre_all" on scores
  for all using (
    exists (
      select 1 from users u
      join exams e on e.id = scores.exam_id
      where u.id = auth.uid() and u.role in ('teacher') and u.class_id = e.class_id
    )
  );
create policy "scores_student_own" on scores
  for select using (
    exists (select 1 from students s where s.id = scores.student_id and s.user_id = auth.uid())
  );

create index if not exists idx_scores_exam    on scores(exam_id);
create index if not exists idx_scores_student on scores(student_id);


-- ============================================================
-- 8. 积分/量化记录表 point_records
-- ============================================================
create table if not exists point_records (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  student_id     uuid not null references students(id) on delete cascade,
  item_label     text not null,   -- 事项名称，如 "课堂玩手机"
  category       text,             -- 分类，如 "纪律类"
  score          int not null,     -- 正数加分，负数扣分
  date           date not null default current_date,
  note           text,
  recorder_id    uuid references users(id),
  created_at     timestamptz default now()
);

alter table point_records enable row level security;

create policy "points_teacher_cadre_all" on point_records
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('teacher','cadre') and u.class_id = point_records.class_id)
  );
create policy "points_student_own" on point_records
  for select using (
    exists (select 1 from students s where s.id = point_records.student_id and s.user_id = auth.uid())
  );
create policy "points_parent_child" on point_records
  for select using (
    exists (
      select 1 from students s
      join users u on u.id = auth.uid() and u.role = 'parent'
      where s.id = point_records.student_id and s.father_phone = u.phone
    )
  );

create index if not exists idx_points_class_date on point_records(class_id, date);
create index if not exists idx_points_student    on point_records(student_id);


-- ============================================================
-- 9. 宿舍评分表 dorm_scores
-- ============================================================
create table if not exists dorm_scores (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  dorm_no        text not null,
  date           date not null default current_date,
  score          int not null default 100,       -- 满分100，扣分项目扣减
  deduct_items   text,                            -- 扣分项描述，如 "整洁卫生, 物品摆放"
  violations     int default 0,
  note           text,
  checker_id     uuid references users(id),
  created_at     timestamptz default now()
);

alter table dorm_scores enable row level security;
create policy "dorm_teacher_cadre_all" on dorm_scores
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('teacher','cadre') and u.class_id = dorm_scores.class_id)
  );
create policy "dorm_student_select" on dorm_scores
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.class_id = dorm_scores.class_id)
  );

create index if not exists idx_dorm_class_date on dorm_scores(class_id, date);


-- ============================================================
-- 10. 座位安排表 seat_arrangements
-- ============================================================
create table if not exists seat_arrangements (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  semester_id    uuid references semesters(id),
  name           text default '当前座位',   -- 如 "第3周座位"
  layout         jsonb not null,             -- [{row,col,student_id,name},...]
  rows           int default 9,
  cols           int default 6,
  is_current     boolean default true,
  created_at     timestamptz default now()
);

alter table seat_arrangements enable row level security;
create policy "seat_class_read" on seat_arrangements
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.class_id = seat_arrangements.class_id)
  );
create policy "seat_teacher_all" on seat_arrangements
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = seat_arrangements.class_id)
  );


-- ============================================================
-- 11. 值日分组表 duty_groups
-- ============================================================
create table if not exists duty_groups (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  semester_id    uuid references semesters(id),
  group_no       int not null,            -- 组号，从1开始
  member_ids     jsonb,                    -- [student_id, ...]
  member_names   text,                     -- 冗余文本，如 "张三、李四、王五"
  created_at     timestamptz default now(),
  unique (class_id, semester_id, group_no)
);

alter table duty_groups enable row level security;
create policy "duty_groups_class_read" on duty_groups
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.class_id = duty_groups.class_id)
  );
create policy "duty_groups_teacher_all" on duty_groups
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = duty_groups.class_id)
  );


-- ============================================================
-- 12. 值日排班表 duty_schedule
-- ============================================================
create table if not exists duty_schedule (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id),
  group_id       uuid references duty_groups(id),
  date           date not null,
  is_done        boolean default false,
  done_at        timestamptz,
  note           text,
  created_at     timestamptz default now(),
  unique (class_id, date)
);

alter table duty_schedule enable row level security;
create policy "duty_schedule_class_read" on duty_schedule
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.class_id = duty_schedule.class_id)
  );
create policy "duty_schedule_teacher_cadre_all" on duty_schedule
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role in ('teacher','cadre') and u.class_id = duty_schedule.class_id)
  );


-- ============================================================
-- 13. 班级通知表 notices
-- ============================================================
create table if not exists notices (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references classes(id),
  title            text not null,
  content          text,
  attachment_url   text,
  is_pinned        boolean default false,
  visible_cadre    boolean default true,
  visible_student  boolean default true,
  visible_parent   boolean default true,
  read_count       int default 0,
  total_count      int default 50,
  publisher_id     uuid references users(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table notices enable row level security;

-- 班主任可全部操作
create policy "notices_teacher_all" on notices
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = notices.class_id)
  );

-- 班干可读取
create policy "notices_cadre_select" on notices
  for select using (
    visible_cadre = true and
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'cadre' and u.class_id = notices.class_id)
  );

-- 学生可读取
create policy "notices_student_select" on notices
  for select using (
    visible_student = true and
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'student' and u.class_id = notices.class_id)
  );

-- 家长可读取
create policy "notices_parent_select" on notices
  for select using (
    visible_parent = true and
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'parent' and u.class_id = notices.class_id)
  );

create index if not exists idx_notices_class on notices(class_id, created_at desc);


-- ============================================================
-- 14. 通知已读记录表 notice_reads（可选，精确已读统计）
-- ============================================================
create table if not exists notice_reads (
  id          uuid primary key default gen_random_uuid(),
  notice_id   uuid not null references notices(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  read_at     timestamptz default now(),
  unique (notice_id, user_id)
);

alter table notice_reads enable row level security;
create policy "notice_reads_own" on notice_reads
  for all using (auth.uid() = user_id);


-- ============================================================
-- 15. 班费记录表 fund_records（可选）
-- ============================================================
create table if not exists fund_records (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id),
  type         text check (type in ('income','expense')),
  amount       numeric(10,2) not null,
  description  text not null,
  date         date not null default current_date,
  recorder_id  uuid references users(id),
  created_at   timestamptz default now()
);

alter table fund_records enable row level security;
create policy "fund_teacher_all" on fund_records
  for all using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'teacher' and u.class_id = fund_records.class_id)
  );
create policy "fund_cadre_read" on fund_records
  for select using (
    exists (select 1 from users u where u.id = auth.uid() and u.role = 'cadre' and u.class_id = fund_records.class_id)
  );


-- ============================================================
-- 16. 实用视图
-- ============================================================

-- 学生积分汇总视图（按学期）
create or replace view v_student_point_summary as
select
  pr.student_id,
  s.name           as student_name,
  s.student_no,
  pr.class_id,
  sum(pr.score)    as total_score,
  count(*)         as record_count,
  sum(case when pr.score > 0 then pr.score else 0 end) as plus_score,
  sum(case when pr.score < 0 then pr.score else 0 end) as minus_score
from point_records pr
join students s on s.id = pr.student_id
group by pr.student_id, s.name, s.student_no, pr.class_id;

-- 今日出勤概况视图
create or replace view v_today_attendance as
select
  ar.class_id,
  ar.date,
  ar.status,
  count(*) as count,
  s.name   as student_name,
  s.student_no
from attendance_records ar
join students s on s.id = ar.student_id
where ar.date = current_date
group by ar.class_id, ar.date, ar.status, s.name, s.student_no;

-- 宿舍本周均分视图
create or replace view v_dorm_week_avg as
select
  class_id,
  dorm_no,
  round(avg(score)::numeric, 1) as avg_score,
  sum(violations)               as total_violations,
  count(*)                      as check_count
from dorm_scores
where date >= date_trunc('week', current_date)
group by class_id, dorm_no
order by avg_score desc;


-- ============================================================
-- 17. 常用函数
-- ============================================================

-- 计算学生考勤月统计
create or replace function get_student_att_monthly(
  p_student_id uuid,
  p_year int,
  p_month int
)
returns table (
  status       text,
  count        bigint
) language sql as $$
  select status, count(*)
  from attendance_records
  where student_id = p_student_id
    and extract(year from date) = p_year
    and extract(month from date) = p_month
  group by status;
$$;

-- 更新成绩班级排名
create or replace function update_exam_rank(p_exam_id uuid)
returns void language plpgsql as $$
begin
  with ranked as (
    select id, row_number() over (order by total_score desc) as rk
    from scores
    where exam_id = p_exam_id
  )
  update scores
  set rank_in_class = ranked.rk
  from ranked
  where scores.id = ranked.id;
end;
$$;


-- ============================================================
-- 完成提示
-- ============================================================
do $$
begin
  raise notice '✅ 班级管理系统数据库建表完成！共创建 15 张表 + 3 个视图 + 2 个函数';
  raise notice '📌 下一步：在 Supabase Auth 中创建班主任账号，然后将 DEMO_MODE 改为 false';
end $$;
