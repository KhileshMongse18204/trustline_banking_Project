let userData = {
  name: "",
  email: "",
  avatar: null
};

function applyBadgeStyle(el, variant) {
  if (!el) return;

  const common = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "10px 16px",
    borderRadius: "999px",
    fontSize: "0.92rem",
    fontWeight: "800",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--text)"
  };

  const variants = {
    success: {
      color: "var(--green)",
      border: "1px solid rgba(85,239,196,0.22)",
      background: "rgba(85,239,196,0.08)"
    },
    warn: {
      color: "#ffd166",
      border: "1px solid rgba(255,209,102,0.22)",
      background: "rgba(255,209,102,0.08)"
    },
    info: {
      color: "var(--acc1)",
      border: "1px solid rgba(0,229,255,0.22)",
      background: "rgba(0,229,255,0.08)"
    }
  };

  Object.assign(el.style, common, variants[variant] || variants.info);
}

async function fetchUserData() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        userData.name = data.user.name || data.user.email || 'User';
        userData.email = data.user.email || '';
        userData.avatar = data.user.profile_photo || null;
      }
    }
  } catch (error) {
    console.log('Could not fetch user data:', error);
  }
}

function formatDateLabel(value) {
  try {
    const date = new Date(value);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Recently';
  }
}

function renderBankCard(primaryBank) {
  const linkedState = document.getElementById('bankLinkedState');
  const emptyState = document.getElementById('bankEmptyState');
  const statusBadge = document.getElementById('bankStatusBadge');
  const changeBtn = document.getElementById('bankChangeBtn');
  const manageBtn = document.getElementById('bankManageBtn');

  if (!linkedState || !emptyState || !statusBadge || !manageBtn || !changeBtn) return;

  if (!primaryBank) {
    linkedState.style.display = 'none';
    emptyState.style.display = 'flex';
    statusBadge.textContent = 'Not linked';
    applyBadgeStyle(statusBadge, 'warn');
    manageBtn.textContent = 'Register Account';
    changeBtn.style.display = 'none';
    return;
  }

  linkedState.style.display = 'block';
  emptyState.style.display = 'none';
  changeBtn.style.display = 'flex';

  statusBadge.textContent = 'Primary';
  applyBadgeStyle(statusBadge, 'success');

  document.getElementById('bankNameText').textContent = primaryBank.displayName;
  document.getElementById('bankHolderText').textContent = primaryBank.accountHolder;
  document.getElementById('bankPhoneText').textContent = primaryBank.phoneNumber;
  document.getElementById('bankTypeText').textContent = `${primaryBank.accountType} Account`;
  document.getElementById('bankUpiText').textContent = primaryBank.upiStatus;
  document.getElementById('bankBalanceText').textContent = TrustLineWallet.formatCurrency(primaryBank.balance);

  manageBtn.textContent = 'Manage Linked Banks';
}

function renderCardsCard(primaryBank) {
  const statusBadge = document.getElementById('cardsStatusBadge');
  const tier = document.getElementById('cardTierText');
  const chip = document.getElementById('cardChipText');
  const masked = document.getElementById('cardMaskedNumber');
  const linkedBankText = document.getElementById('cardLinkedBankText');
  const cardStatusText = document.getElementById('cardStatusText');
  const cardTypeText = document.getElementById('cardTypeText');
  const cardLimitText = document.getElementById('cardLimitText');
  const cardOnlineText = document.getElementById('cardOnlineText');
  const cardContactlessText = document.getElementById('cardContactlessText');

  if (!statusBadge) return;

  if (!primaryBank) {
    statusBadge.textContent = 'Pending';
    applyBadgeStyle(statusBadge, 'warn');
    tier.textContent = 'TrustLine Demo Card';
    chip.textContent = 'Awaiting setup';
    masked.textContent = '•••• 0000';
    linkedBankText.textContent = 'Link bank first';
    cardStatusText.textContent = 'Not issued';
    cardTypeText.textContent = 'Virtual debit';
    cardLimitText.textContent = '₹9000.00';
    cardOnlineText.textContent = 'Disabled';
    cardContactlessText.textContent = 'Disabled';
    return;
  }

  statusBadge.textContent = 'Active';
  applyBadgeStyle(statusBadge, 'success');
  tier.textContent = 'TrustLine Virtual Debit';
  chip.textContent = 'Protected';
  masked.textContent = `•••• ${primaryBank.last4}`;
  linkedBankText.textContent = primaryBank.bankName;
  cardStatusText.textContent = 'Ready';
  cardTypeText.textContent = `${primaryBank.accountType} linked card`;
  cardLimitText.textContent = '₹1,00,000/day';
  cardOnlineText.textContent = 'Enabled';
  cardContactlessText.textContent = 'Enabled';
}

