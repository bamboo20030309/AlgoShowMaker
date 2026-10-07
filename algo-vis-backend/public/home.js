// -----------------------------------------------------------------------------
// 首頁與帳號工作區控制器
// 管理登入狀態、範例瀏覽、deck CRUD 與資料夾對話框；state 是畫面重繪與 API 回應的共同來源。
// -----------------------------------------------------------------------------
(() => {
  const TOKEN_KEY = 'algo_jwt_token';
  const USERNAME_KEY = 'algo_username';
  let thumbnailCache = new Map();
  const thumbnailOwner = () => String(state.user?.id || state.user?.user_uid || state.user?.username || '');

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
  const headerSlidesLink = document.getElementById('headerSlidesLink');
  const headerExamplesLink = document.getElementById('headerExamplesLink');
  const workspaceSlidesNav = document.getElementById('workspaceSlidesNav');
  const workspaceExamplesNav = document.getElementById('workspaceExamplesNav');
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
  const deleteDeckDialog = document.getElementById('deleteDeckDialog');
  const deleteDeckForm = document.getElementById('deleteDeckForm');
  const deleteDeckName = document.getElementById('deleteDeckName');
  const deleteDeckMessage = document.getElementById('deleteDeckMessage');
  const closeDeleteDeckBtn = document.getElementById('closeDeleteDeckBtn');
  const cancelDeleteDeckBtn = document.getElementById('cancelDeleteDeckBtn');
  const confirmDeleteDeckBtn = document.getElementById('confirmDeleteDeckBtn');
  const organizer = window.ASMLibraryOrganizer({
    container: deckGrid, nav: document.getElementById('libraryFolderNav'),
    createButton: document.getElementById('createFolderBtn'),
    message: document.getElementById('libraryLayoutMessage'), api, createCard: createDeckCard
  });

  // -----------------------------------------------------------------------------
  // API 與工作階段
  // 所有請求透過同一 token 包裝；收到未授權回應時清除本機身份並返回訪客視圖。
  // -----------------------------------------------------------------------------
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

  function setNavigationActive(element, active) {
    if (!element) return;
    element.classList.toggle('is-active', active);
    if (active) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  }

  function syncHomeNavigation() {
    const examplesActive = new URLSearchParams(location.search).get('examples') === '1';
    setNavigationActive(headerSlidesLink, !examplesActive);
    setNavigationActive(headerExamplesLink, examplesActive);
    setNavigationActive(workspaceSlidesNav, !examplesActive);
    setNavigationActive(workspaceExamplesNav, examplesActive);
  }

  function safeNextPath() {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '';
  }

  function showGuest() {
    syncHomeNavigation();
    guestView.hidden = false;
    dashboardView.hidden = true;
    accountArea.hidden = true;
    setAuthMode(new URLSearchParams(location.search).has('reset_token') ? 'reset' : 'login');
  }

  async function showDashboard(user) {
    syncHomeNavigation();
    state.user = user;
    guestView.hidden = true;
    dashboardView.hidden = false;
    accountArea.hidden = false;
    accountName.textContent = user.username;
    await loadDecks();
  }

  // -----------------------------------------------------------------------------
  // 登入與註冊表單
  // mode 同時決定欄位、按鈕與驗證規則，送出成功後才切換 dashboard。
  // -----------------------------------------------------------------------------
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

  // -----------------------------------------------------------------------------
  // Deck 卡片、縮圖與清單
  // 清單以 state.decks 為來源；缺少縮圖時背景產生並回傳伺服器，但不阻塞卡片文字。
  // -----------------------------------------------------------------------------
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
      image.draggable = false;
      image.decoding = 'async';
      preview.prepend(image);
    }
    image.src = thumbnail;
    preview.classList.add('has-cover');
    preview.classList.remove('is-loading');
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

    organizer.render(state.decks, query);
  }

  function createDeckCard(deck) {
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
      const cachedThumbnail = thumbnailCache.get(deck.deck_uid);
      if (deck.cover_thumbnail || cachedThumbnail) showDeckThumbnail(preview, deck.cover_thumbnail || cachedThumbnail);
      // Missing covers stay as lightweight placeholders. Generate covers when
      // saving/opening the deck, never by downloading its body from this list.

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
      return card;
  }

  async function loadDecks() {
    setMessage(libraryMessage, '正在讀取投影片...');
    try {
      const data = await api('/api/slides');
      state.decks = data.slides || [];
      thumbnailCache = await window.ASMHomeThumbnailCache?.load(thumbnailOwner(), state.decks) || new Map();
      for (const deck of state.decks) if (deck.cover_thumbnail) {
        window.ASMHomeThumbnailCache?.put(thumbnailOwner(), deck.deck_uid, deck.updated_at, deck.cover_thumbnail);
      }
      await organizer.load(state.decks, data.layout);
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

  // -----------------------------------------------------------------------------
  // Deck 建立、匯入與編輯對話框
  // 新增或匯入成功後重新載入清單；重新命名與刪除集中在目前對話框所指 deck。
  // -----------------------------------------------------------------------------
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

  async function createDeckFromFile(file) {
    const importId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
    createDeckBtn.disabled = true;
    emptyCreateBtn.disabled = true;
    setMessage(libraryMessage, '正在準備匯入投影片…');
    try {
      const cover = /\.asmdeck$/i.test(file.name) ? await window.ASMDeck.readCover(file) : null;
      await window.ASMDeckFileDrop.put(importId, file);
      const data = await api('/api/slides', {
        method: 'POST', body: JSON.stringify({ title: cover?.title || file.name.replace(/\.(asmdeck|json)$/i, ''),
          ...(cover?.thumbnail ? { cover_thumbnail: cover.thumbnail } : {}) })
      });
      location.href = `/slides.html?deck=${encodeURIComponent(data.slide.deck_uid)}&importFile=${encodeURIComponent(importId)}`;
    } catch (error) {
      await window.ASMDeckFileDrop.remove(importId).catch(() => {});
      setMessage(libraryMessage, `匯入失敗：${error.message}`);
      createDeckBtn.disabled = false;
      emptyCreateBtn.disabled = false;
    }
  }

  window.ASMDeckFileDrop.bind({
    previewOnly: true,
    selector: '#createDeckBtn, #emptyCreateBtn',
    allowed: () => !dashboardView.hidden && Boolean(state.user),
    onFile: createDeckFromFile,
    onError: error => setMessage(libraryMessage, `匯入失敗：${error.message}`)
  });

  function openDeck(deckUid) {
    const card = state.decks.find(deck => deck.deck_uid === deckUid);
    if (card) { try { sessionStorage.setItem(`asm-deck-card:${deckUid}`, JSON.stringify(card)); } catch {} }
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

  function closeDeleteDeckDialog() {
    if (deleteDeckDialog.open) deleteDeckDialog.close();
  }

  function openDeleteDeckDialog() {
    const deck = state.decks.find(item => item.deck_uid === state.activeDeckUid);
    if (!deck) return;
    deleteDeckName.textContent = deck.title;
    setMessage(deleteDeckMessage);
    deleteDeckDialog.showModal();
    requestAnimationFrame(() => cancelDeleteDeckBtn.focus());
  }

  createDeckBtn.addEventListener('click', createDeck);
  emptyCreateBtn.addEventListener('click', createDeck);
  searchInput.addEventListener('input', renderDecks);
  closeDeckDialogBtn.addEventListener('click', closeDeckDialog);
  cancelDeckDialogBtn.addEventListener('click', closeDeckDialog);
  closeDeleteDeckBtn.addEventListener('click', closeDeleteDeckDialog);
  cancelDeleteDeckBtn.addEventListener('click', closeDeleteDeckDialog);

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

  deleteDeckBtn.addEventListener('click', openDeleteDeckDialog);

  deleteDeckForm.addEventListener('submit', async event => {
    event.preventDefault();
    const deck = state.decks.find(item => item.deck_uid === state.activeDeckUid);
    if (!deck) return;

    confirmDeleteDeckBtn.disabled = true;
    confirmDeleteDeckBtn.textContent = '刪除中…';
    try {
      await api(`/api/slides/${encodeURIComponent(deck.deck_uid)}`, { method: 'DELETE' });
      state.decks = state.decks.filter(item => item.deck_uid !== deck.deck_uid);
      renderDecks();
      closeDeleteDeckDialog();
      closeDeckDialog();
    } catch (error) {
      setMessage(deleteDeckMessage, error.message);
    } finally {
      confirmDeleteDeckBtn.disabled = false;
      confirmDeleteDeckBtn.textContent = '刪除投影片';
    }
  });

  // -----------------------------------------------------------------------------
  // 首頁啟動
  // 先解析網址模式與現有 token，再選擇訪客或工作區，避免兩個視圖同時發出資料請求。
  // -----------------------------------------------------------------------------
  async function initialize() {
    if (new URLSearchParams(location.search).get('examples') === '1') {
      document.body.classList.add('examples-view');
      showGuest();
      return;
    }
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
