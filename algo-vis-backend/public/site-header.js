// -----------------------------------------------------------------------------
// 共用頂部列的首次繪製
// 緊接在 .site-header 之後同步載入：在第一次繪製前就依本機登入狀態顯示「登入」或
// 「名稱＋登出」，切換首頁／程式碼頁時帳號區不會先空白再跳出來。
// 之後由各頁的 home.js／top-account.js 向伺服器確認並接手。
// -----------------------------------------------------------------------------
(() => {
  let token = '', username = '';
  try {
    token = localStorage.getItem('algo_jwt_token') || '';
    username = localStorage.getItem('algo_username') || '';
  } catch {}
  const signedIn = Boolean(token);
  const show = (id, visible) => { const element = document.getElementById(id); if (element) element.hidden = !visible; };
  const name = (id) => { const element = document.getElementById(id); if (element) { element.textContent = username || '帳號'; element.title = username; } };

  // 首頁：登入按鈕與「名稱＋登出」群組。
  show('headerLoginBtn', !signedIn);
  show('accountArea', signedIn);
  if (signedIn) name('accountName');

  // 程式碼頁：登入連結帶回目前頁面；名稱與登出各自顯示。
  const loginLink = document.getElementById('topLoginLink');
  if (loginLink) loginLink.href = `/?next=${encodeURIComponent(location.pathname + location.search)}`;
  show('topLoginLink', !signedIn);
  show('topAccountName', signedIn);
  show('topLogoutBtn', signedIn);
  if (signedIn) name('topAccountName');

  // 換頁過場只在首頁與程式碼頁之間使用。前往其他頁（例如投影片編輯頁）時對方沒有啟用，
  // 瀏覽器會中止過場並以 rejected promise 回報；在這裡直接略過並吞掉，避免主控台錯誤。
  window.addEventListener('pageswap', event => {
    const transition = event.viewTransition;
    if (!transition) return;
    for (const promise of [transition.ready, transition.finished, transition.updateCallbackDone]) promise?.catch?.(() => {});
    const destination = event.activation?.entry?.url;
    if (!destination) return;
    const path = new URL(destination).pathname;
    if (path !== '/' && path !== '/index.html' && path !== '/algorithm.html') transition.skipTransition();
  });
})();
