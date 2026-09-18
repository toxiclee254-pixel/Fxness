(() => {
  'use strict';

  const STORAGE_KEY = 'fxness-ksh-v1';
  const QUOTES = {
    'EUR/USD': { bid: 1.0842, ask: 1.0844, change: '+0.42%', decimals: 4 },
    'GBP/USD': { bid: 1.2638, ask: 1.2641, change: '-0.18%', decimals: 4 },
    'USD/JPY': { bid: 151.62, ask: 151.65, change: '+0.27%', decimals: 2 },
    'XAU/USD': { bid: 2164.80, ask: 2165.25, change: '+0.64%', decimals: 2 }
  };

  const state = {
    user: null,
    page: 'dashboard',
    market: 'EUR/USD',
    side: 'buy',
    sidebarOpen: false
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const money = (value = 0) => `KSh ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatRate = (value, decimals = 4) => Number(value).toFixed(decimals);
  const initials = (name = 'Trader') => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

  const loadStorage = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: [], session: null };
    } catch (error) {
      return { users: [], session: null };
    }
  };

  const saveStorage = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const showToast = (message, type = 'success') => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 2600);
  };

  const db = () => loadStorage();

  const currentUser = () => {
    const data = db();
    return data.users.find(user => user.id === data.session) || null;
  };

  const setUser = (user) => {
    state.user = user;
    if (user) {
      const id = user.id;
      const data = db();
      const idx = data.users.findIndex(item => item.id === id);
      if (idx >= 0) data.users[idx] = user;
      saveStorage(data);
    }
  };

  const persist = (user) => {
    const data = db();
    const idx = data.users.findIndex(item => item.id === user.id);
    if (idx >= 0) data.users[idx] = user;
    saveStorage(data);
    state.user = user;
  };

  function renderPreview() {
    const container = $('#preview-quotes');
    if (!container) return;
    container.innerHTML = Object.entries(QUOTES).map(([name, quote]) => {
      const gain = quote.change.startsWith('+');
      return `
        <div>
          <span class="market-name">${name}</span>
          <strong>${formatRate(quote.bid, quote.decimals)}</strong>
          <span class="${gain ? 'gain-text' : 'loss-text'}">${quote.change}</span>
        </div>
      `;
    }).join('');
  }

  function updateUserMeta() {
    if (!state.user) return;
    const name = state.user.name || 'Trader';
    const avatar = initials(name);
    $('#sidebar-name').textContent = name;
    $('#sidebar-avatar').textContent = avatar;
    $('#header-avatar').textContent = avatar;
  }

  function isLoggedIn() {
    return Boolean(state.user);
  }

  function showLanding() {
    $('#landing').classList.remove('hidden');
    $('#auth').classList.add('hidden');
    $('#app').classList.add('hidden');
  }

  function showAuth(mode = 'login') {
    $('#landing').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
    $('#login-box').classList.toggle('hidden', mode !== 'login');
    $('#register-box').classList.toggle('hidden', mode !== 'register');
  }

  function showApp() {
    $('#landing').classList.add('hidden');
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
  }

  function currentMarketPrice(market, direction) {
    const entry = QUOTES[market];
    return direction === 'buy' ? entry.ask : entry.bid;
  }

  function livePnl(position) {
    const market = QUOTES[position.instrument];
    const lastPrice = position.side === 'buy' ? market.bid : market.ask;
    const diff = position.side === 'buy' ? (lastPrice - position.entry) : (position.entry - lastPrice);
    return diff * position.amount;
  }

  function renderDashboard() {
    const user = state.user;
    const positions = user.positions || [];
    const totalPnl = positions.reduce((total, p) => total + livePnl(p), 0);
    const transactions = user.transactions || [];

    const html = `
      ${pageHead('OVERVIEW', `Welcome, ${user.name.split(' ')[0]}`, 'Your practice trading workspace in KSh.')}

      <div class="stats-grid">
        <div class="stat-card">
          <small>Account balance</small>
          <strong>${money(user.balance)}</strong>
          <span class="sub">Paper funds</span>
        </div>
        <div class="stat-card">
          <small>Available balance</small>
          <strong>${money(user.balance)}</strong>
          <span class="sub">No margin used</span>
        </div>
        <div class="stat-card">
          <small>Open positions</small>
          <strong>${positions.length}</strong>
          <span class="sub">Active trades</span>
        </div>
        <div class="stat-card">
          <small>Total P/L</small>
          <strong class="${totalPnl >= 0 ? 'gain-text' : 'loss-text'}">${totalPnl >= 0 ? '+' : '-'}${money(Math.abs(totalPnl))}</strong>
          <span class="sub">Estimated</span>
        </div>
      </div>

      <div class="grid-two">
        <section class="card">
          <div class="card-head">
            <h3>Recent transactions</h3>
            <button class="link-inline" data-page="transactions">View all</button>
          </div>
          ${renderTransactionsTable(transactions.slice(-5).reverse())}
        </section>

        <section class="card">
          <div class="card-head">
            <h3>Market overview</h3>
            <button class="link-inline" data-page="markets">Browse</button>
          </div>
          ${renderMarketTable()}
        </section>
      </div>
    `;

    $('#screen').innerHTML = html;
    bindActions();
  }

  function renderMarkets() {
    const html = `
      ${pageHead('MARKET WATCH', 'Markets', 'Monitor live-feeling quotes and choose a trade direction.')}
      <div class="market-grid">
        ${Object.entries(QUOTES).map(([name, quote]) => `
          <div class="market-card">
            <div>
              <h3>${name}</h3>
              <p>${quote.change} today</p>
            </div>
            <div class="market-prices">
              <div>Bid<b>${formatRate(quote.bid, quote.decimals)}</b></div>
              <div>Ask<b>${formatRate(quote.ask, quote.decimals)}</b></div>
            </div>
            <div class="trade-actions">
              <button class="buy-btn" data-quick-market="${name}" data-side="buy">Buy</button>
              <button class="sell-btn" data-quick-market="${name}" data-side="sell">Sell</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    $('#screen').innerHTML = html;
    bindActions();
  }

  function renderTrade() {
    const market = state.market;
    const quote = QUOTES[market];
    const html = `
      ${pageHead('PAPER TRADING', 'Trade', 'Open a simulated order using KSh-based paper funds.')}

      <div class="trade-layout">
        <section class="panel">
          <h2>Order ticket</h2>
          <p class="subhead">All orders are simulated and do not involve real money.</p>

          <div class="toggle-group">
            <button class="${state.side === 'buy' ? 'selected-buy' : ''}" data-side="buy">Buy / Long</button>
            <button class="${state.side === 'sell' ? 'selected-sell' : ''}" data-side="sell">Sell / Short</button>
          </div>

          <label class="field-label">
            Market
            <select id="trade-market" class="select">
              ${Object.keys(QUOTES).map(name => `<option value="${name}" ${name === market ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
          </label>

          <div class="field-row">
            <label class="field-label">
              Trade amount
              <input id="trade-amount" class="field" type="number" min="1" step="100" value="1000" />
            </label>
            <label class="field-label">
              Entry price
              <input id="trade-entry" class="field" type="number" step="0.0001" value="${formatRate(currentMarketPrice(market, state.side), quote.decimals)}" />
            </label>
          </div>

          <div class="field-row">
            <label class="field-label">
              Stop-loss
              <input id="trade-stop" class="field" type="number" step="0.0001" placeholder="Optional" />
            </label>
            <label class="field-label">
              Take-profit
              <input id="trade-target" class="field" type="number" step="0.0001" placeholder="Optional" />
            </label>
          </div>

          <div class="note-box">
            ⓘ This is a simulated order for learning. No real funds, real deposits or withdrawals are processed.
          </div>

          <button class="btn btn-primary btn-full" id="open-trade-btn">Open ${state.side} trade</button>
        </section>

        <section class="panel chart-panel">
          <h2>${market}</h2>
          <p class="subhead">${quote.change} today</p>
          <div class="trade-chart">
            <svg viewBox="0 0 600 250" aria-label="Trade chart">
              <path d="M0 38h600M0 92h600M0 146h600M0 200h600M90 0v250M210 0v250M330 0v250M450 0v250" class="chart-grid"/>
              <path d="M0 195C50 175 80 155 120 168S180 103 220 146S290 160 330 103S390 128 430 68S510 95 600 28V250H0Z" class="chart-overlay"/>
              <path d="M0 195C50 175 80 155 120 168S180 103 220 146S290 160 330 103S390 128 430 68S510 95 600 28" class="chart-stroke"/>
            </svg>
          </div>
        </section>
      </div>
    `;

    $('#screen').innerHTML = html;
    bindActions();

    const select = $('#trade-market');
    select.addEventListener('change', (event) => {
      state.market = event.target.value;
      renderTrade();
    });

    $('#open-trade-btn').addEventListener('click', () => {
      const amount = Number($('#trade-amount').value);
      const entry = Number($('#trade-entry').value);
      if (!amount || amount <= 0 || !entry || entry <= 0) {
        showToast('Enter a valid amount and entry price.', 'error');
        return;
      }

      const user = state.user;
      const newPosition = {
        id: String(Date.now() + Math.random()),
        instrument: state.market,
        side: state.side,
        amount,
        entry,
        stop: Number($('#trade-stop').value) || null,
        target: Number($('#trade-target').value) || null,
        date: new Date().toISOString()
      };

      user.positions = [...(user.positions || []), newPosition];
      user.transactions = [...(user.transactions || []), {
        label: `${state.side === 'buy' ? 'Buy' : 'Sell'} ${state.market}`,
        type: 'Trade',
        amount: 0,
        date: new Date().toISOString()
      }];

      persist(user);
      showToast('Paper trade opened successfully.', 'success');
      renderPositions();
    });
  }

  function renderPositions() {
    const user = state.user;
    const positions = user.positions || [];
    const html = `
      ${pageHead('PORTFOLIO', 'Open positions', 'Manage your active paper trades.')}
      ${positions.length ? `<table class="table"><thead><tr><th>Instrument</th><th>Side</th><th>Amount</th><th>Entry</th><th>Current</th><th>P/L</th><th></th></tr></thead><tbody>${positions.map((pos) => {
        const pnl = livePnl(pos);
        const current = QUOTES[pos.instrument][pos.side === 'buy' ? 'bid' : 'ask'];
        return `<tr>
          <td><strong>${pos.instrument}</strong></td>
          <td class="${pos.side === 'buy' ? 'gain-text' : 'loss-text'}">${pos.side.toUpperCase()}</td>
          <td>${money(pos.amount)}</td>
          <td>${formatRate(pos.entry, QUOTES[pos.instrument].decimals)}</td>
          <td>${formatRate(current, QUOTES[pos.instrument].decimals)}</td>
          <td class="${pnl >= 0 ? 'gain-text' : 'loss-text'}">${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}</td>
          <td><button class="link-inline" data-close-position="${pos.id}">Close</button></td>
        </tr>`;
      }).join('')}</tbody></table>` : '<div class="empty-state"><strong>No open positions</strong>Select a market and open a simulated trade.</div>'}
    `;

    $('#screen').innerHTML = html;
    bindActions();
  }

  function renderTransactions() {
    const user = state.user;
    const transactions = user.transactions || [];
    const html = `
      ${pageHead('ACTIVITY', 'Transactions', 'Paper trading history for this account.')}
      ${renderTransactionsTable(transactions.slice().reverse())}
    `;
    $('#screen').innerHTML = html;
    bindActions();
  }

  function renderTransactionsTable(rows) {
    if (!rows.length) {
      return '<div class="empty-state"><strong>No transactions yet</strong>Your account activity will appear here.</div>';
    }

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((item) => `
            <tr>
              <td>${item.label}<span class="mini-note">${new Date(item.date).toLocaleDateString()}</span></td>
              <td>${item.type}</td>
              <td class="${item.amount >= 0 ? 'gain-text' : 'loss-text'}">${item.amount === 0 ? '—' : `${item.amount >= 0 ? '+' : '-'}${money(Math.abs(item.amount))}`}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderMarketTable() {
    return `
      <table class="table">
        <thead>
          <tr>
            <th>Market</th>
            <th>Bid</th>
            <th>Move</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(QUOTES).map(([name, quote]) => `
            <tr>
              <td><strong>${name}</strong><span class="mini-note">Synthetic feed</span></td>
              <td>${formatRate(quote.bid, quote.decimals)}</td>
              <td class="${quote.change.startsWith('+') ? 'gain-text' : 'loss-text'}">${quote.change}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderProfile() {
    const user = state.user;
    const html = `
      ${pageHead('ACCOUNT', 'Profile', 'Your FXNESS account data.')}
      <section class="profile-box card">
        <div class="profile-line">
          <span class="label">Name</span>
          <strong>${user.name}</strong>
        </div>
        <div class="profile-line">
          <span class="label">Email</span>
          <strong>${user.email}</strong>
        </div>
        <div class="profile-line">
          <span class="label">Account status</span>
          <strong class="gain-text">Active paper account</strong>
        </div>
        <div class="profile-line">
          <span class="label">Balance</span>
          <strong>${money(user.balance)}</strong>
        </div>
        <div class="profile-line">
          <span class="label">Session</span>
          <strong>KSh-based practice</strong>
        </div>
      </section>
    `;
    $('#screen').innerHTML = html;
    bindActions();
  }

  function renderSettings() {
    const html = `
      ${pageHead('PREFERENCES', 'Settings', 'Customize your workspace.')}
      <section class="card profile-box">
        <div class="setting-row">
          <div>
            <h4>Dark appearance</h4>
            <p>Use the dark trading workspace.</p>
          </div>
          <button class="setting-toggle on"><span></span></button>
        </div>
        <div class="setting-row">
          <div>
            <h4>Notifications</h4>
            <p>Enable practice alerts.</p>
          </div>
          <button class="setting-toggle on"><span></span></button>
        </div>
        <div class="setting-row">
          <div>
            <h4>Currency</h4>
            <p>All balances and values use KSh.</p>
          </div>
          <strong>KSh</strong>
        </div>
      </section>
    `;
    $('#screen').innerHTML = html;
    bindActions();
  }

  function pageHead(label, title, sub) {
    return `
      <div class="page-head">
        <small class="eyebrow">${label}</small>
        <h1>${title}</h1>
        <p class="intro">${sub}</p>
      </div>
    `;
  }

  function renderPage() {
    if (!state.user) return;
    const { page } = state;

    if (page === 'dashboard') renderDashboard();
    if (page === 'markets') renderMarkets();
    if (page === 'trade') renderTrade();
    if (page === 'positions') renderPositions();
    if (page === 'transactions') renderTransactions();
    if (page === 'profile') renderProfile();
    if (page === 'settings') renderSettings();

    $('#page-name').textContent = page.charAt(0).toUpperCase() + page.slice(1);
    $('#positions-count').textContent = String((state.user.positions || []).length);
    $('.nav-link.active')?.classList.remove('active');
    $(`.nav-link[data-page="${page}"]`)?.classList.add('active');
  }

  function bindActions() {
    $$('[data-page]').forEach((el) => {
      el.addEventListener('click', () => {
        const page = el.dataset.page;
        if (page) {
          state.page = page;
          renderPage();
        }
      });
    });

    $$('[data-side]').forEach((el) => {
      el.addEventListener('click', () => {
        state.side = el.dataset.side;
        renderPage();
      });
    });

    $$('[data-quick-market]').forEach((el) => {
      el.addEventListener('click', () => {
        state.market = el.dataset.quickMarket;
        state.side = el.dataset.side;
        state.page = 'trade';
        renderPage();
      });
    });

    $$('[data-close-position]').forEach((button) => {
      button.addEventListener('click', () => {
        const { user } = state;
        const id = button.dataset.closePosition;
        const target = (user.positions || []).find(p => p.id === id);
        if (!target) return;

        const pnl = livePnl(target);
        user.positions = (user.positions || []).filter(p => p.id !== id);
        user.transactions = [...(user.transactions || []), {
          label: `Closed ${target.side.toUpperCase()} ${target.instrument}`,
          type: 'Trade closed',
          amount: pnl,
          date: new Date().toISOString()
        }];

        persist(user);
        showToast('Position closed.', 'success');
        renderPage();
      });
    });

    const toggleButtons = document.querySelectorAll('.setting-toggle');
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('on');
      });
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    const email = $('#login-email').value.trim().toLowerCase();
    const password = $('#login-password').value;
    const data = db();
    const user = data.users.find(item => item.email === email && item.password === password);

    if (!user) {
      showToast('Incorrect email or password.', 'error');
      return;
    }

    data.session = user.id;
    saveStorage(data);
    state.user = user;
    showApp();
    state.page = 'dashboard';
    updateUserMeta();
    renderPage();
    showToast('Welcome back to FXNESS.', 'success');
  }

  function handleRegister(event) {
    event.preventDefault();

    const name = $('#reg-name').value.trim();
    const email = $('#reg-email').value.trim().toLowerCase();
    const password = $('#reg-password').value;
    const confirm = $('#reg-confirm').value;

    if (password !== confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    const data = db();
    if (data.users.some(user => user.email === email)) {
      showToast('An account with that email already exists.', 'error');
      return;
    }

    const user = {
      id: String(Date.now() + Math.random()),
      name,
      email,
      password,
      balance: 0,
      positions: [],
      transactions: [{
        label: 'Account created',
        type: 'Account',
        amount: 0,
        date: new Date().toISOString()
      }],
      settings: { dark: true, notifications: true }
    };

    data.users.push(user);
    data.session = user.id;
    saveStorage(data);
    state.user = user;
    showApp();
    state.page = 'dashboard';
    updateUserMeta();
    renderPage();
    showToast('Account created with KSh 0.00.', 'success');
  }

  function init() {
    const data = db();
    state.user = data.users.find(user => user.id === data.session) || null;

    renderPreview();

    $('#login-form').addEventListener('submit', handleLogin);
    $('#register-form').addEventListener('submit', handleRegister);

    document.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      if (action === 'landing') {
        state.user = null;
        showLanding();
      }
      if (action === 'login') showAuth('login');
      if (action === 'register') showAuth('register');
      if (action === 'logout') {
        const data = db();
        data.session = null;
        saveStorage(data);
        state.user = null;
        showLanding();
        showToast('You have been logged out.', 'success');
      }
      if (action === 'menu') {
        $('#sidebar').classList.toggle('open');
      }
    });

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-scroll]');
      if (!target) return;
      const section = document.getElementById(target.dataset.scroll);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    });

    if (state.user) {
      showApp();
      updateUserMeta();
      renderPage();
    } else {
      showLanding();
    }
  }

  init();
})();
