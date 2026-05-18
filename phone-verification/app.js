const fallbackCountries = {
  AD: { country_name: 'Andorra', dialling_code: '+376' },
  AE: { country_name: 'United Arab Emirates', dialling_code: '+971' },
  AF: { country_name: 'Afghanistan', dialling_code: '+93' },
  AG: { country_name: 'Antigua', dialling_code: '+1' },
  AI: { country_name: 'Anguilla', dialling_code: '+1' },
  AU: { country_name: 'Australia', dialling_code: '+61' },
  CA: { country_name: 'Canada', dialling_code: '+1' },
  DE: { country_name: 'Germany', dialling_code: '+49' },
  GB: { country_name: 'United Kingdom', dialling_code: '+44' },
  IN: { country_name: 'India', dialling_code: '+91' },
  SG: { country_name: 'Singapore', dialling_code: '+65' },
  US: { country_name: 'United States', dialling_code: '+1' }
};

const countrySelect = document.getElementById('country-select');
const phoneInput = document.getElementById('phone-input');
const fullNumberInput = document.getElementById('full-number');
const verifyForm = document.getElementById('verify-form');
const statusBox = document.getElementById('status-box');
const resultGrid = document.getElementById('result-grid');

function setStatus(message, type = 'info') {
  statusBox.className = `status-box ${type}`;
  statusBox.innerHTML = message;
}

function sanitizeNumber(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function buildApiNumber() {
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  const prefix = (selectedOption?.dataset?.diallingCode || '').replace(/\s+/g, '');
  const inputNumber = sanitizeNumber(phoneInput.value.trim());

  if (!inputNumber) {
    fullNumberInput.value = prefix;
    return prefix;
  }

  if (inputNumber.startsWith('+')) {
    fullNumberInput.value = inputNumber;
    return inputNumber;
  }

  const normalizedInput = inputNumber.replace(/^0+/, '');
  const normalizedPrefix = prefix.replace('+', '');
  const finalNumber = normalizedInput.startsWith(normalizedPrefix)
    ? `+${normalizedInput}`
    : `${prefix}${normalizedInput}`;

  fullNumberInput.value = finalNumber;
  return finalNumber;
}

function populateCountrySelect(countries) {
  const sorted = Object.entries(countries).sort((a, b) =>
    a[1].country_name.localeCompare(b[1].country_name)
  );

  countrySelect.innerHTML = sorted
    .map(([code, info]) => {
      const selected = code === 'IN' ? 'selected' : '';
      return `<option value="${code}" data-dialling-code="${info.dialling_code}" ${selected}>${info.country_name} (${info.dialling_code})</option>`;
    })
    .join('');

  buildApiNumber();
}

function formatValue(key, value) {
  if (typeof value === 'boolean') {
    return `<span class="value-badge ${value ? 'valid-true' : 'valid-false'}">${value ? 'True' : 'False'}</span>`;
  }

  if (value === null || value === undefined || value === '') {
    return '<span>-</span>';
  }

  return `<span>${String(value)}</span>`;
}

function renderResult(data) {
  const fields = [
    ['valid', 'Valid'],
    ['number', 'Number'],
    ['international_format', 'International Format'],
    ['local_format', 'Local Format'],
    ['country_code', 'Country Code'],
    ['country_name', 'Country Name'],
    ['country_prefix', 'Country Prefix'],
    ['location', 'Location'],
    ['carrier', 'Carrier'],
    ['line_type', 'Line Type']
  ];

  resultGrid.innerHTML = fields
    .map(
      ([key, label]) => `
        <div class="result-item">
          <strong>${label}</strong>
          ${formatValue(key, data[key])}
        </div>
      `
    )
    .join('');
}

function clearResult() {
  resultGrid.innerHTML = '';
}

async function loadCountries() {
  try {
    const response = await fetch('/api/phone-verification/countries');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Could not fetch countries.');
    }

    populateCountrySelect(data);
    setStatus('Countries loaded successfully.', 'success');
  } catch (error) {
    populateCountrySelect(fallbackCountries);
    setStatus(`Countries endpoint unavailable. Fallback sample loaded. Reason: ${error.message}`, 'error');
  }
}

async function verifyNumber(apiNumber) {
  setStatus('Checking number...', 'info');

  try {
    const response = await fetch(`/api/phone-verification/validate?number=${encodeURIComponent(apiNumber)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Number verification failed.');
    }

    renderResult(data);
    setStatus('Phone number verified successfully.', 'success');
  } catch (error) {
    clearResult();
    setStatus(`Validation failed: ${error.message}`, 'error');
  }
}

countrySelect.addEventListener('change', buildApiNumber);
phoneInput.addEventListener('input', buildApiNumber);

verifyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const apiNumber = buildApiNumber();

  if (!apiNumber || apiNumber === '+') {
    setStatus('Please enter a valid phone number first.', 'error');
    return;
  }

  await verifyNumber(apiNumber);
});

clearResult();
loadCountries();