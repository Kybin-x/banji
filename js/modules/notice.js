/* ============================================================
   notice.js — 班级通知
   班级管理系统 v1.0
   ============================================================ */
'use strict';

let _noticeSession = null;

async function initPage(session) {
  _noticeSession = session;
  const canEdit = session.role === 'teacher';

  document.getElementById('page-content').innerHTML = `
  <div class="page-header page-header-row">
    <div><h1>班级通知</h1><p>查看和管理班级公告</p></div>
    ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openAddNotice()">＋ 发布通知</button>` : ''}
  </div>

  <div class="card" id="notice-list-card">
    <div class="skeleton" style="height:300px;"></div>
  </div>

  <div class="modal-overlay" id="notice-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="notice-modal-title">发布通知</div>
        <button class="modal-close" onclick="closeModal('notice-modal')">✕</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="notice-edit-id">
        <div class="form-group">
          <label class="form-label">标题 <span class="required">*</span></label>
          <input class="form-input" id="notice-title-input" placeholder="通知标题">
        </div>
        <div class="form-group">
          <label class="form-label">内容</label>
          <textarea class="form-textarea" id="notice-content-input" rows="5" placeholder="通知详细内容（可选）"></textarea>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">可见范围</label>
            <select class="form-select" id="notice-visible">
              <option value="all">学生和家长</option>
              <option value="student">仅学生</option>
              <option value="parent">仅家长</option>
              <option value="cadre">仅班干部</option>
            </select>
          </div>
          <div class="form-group" style="align-self:flex-end;padding-bottom:18px;">
            <label class="form-check">
              <input type="checkbox" id="notice-pin">
              <span>📌 置顶此通知</span>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('notice-modal')">取消</button>
        <button class="btn btn-primary"   onclick="saveNotice()">发布</button>
      </div>
    </div>
  </div>`;

  initModalClose();
  await loadNotices();
}

async function loadNotices() {
  const { data, error } = await NoticeAPI.getByClass(_noticeSession.classId);
  const card = document.getElementById('notice-list-card');
  if (!card) return;

  const canEdit = _noticeSession.role === 'teacher';
  const notices = data || [];
  const colors  = ['var(--color-gold)','var(--color-teal)','var(--color-green)','var(--color-purple)','var(--color-orange)'];

  if (error || notices.length === 0) {
    card.innerHTML = `<div class="empty-state" style="border:none;"><div class="empty-state-icon">📢</div><div class="empty-state-title">暂无通知</div></div>`;
    return;
  }

  card.innerHTML = notices.map((n, i) => `
    <div class="notice-card">
      <div class="notice-card-bar" style="background:${colors[i%colors.length]}"></div>
      <div class="notice-card-info">
        <div class="notice-card-title">
          ${escHtml(n.title)}
          ${n.is_pinned ? `<span class="badge badge-pin" style="margin-left:6px;">📌 置顶</span>` : ''}
        </div>
        <div class="notice-card-meta">
          ${timeAgo(n.created_at)} · 可见：${visibleLabel(n.visible_to)}
          ${canEdit && n.read_count !== undefined ? ` · 已读 ${n.read_count}/${n.total_count||'—'}` : ''}
        </div>
      </div>
      ${canEdit ? `
      <div class="notice-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditNotice('${n.id}')">编辑</button>
        <button class="btn btn-danger btn-sm"    onclick="deleteNotice('${n.id}')">删除</button>
      </div>` : ''}
    </div>`).join('');
}

function visibleLabel(v) {
  return { all:'学生和家长', student:'仅学生', parent:'仅家长', cadre:'仅班干部' }[v] || '全部';
}

function openAddNotice() {
  document.getElementById('notice-modal-title').textContent = '发布通知';
  document.getElementById('notice-edit-id').value = '';
  document.getElementById('notice-title-input').value = '';
  document.getElementById('notice-content-input').value = '';
  document.getElementById('notice-visible').value = 'all';
  document.getElementById('notice-pin').checked = false;
  openModal('notice-modal');
}

function openEditNotice(id) {
  // 简化：重新查单条再填入
  Toast.info('编辑功能：点击后填入已有内容，敬请期待完整实现');
}

async function saveNotice() {
  const id      = document.getElementById('notice-edit-id').value;
  const title   = document.getElementById('notice-title-input').value.trim();
  const content = document.getElementById('notice-content-input').value.trim();
  const visible = document.getElementById('notice-visible').value;
  const pinned  = document.getElementById('notice-pin').checked;

  if (!title) { Toast.warning('请填写通知标题'); return; }

  const payload = {
    class_id:   _noticeSession.classId,
    title, content: content||null,
    visible_to: visible,
    is_pinned:  pinned,
    author_id:  _noticeSession.userId,
  };

  const result = id ? await NoticeAPI.update(id, payload) : await NoticeAPI.create(payload);
  if (result.error) { Toast.error('保存失败：'+result.error.message); return; }

  Toast.success(id ? '通知已更新' : '通知已发布');
  closeModal('notice-modal');
  await loadNotices();
}

async function deleteNotice(id) {
  if (!confirm('确定删除该通知？')) return;
  const { error } = await NoticeAPI.delete(id);
  if (error) { Toast.error('删除失败'); return; }
  Toast.success('已删除');
  await loadNotices();
}
