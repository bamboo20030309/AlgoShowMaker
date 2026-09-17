(function () {
  const MIME = 'application/x-asm-library-deck';
  window.ASMLibraryOrganizer = function ({ container, nav, createButton, message, api, createCard }) {
    let layout = { folders: [], unfiled: [] }, decks = [], query = '', ready = false, saving = false;
    const expanded = new Map();
    let dragging = null, pointer = null, highlighted = null;
    let suppressClickUntil = 0;
    const folderDialog = document.getElementById('folderDialog');
    const folderForm = document.getElementById('folderDialogForm');
    const folderInput = document.getElementById('folderTitleInput');
    const folderMessage = document.getElementById('folderDialogMessage');
    const folderSubmit = document.getElementById('submitFolderBtn');
    const folderClose = document.getElementById('closeFolderDialogBtn');
    const folderCancel = document.getElementById('cancelFolderDialogBtn');
    let editingFolderId = null, deletingFolderId = null;
    const deleteDialog = document.getElementById('deleteFolderDialog');
    const deleteForm = document.getElementById('deleteFolderForm');
    const deleteMessage = document.getElementById('deleteFolderMessage');
    const deleteSubmit = document.getElementById('deleteFolderSubmit');
    for (const id of ['closeDeleteFolderBtn', 'cancelDeleteFolderBtn']) document.getElementById(id).addEventListener('click', () => { if (!saving) deleteDialog.close(); });
    deleteDialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
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
    const categoryDialog = document.getElementById('categoryDialog');
    const categoryForm = document.getElementById('categoryForm');
    const categoryChoices = document.getElementById('categoryChoices');
    const categoryMessage = document.getElementById('categoryMessage');
    let categoryDeckId = null;
    for (const id of ['closeCategoryBtn', 'cancelCategoryBtn']) document.getElementById(id).addEventListener('click', () => { if (!saving) categoryDialog.close(); });
    categoryDialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    categoryForm.addEventListener('submit', async event => {
      event.preventDefault(); if (saving || !ready || !categoryDeckId) return;
      const selected = [...categoryChoices.querySelectorAll('input:checked')].map(input => input.value);
      let next;
      try { next = ASMLibraryLayout.assign(layout, categoryDeckId, selected); }
      catch (error) { categoryMessage.textContent = error.message; return; }
      categoryForm.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
      categoryMessage.textContent = '正在儲存分類…';
      const success = await change(next);
      categoryForm.querySelectorAll('button, input').forEach(control => { control.disabled = false; });
      if (success) categoryDialog.close(); else categoryMessage.textContent = message.textContent;
    });
    function openCategories(deck) {
      if (!ready || saving) return;
      categoryDeckId = deck.deck_uid; categoryChoices.replaceChildren(); categoryMessage.textContent = '';
      document.getElementById('categoryDeckName').textContent = deck.title;
      layout.folders.forEach(folder => {
        const label = document.createElement('label'); label.className = 'category-choice';
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = folder.id; input.checked = folder.deckIds.includes(deck.deck_uid);
        const text = document.createElement('span'); text.textContent = folder.title; label.append(input, text); categoryChoices.append(label);
      });
      if (!layout.folders.length) categoryMessage.textContent = '請先新增資料夾，即可選擇多個分類。';
      categoryDialog.showModal();
    }
    function status(text, error = false) { message.textContent = text; message.classList.toggle('is-success', !error); }
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
    function drop(id, target, source) {
      clearHighlight();
      if (id && target && ready && !saving) change(ASMLibraryLayout.move(layout, id, target.folder, target.before, source));
    }
    container.addEventListener('dragover', event => {
      if (!dragging || !event.dataTransfer?.types.includes(MIME)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = saving ? 'none' : 'move'; highlight(targetAt(event.target));
    });
    container.addEventListener('drop', event => {
      if (!dragging || !event.dataTransfer?.types.includes(MIME)) return;
      event.preventDefault(); drop(dragging.id, targetAt(event.target), dragging.source); dragging = null;
    });
    container.addEventListener('dragend', () => { dragging = null; clearHighlight(); });
    // Start a drag from the whole card, while allowing a normal click on its buttons.
    container.addEventListener('pointerdown', event => {
      suppressClickUntil = 0;
      const card = event.target.closest('.deck-card[data-deck-id]');
      if (!card || event.target.closest('select, input, textarea') || event.button !== 0 || !ready || saving) return;
      pointer = { id: card.dataset.deckId, source: card.closest('.library-folder').dataset.folderId, x: event.clientX, y: event.clientY, moved: false, card, pointerId: event.pointerId };
    });
    container.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) {
        pointer.moved = true; pointer.card.setPointerCapture(event.pointerId);
        pointer.card.classList.add('library-drag-source');
      }
      if (!pointer.moved) return;
      event.preventDefault();
      highlight(targetAt(document.elementFromPoint(event.clientX, event.clientY)));
      if (event.clientY < 80) window.scrollBy(0, -18);
      else if (event.clientY > innerHeight - 80) window.scrollBy(0, 18);
    });
    container.addEventListener('pointerup', event => {
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      const active = pointer; pointer = null;
      active.card.classList.remove('library-drag-source');
      if (active.moved) {
        event.preventDefault(); suppressClickUntil = performance.now() + 250;
        drop(active.id, targetAt(document.elementFromPoint(event.clientX, event.clientY)), active.source);
      }
      clearHighlight();
    });
    function cancelPointer() { pointer?.card.classList.remove('library-drag-source'); pointer = null; clearHighlight(); }
    container.addEventListener('pointercancel', cancelPointer);
    container.addEventListener('lostpointercapture', cancelPointer);
    container.addEventListener('click', event => {
      if (event.detail && performance.now() < suppressClickUntil) { suppressClickUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    function openFolderDialog(folder = null) {
      if (!ready || saving) return;
      editingFolderId = folder?.id || null;
      folderForm.reset(); folderInput.setCustomValidity(''); folderMessage.textContent = '';
      folderInput.value = folder?.title || '';
      document.getElementById('folderDialogTitle').textContent = folder ? '重新命名資料夾' : '新增資料夾';
      folderSubmit.textContent = folder ? '儲存名稱' : '建立資料夾';
      folderDialog.showModal(); folderInput.focus();
      if (folder) folderInput.select();
    }
    createButton.addEventListener('click', () => openFolderDialog());
    folderInput.addEventListener('input', () => { folderInput.setCustomValidity(''); folderMessage.textContent = ''; });
    folderClose.addEventListener('click', () => { if (!saving) folderDialog.close(); });
    folderCancel.addEventListener('click', () => { if (!saving) folderDialog.close(); });
    folderDialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    folderForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!ready || saving) return;
      const title = folderInput.value.trim();
      if (!title || title.length > 80) {
        folderInput.setCustomValidity('請輸入 1 至 80 個字的資料夾名稱。'); folderInput.reportValidity(); return;
      }
      if (!editingFolderId && layout.folders.length >= 200) { folderMessage.textContent = '最多建立 200 個資料夾。'; return; }
      const id = editingFolderId || 'folder-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2, '0')).join('');
      const next = editingFolderId
        ? { ...layout, folders: layout.folders.map(folder => folder.id === editingFolderId ? { ...folder, title } : folder) }
        : { ...layout, folders: [...layout.folders, { id, title, deckIds: [] }] };
      for (const control of [folderInput, folderSubmit, folderClose, folderCancel]) control.disabled = true;
      folderSubmit.textContent = '正在儲存…'; folderMessage.textContent = '';
      const success = await change(next);
      for (const control of [folderInput, folderSubmit, folderClose, folderCancel]) control.disabled = false;
      folderSubmit.textContent = editingFolderId ? '儲存名稱' : '建立資料夾';
      if (success) folderDialog.close();
      else { folderMessage.textContent = message.textContent; folderInput.focus(); }
    });
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
        const heading = document.createElement('span'); heading.className = 'library-folder-title'; heading.textContent = `${folder.title}（${matches.length}）`; summary.append(heading);
        const cards = document.createElement('div'); cards.className = 'deck-grid gallery-folder-cards';
        if (folder.id) {
          const tools = document.createElement('span'); tools.className = 'library-folder-tools';
          for (const [label, action] of [
            ['重新命名', () => openFolderDialog(folder)],
            ['移除資料夾', () => openDeleteFolder(folder)]
          ]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'icon-btn'; button.title = label; button.setAttribute('aria-label', label);
            button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${label === '重新命名' ? '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>' : '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'}</svg>`;
            button.disabled = !ready || saving;
            button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); action(); }); tools.append(button);
          }
          summary.append(tools); section.append(summary, cards);
        } else section.append(summary, cards);
        if (!matches.length) { const empty = document.createElement('p'); empty.className = 'gallery-folder-empty'; empty.textContent = '將投影片拖到這裡，或使用縮圖下方的資料夾選單。'; section.append(empty); }
        for (const deck of matches) {
          const card = createCard(deck); card.dataset.deckId = deck.deck_uid; card.draggable = ready && !saving;
          card.querySelectorAll('img').forEach(image => { image.draggable = false; });
          card.addEventListener('dragstart', event => { if (pointer || !ready || saving) { event.preventDefault(); return; } dragging = { id: deck.deck_uid, source: folder.id }; event.dataTransfer.setData(MIME, deck.deck_uid); event.dataTransfer.effectAllowed = 'move'; });
          const controls = document.createElement('div'); controls.className = 'library-card-controls';
          const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'library-drag-handle'; handle.textContent = '⠿'; handle.title = '拖曳至另一張投影片前方排序，或拖入資料夾'; handle.setAttribute('aria-label', `拖曳 ${deck.title}`); handle.disabled = !ready || saving;
          const categoriesButton = document.createElement('button'); categoriesButton.type = 'button'; categoriesButton.className = 'quiet-btn library-categories-button'; categoriesButton.setAttribute('aria-label', `${deck.title} 的分類`);
          const memberships = layout.folders.filter(item => item.deckIds.includes(deck.deck_uid));
          categoriesButton.textContent = memberships.length ? `分類（${memberships.length}）` : '選擇分類'; categoriesButton.title = memberships.map(item => item.title).join('、') || '未分類'; categoriesButton.disabled = !ready || saving;
          categoriesButton.addEventListener('click', () => openCategories(deck)); controls.append(handle, categoriesButton);
          const index = folder.deckIds.indexOf(deck.deck_uid);
          for (const [label, delta] of [['往前', -1], ['往後', 1]]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'library-order-button'; button.textContent = delta < 0 ? '↑' : '↓'; button.setAttribute('aria-label', `${deck.title} ${label}`); button.disabled = !ready || saving || index + delta < 0 || index + delta >= folder.deckIds.length;
            button.addEventListener('click', () => change(ASMLibraryLayout.move(layout, deck.deck_uid, folder.id, folder.deckIds[index + (delta < 0 ? -1 : 2)] || null, folder.id))); controls.append(button);
          }
          card.append(controls); cards.append(card);
        }
        container.append(section);
        const link = document.createElement('button'); link.type = 'button'; link.className = 'gallery-category'; link.textContent = folder.title; link.hidden = section.hidden;
        link.addEventListener('click', () => { section.open = true; expanded.set(folder.id, true); section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }); nav.append(link);
      }
    }
    return {
      async load(items) {
        ready = false; decks = items; layout = { folders: [], unfiled: [] }; status('正在讀取資料夾…');
        try { layout = (await api('/api/slide-library')).layout; ready = true; status(''); }
        catch (error) { status(`無法讀取資料夾：${error.message}。請重新整理後再試。`, true); }
      },
      render(items, search = '') { decks = items; query = search; render(); }
    };
  };
})();
