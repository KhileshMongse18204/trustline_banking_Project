// TrustLine Terminal - JavaScript with localStorage

const terminalOutput = document.getElementById('terminalOutput');
const terminalInput = document.getElementById('terminalInput');

// State
let currentBank = null;
let inputMode = null;
let inputBuffer = '';

// Storage key
const STORAGE_KEY = 'trustline_banks';

// Helper functions
function print(text, className = '') {
  const span = document.createElement('span');
  if (className) span.className = className;
  span.textContent = text;
  terminalOutput.appendChild(span);
  terminalOutput.appendChild(document.createTextNode('\n'));
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function printLine(text, className = '') {
  print(text, className);
}

function clearOutput() {
  terminalOutput.innerHTML = '';
}

// LocalStorage functions
function getBanks() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveBanks(banks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(banks));
}

function findBank(name) {
  const banks = getBanks();
  return banks.find(b => b.name.toLowerCase() === name.toLowerCase()) || null;
}

function addBank(name, pin) {
  const banks = getBanks();
  banks.push({
    id: Date.now(),
    name: name,
    pin: pin,
    balance: 0,
    transactions: []
  });
  saveBanks(banks);
}

function updateBank(bank) {
  const banks = getBanks();
  const index = banks.findIndex(b => b.id === bank.id);
  if (index !== -1) {
    banks[index] = bank;
    saveBanks(banks);
  }
}

function deleteBank(bankId) {
  let banks = getBanks();
  banks = banks.filter(b => b.id !== bankId);
  saveBanks(banks);
}

