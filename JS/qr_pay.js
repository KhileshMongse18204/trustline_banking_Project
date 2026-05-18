const app = window.TrustLineApp;
const qrOptions = document.getElementById('qrOptions');
const preview = document.getElementById('qrPreview');
const payloadInput = document.getElementById('qrPayload');
const sampleQrs = [
  { name:'Tea Point', payload:'upi://pay?pa=teapoint@bank&pn=Tea Point&am=120', hint:'Street chai & snacks', amount:120 },
  { name:'Campus Canteen', payload:'upi://pay?pa=campuscanteen@bank&pn=Campus Canteen&am=185', hint:'Lunch combo', amount:185 },
  { name:'Book Store', payload:'upi://pay?pa=bookstore@bank&pn=Book Store&am=599', hint:'Semester books', amount:599 },
];
let selectedPayload = '';

function parsePayload(payload){
  const text = String(payload || '').trim();
  const pnMatch = text.match(/(?:[?&]pn=)([^&]+)/i);
  const amMatch = text.match(/(?:[?&]am=)([^&]+)/i);
  const merchant = pnMatch ? decodeURIComponent(pnMatch[1].replace(/\+/g, ' ')) : (text || 'Scanned Merchant');
  const amount = amMatch ? Number(amMatch[1]) : 0;
  return { merchant, amount, payload:text };
}

function setPayload(payload){
  selectedPayload = payload;
  payloadInput.value = payload;
  const parsed = parsePayload(payload);
  document.getElementById('merchantName').value = parsed.merchant;
  if (parsed.amount) document.getElementById('qrAmount').value = parsed.amount;
  preview.innerHTML = `<div class="stack"><strong>${parsed.merchant}</strong><div class="helper">Payload: ${parsed.payload}</div><div class="helper">Suggested amount: ${parsed.amount ? app.money(parsed.amount) : 'Enter manually'}</div></div>`;
  qrOptions.querySelectorAll('.qr-option').forEach(node => node.classList.toggle('active', node.dataset.payload === payload));
}

async function loadBanks(){
  const bankData = await app.api('/api/banks/my');
  const banks = bankData.banks || [];
  document.getElementById('qrBankId').innerHTML = banks.length ? banks.map(b => `<option value="${b.id}">${b.bank_name || b.name} • ${app.money(b.balance)}</option>`).join('') : '<option value="">No linked banks</option>';
}

qrOptions.innerHTML = sampleQrs.map(item => `<div class="qr-option" data-payload="${item.payload}"><strong>${item.name}</strong><div class="helper">${item.hint}</div><div class="helper">${app.money(item.amount)}</div></div>`).join('');
qrOptions.querySelectorAll('.qr-option').forEach(item => item.addEventListener('click', ()=> setPayload(item.dataset.payload)));
payloadInput.addEventListener('input', () => setPayload(payloadInput.value));

document.getElementById('qrPayBtn').addEventListener('click', async () => {
  const payload = {
    bankId: document.getElementById('qrBankId').value,
    qrPayload: payloadInput.value.trim() || selectedPayload,
    merchantName: document.getElementById('merchantName').value.trim(),
    amount: Number(document.getElementById('qrAmount').value || 0),
    note: document.getElementById('qrNote').value.trim(),
  };
  try {
    await app.api('/api/payments/qr-pay', { method:'POST', body: JSON.stringify(payload) });
    document.getElementById('qrAmount').value = '';
    document.getElementById('qrNote').value = '';
    app.toast('QR payment successful', `Paid ${app.money(payload.amount)} to ${payload.merchantName || 'merchant'}.`);
    await loadBanks();
  } catch (error) { app.toast('QR payment failed', error.message); }
});

window.addEventListener('DOMContentLoaded', async () => { await app.requireAuth(); await loadBanks(); setPayload(sampleQrs[0].payload); });
