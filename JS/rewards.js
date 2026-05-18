const app = window.TrustLineApp;
async function loadRewards(){
  const data = await app.api('/api/rewards');
  const rewards = data.rewards || [];
  const total = rewards.reduce((sum, item) => sum + Number(item.points || 0), 0);
  document.getElementById('rewardPoints').textContent = total.toLocaleString('en-IN');
  document.getElementById('rewardCount').textContent = rewards.length;
  document.getElementById('rewardBest').textContent = `${Math.max(0, ...rewards.map(item => Number(item.points || 0)))} pts`;
  document.getElementById('rewardHistory').innerHTML = rewards.length ? rewards.map(item => `<div class="reward-item"><div class="reward-top"><div><strong>${item.title}</strong><div class="helper">${item.reason || ''}</div></div><span class="points-badge">${item.points} pts</span></div><div class="helper">${app.dateTime(item.created_at)}</div></div>`).join('') : '<div class="empty">No rewards yet. Link a bank or make a payment to start earning points.</div>';
}
window.addEventListener('DOMContentLoaded', async () => { await app.requireAuth(); await loadRewards(); });