// Command handlers
const commands = {
  help: () => {
    print('=== TrustLine Terminal Help ===', 'info');
    print('Available commands:', 'dim');
    print('  help          - Show this help message', 'menu-option');
    print('  menu          - Show main menu', 'menu-option');
    print('  create        - Create a new bank account', 'menu-option');
    print('  list          - List all banks', 'menu-option');
    print('  access <name> - Access a bank account', 'menu-option');
    print('  update <name> - Update bank details', 'menu-option');
    print('  delete <name> - Delete a bank account', 'menu-option');
    print('  clear         - Clear terminal', 'menu-option');
    print('  exit          - Go back to Home', 'menu-option');
  },

  menu: () => {
    if (currentBank) {
      showBankMenu();
    } else {
      showMainMenu();
    }
  },

  clear: () => {
    clearOutput();
  },

  exit: () => {
    if (currentBank) {
      currentBank = null;
      showMainMenu();
    } else {
      window.location.href = 'Home.html';
    }
  },

  list: () => {
    const banks = getBanks();
    if (banks.length > 0) {
      print('\n=== List of Banks ===', 'info');
      banks.forEach((bank, idx) => {
        print(`  ${idx + 1}. ${bank.name} - ₹${bank.balance.toFixed(2)}`, 'menu-option');
      });
      print('');
    } else {
      print('No banks have been created yet.', 'warning');
    }
  },

  create: () => {
    print('\n=== Create New Bank ===', 'info');
    print('Enter new bank name: ', 'dim');
    inputMode = { type: 'create', step: 'name' };
  },

  processCreate: (name) => {
    if (!name || !name.trim()) {
      print('Bank name cannot be empty.', 'error');
      inputMode = null;
      return;
    }
    
    if (findBank(name.trim())) {
      print('That name already exists.', 'error');
      inputMode = null;
      return;
    }
    
    print('Set a PIN (4 digits): ', 'dim');
    inputMode = { type: 'create', step: 'pin', name: name.trim() };
  },

  processCreatePin: (pin) => {
    if (!pin || !pin.trim()) {
      print('PIN cannot be empty.', 'error');
      inputMode = null;
      return;
    }
    
    addBank(inputMode.name, pin.trim());
    print(`Bank '${inputMode.name}' created successfully!`, 'success');
    inputMode = null;
  },

  access: () => {
    print('Enter bank name to access: ', 'dim');
    inputMode = { type: 'access', step: 'name' };
  },

  processAccessName: (name) => {
    const bank = findBank(name.trim());
    if (!bank) {
      print('Bank not found.', 'error');
      inputMode = null;
      return;
    }
    
    print(`Enter PIN for ${bank.name}: `, 'dim');
    inputMode = { type: 'access', name: name.trim(), step: 'pin' };
  },

  processAccess: (pin) => {
    const bank = findBank(inputMode.name);
    if (!bank) {
      print('Bank not found.', 'error');
      inputMode = null;
      return;
    }
    
    if (bank.pin !== pin.trim()) {
      print('Incorrect PIN!', 'error');
      inputMode = null;
      return;
    }
    
    currentBank = bank;
    print(`\nWelcome, ${currentBank.name}!`, 'success');
    showBankMenu();
    inputMode = null;
  },

  update: () => {
    print('Enter bank name to update: ', 'dim');
    inputMode = { type: 'update', step: 'name' };
  },

  processUpdateName: (name) => {
    const bank = findBank(name.trim());
    if (!bank) {
      print('Bank not found.', 'error');
      inputMode = null;
      return;
    }
    print(`Enter PIN for ${bank.name}: `, 'dim');
    inputMode = { type: 'update', name: name.trim(), step: 'pin' };
  },

  processUpdatePin: (pin) => {
    const bank = findBank(inputMode.name);
    if (!bank || bank.pin !== pin.trim()) {
      print('Incorrect PIN!', 'error');
      inputMode = null;
      return;
    }
    
    print('Enter new bank name (leave blank to keep current): ', 'dim');
    inputMode.step = 'newName';
  },

  processUpdateNewName: (newName) => {
    inputMode.newName = newName.trim();
    print('Enter new PIN (leave blank to keep current): ', 'dim');
    inputMode.step = 'newPin';
  },

  processUpdatePinNew: (newPin) => {
    const bank = findBank(inputMode.name);
    if (!bank) {
      print('Bank not found.', 'error');
      inputMode = null;
      return;
    }
    
    if (inputMode.newName && inputMode.newName !== bank.name) {
      if (findBank(inputMode.newName)) {
        print('A bank with that name already exists.', 'error');
        inputMode = null;
        return;
      }
      bank.name = inputMode.newName;
    }
    
    if (newPin && newPin.trim()) {
      bank.pin = newPin.trim();
    }
    
    updateBank(bank);
    print('Bank details updated successfully!', 'success');
    inputMode = null;
  },

  delete: () => {
    print('Enter bank name to delete: ', 'dim');
    inputMode = { type: 'delete', step: 'name' };
  },

  processDeleteName: (name) => {
    const bank = findBank(name.trim());
    if (!bank) {
      print('Bank not found.', 'error');
      inputMode = null;
      return;
    }
    print(`Enter PIN to confirm deletion of ${bank.name}: `, 'dim');
    inputMode = { type: 'delete', name: name.trim(), step: 'pin' };
  },

  processDeletePin: (pin) => {
    const bank = findBank(inputMode.name);
    if (!bank || bank.pin !== pin.trim()) {
      print('Incorrect PIN!', 'error');
      inputMode = null;
      return;
    }
    
    print('Type YES to confirm deletion: ', 'dim');
    inputMode.step = 'confirm';
  },

  processDeleteConfirm: (confirm) => {
    if (confirm.trim().toLowerCase() !== 'yes') {
      print('Deletion cancelled.', 'warning');
      inputMode = null;
      return;
    }
    
    const bank = findBank(inputMode.name);
    if (bank) {
      deleteBank(bank.id);
      print(`Bank '${inputMode.name}' deleted successfully!`, 'success');
    }
    inputMode = null;
  },

  // Bank operations
  deposit: () => {
    if (!currentBank) {
      print('Access a bank first using: access <name>', 'warning');
      return;
    }
    
    print('Enter amount to deposit: ', 'dim');
    inputMode = { type: 'deposit' };
  },

  processDeposit: (amount) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      print('Invalid amount. Must be a positive number.', 'error');
      inputMode = null;
      return;
    }
    
    currentBank.balance += amountNum;
    currentBank.transactions.push({
      date: new Date().toISOString().split('T')[0],
      type: 'deposit',
      amount: amountNum,
      note: `Deposited ₹${amountNum.toFixed(2)}`
    });
    
    updateBank(currentBank);
    print(`Deposited ₹${amountNum.toFixed(2)}. New balance: ₹${currentBank.balance.toFixed(2)}`, 'success');
    inputMode = null;
  },

  withdraw: () => {
    if (!currentBank) {
      print('Access a bank first using: access <name>', 'warning');
      return;
    }
    
    print('Enter amount to withdraw: ', 'dim');
    inputMode = { type: 'withdraw' };
  },

  processWithdraw: (amount) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      print('Invalid amount. Must be a positive number.', 'error');
      inputMode = null;
      return;
    }
    
    if (amountNum > currentBank.balance) {
      print(`Insufficient funds! Current balance: ₹${currentBank.balance.toFixed(2)}`, 'error');
      inputMode = null;
      return;
    }
    
    currentBank.balance -= amountNum;
    currentBank.transactions.push({
      date: new Date().toISOString().split('T')[0],
      type: 'withdraw',
      amount: amountNum,
      note: `Withdrew ₹${amountNum.toFixed(2)}`
    });
    
    updateBank(currentBank);
    print(`Withdrew ₹${amountNum.toFixed(2)}. New balance: ₹${currentBank.balance.toFixed(2)}`, 'success');
    inputMode = null;
  },

  balance: () => {
    if (!currentBank) {
      print('Access a bank first using: access <name>', 'warning');
      return;
    }
    
    print(`\nBalance for ${currentBank.name}: ₹${currentBank.balance.toFixed(2)}`, 'info');
    print('\nTransaction History:', 'info');
    
    if (currentBank.transactions && currentBank.transactions.length > 0) {
      currentBank.transactions.forEach(t => {
        let className = 'dim';
        if (t.type === 'deposit' || t.type === 'transfer_in') className = 'transaction-deposit';
        if (t.type === 'withdraw' || t.type === 'transfer_out') className = 'transaction-withdraw';
        print(`  ${t.date} - ${t.note}`, className);
      });
    } else {
      print('  (no transactions yet)', 'dim');
    }
    print('');
  },

  transfer: () => {
    if (!currentBank) {
      print('Access a bank first using: access <name>', 'warning');
      return;
    }
    
    print('Enter name of bank to transfer to: ', 'dim');
    inputMode = { type: 'transfer', step: 'toName' };
  },

  processTransferToName: (toName) => {
    if (!toName || !toName.trim()) {
      print('Bank name is required.', 'error');
      inputMode = null;
      return;
    }
    
    const toBank = findBank(toName.trim());
    if (!toBank) {
      print('That bank does not exist.', 'error');
      inputMode = null;
      return;
    }
    
    if (toBank.id === currentBank.id) {
      print('Cannot transfer to the same bank.', 'error');
      inputMode = null;
      return;
    }
    
    inputMode.toName = toName.trim();
    print('Enter amount to transfer: ', 'dim');
    inputMode.step = 'amount';
  },

  processTransferAmount: (amount) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      print('Invalid amount. Must be a positive number.', 'error');
      inputMode = null;
      return;
    }
    
    if (amountNum > currentBank.balance) {
      print(`Not enough money! Current balance: ₹${currentBank.balance.toFixed(2)}`, 'error');
      inputMode = null;
      return;
    }
    
    const toBank = findBank(inputMode.toName);
    if (!toBank) {
      print('Recipient bank not found.', 'error');
      inputMode = null;
      return;
    }
    
    // Deduct from current bank
    currentBank.balance -= amountNum;
    currentBank.transactions.push({
      date: new Date().toISOString().split('T')[0],
      type: 'transfer_out',
      amount: amountNum,
      note: `Transferred ₹${amountNum.toFixed(2)} to ${toBank.name}`
    });
    updateBank(currentBank);
    
    // Add to recipient bank
    toBank.balance += amountNum;
    toBank.transactions.push({
      date: new Date().toISOString().split('T')[0],
      type: 'transfer_in',
      amount: amountNum,
      note: `Received ₹${amountNum.toFixed(2)} from ${currentBank.name}`
    });
    updateBank(toBank);
    
    // Reload current bank
    currentBank = findBank(currentBank.name);
    
    print(`Transferred ₹${amountNum.toFixed(2)} to ${inputMode.toName}. New balance: ₹${currentBank.balance.toFixed(2)}`, 'success');
    inputMode = null;
  },

  clearhistory: () => {
    if (!currentBank) {
      print('Access a bank first using: access <name>', 'warning');
      return;
    }
    
    if (!currentBank.transactions || currentBank.transactions.length === 0) {
      print('No transactions to delete.', 'warning');
      return;
    }
    
    print('Delete ALL transaction history? Type YES to confirm: ', 'dim');
    inputMode = { type: 'clearhistory' };
  },

  processClearHistory: (confirm) => {
    if (confirm.trim().toLowerCase() !== 'yes') {
      print('Cancelled. History not deleted.', 'warning');
      inputMode = null;
      return;
    }
    
    currentBank.transactions = [];
    updateBank(currentBank);
    print('Transaction history deleted.', 'success');
    inputMode = null;
  },

  back: () => {
    if (currentBank) {
      currentBank = null;
      showMainMenu();
    }
  }
};

