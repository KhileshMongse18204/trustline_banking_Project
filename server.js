require('dotenv').config();
const path = require('path');
const https = require('https');
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());

let db;

const PHONE_VERIFY_API_KEY = process.env.APILAYER_API_KEY || '';
const PHONE_VERIFY_API_BASE = 'https://api.apilayer.com/number_verification';

function buildPhoneVerificationHeaders() {
  if (!PHONE_VERIFY_API_KEY) return null;
  return { apikey: PHONE_VERIFY_API_KEY, Accept: 'application/json' };
}

function phoneVerificationRequest(pathname) {
  const headers = buildPhoneVerificationHeaders();
  if (!headers) {
    return Promise.reject(Object.assign(new Error('APILAYER_API_KEY is missing. Add it to your .env file.'), { statusCode: 500 }));
  }

  return new Promise((resolve, reject) => {
    const req = https.request(`${PHONE_VERIFY_API_BASE}${pathname}`, { method: 'GET', headers }, (apiRes) => {
      let raw = '';
      apiRes.on('data', (chunk) => { raw += chunk; });
      apiRes.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch (e) {
          parsed = { raw };
        }

        if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
          const err = new Error(parsed.message || 'Phone verification request failed.');
          err.statusCode = apiRes.statusCode || 500;
          err.payload = parsed;
          return reject(err);
        }

        resolve(parsed);
      });
    });

    req.on('error', (error) => reject(Object.assign(new Error(error.message || 'Failed to connect to APILayer.'), { statusCode: 500 })));
    req.end();
  });
}


function safeJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (e) { return fallback; }
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function createNotification(userId, title, message, type = 'info', meta = null) {
  if (!userId) return;
  await db.execute(
    'INSERT INTO notifications (user_id, title, message, type, meta_json) VALUES (?, ?, ?, ?, ?)',
    [userId, title, message, type, meta ? JSON.stringify(meta) : null]
  );
}

async function createReward(userId, title, points, reason = '') {
  if (!userId || !points) return;
  await db.execute(
    'INSERT INTO rewards (user_id, title, points, reason) VALUES (?, ?, ?, ?)',
    [userId, title, points, reason]
  );
}

function buildNotificationMessage(prefix, amount, subject) {
  return `${prefix} ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount || 0))}${subject ? ` ${subject}` : ''}`;
}

async function initDb() {
  db = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'trustline_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) DEFAULT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) DEFAULT NULL,
      google_id VARCHAR(255) DEFAULT NULL,
      profile_photo VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS banks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      bank_name VARCHAR(255) DEFAULT NULL,
      account_holder VARCHAR(255) DEFAULT NULL,
      account_number VARCHAR(64) DEFAULT NULL,
      ifsc_code VARCHAR(32) DEFAULT NULL,
      upi_id VARCHAR(255) DEFAULT NULL,
      phone_number VARCHAR(20) DEFAULT NULL,
      pin VARCHAR(255) NOT NULL,
      balance DECIMAL(15,2) DEFAULT 0.00,
      is_primary TINYINT(1) DEFAULT 0,
      transactions JSON DEFAULT JSON_ARRAY(),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read TINYINT(1) DEFAULT 0,
      meta_json JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      points INT DEFAULT 0,
      reason TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  const alterStatements = [
    'ALTER TABLE users ADD COLUMN profile_photo VARCHAR(500) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN bank_name VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN account_holder VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN account_number VARCHAR(64) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN ifsc_code VARCHAR(32) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN upi_id VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL',
    'ALTER TABLE banks ADD COLUMN is_primary TINYINT(1) DEFAULT 0',
  ];
  for (const statement of alterStatements) {
    try { await db.execute(statement); } catch (e) {}
  }
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.execute('SELECT id, name, email, google_id, profile_photo FROM users WHERE id = ?', [id]);
    if (!rows.length) return done(null, false);
    done(null, rows[0]);
  } catch (error) {
    done(error);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        const name = profile.displayName || 'Google User';
        const profilePhoto = profile.photos && profile.photos[0] && profile.photos[0].value;

        if (!email) return done(new Error('Google account has no email'));

        const [existingUsers] = await db.execute('SELECT * FROM users WHERE google_id = ? OR email = ?', [googleId, email]);
        if (existingUsers.length > 0) {
          const user = existingUsers[0];
          await db.execute('UPDATE users SET google_id = ?, profile_photo = ? WHERE id = ?', [googleId, profilePhoto, user.id]);
          return done(null, { id: user.id, name: user.name, email: user.email, profile_photo: profilePhoto });
        }

        const [result] = await db.execute(
          'INSERT INTO users (name, email, google_id, profile_photo) VALUES (?, ?, ?, ?)',
          [name, email, googleId, profilePhoto]
        );

        return done(null, { id: result.insertId, name, email, profile_photo: profilePhoto });
      } catch (error) {
        done(error);
      }
    }
  )
);

