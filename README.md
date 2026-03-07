# 班级管理系统 v1.0 — 部署说明

> 技术栈：纯 HTML / CSS / JS（无需构建工具）+ Supabase 后端  
> 适合部署到：Cloudflare Pages / GitHub Pages / 任意静态托管

---

## 一、目录结构

```
班级管理系统/
├── index.html              ← 登录页（入口）
├── css/
│   ├── base.css            ← CSS 变量、Reset、动画
│   ├── layout.css          ← 侧边栏 / 顶栏布局
│   ├── components.css      ← 通用组件（卡片/按钮/表格等）
│   └── pages.css           ← 各页面专属样式
├── js/
│   ├── config.js           ← ⭐ 配置文件（Supabase、演示模式）
│   ├── utils.js            ← 工具函数（日期/周次/Toast等）
│   ├── supabase.js         ← Supabase 客户端 + 业务 API
│   ├── auth.js             ← 登录 / 登出 / 权限校验
│   ├── layout.js           ← 侧边栏渲染 / 导航 / 跳转
│   └── modules/            ← 各功能页逻辑
│       ├── dashboard.js    ← 首页（4角色）
│       ├── students.js     ← 学生信息管理
│       ├── attendance.js   ← 考勤管理
│       ├── score.js        ← 成绩管理
│       ├── points.js       ← 积分/量化
│       ├── dorm.js         ← 宿舍管理
│       ├── seat.js         ← 座位管理
│       ├── duty.js         ← 值日管理
│       ├── notice.js       ← 班级通知
│       └── settings.js     ← 系统设置
├── pages/                  ← 各功能页 HTML（结构统一）
│   └── *.html
└── supabase_schema.sql     ← 数据库建表脚本
```

---

## 二、快速体验（演示模式）

无需任何配置，解压后**直接用浏览器打开 `index.html`** 即可。

| 角色 | 账号 | 密码 |
|------|------|------|
| 班主任 | 13800000000 | 123456 |
| 班干部 | 13800000099 | 0099 |
| 学生 | 13800000002 | 0002 |
| 家长 | 13800000100 | 0100 |

> ⚠️ 演示模式下数据均为 Mock 数据，刷新后重置，不会真正写入数据库。

---

## 三、连接真实 Supabase（生产环境）

### 第 1 步：建表

在 [Supabase 控制台](https://app.supabase.com) → 你的项目 → **SQL Editor** 中，  
将 `supabase_schema.sql` 的全部内容粘贴执行。

### 第 2 步：关闭演示模式

打开 `js/config.js`，将：
```js
const DEMO_MODE = true;
```
改为：
```js
const DEMO_MODE = false;
```

### 第 3 步：创建班主任账号

在 Supabase 控制台 → **Authentication → Users → Add user**：

- Email：`13800000000@cms.local`（手机号 + @cms.local）
- Password：自定义密码（如 `Teacher@2026`）

然后在 SQL Editor 执行：
```sql
insert into users (id, class_id, role, display_name, phone, class_no)
values (
  '替换为上一步创建的用户UUID',
  '00000000-0000-0000-0000-000000000001',
  'teacher',
  '王雪梅',
  '13800000000',
  '24电商6班'
);
```

### 第 4 步：批量导入学生

**方式 A — 前端操作**  
登录班主任账号 → 学生信息 → 批量导入（上传 Excel）

**方式 B — SQL 直接插入**  
```sql
insert into students (class_id, student_no, name, gender, phone, is_boarding, dorm_no)
values
  ('00000000-0000-0000-0000-000000000001', '2024001', '张三', '男', '13800000001', true, '301'),
  ('00000000-0000-0000-0000-000000000001', '2024002', '张丽华', '女', '13800000002', true, '302');
  -- ... 继续添加
```

### 第 5 步：为学生创建登录账号

每个学生在 Supabase Auth 中创建账号（自动化脚本，在 settings 页面点击「同步学生账号」），  
或批量执行 SQL（需借助 Supabase Edge Function）。

初始密码规则：身份证后4位。

---

## 四、部署到 Cloudflare Pages（推荐）

1. 将整个文件夹推送到 GitHub 仓库
2. 登录 [Cloudflare Pages](https://pages.cloudflare.com)
3. 创建新项目 → 连接 GitHub 仓库
4. 构建设置：
   - **框架预设**：None
   - **构建命令**：留空
   - **输出目录**：`/`（根目录）
5. 点击部署，完成后获得 `xxx.pages.dev` 域名

> ⚠️ 注意：需要在 Supabase 项目设置 → API → **Allowed Origins** 中添加你的 Pages 域名。

---

## 五、部署到 GitHub Pages

```bash
# 1. 初始化仓库
git init
git add .
git commit -m "init: 班级管理系统 v1.0"

# 2. 推送到 GitHub
git remote add origin https://github.com/你的用户名/class-management.git
git push -u origin main

# 3. 开启 GitHub Pages
# 仓库设置 → Pages → Branch: main → 根目录 /
```

访问地址：`https://你的用户名.github.io/class-management/`

---

## 六、学期配置

登录班主任账号 → 系统设置 → 学期配置：

| 字段 | 说明 |
|------|------|
| 学期名称 | 如 `2025-2026学年第二学期` |
| 第1周周一 | 如 `2026-02-24`（影响全系统周次显示）|
| 总周数 | 如 `20` |

配置完成后所有页面的「第X周」会自动计算。

---

## 七、角色权限说明

| 功能 | 班主任 | 班干部 | 学生 | 家长 |
|------|:------:|:------:|:----:|:----:|
| 学生信息（增删改） | ✅ | — | — | — |
| 考勤登记 | ✅ | ✅ | 只读 | 只读 |
| 成绩导入/管理 | ✅ | — | 只读 | 只读 |
| 积分登记 | ✅ | ✅ | 只读 | 只读 |
| 宿舍评分 | ✅ | ✅ | 只读 | — |
| 座位编排 | ✅ | — | 只读 | — |
| 值日管理 | ✅ | ✅ | 只读 | — |
| 发布通知 | ✅ | — | 只读 | 只读 |
| 系统设置 | ✅ | — | 个人 | 个人 |

---

## 八、常见问题

**Q：登录后跳转到空白页？**  
A：检查 `pages/` 目录是否与 `index.html` 同级，路径 `../js/config.js` 是否正确。

**Q：连接 Supabase 失败？**  
A：`settings` 页面有「测试连接」按钮。常见原因：
- CORS 未配置（Supabase → API Settings → Allowed Origins 加域名）
- anonKey 填写有误

**Q：想修改积分/考勤事项？**  
A：登录班主任 → 系统设置 → 自定义配置，可增删改积分事项、宿舍扣分项。

**Q：忘记密码？**  
A：班主任在 settings 页面 → 账号管理 → 重置密码。

---

## 九、数据备份

登录班主任账号 → 系统设置 → 数据管理 → 导出全部数据（Excel）。

Supabase 提供每日自动备份（付费计划），也可在控制台手动导出 PostgreSQL dump。

---

*最后更新：2026-03-07 · 班级管理系统 v1.0*
