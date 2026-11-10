// -----------------------------------------------------------------------------
// 程式碼頁頂部帳號區
// 全站只有首頁一個登入框：未登入時「登入」帶 ?next= 回到首頁，登入後跳回本頁；
// 已登入時顯示名稱與「登出」。與首頁共用 algo_jwt_token／algo_username。
// -----------------------------------------------------------------------------
(() => {
  const TOKEN_KEY = 'algo_jwt_token';
  const USERNAME_KEY = 'algo_username';
  const loginLink = document.getElementById('topLoginLink');
  const nameLabel = document.getElementById('topAccountName');
  const logoutBtn = document.getElementById('topLogoutBtn');
  if (!loginLink || !nameLabel || !logoutBtn) return;

  function read(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }

  function clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USERNAME_KEY);
    } catch {}
  }

  // Return to this exact page (path + query) after logging in on the home page.
  function loginHref() {
    const next = `${location.pathname}${location.search}`;
    return `/?next=${encodeURIComponent(next)}`;
  }

  function render(username) {
    const signedIn = Boolean(username);
    loginLink.href = loginHref();
    loginLink.hidden = signedIn;
    nameLabel.hidden = !signedIn;
    logoutBtn.hidden = !signedIn;
    nameLabel.textContent = signedIn ? username : '';
    nameLabel.title = signedIn ? username : '';
  }

  logoutBtn.addEventListener('click', () => {
    clear();
    // Account-level settings (e.g. event preferences) were loaded with the old
    // token; reload so the page starts again as a guest.
    location.reload();
  });

  const token = read(TOKEN_KEY);
  render(token ? read(USERNAME_KEY) || '帳號' : '');
  if (!token) return;

  // Confirm the stored token is still valid; an expired one falls back to guest.
  fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    .then(async response => {
      if (response.status === 401 || response.status === 403) {
        clear();
        render('');
        return;
      }
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const username = data?.user?.username;
      if (username) {
        try { localStorage.setItem(USERNAME_KEY, username); } catch {}
        render(username);
      }
    })
    .catch(() => {});
})();
