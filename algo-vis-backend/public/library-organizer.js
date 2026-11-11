// -----------------------------------------------------------------------------
// 投影片庫資料夾控制器
// 協調 deck 清單、資料夾版面、拖放與遠端儲存；先更新記憶體版面，再序列化提交並重新渲染。
// -----------------------------------------------------------------------------
(function () {
  const ICON = paths => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const TRASH_PATHS = '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>';
  const TRASH_ICON = ICON(TRASH_PATHS);
  const ARROW_LEFT_ICON = ICON('<path d="M19 12H5M11 6l-6 6 6 6"/>');
  const ARROW_RIGHT_ICON = ICON('<path d="M5 12h14M13 6l6 6-6 6"/>');
  window.ASMLibraryOrganizer = function ({ container, nav, createButton, message, api, createCard, onDelete }) {
    let layout = { folders: [], unfiled: [] }, decks = [], query = '', ready = false, saving = false;
    const expanded = new Map();
    // Cards are dragged with pointer events only (whole-card copy follows the pointer).
    let pointer = null, highlighted = null, dragClone = null;
    let suppressClickUntil = 0;
    let deletingFolderId = null;
    // 新增資料夾不開對話框：在清單底部加一列可直接輸入名稱的資料夾（pendingFolder），
    // 名稱 Enter／離開即建立，Esc 或留空則取消；儲存失敗時保留已輸入的名稱。
    let pendingFolder = null;
    const deleteDialog = document.getElementById('deleteFolderDialog');
    const deleteForm = document.getElementById('deleteFolderForm');
    const deleteMessage = document.getElementById('deleteFolderMessage');
    const deleteSubmit = document.getElementById('deleteFolderSubmit');
    for (const id of ['closeDeleteFolderBtn', 'cancelDeleteFolderBtn']) document.getElementById(id).addEventListener('click', () => { if (!saving) deleteDialog.close(); });
    deleteDialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    // -----------------------------------------------------------------------------
    // 資料夾與分類對話框
    // 對話框暫存目前 folder/deck，確認後才呼叫 API，取消不改 layout。
    // -----------------------------------------------------------------------------
    function openDeleteFolder(folder) {
      if (!ready || saving) return;
      deletingFolderId = folder.id; deleteMessage.textContent = '';
      document.getElementById('deleteFolderName').textContent = `確定要移除「${folder.title}」嗎？`;
      deleteDialog.showModal(); document.getElementById('cancelDeleteFolderBtn').focus();
    }
    deleteForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!ready || saving || !deletingFolderId) return;
      deleteForm.querySelectorAll('button').forEach(button => { button.disabled = true; });
      deleteSubmit.textContent = '正在移除…'; deleteMessage.textContent = '';
      const success = await change(ASMLibraryLayout.removeFolder(layout, deletingFolderId));
      deleteForm.querySelectorAll('button').forEach(button => { button.disabled = false; }); deleteSubmit.textContent = '移除資料夾';
      if (success) deleteDialog.close(); else deleteMessage.textContent = message.textContent;
    });
    // 不顯示「正在儲存／已儲存」等進度與成功提示；只有失敗才顯示訊息，下一次成功時清掉先前的失敗訊息。
    let showingError = false;
    function status(text, error = false) {
      if (error) { message.textContent = text; message.classList.remove('is-success'); showingError = true; return; }
      if (showingError) { message.textContent = ''; showingError = false; }
    }
    // -----------------------------------------------------------------------------
    // 版面提交交易
    // 先正規化下一版 layout，儲存成功後才取代本機狀態並重繪；失敗時維持原排序。
    // -----------------------------------------------------------------------------
    async function change(next) {
      if (!ready || saving) return false;
      const previous = layout;
      saving = true; layout = next; render(); status('正在儲存資料夾與排序…');
      try {
        layout = (await api('/api/slide-library', { method: 'PUT', body: JSON.stringify({ layout }) })).layout;
        status('資料夾與排序已儲存');
        return true;
      } catch (error) { layout = previous; status(`儲存失敗：${error.message}；已恢復原排序。`, true); return false; }
      finally { saving = false; render(); }
    }
    function clearHighlight() { highlighted?.classList.remove('library-drop-target'); highlighted = null; }
    function targetAt(element) {
      const card = element?.closest('.deck-card[data-deck-id]');
      const folder = element?.closest('.library-folder');
      if (!folder || !container.contains(folder)) return null;
      return { folder: folder.dataset.folderId, before: card?.dataset.deckId || null, element: card || folder };
    }
    function highlight(target) {
      clearHighlight(); highlighted = target?.element; highlighted?.classList.add('library-drop-target');
    }
    // -----------------------------------------------------------------------------
    // 拖放目的地解析
    // 從指標位置判斷資料夾或相鄰 deck，透過純 layout.move 計算結果，避免直接搬 DOM。
    // -----------------------------------------------------------------------------
    function drop(id, target, source) {
      clearHighlight();
      if (id && target && ready && !saving) change(ASMLibraryLayout.move(layout, id, target.folder, target.before, source));
    }
    // Start a drag from the whole card, while allowing a normal click on its buttons.
    container.addEventListener('pointerdown', event => {
      suppressClickUntil = 0;
      const card = event.target.closest('.deck-card[data-deck-id]');
      if (!card || event.target.closest('select, input, textarea, button:not(.deck-open), [contenteditable="true"]') || event.button !== 0 || !ready || saving) return;
      pointer = { id: card.dataset.deckId, source: card.closest('.library-folder').dataset.folderId, x: event.clientX, y: event.clientY, moved: false, card, pointerId: event.pointerId };
    });
    container.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) {
        pointer.moved = true; pointer.card.setPointerCapture(event.pointerId);
        startDragClone(pointer.card);
        pointer.card.classList.add('library-drag-source');
      }
      if (!pointer.moved) return;
      event.preventDefault();
      moveDragClone(event.clientX - pointer.x, event.clientY - pointer.y);
      highlight(targetAt(document.elementFromPoint(event.clientX, event.clientY)));
      // Auto-scroll the area that actually scrolls (the page's <main> below the top bar).
      const scroller = container.closest('main') || document.scrollingElement;
      const bounds = scroller.getBoundingClientRect();
      const top = Math.max(0, bounds.top), bottom = Math.min(innerHeight, bounds.bottom);
      if (event.clientY < top + 80) scroller.scrollBy(0, -18);
      else if (event.clientY > bottom - 80) scroller.scrollBy(0, 18);
    });
    container.addEventListener('pointerup', event => {
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      const active = pointer; pointer = null;
      active.card.classList.remove('library-drag-source'); endDragClone();
      if (active.moved) {
        event.preventDefault(); suppressClickUntil = performance.now() + 250;
        drop(active.id, targetAt(document.elementFromPoint(event.clientX, event.clientY)), active.source);
      }
      clearHighlight();
    });
    function cancelPointer() { pointer?.card.classList.remove('library-drag-source'); pointer = null; endDragClone(); clearHighlight(); }
    // The floating copy is pointer-transparent, so elementFromPoint still finds the drop target below it.
    function startDragClone(card) {
      endDragClone();
      const box = card.getBoundingClientRect();
      dragClone = card.cloneNode(true);
      dragClone.classList.add('library-drag-clone');
      dragClone.removeAttribute('data-deck-id');
      dragClone.setAttribute('aria-hidden', 'true');
      Object.assign(dragClone.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
      document.body.append(dragClone);
    }
    function moveDragClone(dx, dy) { if (dragClone) dragClone.style.transform = `translate(${dx}px, ${dy}px)`; }
    function endDragClone() { dragClone?.remove(); dragClone = null; }
    container.addEventListener('pointercancel', cancelPointer);
    container.addEventListener('lostpointercapture', cancelPointer);
    container.addEventListener('click', event => {
      if (event.detail && performance.now() < suppressClickUntil) { suppressClickUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    function newFolderId() {
      return 'folder-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2, '0')).join('');
    }
    function startNewFolder() {
      if (!ready || saving) return;
      if (layout.folders.length >= 200) { status('最多建立 200 個資料夾。', true); return; }
      if (!pendingFolder) pendingFolder = { title: '' };
      render();
    }
    createButton.addEventListener('click', startNewFolder);
    // Inline name editor used for both a new folder and renaming an existing one.
    function nameInput(initial, label, commit, cancel) {
      const input = document.createElement('input');
      input.type = 'text'; input.className = 'library-folder-name-input'; input.maxLength = 80;
      input.value = initial; input.placeholder = '資料夾名稱'; input.setAttribute('aria-label', label);
      let done = false;
      const finish = save => {
        if (done) return; done = true;
        const title = input.value.trim();
        if (save && title) commit(title); else cancel(input.value);
      };
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        event.stopPropagation();
      });
      input.addEventListener('blur', () => finish(true));
      // Typing in the name must not toggle the folder or start a card drag.
      for (const type of ['click', 'pointerdown', 'keyup']) input.addEventListener(type, event => { event.stopPropagation(); if (type === 'click') event.preventDefault(); });
      return input;
    }
    async function commitNewFolder(title) {
      const draft = { title };
      pendingFolder = null;
      const success = await change({ ...layout, folders: [...layout.folders, { id: newFolderId(), title, deckIds: [] }] });
      if (!success) { pendingFolder = draft; render(); }
    }
    function cancelNewFolder() { pendingFolder = null; render(); }
    function renameFolder(folder, title) {
      if (title === folder.title) { render(); return; }
      change({ ...layout, folders: layout.folders.map(item => item.id === folder.id ? { ...item, title } : item) });
    }
    // -----------------------------------------------------------------------------
    // 清單渲染與事件接線
    // 每次依 layout 重建資料夾與未分類區，卡片事件只傳 deck id，不保存失效的 DOM 參照。
    // -----------------------------------------------------------------------------
    function render() {
      layout = ASMLibraryLayout.reconcile(layout, decks.map(deck => deck.deck_uid));
      container.replaceChildren(); nav.replaceChildren(); createButton.disabled = !ready || saving;
      const byId = new Map(decks.map(deck => [deck.deck_uid, deck]));
      const folders = [{ id: '', title: '未分類', deckIds: layout.unfiled }, ...layout.folders];
      for (const folder of folders) {
        const matches = folder.deckIds.map(id => byId.get(id)).filter(deck => deck.title.toLocaleLowerCase('zh-Hant').includes(query));
        const section = document.createElement('details');
        section.className = 'gallery-folder library-folder'; section.dataset.folderId = folder.id;
        section.open = query ? true : expanded.get(folder.id) !== false;
        section.hidden = Boolean(query) && matches.length === 0;
        section.addEventListener('toggle', () => { if (!query && section.isConnected) expanded.set(folder.id, section.open); });
        const summary = document.createElement('summary');
        const heading = document.createElement('span'); heading.className = 'library-folder-title';
        const name = document.createElement('span'); name.className = 'library-folder-name'; name.textContent = folder.title;
        const count = document.createElement('span'); count.className = 'library-folder-count'; count.textContent = `共 ${matches.length} 份`;
        heading.append(name, count); summary.append(heading);
        if (folder.id) {
          name.classList.add('is-editable'); name.title = '雙擊以重新命名'; name.tabIndex = 0;
          const edit = event => {
            event.preventDefault(); event.stopPropagation();
            if (!ready || saving) return;
            name.replaceWith(nameInput(folder.title, `重新命名 ${folder.title}`, title => renameFolder(folder, title), () => render()));
            const input = heading.querySelector('.library-folder-name-input'); input.focus(); input.select();
          };
          // 與卡片標題一致：雙擊名稱才改名；單擊名稱不改名也不收合分類（避免雙擊時連續開關兩次）。
          name.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
          name.addEventListener('dblclick', edit);
          name.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'F2') edit(event); });
        }
        const cards = document.createElement('div'); cards.className = 'deck-grid gallery-folder-cards';
        if (folder.id) {
          const tools = document.createElement('span'); tools.className = 'library-folder-tools';
          const remove = document.createElement('button'); remove.type = 'button';
          remove.className = 'library-card-icon library-delete-button library-folder-delete';
          remove.title = '移除資料夾'; remove.setAttribute('aria-label', '移除資料夾'); remove.innerHTML = TRASH_ICON;
          remove.disabled = !ready || saving;
          remove.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openDeleteFolder(folder); }); tools.append(remove);
          summary.append(tools); section.append(summary, cards);
        } else section.append(summary, cards);
        if (!matches.length) { const empty = document.createElement('p'); empty.className = 'gallery-folder-empty'; empty.textContent = '將投影片拖到這裡。'; section.append(empty); }
        for (const deck of matches) {
          const card = createCard(deck); card.dataset.deckId = deck.deck_uid; card.draggable = false;
          card.querySelectorAll('img').forEach(image => { image.draggable = false; });
          const controls = document.createElement('div'); controls.className = 'library-card-controls';
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'library-card-icon library-delete-button';
          remove.title = '刪除投影片'; remove.setAttribute('aria-label', `刪除 ${deck.title}`); remove.disabled = !ready || saving;
          remove.innerHTML = TRASH_ICON;
          remove.addEventListener('click', () => onDelete?.(deck));
          const spacer = document.createElement('span'); spacer.className = 'library-card-spacer';
          controls.append(remove, spacer);
          const index = folder.deckIds.indexOf(deck.deck_uid);
          for (const [label, delta] of [['往前', -1], ['往後', 1]]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'library-card-icon library-order-button';
            button.innerHTML = delta < 0 ? ARROW_LEFT_ICON : ARROW_RIGHT_ICON; button.title = label; button.setAttribute('aria-label', `${deck.title} ${label}`);
            button.disabled = !ready || saving || index + delta < 0 || index + delta >= folder.deckIds.length;
            button.addEventListener('click', () => change(ASMLibraryLayout.move(layout, deck.deck_uid, folder.id, folder.deckIds[index + (delta < 0 ? -1 : 2)] || null, folder.id))); controls.append(button);
          }
          card.append(controls); cards.append(card);
        }
        container.append(section);
        const link = document.createElement('button'); link.type = 'button'; link.className = 'gallery-category'; link.textContent = folder.title; link.hidden = section.hidden;
        link.addEventListener('click', () => { section.open = true; expanded.set(folder.id, true); section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }); nav.append(link);
      }
      if (pendingFolder && !query) {
        const section = document.createElement('details');
        section.className = 'gallery-folder library-folder library-folder-new'; section.open = true;
        const summary = document.createElement('summary');
        const heading = document.createElement('span'); heading.className = 'library-folder-title';
        const input = nameInput(pendingFolder.title, '新資料夾名稱', commitNewFolder, cancelNewFolder);
        input.addEventListener('input', () => { if (pendingFolder) pendingFolder.title = input.value; });
        heading.append(input); summary.append(heading); section.append(summary);
        container.append(section);
        input.focus(); input.select();
        section.scrollIntoView({ block: 'nearest' });
      }
    }
    return {
      async load(items, suppliedLayout = null) {
        ready = false; decks = items; layout = { folders: [], unfiled: [] }; status('正在讀取資料夾…');
        try { layout = suppliedLayout || (await api('/api/slide-library')).layout; ready = true; status(''); }
        catch (error) { status(`無法讀取資料夾：${error.message}。請重新整理後再試。`, true); }
      },
      render(items, search = '') { decks = items; query = search; render(); }
    };
  };
})();
