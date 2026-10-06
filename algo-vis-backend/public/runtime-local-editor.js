// Runtime edits are a browser-owned overlay. This module never sends a save
// message to the parent or calls a deck/preferences storage API.
(function () {
  if (new URLSearchParams(location.search).get('asmEmbed') !== 'runtime') return;
  let bridge, key = '', original = null, draft = null, applying = false;
  let generation = 0, timer = null, databasePromise = null, writes = Promise.resolve();
  let reset, status;

  function notifyEditorState() {
    window.parent.postMessage({ type: 'asm-runtime-code-editor-state',
      open: document.body.classList.contains('asm-runtime-local-edit') }, location.origin);
  }
  function toggleCodeEditor() {
    const open = !document.body.classList.contains('asm-runtime-local-edit');
    if (!open) {
      save(bridge.snapshot());
      window.ASMTraceStudio?.close?.();
    }
    document.body.classList.toggle('asm-runtime-local-edit', open);
    if (open) document.getElementById('codePanel').classList.remove('collapsed');
    notifyEditorState();
    requestAnimationFrame(() => { aceEditor.resize(); window.ASMTracePlayer?.rebaseCurrentFrame?.({ confirmVisible: true }); });
  }

  function database() {
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('asm-runtime-local-edits-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('animations');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('本機儲存區被其他頁面占用'));
    });
    return databasePromise;
  }
  async function stored(operation, id, value) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('animations', operation === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('animations');
      const request = operation === 'get' ? store.get(id)
        : operation === 'delete' ? store.delete(id) : store.put(value, id);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || request.error);
    });
  }
  function save(animation) {
    if (!key || applying) return Promise.resolve();
    clearTimeout(timer);
    draft = animation || {
      ...(draft || original), code: aceEditor.getValue(),
      input: document.getElementById('inputArea').value
    };
    const id = key, value = draft;
    status.textContent = '正在保存至本機…';
    writes = writes.then(() => stored('put', id, value)).then(() => {
      if (key === id) status.textContent = '已保存在本機';
    }).catch(error => {
      console.warn('本機動畫儲存失敗', error);
      if (key === id) status.textContent = '本機儲存失敗；目前修改僅保留在此頁';
    });
    return writes;
  }
  function scheduleSave() {
    if (applying || !key) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(), 400);
  }
  async function load(animation, slideId) {
    const identity = window.ASMTraceProvenance.create(animation?.code || '', animation?.input || '');
    const nextKey = `${slideId || 'legacy'}:${identity.sourceFingerprint}:${identity.inputFingerprint}`;
    // Parent visibility/reload messages must not overwrite in-progress edits.
    if (key === nextKey) return;
    if (key && timer) save();
    clearTimeout(timer);
    const request = ++generation;
    let saved;
    try { await writes; saved = await stored('get', nextKey); }
    catch (error) { console.warn('無法讀取本機動畫', error); }
    if (request !== generation) return;
    key = nextKey;
    original = animation;
    draft = saved && typeof saved.code === 'string' ? saved : null;
    applying = true;
    try { await bridge.apply(draft || original); }
    finally { applying = false; }
    status.textContent = draft ? '已載入本機修改' : '本機修改不會更動原投影片';
    notifyEditorState();
  }
  function init(options) {
    bridge = options;
    const controls = document.createElement('div');
    controls.className = 'runtime-local-controls';
    const studio = document.getElementById('editAnimationBtn');
    const settings = document.getElementById('eventSettingsBtn');
    reset = document.createElement('button');
    reset.id = 'runtimeLocalResetBtn'; reset.type = 'button'; reset.textContent = '還原原版';
    status = document.createElement('span'); status.id = 'runtimeLocalStatus'; status.setAttribute('role', 'status');
    controls.append(studio, ...(settings ? [settings] : []), reset, status);
    document.getElementById('subTabs').append(controls);
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (event.data?.type === 'asm-runtime-toggle-code-editor' && key) toggleCodeEditor();
    });
    reset.addEventListener('click', async () => {
      if (!key || !original || document.getElementById('runBtn').disabled) return;
      clearTimeout(timer);
      const id = key, base = original;
      await writes;
      try { await stored('delete', id); }
      catch (error) { status.textContent = '還原失敗，請稍後重試'; return; }
      if (key !== id) return;
      window.ASMTraceStudio?.close?.({ render: false });
      draft = null;
      applying = true;
      try { await bridge.apply(base); }
      finally { applying = false; }
      status.textContent = '已還原原投影片動畫';
    });
    document.addEventListener('DOMContentLoaded', () => {
      aceEditor.on('change', scheduleSave);
      document.getElementById('inputArea').addEventListener('input', scheduleSave);
    });
    window.addEventListener('asm:trace-event-settings-changed', () => {
      if (!applying) save(bridge.snapshot());
    });
    window.addEventListener('pagehide', () => { if (draft || timer) save(bridge.snapshot()); });
  }
  window.ASMRuntimeLocalEditor = {
    init, load, save,
    hasChanges: () => Boolean(draft || timer || document.body.classList.contains('asm-runtime-local-edit'))
  };
})();
