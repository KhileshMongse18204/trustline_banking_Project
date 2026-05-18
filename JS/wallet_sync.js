(function (window) {
  const STATE_KEY = 'trustline_wallet_state';
  const LEGACY_BANKS_KEY = 'trustline_linked_banks';
  const LEGACY_TX_KEY = 'trustline_profile_transactions';
  const LEGACY_REWARDS_KEY = 'trustline_rewards';
  const LEGACY_NOTIFICATIONS_KEY = 'trustline_notifications';

  const DEFAULT_BALANCE = 9000;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function round2(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function formatCurrency(value) {
    return `₹${round2(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function readLegacyBanks() {
    const raw = safeParse(localStorage.getItem(LEGACY_BANKS_KEY), []);
    return Array.isArray(raw) ? raw : [];
  }

  function readLegacyTransactions() {
    const raw = safeParse(localStorage.getItem(LEGACY_TX_KEY), []);
    return Array.isArray(raw) ? raw : [];
  }

  function readLegacyRewards() {
    const raw = safeParse(localStorage.getItem(LEGACY_REWARDS_KEY), []);
    return Array.isArray(raw) ? raw : [];
  }

  function readLegacyNotifications() {
    const raw = safeParse(localStorage.getItem(LEGACY_NOTIFICATIONS_KEY), []);
    return Array.isArray(raw) ? raw : [];
  }

  function normalizeBank(bank) {
    if (!bank) return null;

    const bankName = bank.bankName || bank.name || 'Linked Bank';
    const accountNumber = String(bank.accountNumber || bank.account_number || '');
    const last4 = accountNumber ? accountNumber.slice(-4) : '3941';

    return {
      bankName,
      displayName: `${bankName} • ${last4}`,
      accountHolder: bank.accountHolder || bank.account_holder || 'Account Holder',
      phoneNumber: bank.mobileNumber || bank.phoneNumber || bank.phone_number || 'Not added',
      accountType: bank.accountType || bank.account_type || 'Savings',
      balance: round2(
        bank.balance !== undefined && bank.balance !== null && bank.balance !== ''
          ? bank.balance
          : DEFAULT_BALANCE
      ),
      upiStatus: bank.upiStatus || 'Ready for payments',
      last4
    };
  }

  function normalizeTransaction(item) {
    return {
      title: item.title || item.note || 'Money movement',
      party: item.party || item.bankName || 'TrustLine',
      amount: round2(item.amount || 0),
      direction: item.direction || (item.type === 'withdraw' || item.type === 'debit' || item.type === 'transfer_out' ? 'debit' : 'credit'),
      createdAt: item.createdAt || item.date || new Date().toISOString(),
      note: item.note || '',
      type: item.type || 'payment'
    };
  }

  function buildInitialState() {
    const linkedBanks = readLegacyBanks();
    const primaryBank = linkedBanks.length
      ? normalizeBank(linkedBanks[0])
      : null;

    const rawTx = readLegacyTransactions();
    const transactions = rawTx.length
      ? rawTx.map(normalizeTransaction)
      : [];

    const rawRewards = readLegacyRewards();
    const rewardPoints = rawRewards.reduce((sum, item) => sum + toNumber(item.points, 0), 0);

    const rewards = {
      points: rewardPoints,
      reason: rawRewards[0]?.title || 'No rewards yet',
      hint: rawRewards[0]?.reason || 'Keep transacting to earn more',
      progressTarget: 100,
      items: rawRewards.map(item => ({
        title: item.title || 'Reward earned',
        subtitle: item.reason || 'Reward activity',
        points: toNumber(item.points, 0)
      }))
    };

    return {
      primaryBank,
      transactions,
      rewards,
      notifications: readLegacyNotifications()
    };
  }

  function emitUpdate(state) {
    window.dispatchEvent(
      new CustomEvent('trustline-wallet-updated', {
        detail: clone(state)
      })
    );
  }

  function syncLegacyStores(state) {
    if (state.primaryBank) {
      const legacyBanks = readLegacyBanks();
      const existing = legacyBanks[0] || {};

      legacyBanks[0] = {
        ...existing,
        bankName: state.primaryBank.bankName,
        name: state.primaryBank.bankName,
        accountHolder: state.primaryBank.accountHolder,
        phoneNumber: state.primaryBank.phoneNumber,
        mobileNumber: state.primaryBank.phoneNumber,
        accountType: state.primaryBank.accountType,
        balance: round2(state.primaryBank.balance),
        upiStatus: state.primaryBank.upiStatus,
        accountNumber: existing.accountNumber || state.primaryBank.last4
      };

      localStorage.setItem(LEGACY_BANKS_KEY, JSON.stringify(legacyBanks));
    }

    localStorage.setItem(LEGACY_TX_KEY, JSON.stringify(state.transactions || []));
    localStorage.setItem(LEGACY_NOTIFICATIONS_KEY, JSON.stringify(state.notifications || []));

    localStorage.setItem(
      LEGACY_REWARDS_KEY,
      JSON.stringify((state.rewards?.items || []).map(item => ({
        title: item.title,
        reason: item.subtitle,
        points: item.points
      })))
    );
  }

  function saveState(nextState) {
    const safeState = clone(nextState);
    localStorage.setItem(STATE_KEY, JSON.stringify(safeState));
    syncLegacyStores(safeState);
    emitUpdate(safeState);
    return safeState;
  }

  function getState() {
    const existing = safeParse(localStorage.getItem(STATE_KEY), null);
    if (existing && typeof existing === 'object') return existing;

    const state = buildInitialState();
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    syncLegacyStores(state);
    return state;
  }

  function getPrimaryBank() {
    return getState().primaryBank;
  }

  function getTransactions() {
    return getState().transactions || [];
  }

  function getRewards() {
    return getState().rewards || {
      points: 0,
      reason: 'No rewards yet',
      hint: 'Keep transacting to earn more',
      progressTarget: 100,
      items: []
    };
  }

  function getNotifications() {
    return getState().notifications || [];
  }

  function getSummary() {
    const state = getState();
    const txs = state.transactions || [];

    const moneyIn = txs
      .filter(tx => tx.direction === 'credit')
      .reduce((sum, tx) => sum + toNumber(tx.amount, 0), 0);

    const moneyOut = txs
      .filter(tx => tx.direction === 'debit')
      .reduce((sum, tx) => sum + toNumber(tx.amount, 0), 0);

    return {
      balance: round2(state.primaryBank?.balance || 0),
      totalTransactions: txs.length,
      moneyIn: round2(moneyIn),
      moneyOut: round2(moneyOut),
      linkedBanks: state.primaryBank ? 1 : 0
    };
  }

  function addNotification(state, title, message, type = 'success') {
    state.notifications = state.notifications || [];
    state.notifications.unshift({
      title,
      message,
      type,
      createdAt: new Date().toISOString()
    });
  }

  function addReward(state, title, subtitle, points) {
    const rewardPoints = toNumber(points, 0);
    state.rewards = state.rewards || {
      points: 0,
      reason: '',
      hint: '',
      progressTarget: 100,
      items: []
    };

    state.rewards.points = toNumber(state.rewards.points, 0) + rewardPoints;
    state.rewards.reason = title;
    state.rewards.hint = subtitle;
    state.rewards.items = state.rewards.items || [];
    state.rewards.items.unshift({
      title,
      subtitle,
      points: rewardPoints
    });
  }

  function pay(payload = {}) {
    const state = getState();
    const bank = state.primaryBank;

    if (!bank) {
      return { ok: false, error: 'No linked bank found.' };
    }

    const amount = round2(payload.amount || 0);
    const merchant = (payload.merchant || payload.party || 'Merchant').trim();
    const notes = (payload.notes || '').trim();

    if (!amount || amount <= 0) {
      return { ok: false, error: 'Invalid amount.' };
    }

    if (amount > bank.balance) {
      return { ok: false, error: 'Insufficient balance.' };
    }

    bank.balance = round2(bank.balance - amount);

    const transaction = {
      title: `Payment to ${merchant}`,
      party: merchant,
      amount,
      direction: 'debit',
      createdAt: new Date().toISOString(),
      note: notes || `Paid ${formatCurrency(amount)} to ${merchant}`,
      type: payload.type || 'qr_payment'
    };

    state.transactions = state.transactions || [];
    state.transactions.unshift(transaction);

    const earnedPoints = Math.max(1, Math.floor(amount / 100));
    addReward(state, 'Spend reward', `Paid ${merchant}`, earnedPoints);
    addNotification(state, 'Payment successful', `${formatCurrency(amount)} paid to ${merchant}.`, 'success');

    saveState(state);
    return { ok: true, state: clone(state), transaction };
  }

  function deposit(payload = {}) {
    const state = getState();
    const bank = state.primaryBank;

    if (!bank) {
      return { ok: false, error: 'No linked bank found.' };
    }

    const amount = round2(payload.amount || 0);
    if (!amount || amount <= 0) {
      return { ok: false, error: 'Invalid amount.' };
    }

    bank.balance = round2(bank.balance + amount);

    const transaction = {
      title: payload.title || 'Deposit completed',
      party: payload.party || bank.bankName,
      amount,
      direction: 'credit',
      createdAt: new Date().toISOString(),
      note: payload.note || `Added ${formatCurrency(amount)} to ${bank.bankName}`,
      type: payload.type || 'deposit'
    };

    state.transactions = state.transactions || [];
    state.transactions.unshift(transaction);
    addNotification(state, 'Deposit completed', transaction.note, 'success');

    saveState(state);
    return { ok: true, state: clone(state), transaction };
  }

  function subscribe(callback) {
    const handler = (event) => callback(event.detail);
    window.addEventListener('trustline-wallet-updated', handler);

    return () => {
      window.removeEventListener('trustline-wallet-updated', handler);
    };
  }

  window.TrustLineWallet = {
    getState,
    saveState,
    getPrimaryBank,
    getTransactions,
    getRewards,
    getNotifications,
    getSummary,
    pay,
    deposit,
    subscribe,
    formatCurrency
  };
})(window);