app.use(express.static(path.join(__dirname, '.')));

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

async function getBankById(bankId) {
  const [rows] = await db.execute('SELECT * FROM banks WHERE id = ?', [bankId]);
  return rows[0] || null;
}

async function getUserBank(bankId, userId) {
  const [rows] = await db.execute('SELECT * FROM banks WHERE id = ? AND user_id = ?', [bankId, userId]);
  return rows[0] || null;
}

async function appendTransaction(bankId, transaction) {
  const bank = await getBankById(bankId);
  if (!bank) return null;
  const transactions = safeJson(bank.transactions, []);
  transactions.unshift({
    ...transaction,
    createdAt: new Date().toISOString(),
  });
  await db.execute('UPDATE banks SET transactions = ? WHERE id = ?', [JSON.stringify(transactions), bankId]);
  return transactions;
}

// auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  try {
    const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(400).json({ error: 'Email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
    req.login({ id: result.insertId }, async (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      await createNotification(result.insertId, 'Welcome to TrustLine', 'Your account has been created successfully.', 'success');
      await createReward(result.insertId, 'Welcome bonus', 25, 'Starter points for signing up');
      return res.json({ success: true, id: result.insertId });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const [rows] = await db.execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid email or password' });
    const user = rows[0];
    if (!user.password_hash) return res.status(400).json({ error: 'This account is registered with Google. Please sign in with Google.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid email or password' });
    req.login({ id: user.id }, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      res.json({ success: true, id: user.id, email: user.email, name: user.name });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/Sign.html?error=google_auth_failed', session: true }), (req, res) => {
  res.redirect('/Home.html');
});
app.get('/api/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});
app.get('/api/auth/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) return res.json({ user: req.user });
  res.status(401).json({ error: 'Not authenticated' });
});

// existing / generic bank endpoints
app.get('/api/banks', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, user_id, name, bank_name, account_holder, account_number, ifsc_code, upi_id, phone_number, balance, is_primary FROM banks ORDER BY created_at DESC');
    res.json({ banks: rows.map((row) => ({ ...row, balance: money(row.balance) })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/banks', async (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN are required' });
  try {
    const userId = req.user ? req.user.id : null;
    const [result] = await db.execute('INSERT INTO banks (name, bank_name, pin, balance, user_id, is_primary) VALUES (?, ?, ?, 0, ?, 0)', [name, name, pin, userId]);
    if (userId) await createNotification(userId, 'Bank created', `${name} has been created in your demo account.`, 'success');
    res.json({ success: true, bankId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/banks/:name/access', async (req, res) => {
  const { name } = req.params;
  const { pin } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM banks WHERE name = ?', [name]);
    if (!rows.length) return res.status(404).json({ error: 'Bank not found' });
    const bank = rows[0];
    if (bank.pin !== pin) return res.status(401).json({ error: 'Incorrect PIN' });
    res.json({ bank: { ...bank, balance: money(bank.balance), transactions: safeJson(bank.transactions, []) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/banks/:name', async (req, res) => {
  const { name } = req.params;
  const { pin, newName, newPin } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM banks WHERE name = ?', [name]);
    if (!rows.length) return res.status(404).json({ error: 'Bank not found' });
    const bank = rows[0];
    if (bank.pin !== pin) return res.status(401).json({ error: 'Incorrect PIN' });
    const updateName = newName && newName !== bank.name ? newName : bank.name;
    const updatePin = newPin || bank.pin;
    await db.execute('UPDATE banks SET name = ?, bank_name = COALESCE(bank_name, ?) , pin = ? WHERE id = ?', [updateName, updateName, updatePin, bank.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/banks/:name', async (req, res) => {
  const { name } = req.params;
  const { pin } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM banks WHERE name = ?', [name]);
    if (!rows.length) return res.status(404).json({ error: 'Bank not found' });
    const bank = rows[0];
    if (bank.pin !== pin) return res.status(401).json({ error: 'Incorrect PIN' });
    await db.execute('DELETE FROM banks WHERE id = ?', [bank.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/banks/:id/deposit', async (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const bank = await getBankById(id);
    if (!bank) return res.status(404).json({ error: 'Bank not found' });
    const newBalance = money(bank.balance) + amount;
    await db.execute('UPDATE banks SET balance = ? WHERE id = ?', [newBalance, id]);
    const transactions = await appendTransaction(id, { type: 'deposit', amount, direction: 'credit', note: `Deposited ${amount.toFixed(2)}`, party: 'Cash Deposit' });
    if (bank.user_id) await createNotification(bank.user_id, 'Deposit completed', buildNotificationMessage('Added', amount, `to ${bank.bank_name || bank.name}`), 'success');
    res.json({ success: true, bank: { ...bank, balance: newBalance, transactions } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/banks/:id/withdraw', async (req, res) => {
  const { id } = req.params;
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const bank = await getBankById(id);
    if (!bank) return res.status(404).json({ error: 'Bank not found' });
    const currentBalance = money(bank.balance);
    if (amount > currentBalance) return res.status(400).json({ error: 'Insufficient funds' });
    const newBalance = currentBalance - amount;
    await db.execute('UPDATE banks SET balance = ? WHERE id = ?', [newBalance, id]);
    const transactions = await appendTransaction(id, { type: 'withdraw', amount: -amount, direction: 'debit', note: `Withdrew ${amount.toFixed(2)}`, party: 'Cash Withdrawal' });
    if (bank.user_id) await createNotification(bank.user_id, 'Withdrawal completed', buildNotificationMessage('Debited', amount, `from ${bank.bank_name || bank.name}`), 'warning');
    res.json({ success: true, bank: { ...bank, balance: newBalance, transactions } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/banks/:id/transfer', async (req, res) => {
  const { id } = req.params;
  const { toName } = req.body;
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const fromBank = await getBankById(id);
    if (!fromBank) return res.status(404).json({ error: 'Bank not found' });
    const currentBalance = money(fromBank.balance);
    if (amount > currentBalance) return res.status(400).json({ error: 'Not enough money' });
    const [toRows] = await db.execute('SELECT * FROM banks WHERE name = ? LIMIT 1', [toName]);
    if (!toRows.length) return res.status(404).json({ error: 'Recipient bank not found' });
    const toBank = toRows[0];
    if (toBank.id === fromBank.id) return res.status(400).json({ error: 'Cannot transfer to the same bank' });
    const newFromBalance = currentBalance - amount;
    const newToBalance = money(toBank.balance) + amount;
    await db.execute('UPDATE banks SET balance = ? WHERE id = ?', [newFromBalance, fromBank.id]);
    await db.execute('UPDATE banks SET balance = ? WHERE id = ?', [newToBalance, toBank.id]);
    const fromTransactions = await appendTransaction(fromBank.id, { type: 'transfer_out', amount: -amount, direction: 'debit', note: `Transferred ${amount.toFixed(2)} to ${toBank.bank_name || toBank.name}`, party: toBank.bank_name || toBank.name });
    await appendTransaction(toBank.id, { type: 'transfer_in', amount, direction: 'credit', note: `Received ${amount.toFixed(2)} from ${fromBank.bank_name || fromBank.name}`, party: fromBank.bank_name || fromBank.name });
    if (fromBank.user_id) await createNotification(fromBank.user_id, 'Transfer successful', buildNotificationMessage('Sent', amount, `to ${toBank.bank_name || toBank.name}`), 'success');
    res.json({ success: true, bank: { ...fromBank, balance: newFromBalance, transactions: fromTransactions } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/banks/:id/clear-history', async (req, res) => {
  const { id } = req.params;
  try {
    const bank = await getBankById(id);
    if (!bank) return res.status(404).json({ error: 'Bank not found' });
    await db.execute('UPDATE banks SET transactions = JSON_ARRAY() WHERE id = ?', [id]);
    res.json({ success: true, bank: { ...bank, balance: money(bank.balance), transactions: [] } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// new integrated endpoints
app.get('/api/banks/my', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM banks WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC', [req.user.id]);
    res.json({ banks: rows.map((row) => ({ ...row, balance: money(row.balance), transactions: safeJson(row.transactions, []) })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/banks/link', requireAuth, async (req, res) => {
  const { bankName, accountHolder, accountNumber, ifscCode, upiId, phoneNumber, pin, openingBalance } = req.body;
  if (!bankName || !accountHolder || !accountNumber || !ifscCode || !upiId || !phoneNumber || !pin) {
    return res.status(400).json({ error: 'All bank details are required' });
  }
  try {
    const [existing] = await db.execute('SELECT id FROM banks WHERE user_id = ? AND account_number = ?', [req.user.id, accountNumber]);
    if (existing.length) return res.status(400).json({ error: 'This account is already linked' });
    const displayName = `${bankName} • ${String(accountNumber).slice(-4)}`;
    const [hasPrimaryRows] = await db.execute('SELECT id FROM banks WHERE user_id = ? AND is_primary = 1 LIMIT 1', [req.user.id]);
    const isPrimary = hasPrimaryRows.length ? 0 : 1;
    const balance = Number(openingBalance || 0);
    const [result] = await db.execute(
      'INSERT INTO banks (user_id, name, bank_name, account_holder, account_number, ifsc_code, upi_id, phone_number, pin, balance, is_primary, transactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_ARRAY())',
      [req.user.id, displayName, bankName, accountHolder, accountNumber, String(ifscCode).toUpperCase(), upiId, phoneNumber, pin, balance, isPrimary]
    );
    if (balance > 0) {
      await appendTransaction(result.insertId, { type: 'deposit', amount: balance, direction: 'credit', note: `Opening balance ${balance.toFixed(2)}`, party: bankName });
    }
    await createNotification(req.user.id, 'Bank linked successfully', `${bankName} ending with ${String(accountNumber).slice(-4)} is ready for payments.`, 'success');
    await createReward(req.user.id, 'Bank linking reward', 50, `Linked ${bankName}`);
    const bank = await getBankById(result.insertId);
    res.json({ success: true, bank: { ...bank, balance: money(bank.balance), transactions: safeJson(bank.transactions, []) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

const mockContacts = [
  { name: 'Rahul Sharma', phone: '9876543210', label: 'Friend from class', recent: true },
  { name: 'Priya Nair', phone: '9822012345', label: 'Flat rent group', recent: true },
  { name: 'Aman Verma', phone: '9819988877', label: 'Project teammate', recent: false },
  { name: 'Neha Kulkarni', phone: '9765432109', label: 'Café payment', recent: false },
  { name: 'Hostel Office', phone: '9000011111', label: 'Fees and dues', recent: false },
  { name: 'Mess Counter', phone: '9090909090', label: 'Food wallet', recent: false },
];

app.get('/api/payments/contacts', requireAuth, async (req, res) => {
  res.json({ contacts: mockContacts });
});

app.post('/api/payments/contact-pay', requireAuth, async (req, res) => {
  const { bankId, contactName, contactPhone, amount, note } = req.body;
  const debit = Number(amount);
  if (!bankId || !contactName || !contactPhone || !debit || debit <= 0) return res.status(400).json({ error: 'Valid payment details are required' });
  try {
    const bank = await getUserBank(bankId, req.user.id);
    if (!bank) return res.status(404).json({ error: 'Linked bank not found' });
    const currentBalance = money(bank.balance);
    if (debit > currentBalance) return res.status(400).json({ error: 'Insufficient balance' });
    const newBalance = currentBalance - debit;
    await db.execute('UPDATE banks SET balance = ? WHERE id = ?', [newBalance, bank.id]);
    const transactions = await appendTransaction(bank.id, {
      type: 'contact_pay',
      amount: -debit,
      direction: 'debit',
      note: note || `Paid ${contactName}`,
      party: `${contactName} (${contactPhone})`,
    });
    const rewardPoints = Math.max(10, Math.floor(debit / 25));
    await createReward(req.user.id, 'Contact payment reward', rewardPoints, `Sent money to ${contactName}`);
    await createNotification(req.user.id, 'Money sent successfully', buildNotificationMessage('Sent', debit, `to ${contactName}`), 'success');
    res.json({ success: true, bank: { ...bank, balance: newBalance, transactions } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/payments/qr-pay', requireAuth, async (req, res) => {
  const { bankId, qrPayload, merchantName, amount, note } = req.body;
  const debit = Number(amount);
  if (!bankId || !qrPayload || !debit || debit <= 0) return res.status(400).json({ error: 'QR payload, bank, and valid amount are required' });
  try {
    const bank = await getUserBank(bankId, req.user.id);
    if (!bank) return res.status(404).json({ error: 'Linked bank not found' });
    const currentBalance = money(bank.balance);
    if (debit > currentBalance) return res.status(400).json({ error: 'Insufficient balance' });
    const pnMatch = String(qrPayload).match(/(?:[?&]pn=)([^&]+)/i);
    const parsedMerchant = merchantName || (pnMatch ? decodeURIComponent(pnMatch[1].replace(/\+/g, ' ')) : 'Scanned Merchant');
    const newBalance = currentBalance - debit;
    await db.execute('UPDATE banks SET balance = ? WHERE id = ?', [newBalance, bank.id]);
    const transactions = await appendTransaction(bank.id, {
      type: 'qr_pay',
      amount: -debit,
      direction: 'debit',
      note: note || `QR paid to ${parsedMerchant}`,
      party: parsedMerchant,
      qrPayload,
    });
    const rewardPoints = Math.max(15, Math.floor(debit / 20));
    await createReward(req.user.id, 'QR payment reward', rewardPoints, `Paid ${parsedMerchant}`);
    await createNotification(req.user.id, 'QR payment completed', buildNotificationMessage('Paid', debit, `to ${parsedMerchant}`), 'success');
    res.json({ success: true, bank: { ...bank, balance: newBalance, transactions } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/passbook', requireAuth, async (req, res) => {
  try {
    const { bankId } = req.query;
    const params = [req.user.id];
    let sql = 'SELECT * FROM banks WHERE user_id = ?';
    if (bankId) { sql += ' AND id = ?'; params.push(bankId); }
    sql += ' ORDER BY is_primary DESC, created_at DESC';
    const [rows] = await db.execute(sql, params);
    const banks = rows.map((row) => ({ ...row, balance: money(row.balance), transactions: safeJson(row.transactions, []) }));
    const entries = [];
    banks.forEach((bank) => {
      bank.transactions.forEach((txn) => {
        entries.push({
          bankId: bank.id,
          bankName: bank.bank_name || bank.name,
          amount: Number(txn.amount || 0),
          note: txn.note || txn.type || 'Transaction',
          party: txn.party || '',
          type: txn.type || 'transaction',
          createdAt: txn.createdAt || bank.created_at,
        });
      });
    });
    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ banks, entries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rewards', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ rewards: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ notifications: rows.map((row) => ({ ...row, meta_json: safeJson(row.meta_json, null) })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/phone-verification/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'Phone verification routes are available',
    apiKeyConfigured: Boolean(PHONE_VERIFY_API_KEY),
  });
});

app.get('/api/phone-verification/countries', async (_req, res) => {
  try {
    const data = await phoneVerificationRequest('/countries');
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Could not fetch countries from APILayer.',
      details: error.payload || null,
    });
  }
});

app.get('/api/phone-verification/validate', async (req, res) => {
  const number = String(req.query.number || '').trim();
  if (!number) {
    return res.status(400).json({ message: 'Query parameter "number" is required.' });
  }

  try {
    const data = await phoneVerificationRequest(`/validate?number=${encodeURIComponent(number)}`);
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Number validation failed.',
      details: error.payload || null,
    });
  }
});

app.get('/phone-verification', (_req, res) => {
  res.redirect('/phone-verification/');
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, async () => {
  try {
    await initDb();
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    console.error('Failed to initialize database', err);
    process.exit(1);
  }
});