function renderTransactionsCard(transactions) {
  const list = document.getElementById('transactionsList');
  const summaryValue = document.getElementById('transactionSummaryValue');
  const countValue = document.getElementById('transactionCountValue');
  const statusBadge = document.getElementById('txnStatusBadge');

  if (!list || !summaryValue || !countValue || !statusBadge) return;

  list.innerHTML = '';

  if (!transactions.length) {
    statusBadge.textContent = 'Empty';
    applyBadgeStyle(statusBadge, 'warn');
    summaryValue.textContent = '₹0.00';
    countValue.textContent = '0';
    list.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:center; min-height:140px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); border-radius:22px; padding:22px;">
        <h4 style="margin:0 0 8px; font-size:1.05rem; font-weight:800;">No transactions yet</h4>
        <p style="margin:0; color:var(--muted); line-height:1.65;">Once money activity starts, your recent entries will appear here.</p>
      </div>
    `;
    return;
  }

  statusBadge.textContent = 'Recent';
  applyBadgeStyle(statusBadge, 'success');
  summaryValue.textContent = TrustLineWallet.formatCurrency(transactions[0].amount);
  countValue.textContent = String(Math.min(transactions.length, 3));

  transactions.slice(0, 3).forEach(item => {
    const row = document.createElement('div');
    row.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:18px 20px; border-radius:22px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04);">
        <div style="min-width:0;">
          <strong style="display:block; font-size:1rem; margin-bottom:6px; line-height:1.35; word-break:break-word;">${item.title}</strong>
          <span style="display:block; color:var(--muted); font-size:0.92rem; line-height:1.5; word-break:break-word;">${item.party} • ${formatDateLabel(item.createdAt)}</span>
        </div>
        <div style="font-size:1rem; font-weight:800; white-space:nowrap; color:${item.direction === 'debit' ? '#ff7b89' : 'var(--green)'};">
          ${item.direction === 'debit' ? '-' : '+'}${TrustLineWallet.formatCurrency(item.amount).replace('₹', '₹ ')}
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

function renderRewardsCard(rewards) {
  const statusBadge = document.getElementById('rewardStatusBadge');
  const pointsValue = document.getElementById('rewardPointsValue');
  const reasonText = document.getElementById('rewardReasonText');
  const progressBar = document.getElementById('rewardProgressBar');
  const progressText = document.getElementById('rewardProgressText');
  const hintText = document.getElementById('rewardHintText');
  const list = document.getElementById('rewardsList');

  if (!statusBadge || !pointsValue || !reasonText || !progressBar || !progressText || !hintText || !list) return;

  list.innerHTML = '';

  if (!rewards || !rewards.points) {
    statusBadge.textContent = 'Starter';
    applyBadgeStyle(statusBadge, 'warn');
    pointsValue.textContent = '0';
    reasonText.textContent = 'No rewards yet';
    progressBar.style.width = '0%';
    progressText.textContent = '0 / 100 points to unlock next milestone';
    hintText.textContent = 'Keep transacting to grow faster';
    list.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:center; min-height:140px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); border-radius:22px; padding:22px;">
        <h4 style="margin:0 0 8px; font-size:1.05rem; font-weight:800;">No reward activity yet</h4>
        <p style="margin:0; color:var(--muted); line-height:1.65;">Link a bank or complete demo transactions to start earning points.</p>
      </div>
    `;
    return;
  }

  statusBadge.textContent = 'Live';
  applyBadgeStyle(statusBadge, 'warn');
  pointsValue.textContent = Number(rewards.points || 0).toLocaleString('en-IN');
  reasonText.textContent = rewards.reason || 'Reward earned';

  const target = Number(rewards.progressTarget || 100);
  const progressPercent = Math.min(100, Math.round((Number(rewards.points || 0) / target) * 100));
  progressBar.style.width = `${progressPercent}%`;
  progressText.textContent = `${rewards.points} / ${target} points to unlock next milestone`;
  hintText.textContent = rewards.hint || 'Rewards updated successfully';

  (rewards.items || []).slice(0, 3).forEach(item => {
    const row = document.createElement('div');
    row.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:18px 20px; border-radius:22px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04);">
        <div style="min-width:0;">
          <strong style="display:block; font-size:1rem; margin-bottom:6px; line-height:1.35; word-break:break-word;">${item.title}</strong>
          <span style="display:block; color:var(--muted); font-size:0.92rem; line-height:1.5; word-break:break-word;">${item.subtitle}</span>
        </div>
        <b style="font-size:1rem; color:#ffd166; white-space:nowrap;">+${Number(item.points || 0)} pts</b>
      </div>
    `;
    list.appendChild(row);
  });
}

function attachCardActionHandlers() {
  const cardsPrimaryBtn = document.getElementById('cardsPrimaryBtn');
  const cardsSecondaryBtn = document.getElementById('cardsSecondaryBtn');

  cardsPrimaryBtn?.addEventListener('click', () => {
    window.location.href = 'cards.html';
  });

  cardsSecondaryBtn?.addEventListener('click', () => {
    window.location.href = 'cards.html';
  });
}

function renderDashboardFromWallet() {
  const primaryBank = TrustLineWallet.getPrimaryBank();
  const transactions = TrustLineWallet.getTransactions();
  const rewards = TrustLineWallet.getRewards();

  renderBankCard(primaryBank);
  renderCardsCard(primaryBank);
  renderTransactionsCard(transactions);
  renderRewardsCard(rewards);
}

async function initProfile() {
  await fetchUserData();

  document.getElementById('profileName').textContent = userData.name || 'User Name';
  document.getElementById('profileEmail').textContent = userData.email || 'user@email.com';

  const avatarEl = document.getElementById('profileAvatar');
  const initialEl = document.getElementById('avatarInitial');

  if (userData.avatar) {
    avatarEl.innerHTML = `<img src="${userData.avatar}" alt="Profile" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    initialEl.textContent = userData.name ? userData.name.charAt(0).toUpperCase() : 'U';
  }

  applyBadgeStyle(document.getElementById('bankStatusBadge'), 'info');
  applyBadgeStyle(document.getElementById('cardsStatusBadge'), 'success');
  applyBadgeStyle(document.getElementById('txnStatusBadge'), 'success');
  applyBadgeStyle(document.getElementById('rewardStatusBadge'), 'warn');

  TrustLineWallet.getState();
  renderDashboardFromWallet();
  attachCardActionHandlers();

  TrustLineWallet.subscribe(() => {
    renderDashboardFromWallet();
  });

  window.addEventListener('storage', () => {
    renderDashboardFromWallet();
  });
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to sign out?')) {
    try {
      await fetch('/api/auth/logout', { credentials: 'include' });
    } catch (e) {}
    window.location.href = 'index.html';
  }
});

window.addEventListener('DOMContentLoaded', initProfile);