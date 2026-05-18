const app = window.TrustLineApp;
const bankList = document.getElementById('bankList');
const form = document.getElementById('bankLinkForm');

async function loadBanks(){
  const data = await app.api('/api/banks/my');
  const banks = data.banks || [];
  if (!banks.length){ bankList.innerHTML = '<div class="empty">No linked banks yet. Link your first bank using the form.</div>'; return; }
  bankList.innerHTML = banks.map(bank => `
    <div class="bank-card">
      <div class="bank-head">
        <div>
          <div class="bank-title">${bank.bank_name || bank.name}</div>
          <div class="bank-meta">${bank.account_holder || ''}<br>${bank.account_number || ''} • ${bank.ifsc_code || ''}<br>${bank.upi_id || ''}</div>
        </div>
        ${bank.is_primary ? '<span class="tag">Primary</span>' : ''}
      </div>
      <div class="bank-balance">${app.money(bank.balance)}</div>
      <div class="helper">Linked phone: ${bank.phone_number || '—'}</div>
      <div class="bank-actions">
        <button class="btn btn-success btn-sm" data-deposit="${bank.id}">Add ₹1,000 demo funds</button>
        <button class="btn btn-secondary btn-sm" data-passbook="${bank.id}">Open passbook</button>
      </div>
    </div>`).join('');

  bankList.querySelectorAll('[data-deposit]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await app.api(`/api/banks/${btn.dataset.deposit}/deposit`, { method:'POST', body: JSON.stringify({ amount: 1000 }) });
      app.toast('Demo funds added', '₹1,000 added to the selected bank.');
      await loadBanks();
    } catch (error) { app.toast('Deposit failed', error.message); }
  }));
  bankList.querySelectorAll('[data-passbook]').forEach(btn => btn.addEventListener('click', () => {
    window.location.href = `passbook.html?bankId=${btn.dataset.passbook}`;
  }));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    bankName: document.getElementById('bankName').value,
    accountHolder: document.getElementById('accountHolder').value.trim(),
    accountNumber: document.getElementById('accountNumber').value.trim(),
    ifscCode: document.getElementById('ifscCode').value.trim().toUpperCase(),
    phoneNumber: document.getElementById('phoneNumber').value.trim(),
    upiId: document.getElementById('upiId').value.trim(),
    pin: document.getElementById('upiPin').value.trim(),
    openingBalance: Number(document.getElementById('openingBalance').value || 0),
  };
  try {
    await app.api('/api/banks/link', { method:'POST', body: JSON.stringify(payload) });
    form.reset();
    document.getElementById('openingBalance').value = '5000';
    app.toast('Bank linked', 'Your mock bank account is ready for payments.');
    await loadBanks();
  } catch (error) { app.toast('Linking failed', error.message); }
});

document.getElementById('refreshBanks').addEventListener('click', loadBanks);
window.addEventListener('DOMContentLoaded', async () => { await app.requireAuth(); await loadBanks(); });
