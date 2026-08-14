(() => {
  const TOKEN_KEY = 'algo_jwt_token';
  const USERNAME_KEY = 'algo_username';
  const state = {
    authMode: 'login',
    decks: [],
    activeDeckUid: null,
    user: null
  };

  const guestView = document.getElementById('guestView');
  const dashboardView = document.getElementById('dashboardView');
  const accountArea = document.getElementById('accountArea');
  const accountName = document.getElementById('accountName');
  const logoutBtn = document.getElementById('logoutBtn');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authTabs = document.getElementById('authTabs');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const authForm = document.getElementById('authForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const passwordField = document.getElementById('passwordField');
  const confirmPasswordField = document.getElementById('confirmPasswordField');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authMessage = document.getElementById('authMessage');
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const backToLoginBtn = document.getElementById('backToLoginBtn');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const createDeckBtn = document.getElementById('createDeckBtn');
  const emptyCreateBtn = document.getElementById('emptyCreateBtn');
  const searchInput = document.getElementById('searchInput');
  const deckGrid = document.getElementById('deckGrid');
  const deckCount = document.getElementById('deckCount');
  const emptyState = document.getElementById('emptyState');
  const libraryMessage = document.getElementById('libraryMessage');
  const deckDialog = document.getElementById('deckDialog');
  const deckDialogForm = document.getElementById('deckDialogForm');
  const deckTitleInput = document.getElementById('deckTitleInput');
  const deckDialogMessage = document.getElementById('deckDialogMessage');
  const closeDeckDialogBtn = document.getElementById('closeDeckDialogBtn');
  const cancelDeckDialogBtn = document.getElementById('cancelDeckDialogBtn');
  const deleteDeckBtn = document.getElementById('deleteDeckBtn');

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setMessage(element, message = '', success = false) {
    element.textContent = message;
    element.classList.toggle('is-success', success);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token()) headers.set('Authorization', `Bearer ${token()}`);

    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || '伺服器暫時無法處理，請稍後再試');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    state.user = null;
  }

  function safeNextPath() {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '';
  }

  function showGuest() {
    guestView.hidden = false;
    dashboardView.hidden = true;
    accountArea.hidden = true;
    setAuthMode(new URLSearchParams(location.search).has('reset_token') ? 'reset' : 'login');
  }

  async function showDashboard(user) {
    state.user = user;
    guestView.hidden = true;
    dashboardView.hidden = false;
    accountArea.hidden = false;
    accountName.textContent = user.username;
    await loadDecks();
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const isLogin = mode === 'login';
    const isRegister = mode === 'register';
    const isForgot = mode === 'forgot';
    const isReset = mode === 'reset';

    authTabs.hidden = isForgot || isReset;
    passwordField.hidden = isForgot;
    confirmPasswordField.hidden = !isRegister;
    confirmPasswordInput.required = isRegister;
    forgotPasswordBtn.hidden = !isLogin;
    backToLoginBtn.hidden = !(isForgot || isReset);
    loginTab.classList.toggle('is-active', isLogin);
    loginTab.setAttribute('aria-selected', String(isLogin));
    registerTab.classList.toggle('is-active', isRegister);
    registerTab.setAttribute('aria-selected', String(isRegister));
    passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
    passwordInput.placeholder = isReset ? '輸入新的密碼' : '至少 8 個字元';

    const copy = {
      login: ['登入 AlgoShowMaker', '開啟你的投影片，繼續上次的編輯。', '登入'],
      register: ['建立個人工作區', '註冊後，投影片會安全地存放在你的帳號中。', '建立帳號'],
      forgot: ['重設密碼', '輸入註冊 Email，我們會寄送重設連結。', '寄送重設連結'],
      reset: ['設定新密碼', '為你的 AlgoShowMaker 帳號設定新密碼。', '更新密碼']
    }[mode];

    authTitle.textContent = copy[0];
    authSubtitle.textContent = copy[1];
    authSubmitBtn.textContent = copy[2];
    setMessage(authMessage);
  }

  async function login(username, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USERNAME_KEY, data.username);
    return { id: data.user_uid, username: data.username };
  }

  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    const username = emailInput.value.trim();
    const password = passwordInput.value;
    setMessage(authMessage);
    authSubmitBtn.disabled = true;

    try {
      if (state.authMode === 'forgot') {
        const data = await api('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ username })
        });
        setMessage(authMessage, data.message || '重設連結已寄出，請檢查信箱。', true);
        return;
      }

      if (state.authMode === 'reset') {
        const resetToken = new URLSearchParams(location.search).get('reset_token');
        const data = await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword: password })
        });
        history.replaceState({}, document.title, '/');
        setAuthMode('login');
        setMessage(authMessage, data.message || '密碼已更新，請重新登入。', true);
        passwordInput.value = '';
        return;
      }

      if (state.authMode === 'register') {
        if (password !== confirmPasswordInput.value) {
          throw new Error('兩次輸入的密碼不一致');
        }
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
      }

      const user = await login(username, password);
      const next = safeNextPath();
      if (next) {
        location.href = next;
        return;
      }
      await showDashboard(user);
    } catch (error) {
      setMessage(authMessage, error.message);
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  loginTab.addEventListener('click', () => setAuthMode('login'));
  registerTab.addEventListener('click', () => setAuthMode('register'));
  forgotPasswordBtn.addEventListener('click', () => setAuthMode('forgot'));
  backToLoginBtn.addEventListener('click', () => setAuthMode('login'));

  togglePasswordBtn.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    togglePasswordBtn.textContent = show ? '隱藏' : '顯示';
    togglePasswordBtn.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
    togglePasswordBtn.title = show ? '隱藏密碼' : '顯示密碼';
  });

  logoutBtn.addEventListener('click', () => {
    clearSession();
    state.decks = [];
    showGuest();
  });

  function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '剛剛更新';
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay
      ? `今天 ${new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(date)}`
      : new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function previewColor(uid) {
    const colors = ['#1d8f83', '#007acc', '#d07b31', '#8a64b6', '#4f8e59'];
    const sum = [...String(uid)].reduce((total, char) => total + char.charCodeAt(0), 0);
    return colors[sum % colors.length];
  }

  function showDeckThumbnail(preview, thumbnail) {
    if (!thumbnail) return;
    let image = preview.querySelector('.deck-cover-image');
    if (!image) {
      image = document.createElement('img');
      image.className = 'deck-cover-image';
      image.alt = '';
      image.decoding = 'async';
      preview.prepend(image);
    }
    image.src = thumbnail;
    preview.classList.add('has-cover');
    preview.classList.remove('is-loading');
  }

  async function buildMissingThumbnail(deck, preview) {
    if (!window.AlgoDeckThumbnail || deck.cover_thumbnail) return;
    preview.classList.add('is-loading');
    try {
      const data = await api(`/api/slides/${encodeURIComponent(deck.deck_uid)}`);
      const thumbnail = await window.AlgoDeckThumbnail.create(data.slide.deck);
      deck.cover_thumbnail = thumbnail;
      showDeckThumbnail(preview, thumbnail);
      await api(`/api/slides/${encodeURIComponent(deck.deck_uid)}`, {
        method: 'PUT',
        body: JSON.stringify({ cover_thumbnail: thumbnail })
      });
    } catch (error) {
      preview.classList.remove('is-loading');
      console.warn('Failed to build deck thumbnail', error);
    }
  }

  function renderDecks() {
    const query = searchInput.value.trim().toLocaleLowerCase('zh-Hant');
    const decks = state.decks.filter(deck => deck.title.toLocaleLowerCase('zh-Hant').includes(query));
    deckGrid.replaceChildren();
    deckCount.textContent = query
      ? `找到 ${decks.length} 份`
      : `共 ${state.decks.length} 份`;
    emptyState.hidden = state.decks.length !== 0 || Boolean(query);

    if (query && decks.length === 0) {
      setMessage(libraryMessage, '找不到符合名稱的投影片');
    } else {
      setMessage(libraryMessage);
    }

    decks.forEach(deck => {
      const card = document.createElement('article');
      card.className = 'deck-card';

      const openButton = document.createElement('button');
      openButton.className = 'deck-open';
      openButton.type = 'button';
      openButton.setAttribute('aria-label', `開啟 ${deck.title}`);
      openButton.addEventListener('click', () => openDeck(deck.deck_uid));

      const preview = document.createElement('div');
      preview.className = 'deck-preview';
      preview.style.setProperty('--preview-accent', previewColor(deck.deck_uid));
      if (deck.cover_thumbnail) showDeckThumbnail(preview, deck.cover_thumbnail);
      else buildMissingThumbnail(deck, preview);

      const slideNumber = document.createElement('span');
      slideNumber.className = 'deck-number';
      slideNumber.textContent = `${deck.slide_count || 0} 張`;
      preview.appendChild(slideNumber);
      openButton.appendChild(preview);

      const info = document.createElement('div');
      info.className = 'deck-info';
      const copy = document.createElement('div');
      copy.className = 'deck-copy';
      const title = document.createElement('button');
      title.className = 'deck-title deck-title-button';
      title.type = 'button';
      title.textContent = deck.title;
      title.title = 'Rename presentation';
      title.setAttribute('aria-label', `Rename ${deck.title}`);
      title.addEventListener('click', () => openDeckDialog(deck));
      const meta = document.createElement('span');
      meta.className = 'deck-meta';
      meta.textContent = `更新於 ${formatUpdatedAt(deck.updated_at)}`;
      copy.append(title, meta);

      const settings = document.createElement('button');
      settings.className = 'deck-settings';
      settings.type = 'button';
      settings.textContent = '⋯';
      settings.title = '投影片設定';
      settings.setAttribute('aria-label', `${deck.title} 設定`);
      settings.addEventListener('click', () => openDeckDialog(deck));

      info.append(copy, settings);
      card.append(openButton, info);
      deckGrid.appendChild(card);
    });
  }

  async function loadDecks() {
    setMessage(libraryMessage, '正在讀取投影片...');
    try {
      const data = await api('/api/slides');
      state.decks = data.slides || [];
      renderDecks();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearSession();
        showGuest();
        return;
      }
      setMessage(libraryMessage, error.message);
    }
  }

  async function createDeck() {
    createDeckBtn.disabled = true;
    emptyCreateBtn.disabled = true;
    setMessage(libraryMessage, '正在建立投影片...');
    try {
      const data = await api('/api/slides', {
        method: 'POST',
        body: JSON.stringify({ title: '未命名投影片' })
      });
      openDeck(data.slide.deck_uid);
    } catch (error) {
      setMessage(libraryMessage, error.message);
      createDeckBtn.disabled = false;
      emptyCreateBtn.disabled = false;
    }
  }

  function openDeck(deckUid) {
    location.href = `/slides.html?deck=${encodeURIComponent(deckUid)}`;
  }

  function openDeckDialog(deck) {
    state.activeDeckUid = deck.deck_uid;
    deckTitleInput.value = deck.title;
    setMessage(deckDialogMessage);
    deckDialog.showModal();
    requestAnimationFrame(() => {
      deckTitleInput.focus();
      deckTitleInput.select();
    });
  }

  function closeDeckDialog() {
    state.activeDeckUid = null;
    deckDialog.close();
  }

  createDeckBtn.addEventListener('click', createDeck);
  emptyCreateBtn.addEventListener('click', createDeck);
  searchInput.addEventListener('input', renderDecks);
  closeDeckDialogBtn.addEventListener('click', closeDeckDialog);
  cancelDeckDialogBtn.addEventListener('click', closeDeckDialog);

  deckDialogForm.addEventListener('submit', async event => {
    event.preventDefault();
    const title = deckTitleInput.value.trim();
    if (!title || !state.activeDeckUid) return;

    try {
      const data = await api(`/api/slides/${encodeURIComponent(state.activeDeckUid)}`, {
        method: 'PUT',
        body: JSON.stringify({ title })
      });
      const index = state.decks.findIndex(deck => deck.deck_uid === state.activeDeckUid);
      if (index >= 0) state.decks[index] = { ...state.decks[index], ...data.slide };
      renderDecks();
      closeDeckDialog();
    } catch (error) {
      setMessage(deckDialogMessage, error.message);
    }
  });

  deleteDeckBtn.addEventListener('click', async () => {
    const deck = state.decks.find(item => item.deck_uid === state.activeDeckUid);
    if (!deck || !confirm(`確定要刪除「${deck.title}」嗎？刪除後無法復原。`)) return;

    try {
      await api(`/api/slides/${encodeURIComponent(deck.deck_uid)}`, { method: 'DELETE' });
      state.decks = state.decks.filter(item => item.deck_uid !== deck.deck_uid);
      renderDecks();
      closeDeckDialog();
    } catch (error) {
      setMessage(deckDialogMessage, error.message);
    }
  });

  async function initialize() {
    const resetMode = new URLSearchParams(location.search).has('reset_token');
    if (resetMode) {
      showGuest();
      return;
    }

    if (!token()) {
      showGuest();
      return;
    }

    try {
      const data = await api('/api/auth/me');
      await showDashboard(data.user);
    } catch {
      clearSession();
      showGuest();
    }
  }

  initialize();
})();
