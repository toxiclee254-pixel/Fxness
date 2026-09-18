(() => {
  'use strict';

  const STORAGE_KEY = 'fxness-ksh-v1';
  const QUOTES = {
    'EUR/USD': { bid: 1.0842, ask: 1.0844, change: '+0.42%', decimals: 4 },
    'GBP/USD': { bid: 1.2638, ask: 1.2641, change: '-0.18%', decimals: 4 },
    'USD/JPY': { bid: 151.62, ask: 151.65, change: '+0.27%', decimals: 2 },
    'XAU/USD': { bid: 2164.8, ask: 2165.25, change: '+0.64%', decimals: 2 }
  };

  const state = {
    user: null,
    page: 'dashboard',
    market: 'EUR/USD',
    side: 'buy'
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const money = (value = 0) => `KSh ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatRate = (value, decimals = 4) => Number(value).toFixed(decimals);
  const initials = (name = 'Trader') => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

  const loadStorage = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: [], session: null };
    } catch {
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
    return data.users.find((user) => user.id === data.session) || null;
  };

  const persistUser = (user) => {
    const data = db();
    const index = data.users.findIndex((item) => item.id === user.id);
    if (index >= 0) data.users[index] = user;
    saveStorage(data);
    state.user = user;
  };

  const updateUserMeta = () => {
    if (!state.user) return;
    const name = state.user.name || 'Trader';
    const avatar = initials(name);
    $('#sidebar-name').textContent = name;
    $('#sidebar-avatar').textContent = avatar;
    $('#header-avatar').textContent = avatar;
  };

  const renderPreview = () => {
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
  };

  const pageHead = (label, title, sub) => `
    <div class="page-head">
      <small class="eyebrow">${label}</small>
      <h1>${title}</h1>
      <p class="intro">${sub}</p>
    </div>
  `;

  const marketTable = () => `
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

  const transactionTable = (rows) => {
    if (!rows || !rows.length) {
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
          ${rows.slice().reverse().map((row) => `
            <tr>
              <td>${row.label}<span class="mini-note">${new Date(row.date).toLocaleDateString()}</span></td>
              <td>${row.type}</td>
              <td class="${row.amount >= 0 ? 'gain-text' : 'loss-text'}">${row.amount === 0 ? '—' : `${row.amount >= 0 ? '+' : '-'}${money(Math.abs(row.amount))}`}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const currentPrice = (market, direction) => {
    const quote = QUOTES[market];
    return direction === 'buy' ? quote.ask : quote.bid;
  };

  const livePnl = (position) => {
    const quote = QUOTES[position.instrument];
    const current = position.side === 'buy' ? quote.bid : quote.ask;
    const diff = position.side === 'buy' ? current - position.entry : position.entry - current;
    return diff * position.amount;
  };

  const renderDashboard = () => {
    const user = state.user;
    const positions = user.positions || [];
    const totalPnl = positions.reduce((sum, position) => sum + livePnl(position), 0);
    const html = `
      ${pageHead('OVERVIEW', `Welcome, ${user.name.split(' ')[0]}`, 'Your KSh-based paper trading workspace.')}

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
          ${transactionTable((user.transactions || []).slice(-5))}
        </section>

        <section class="card">
          <div class="card-head">
            <h3>Market overview</h3>
            <button class="link-inline" data-page="markets">Browse</button>
          </div>
          ${marketTable()}
        </section>
      </div>
    `;

    $('#screen').innerHTML = html;
  };

  const renderMarkets = () => {
    const html = `
      ${pageHead('MARKET WATCH', 'Markets', 'Monitor simulated quotes and decide whether to buy or sell.')}
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
  };

  const renderTrade = () => {
    const market = state.market;
    const quote = QUOTES[market];

    const html = `
      ${pageHead('PAPER TRADING', 'Trade', 'Select a market and open a simulated order using KSh.')}

      <div class="trade-layout">
        <section class="panel">
          <h2>Order ticket</h2>
          <p class="subhead">This app is limited to simulated trading for practice.</p>

          <div class="toggle-group">
            <button class="${state.side === 'buy' ? 'selected-buy' : ''}" data-side="buy">Buy / Long</button>
            <button class="${state.side === 'sell' ? 'selected-sell' : ''}" data-side="sell">Sell / Short</button>
          </div>

          <label class="field-label">
            Market
            <select id="trade-market" class="select">
              ${Object.keys(QUOTES).map((name) => `<option value="${name}" ${name === market ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
          </label>

          <div class="field-row">
            <label class="field-label">
              Trade amount
              <input id="trade-amount" class="field" type="number" min="1" step="100" value="1000" />
            </label>
            <label class="field-label">
              Entry price
              <input id="trade-entry" class="field" type="number" step="0.0001" value="${formatRate(currentPrice(market, state.side), quote.decimals)}" />
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
            ⓘ This is a simulated order. No real money is used and no financial transactions are processed.
          </div>

          <button class="btn btn-primary btn-full" id="open-trade-btn">Open ${state.side} trade</button>
        </section>

        <section class="panel chart-panel">
          <h2>${market}</h2>
          <p class="subhead">${quote.change} today</p>
          <div class="trade-chart">
            <svg viewBox="0 0 600 250" aria-label="Trade chart preview">
              <path d="M0 38h600M0 92h600M0 146h600M0 200h600M90 0v250M210 0v250M330 0v250M450 0v250" class="chart-grid"/>
              <path d="M0 195C50 175 80 155 120 168S180 103 220 146S290 160 330 103S390 128 430 68S510 95 600 28V250H0Z" class="chart-overlay"/>
              <path d="M0 195C50 175 80 155 120 168S180 103 220 146S290 160 330 103S390 128 430 68S510 95 600 28" class="chart-stroke"/>
            </svg>
          </div>
        </section>
      </div>
    `;

    $('#screen').innerHTML = html;

    $('#open-trade-btn')?.addEventListener('click', () => {
      const amount = Number($('#trade-amount').value);
      const entry = Number($('#trade-entry').value);
      if (!amount || amount <= 0 || !entry || entry <= 0) {
        showToast('Enter a valid trade amount and entry price.', 'error');
        return;
      }

      const user = state.user;
      const position = {
        id: `pos-${Date.now()}-${Math.random()}`,
        instrument: state.market,
        side: state.side,
        amount,
        entry,
        stop: Number($('#trade-stop').value) || null,
        target: Number($('#trade-target').value) || null,
        date: new Date().toISOString()
      };

      user.positions = [...(user.positions || []), position];
      user.transactions = [...(user.transactions || []), {
        label: `${state.side === 'buy' ? 'Buy' : 'Sell'} ${state.market}`,
        type: 'Trade',
        amount: 0,
        date: new Date().toISOString()
      }];

      persistUser(user);
      showToast('Paper trade opened successfully.', 'success');
      state.page = 'positions';
      renderPage();
    });
  };

  const renderPositions = () => {
    const user = state.user;
    const positions = user.positions || [];
    const html = `
      ${pageHead('PORTFOLIO', 'Open positions', 'Monitor and close your active paper trades.')}
      ${positions.length ? `
        <table class="table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Side</th>
              <th>Amount</th>
              <th>Entry</th>
              <th>Current</th>
              <th>P/L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${positions.map((position) => {
              const pnl = livePnl(position);
              const current = QUOTES[position.instrument][position.side === 'buy' ? 'bid' : 'ask'];
              return `
                <tr>
                  <td><strong>${position.instrument}</strong></td>
                  <td class="${position.side === 'buy' ? 'gain-text' : 'loss-text'}">${position.side.toUpperCase()}</td>
                  <td>${money(position.amount)}</td>
                  <td>${formatRate(position.entry, QUOTES[position.instrument].decimals)}</td>
                  <td>${formatRate(current, QUOTES[position.instrument].decimals)}</td>
                  <td class="${pnl >= 0 ? 'gain-text' : 'loss-text'}">${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}</td>
                  <td><button class="link-inline" data-close-position="${position.id}">Close</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<div class="empty-state"><strong>No open positions</strong>Select a market and open a simulated trade.</div>'}
    `;

    $('#screen').innerHTML = html;
  };

  const renderTransactions = () => {
    const user = state.user;
    const html = `
      ${pageHead('ACTIVITY', 'Transactions', 'Your KSh paper trading history.')}
      ${transactionTable(user.transactions || [])}
    `;
    $('#screen').innerHTML = html;
  };

  const renderProfile = () => {
    const user = state.user;
    const html = `
      ${pageHead('ACCOUNT', 'Profile', 'Your FXNESS account details.')}
      <section class="card profile-box">
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
          <span class="label">Currency</span>
          <strong>KSh</strong>
        </div>
      </section>
    `;
    $('#screen').innerHTML = html;
  };

  const renderSettings = () => {
    const html = `
      ${pageHead('PREFERENCES', 'Settings', 'Customize your workspace.')}
      <section class="card profile-box">
        <div class="setting-row">
          <div>
            <h4>Dark appearance</h4>
            <p>Use the professional dark trading workspace.</p>
          </div>
          <button class="setting-toggle on"><span></span></button>
        </div>
        <div class="setting-row">
          <div>
            <h4>Notifications</h4>
            <p>Receive practice alerts.</p>
          </div>
          <button class="setting-toggle on"><span></span></button>
        </div>
        <div class="setting-row">
          <div>
            <h4>Currency</h4>
            <p>All values are displayed in KSh.</p>
          </div>
          <strong>KSh</strong>
        </div>
      </section>
    `;
    $('#screen').innerHTML = html;
  };

  const renderPage = () => {
    if (!state.user) return;

    if (state.page === 'dashboard') renderDashboard();
    if (state.page === 'markets') renderMarkets();
    if (state.page === 'trade') renderTrade();
    if (state.page === 'positions') renderPositions();
    if (state.page === 'transactions') renderTransactions();
    if (state.page === 'profile') renderProfile();
    if (state.page === 'settings') renderSettings();

    $('#page-name').textContent = state.page.charAt(0).toUpperCase() + state.page.slice(1);
    $('#positions-count').textContent = String((state.user.positions || []).length);

    $$('.nav-link').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === state.page);
    });
  };

  const login = (event) => {
    event.preventDefault();
    const email = $('#login-email').value.trim().toLowerCase();
    const password = $('#login-password').value;
    const data = db();
    const user = data.users.find((item) => item.email === email && item.password === password);

    if (!user) {
      showToast('Incorrect email or password.', 'error');
      return;
    }

    data.session = user.id;
    saveStorage(data);
    state.user = user;
    state.page = 'dashboard';
    updateUserMeta();
    showApp();
    renderPage();
    showToast('Welcome back to FXNESS.', 'success');
  };

  const register = (event) => {
    event.preventDefault();
    const name = $('#reg-name').value.trim();
    const email = $('#reg-email').value.trim().toLowerCase();
    const password = $('#reg-password').value;
    const confirm = $('#reg-confirm').value;

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    if (password !== confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    const data = db();
    if (data.users.some((user) => user.email === email)) {
      showToast('An account with that email already exists.', 'error');
      return;
    }

    const newUser = {
      id: `user-${Date.now()}-${Math.random()}`,
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

    data.users.push(newUser);
    data.session = newUser.id;
    saveStorage(data);
    state.user = newUser;
    state.page = 'dashboard';
    updateUserMeta();
    showApp();
    renderPage();
    showToast('Account created with KSh 0.00.', 'success');
  };

  const showLanding = () => {
    $('#landing').classList.remove('hidden');
    $('#auth').classList.add('hidden');
    $('#app').classList.add('hidden');
  };

  const showAuth = (mode) => {
    $('#landing').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
    $('#login-box').classList.toggle('hidden', mode !== 'login');
    $('#register-box').classList.toggle('hidden', mode !== 'register');
  };

  const showApp = () => {
    $('#landing').classList.add('hidden');
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
  };

  document.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      const action = actionTarget.dataset.action;
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
    }

    const navTarget = event.target.closest('[data-page]');
    if (navTarget && navTarget.dataset.page) {
      const page = navTarget.dataset.page;
      state.page = page;
      if (!state.user) return;
      if (page === 'trade' && !state.market) state.market = 'EUR/USD';
      renderPage();
    }

    const quickMarket = event.target.closest('[data-quick-market]');
    if (quickMarket) {
      state.market = quickMarket.dataset.quickMarket;
      state.side = quickMarket.dataset.side;
      state.page = 'trade';
      renderPage();
    }

    const closeTarget = event.target.closest('[data-close-position]');
    if (closeTarget) {
      const user = state.user;
      const id = closeTarget.dataset.closePosition;
      const target = (user.positions || []).find((position) => position.id === id);
      if (!target) return;
      const pnl = livePnl(target);
      user.positions = (user.positions || []).filter((position) => position.id !== id);
      user.transactions = [...(user.transactions || []), {
        label: `Closed ${target.side.toUpperCase()} ${target.instrument}`,
        type: 'Trade closed',
        amount: pnl,
        date: new Date().toISOString()
      }];
      persistUser(user);
      showToast('Position closed successfully.', 'success');
      renderPage();
    }

    const scrollTarget = event.target.closest('[data-scroll]');
    if (scrollTarget) {
      const section = document.getElementById(scrollTarget.dataset.scroll);
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.addEventListener('change', (event) => {
    const tradeMarket = event.target.closest('#trade-market');
    if (tradeMarket) {
      state.market = tradeMarket.value;
      renderPage();
    }
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.setting-toggle');
    if (toggle) {
      toggle.classList.toggle('on');
    }
  });

  document.addEventListener('click', (event) => {
    const sideButton = event.target.closest('[data-side]');
    if (!sideButton || !sideButton.dataset.side) return;
    const side = sideButton.dataset.side;
    if (['buy', 'sell'].includes(side)) {
      state.side = side;
      renderPage();
    }
  });

  $('#login-form').addEventListener('submit', login);
  $('#register-form').addEventListener('submit', register);

  const init = () => {
    renderPreview();

    const data = db();
    state.user = data.users.find((user) => user.id === data.session) || null;

    if (state.user) {
      updateUserMeta();
      showApp();
      renderPage();
    } else {
      showLanding();
    }
  };

  init();
})();
