/**
 * contact_pay.js — TrustLine Contact Pay module
 * Rebuilt: confirmation modal, inline validation, quick amounts,
 * loading/disabled states, success overlay, avatar color variety.
 */

const app = window.TrustLineApp;

// ── State ────────────────────────────────────────────────
let contacts = [];
let selectedContact = null;
let banks = [];

// ── DOM refs ─────────────────────────────────────────────
const contactList       = document.getElementById('contactList');
const contactSearch     = document.getElementById('contactSearch');
const selectedCard      = document.getElementById('selectedContactCard');
const bankSelect        = document.getElementById('contactBankId');
const amountInput       = document.getElementById('contactAmount');
const noteInput         = document.getElementById('contactNote');
const phoneInput        = document.getElementById('contactPhone');
const payBtn            = document.getElementById('contactPayBtn');
const confirmModal      = document.getElementById('confirmModal');
const modalCancel       = document.getElementById('modalCancel');
const modalConfirm      = document.getElementById('modalConfirm');
const successOverlay    = document.getElementById('successOverlay');
const successClose      = document.getElementById('successClose');
const toastStack        = document.getElementById('toastStack');

// ── Avatar palette — 8 distinct accent pairs ─────────────
const AVATAR_COLORS = [
  ['#00e5ff','#7c4dff'], ['#00d68f','#00b894'],
  ['#ffd166','#f7a24b'], ['#ff6b81','#e17055'],
  ['#a29bfe','#6c5ce7'], ['#fd79a8','#e84393'],
  ['#55efc4','#00cec9'], ['#74b9ff','#0984e3'],
];

