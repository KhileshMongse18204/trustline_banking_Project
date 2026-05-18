(function () {
  function setText(selectors, value) {
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = value;
      });
    });
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

  function renderList(transactions) {
    const container =
      document.querySelector('#passbookTransactionsList') ||
      document.querySelector('#transactionsList') ||
      document.querySelector('[data-passbook-list]');

    if (!container) return;

    container.innerHTML = '';

    if (!transactions.length) {
      container.innerHTML = `
        <div style="padding:1rem;border:1px dashed rgba(255,255,255,0.18);border-radius:16px;color:var(--muted);">
          No transactions yet.
        </div>
      `;
      return;
    }

    transactions.forEach((item) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:1rem;padding:1rem;border:1px solid rgba(255,255,255,0.08);border-radius:16px;background:rgba(255,255,255,0.04);margin-bottom:.75rem;';
      row.innerHTML = `
        <div style="min-width:0;">
          <div style="font-weight:800;margin-bottom:.2rem;">${item.title}</div>
          <div style="color:var(--muted);font-size:.84rem;line-height:1.5;">${item.party} • ${formatDateLabel(item.createdAt)}</div>
        </div>
        <div style="font-weight:800;white-space:nowrap;color:${item.direction === 'debit' ? '#ff7b89' : '#55efc4'};">
          ${item.direction === 'debit' ? '-' : '+'}${TrustLineWallet.formatCurrency(item.amount).replace('₹', '₹ ')}
        </div>
      `;
      container.appendChild(row);
    });
  }

  function renderPassbook() {
    const summary = TrustLineWallet.getSummary();
    const transactions = TrustLineWallet.getTransactions();

    setText(['#totalTransactions', '#passbookTotalTransactions', '[data-total-transactions]'], String(summary.totalTransactions));
    setText(['#moneyIn', '#passbookMoneyIn', '[data-money-in]'], TrustLineWallet.formatCurrency(summary.moneyIn));
    setText(['#moneyOut', '#passbookMoneyOut', '[data-money-out]'], TrustLineWallet.formatCurrency(summary.moneyOut));
    setText(['#linkedBanks', '#passbookLinkedBanks', '[data-linked-banks]'], String(summary.linkedBanks));
    setText(['#currentBalance', '#passbookCurrentBalance', '[data-current-balance]'], TrustLineWallet.formatCurrency(summary.balance));

    renderList(transactions);
  }

  window.addEventListener('DOMContentLoaded', () => {
    TrustLineWallet.getState();
    renderPassbook();

    TrustLineWallet.subscribe(renderPassbook);
    window.addEventListener('storage', renderPassbook);
  });
})();