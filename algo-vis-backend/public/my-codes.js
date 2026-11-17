// -----------------------------------------------------------------------------
// 程式碼頁「我的程式碼」側欄
// 頂部選單「我的程式碼」開關左側滑出的側欄（與「演算法範例集」互斥）。
// - 未登入：顯示「登入後可儲存程式碼」與登入連結（/?next= 帶回本頁，與頂部「登入」相同）。
// - 已登入：儲存目前編輯器的程式碼（可一併儲存輸入資料）、列出、載入與刪除。
// 資料沿用既有的 /api/codes（CodeModel），已存的程式碼不需轉換。
// 清單一律以 textContent 建立，不把標題或說明當成 HTML。
// -----------------------------------------------------------------------------
(() => {
  const TOKEN_KEY = 'algo_jwt_token';
  const USERNAME_KEY = 'algo_username';
  const button = document.getElementById('myCodesBtn');
  const panel = document.getElementById('myCodesPanel');
  const body = document.getElementById('myCodesBody');
  if (!button || !panel || !body) return;

  let codes = null; // null = 尚未載入
  let loading = false;
  let formOpen = false;
  let confirmingId = '';
  let message = { text: '', error: false };

  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const token = () => read(TOKEN_KEY);
  const loginHref = () => `/?next=${encodeURIComponent(location.pathname + location.search)}`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function toast(text, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) { container = el('div'); container.id = 'toast-container'; document.body.append(container); }
    const item = el('div', `toast-msg ${type}`, text);
    container.append(item);
    setTimeout(() => item.remove(), 3500);
  }

  // 登入已失效：清掉本機憑證，頂部列與側欄都回到訪客狀態。
  function signedOut() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USERNAME_KEY); } catch {}
    window.ASMSiteHeader?.apply();
    codes = null; formOpen = false; confirmingId = '';
    render();
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token()}` } });
    if (response.status === 401 || response.status === 403) { signedOut(); throw Object.assign(new Error('登入已過期，請重新登入'), { auth: true }); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function loadList() {
    loading = true; render();
    try { codes = (await api('/api/codes')).codes || []; message = { text: '', error: false }; }
    catch (error) { if (!error.auth) message = { text: `無法讀取程式碼：${error.message}`, error: true }; }
    finally { loading = false; render(); }
  }

  function open() {
    document.getElementById('algoSidePanel')?.classList.remove('open');
    panel.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    if (token() && codes === null && !loading) loadList(); else render();
  }

  function close() {
    panel.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    formOpen = false; confirmingId = '';
  }

  const isOpen = () => panel.classList.contains('open');

  // ---------------------------------------------------------------------------
  // 動作：儲存、載入、刪除
  // ---------------------------------------------------------------------------
  async function save(form) {
    const title = form.elements.title.value.trim();
    const desc = form.elements.desc.value.trim();
    // front.js 以頂層 const 宣告 aceEditor：同一頁的一般 script 共用這個全域名稱（不在 window 上）。
    const editor = typeof aceEditor !== 'undefined' ? aceEditor : null;
    const content = editor ? editor.getValue() : '';
    if (!title) { form.elements.title.focus(); return; }
    if (!content.trim()) { message = { text: '編輯器裡沒有程式碼可以儲存。', error: true }; render(); return; }
    const input = form.elements.withInput.checked ? (document.getElementById('inputArea')?.value || '') : '';
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = '儲存中…';
    try {
      await api('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, desc, language: 'cpp', content, inputs: input ? [input] : [] })
      });
      formOpen = false; message = { text: '', error: false };
      toast(`已儲存：${title}`, 'success');
      await loadList();
    } catch (error) {
      if (error.auth) return;
      message = { text: `儲存失敗：${error.message}`, error: true };
      submit.disabled = false; submit.textContent = '儲存';
      renderMessage();
    }
  }

  async function load(code) {
    try {
      const data = await api(`/api/codes/${encodeURIComponent(code.code_uid)}`);
      const target = data.code;
      if (!target) throw new Error('資料格式錯誤');
      window.asmReplaceEditorCode?.(target.content, 1);
      const inputArea = document.getElementById('inputArea');
      if (inputArea) inputArea.value = target.inputs?.[0] || '';
      if (typeof window.saveAlgorithmDraft === 'function') window.saveAlgorithmDraft();
      toast(`已載入：${target.title}`, 'success');
      close();
    } catch (error) {
      if (!error.auth) toast(`載入失敗：${error.message}`, 'error');
    }
  }

  async function remove(code) {
    try {
      await api(`/api/codes/${encodeURIComponent(code.code_uid)}`, { method: 'DELETE' });
      confirmingId = '';
      codes = (codes || []).filter(item => item.code_uid !== code.code_uid);
      toast(`已刪除：${code.title}`, 'success');
      render();
    } catch (error) {
      if (!error.auth) { message = { text: `刪除失敗：${error.message}`, error: true }; render(); }
    }
  }

  // ---------------------------------------------------------------------------
  // 畫面
  // ---------------------------------------------------------------------------
  function renderMessage() {
    const line = body.querySelector('.my-codes-message');
    if (!line) return;
    line.textContent = message.text;
    line.classList.toggle('is-error', message.error);
    line.hidden = !message.text;
  }

  function renderSignedOut() {
    const box = el('div', 'my-codes-signed-out');
    box.append(el('p', 'my-codes-hint', '登入後可儲存程式碼'));
    box.append(el('p', 'my-codes-subtle', '儲存的程式碼會跟著帳號，在任何電腦登入都能打開。'));
    const link = el('a', 'my-codes-primary', '登入');
    link.href = loginHref();
    box.append(link);
    body.append(box);
  }

  function renderForm() {
    const form = el('form', 'my-codes-form');
    form.noValidate = true;
    const title = el('input'); title.name = 'title'; title.type = 'text'; title.maxLength = 80; title.required = true;
    title.placeholder = '標題'; title.setAttribute('aria-label', '標題');
    const desc = el('textarea'); desc.name = 'desc'; desc.rows = 2; desc.maxLength = 300;
    desc.placeholder = '說明（選填）'; desc.setAttribute('aria-label', '說明');
    const withInputLabel = el('label', 'my-codes-check');
    const withInput = el('input'); withInput.name = 'withInput'; withInput.type = 'checkbox'; withInput.checked = true;
    withInputLabel.append(withInput, document.createTextNode(' 一併儲存輸入資料'));
    const actions = el('div', 'my-codes-form-actions');
    const cancel = el('button', 'my-codes-secondary', '取消'); cancel.type = 'button';
    cancel.addEventListener('click', () => { formOpen = false; render(); });
    const submit = el('button', 'my-codes-primary', '儲存'); submit.type = 'submit';
    actions.append(cancel, submit);
    form.append(title, desc, withInputLabel, actions);
    form.addEventListener('submit', event => { event.preventDefault(); save(form); });
    form.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); formOpen = false; render(); button.focus(); } });
    body.append(form);
    title.focus();
  }

  function renderItem(code) {
    const item = el('li', 'my-codes-item');
    if (confirmingId === code.code_uid) {
      item.classList.add('is-confirming');
      item.append(el('p', 'my-codes-confirm', `刪除「${code.title}」？刪除後無法復原。`));
      const actions = el('div', 'my-codes-form-actions');
      const cancel = el('button', 'my-codes-secondary', '取消'); cancel.type = 'button';
      cancel.addEventListener('click', () => { confirmingId = ''; render(); });
      const confirm = el('button', 'my-codes-danger', '刪除'); confirm.type = 'button';
      confirm.addEventListener('click', () => { confirm.disabled = true; remove(code); });
      actions.append(cancel, confirm);
      item.append(actions);
      return item;
    }
    const open = el('button', 'my-codes-open'); open.type = 'button';
    open.title = `載入「${code.title}」到編輯器`;
    open.append(el('span', 'my-codes-title', code.title));
    const date = code.created_at ? new Date(code.created_at) : null;
    open.append(el('span', 'my-codes-meta', date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('zh-TW') : ''));
    if (code.desc) open.append(el('span', 'my-codes-desc', code.desc));
    open.addEventListener('click', () => load(code));
    const trash = el('button', 'my-codes-delete'); trash.type = 'button';
    trash.title = '刪除'; trash.setAttribute('aria-label', `刪除 ${code.title}`);
    trash.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
    trash.addEventListener('click', () => { confirmingId = code.code_uid; render(); });
    item.append(open, trash);
    return item;
  }

  function render() {
    body.replaceChildren();
    if (!token()) { renderSignedOut(); return; }
    if (formOpen) renderForm();
    else {
      const add = el('button', 'my-codes-primary my-codes-add', '儲存目前程式碼'); add.type = 'button';
      add.addEventListener('click', () => { formOpen = true; confirmingId = ''; message = { text: '', error: false }; render(); });
      body.append(add);
    }
    const line = el('p', 'my-codes-message'); line.setAttribute('role', 'status');
    body.append(line); renderMessage();
    if (loading && codes === null) { body.append(el('p', 'my-codes-subtle', '讀取中…')); return; }
    if (codes === null) return;
    if (!codes.length) { body.append(el('p', 'my-codes-subtle', '還沒有儲存的程式碼。')); return; }
    const list = el('ul', 'my-codes-list');
    list.append(...codes.map(renderItem));
    body.append(list);
  }

  // ---------------------------------------------------------------------------
  // 開關與互斥
  // ---------------------------------------------------------------------------
  button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (isOpen()) close(); else open(); });
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); button.click(); } });
  panel.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', event => { if (isOpen() && !panel.contains(event.target) && !button.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && isOpen()) { close(); button.focus(); } });

  render();
  window.ASMMyCodes = { open, close, isOpen };
})();
