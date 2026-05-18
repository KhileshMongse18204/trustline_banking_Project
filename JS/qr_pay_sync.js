(function () {
  function qs(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function setBalanceText(value) {
    const selectors = [
      '#bankBalanceText',
      '#currentBalance',
      '#currentBalanceText',
      '#walletBalance',
      '#availableBalance',
      '.wallet-balance'
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = value;
      });
    });
  }

  function setSummaryValues() {
    const summary = TrustLineWallet.getSummary();

    const totalEl = qs(['#totalTransactions', '#passbookTotalTransactions', '[data-total-transactions]']);
    const inEl = qs(['#moneyIn', '#passbookMoneyIn', '[data-money-in]']);
    const outEl = qs(['#moneyOut', '#passbookMoneyOut', '[data-money-out]']);
    const linkedEl = qs(['#linkedBanks', '#passbookLinkedBanks', '[data-linked-banks]']);

    if (totalEl) totalEl.textContent = String(summary.totalTransactions);
    if (inEl) inEl.textContent = TrustLineWallet.formatCurrency(summary.moneyIn);
    if (outEl) outEl.textContent = TrustLineWallet.formatCurrency(summary.moneyOut);
    if (linkedEl) linkedEl.textContent = String(summary.linkedBanks);
  }

  function populateBankSelect(select) {
    const bank = TrustLineWallet.getPrimaryBank();
    if (!select) return;

    select.innerHTML = '';

    if (!bank) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No linked bank found';
      select.appendChild(opt);
      select.disabled = true;
      return;
    }

    const opt = document.createElement('option');
    opt.value = bank.bankName;
    opt.textContent = `${bank.bankName} • ${TrustLineWallet.formatCurrency(bank.balance)}`;
    select.appendChild(opt);
    select.disabled = false;
  }

  function showMessage(message, ok = true) {
    const box = qs(['#paymentMessage', '#payMessage', '.payment-message']);
    if (!box) {
      alert(message);
      return;
    }

    box.textContent = message;
    box.style.display = 'block';
    box.style.color = ok ? '#55efc4' : '#ff7b89';
  }

  function bindQrPay() {
    const form = qs(['#qrPayForm', '#paymentForm', 'form']);
    const bankSelect = qs(['#fromBank', '#from-bank', 'select[name="fromBank"]', 'select']);
    const merchantInput = qs(['#merchant', '#merchantName', 'input[name="merchant"]']);
    const amountInput = qs(['#amount', 'input[name="amount"]']);
    const notesInput = qs(['#notes', 'textarea[name="notes"]', 'input[name="notes"]']);
    const payBtn = qs(['#payNowBtn', '#pay-now-btn', '.pay-now-btn', 'button[type="submit"]']);

    const syncUi = () => {
      const bank = TrustLineWallet.getPrimaryBank();
      populateBankSelect(bankSelect);
      setBalanceText(bank ? TrustLineWallet.formatCurrency(bank.balance) : '₹0.00');
      setSummaryValues();
    };

    syncUi();

    const submitHandler = (event) => {
      if (event) event.preventDefault();

      const merchant = merchantInput ? merchantInput.value.trim() : '';
      const amount = amountInput ? Number(amountInput.value) : 0;
      const notes = notesInput ? notesInput.value.trim() : '';

      if (!merchant) {
        showMessage('Please enter merchant name.', false);
        return;
      }

      if (!amount || amount <= 0) {
        showMessage('Please enter a valid amount.', false);
        return;
      }

      const result = TrustLineWallet.pay({
        amount,
        merchant,
        notes,
        type: 'qr_payment'
      });

      if (!result.ok) {
        showMessage(result.error || 'Payment failed.', false);
        return;
      }

      syncUi();

      if (amountInput) amountInput.value = '';
      if (notesInput) notesInput.value = '';

      showMessage(`Payment successful. ${TrustLineWallet.formatCurrency(amount)} paid to ${merchant}.`, true);
    };

    if (form) {
      form.addEventListener('submit', submitHandler);
    }

    if (payBtn && !form) {
      payBtn.addEventListener('click', submitHandler);
    }

    TrustLineWallet.subscribe(syncUi);
    window.addEventListener('storage', syncUi);
  }

  window.addEventListener('DOMContentLoaded', bindQrPay);
})();