function showMainMenu() {
  print('\n===  TrustLine Bank App Main Menu  ===', 'info');
  print('  1. Create New Bank', 'menu-option');
  print('  2. Access Existing Bank', 'menu-option');
  print('  3. List Banks', 'menu-option');
  print('  4. Update Existing Bank', 'menu-option');
  print('  5. Delete Bank', 'menu-option');
  print('  6. Quit', 'menu-option');
  print('\nEnter command (or type help for commands):', 'dim');
}

function showBankMenu() {
  print('\n--- Welcome, ' + currentBank.name + ' ---', 'success');
  print('  1. Deposit Money', 'menu-option');
  print('  2. Withdraw Money', 'menu-option');
  print('  3. Show Balance & History', 'menu-option');
  print('  4. Transfer Money', 'menu-option');
  print('  5. Delete Transaction History', 'menu-option');
  print('  6. Go Back to Main Menu', 'menu-option');
  print('\nEnter command:', 'dim');
}

function processInput(trimmed) {
  // Handle input mode
  if (inputMode) {
    switch (inputMode.type) {
      case 'create':
        if (inputMode.step === 'name') {
          commands.processCreate(trimmed);
        } else if (inputMode.step === 'pin') {
          commands.processCreatePin(trimmed);
        }
        return;
        
      case 'access':
        if (inputMode.step === 'name') {
          commands.processAccessName(trimmed);
        } else if (inputMode.step === 'pin') {
          commands.processAccess(trimmed);
        }
        return;
        
      case 'update':
        if (inputMode.step === 'name') {
          commands.processUpdateName(trimmed);
        } else if (inputMode.step === 'pin') {
          commands.processUpdatePin(trimmed);
        } else if (inputMode.step === 'newName') {
          commands.processUpdateNewName(trimmed);
        } else if (inputMode.step === 'newPin') {
          commands.processUpdatePinNew(trimmed);
        }
        return;
        
      case 'delete':
        if (inputMode.step === 'name') {
          commands.processDeleteName(trimmed);
        } else if (inputMode.step === 'pin') {
          commands.processDeletePin(trimmed);
        } else if (inputMode.step === 'confirm') {
          commands.processDeleteConfirm(trimmed);
        }
        return;
        
      case 'deposit':
        commands.processDeposit(trimmed);
        return;
        
      case 'withdraw':
        commands.processWithdraw(trimmed);
        return;
        
      case 'transfer':
        if (inputMode.step === 'toName') {
          commands.processTransferToName(trimmed);
        } else if (inputMode.step === 'amount') {
          commands.processTransferAmount(trimmed);
        }
        return;
        
      case 'clearhistory':
        commands.processClearHistory(trimmed);
        return;
    }
    return;
  }
  
  // Handle commands
  const parts = trimmed.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  if (!currentBank) {
    if (cmd === '1' || cmd === 'create') {
      commands.create();
      return;
    }
    if (cmd === '2' || cmd === 'access') {
      commands.access();
      return;
    }
    if (cmd === '3' || cmd === 'list') {
      commands.list();
      return;
    }
    if (cmd === '4' || cmd === 'update') {
      commands.update();
      return;
    }
    if (cmd === '5' || cmd === 'delete') {
      commands.delete();
      return;
    }
    if (cmd === '6' || cmd === 'quit' || cmd === 'exit') {
      window.location.href = 'Home.html';
      return;
    }
  } else {
    if (cmd === '1' || cmd === 'deposit') {
      commands.deposit();
      return;
    }
    if (cmd === '2' || cmd === 'withdraw') {
      commands.withdraw();
      return;
    }
    if (cmd === '3' || cmd === 'balance' || cmd === 'show') {
      commands.balance();
      return;
    }
    if (cmd === '4' || cmd === 'transfer') {
      commands.transfer();
      return;
    }
    if (cmd === '5' || cmd === 'clearhistory') {
      commands.clearhistory();
      return;
    }
    if (cmd === '6' || cmd === 'back' || cmd === 'exit') {
      commands.back();
      return;
    }
  }
  
  if (commands[cmd]) {
    commands[cmd]();
  } else {
    print(`Unknown command: ${cmd}. Type 'help' for available commands.`, 'error');
  }
}

function handleCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;
  
  print('$ ' + trimmed, 'dim');
  processInput(trimmed);
}

// Event listener
terminalInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const value = terminalInput.value;
    terminalInput.value = '';
    handleCommand(value);
  }
});

// Initialize
showMainMenu();

// Focus input on click
document.querySelector('.terminal-body').addEventListener('click', () => {
  terminalInput.focus();
});
