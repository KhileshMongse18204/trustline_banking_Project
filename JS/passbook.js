const app = window.TrustLineApp;
let rows = [];
let banks = [];
const list = document.getElementById('passbookList');
const bankFilter = document.getElementById('pbBankFilter');
const searchInput = document.getElementById('pbSearch');

function render(){
  const bankId = bankFilter.value;
  const q = searchInput.value.trim().toLowerCase();
  const filtered = rows.filter(row => (bankId === 'all' || String(row.bankId) === bankId) && (!q || row.note.toLowerCase().includes(q) || row.party.toLowerCase().includes(q) || row.bankName.toLowerCase().includes(q)));
  if (!filtered.length) { list.innerHTML = '<div class="empty">No transactions found for the current filters.</div>'; } else {
    list.innerHTML = filtered.map(row => `<div class="txn-item"><div class="txn-top"><div><strong>${row.note}</strong><div class="helper">${row.bankName} • ${row.party || 'TrustLine'} • ${app.dateTime(row.createdAt)}</div></div><div class="${row.amount >= 0 ? 'amount-positive' : 'amount-negative'}">${row.amount >= 0 ? '+' : '-'}${app.money(Math.abs(row.amount))}</div></div></div>`).join('');
  }
  document.getElementById('pbTxnCount').textContent = rows.length;
  const moneyIn = rows.filter(r => r.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  const moneyOut = Math.abs(rows.filter(r => r.amount < 0).reduce((sum, row) => sum + row.amount, 0));
  document.getElementById('pbMoneyIn').textContent = app.money(moneyIn);
  document.getElementById('pbMoneyOut').textContent = app.money(moneyOut);
  document.getElementById('pbBankCount').textContent = banks.length;
}

async function loadPassbook(){
  const params = new URLSearchParams(window.location.search);
  const bankIdQuery = params.get('bankId');
  const data = await app.api(bankIdQuery ? `/api/passbook?bankId=${bankIdQuery}` : '/api/passbook');
  rows = data.entries || [];
  banks = data.banks || [];
  bankFilter.innerHTML = '<option value="all">All banks</option>' + banks.map(b => `<option value="${b.id}">${b.bank_name || b.name}</option>`).join('');
  if (bankIdQuery) bankFilter.value = bankIdQuery;
  render();
}

bankFilter.addEventListener('change', render);
searchInput.addEventListener('input', render);
window.addEventListener('DOMContentLoaded', async () => { await app.requireAuth(); await loadPassbook(); });