function avatarStyle(name) {
  // Deterministic colour pick from name
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  const [c1, c2] = AVATAR_COLORS[idx];
  return `background: linear-gradient(135deg, ${c1}, ${c2})`;
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function moneyFmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Toast ─────────────────────────────────────────────────
function toast(title, msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' toast-error' : '');
  el.innerHTML = `<div class="toast-title">${title}</div><div class="toast-msg">${msg}</div>`;
  toastStack.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Filter & render contacts ──────────────────────────────
function filterContacts() {
  const q = contactSearch.value.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(c =>
    c.name.toLowerCase().includes(q) || c.phone.includes(q)
  );
}

function renderContacts(items) {
  if (!items.length) {
    contactList.innerHTML = `
      <div class="empty-state">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <div>No contacts found</div>
      </div>`;
    return;
  }

  contactList.innerHTML = items.map(c => `
    <div class="contact-row ${selectedContact?.phone === c.phone ? 'active' : ''}" data-phone="${c.phone}">
      <div class="avatar" style="${avatarStyle(c.name)}">${initials(c.name)}</div>
      <div class="contact-info">
        <div class="contact-name">${c.name}</div>
        <div class="contact-phone">${c.phone}</div>
      </div>
      <span class="contact-badge ${c.recent ? 'badge-recent' : 'badge-mock'}">${c.recent ? 'Recent' : 'Mock'}</span>
    </div>
  `).join('');

  contactList.querySelectorAll('.contact-row').forEach(row => {
    row.addEventListener('click', () => selectContact(
      contacts.find(c => c.phone === row.dataset.phone)
    ));
  });
}

// ── Select a contact ──────────────────────────────────────
function selectContact(contact) {
  selectedContact = contact;
  phoneInput.value = contact?.phone || '';

  if (contact) {
    selectedCard.classList.remove('empty');
    selectedCard.innerHTML = `
      <div class="avatar" style="${avatarStyle(contact.name)}">${initials(contact.name)}</div>
      <div>
        <div class="selected-name">${contact.name}</div>
        <div class="selected-phone">${contact.phone}</div>
        <div class="selected-label">${contact.label}</div>
      </div>`;
  } else {
    selectedCard.classList.add('empty');
    selectedCard.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="7" r="4"/><path d="M5.2 20a7 7 0 0 1 13.6 0"/>
      </svg>
      Select a contact from the left to continue`;
  }

  updateSendBtn();
  renderContacts(filterContacts());
}

// ── Enable/disable send button ────────────────────────────
function updateSendBtn() {
  const hasContact = !!selectedContact;
  const hasAmount  = Number(amountInput.value) > 0;
  const hasBank    = !!bankSelect.value;
  payBtn.disabled  = !(hasContact && hasAmount && hasBank);
}

// ── Quick amount buttons ──────────────────────────────────
document.getElementById('quickAmounts').addEventListener('click', e => {
  if (e.target.classList.contains('quick-btn')) {
    amountInput.value = e.target.dataset.val;
    updateSendBtn();
  }
});
amountInput.addEventListener('input', updateSendBtn);
bankSelect.addEventListener('change', updateSendBtn);

// ── Open confirm modal ────────────────────────────────────
payBtn.addEventListener('click', () => {
  const amount = Number(amountInput.value);
  if (!selectedContact || amount <= 0 || !bankSelect.value) return;

  const bankOption = bankSelect.options[bankSelect.selectedIndex];
  const note = noteInput.value.trim() || '—';

  document.getElementById('modalAmount').textContent = moneyFmt(amount);
  document.getElementById('modalTo').textContent     = `to ${selectedContact.name}`;
  document.getElementById('modalPhone').textContent  = selectedContact.phone;
  document.getElementById('modalBank').textContent   = bankOption?.text || bankSelect.value;
  document.getElementById('modalNote').textContent   = note;

  confirmModal.classList.add('show');
});

modalCancel.addEventListener('click', () => confirmModal.classList.remove('show'));
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) confirmModal.classList.remove('show'); });

// ── Confirm and send ──────────────────────────────────────
modalConfirm.addEventListener('click', async () => {
  confirmModal.classList.remove('show');

  const amount = Number(amountInput.value);
  const payload = {
    bankId:       bankSelect.value,
    contactName:  selectedContact.name,
    contactPhone: selectedContact.phone,
    amount,
    note: noteInput.value.trim(),
  };

  // Loading state
  modalConfirm.textContent = 'Sending…';
  payBtn.classList.add('loading');
  payBtn.disabled = true;

  try {
    await app.api('/api/payments/contact-pay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Success
    document.getElementById('successAmount').textContent = moneyFmt(amount);
    document.getElementById('successTo').textContent = `to ${selectedContact.name}`;
    successOverlay.classList.add('show');

    // Reset form
    amountInput.value = '';
    noteInput.value   = '';
    phoneInput.value  = '';
    selectContact(null);
    await loadData();

  } catch (err) {
    toast('Payment failed', err.message || 'Something went wrong.', true);
  } finally {
    modalConfirm.textContent = 'Confirm & Send';
    payBtn.classList.remove('loading');
    updateSendBtn();
  }
});

// ── Success close ─────────────────────────────────────────
successClose.addEventListener('click', () => successOverlay.classList.remove('show'));
successOverlay.addEventListener('click', e => { if (e.target === successOverlay) successOverlay.classList.remove('show'); });

// ── Search ────────────────────────────────────────────────
contactSearch.addEventListener('input', () => renderContacts(filterContacts()));

// ── Load data ─────────────────────────────────────────────
async function loadData() {
  try {
    const [contactData, bankData] = await Promise.all([
      app.api('/api/payments/contacts'),
      app.api('/api/banks/my'),
    ]);

    contacts = contactData.contacts || [];
    banks    = bankData.banks || [];

    renderContacts(filterContacts());

    bankSelect.innerHTML = banks.length
      ? banks.map(b => `<option value="${b.id}">${b.bank_name || b.name} • ${moneyFmt(b.balance)}</option>`).join('')
      : '<option value="">No linked banks</option>';

    updateSendBtn();
  } catch (err) {
    toast('Load error', err.message || 'Could not load contacts or banks.', true);
  }
}

// ── Boot ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await app.requireAuth();
  await loadData();
});