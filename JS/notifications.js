const app = window.TrustLineApp;
async function loadNotifications(){
  const data = await app.api('/api/notifications');
  const rows = data.notifications || [];
  document.getElementById('unreadCount').textContent = rows.filter(item => !item.is_read).length;
  const list = document.getElementById('notificationList');
  list.innerHTML = rows.length ? rows.map(item => `<div class="notification-item" data-id="${item.id}"><div class="notification-top"><div><strong>${item.title}</strong><div class="helper">${item.message}</div></div>${item.is_read ? '<span class="tag">Read</span>' : '<span class="tag">Unread</span>'}</div><div class="helper">${app.dateTime(item.created_at)}</div></div>`).join('') : '<div class="empty">No notifications yet.</div>';
  list.querySelectorAll('.notification-item').forEach(node => node.addEventListener('click', async () => {
    try { await app.api(`/api/notifications/${node.dataset.id}/read`, { method:'POST' }); await loadNotifications(); } catch (error) { app.toast('Update failed', error.message); }
  }));
}

document.getElementById('readAllBtn').addEventListener('click', async () => {
  try { await app.api('/api/notifications/read-all', { method:'POST' }); await loadNotifications(); } catch (error) { app.toast('Update failed', error.message); }
});
window.addEventListener('DOMContentLoaded', async () => { await app.requireAuth(); await loadNotifications(); });
