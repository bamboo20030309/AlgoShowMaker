(function () {
  const MIME = 'application/x-asm-library-deck';
  window.ASMLibraryOrganizer = function ({ container, nav, createButton, message, api, createCard }) {
    let layout = { folders: [], unfiled: [] }, decks = [], query = '', ready = false, saving = false;
    const expanded = new Map();
    let dragging = null, pointer = null, highlighted = null;
    function status(text, error = false) { message.textContent = text; message.classList.toggle('is-success', !error); }
    async function change(next) {
      if (!ready || saving) return;
      const previous = layout;
      saving = true; layout = next; render(); status('正在儲存資料夾與排序…');
      try {
        layout = (await api('/api/slide-library', { method: 'PUT', body: JSON.stringify({ layout }) })).layout;
        status('資料夾與排序已儲存');
      } catch (error) { layout = previous; status(`儲存失敗：${error.message}；已恢復原排序。`, true); }
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
    function drop(id, target) {
      clearHighlight();
      if (id && target && ready && !saving) change(ASMLibraryLayout.move(layout, id, target.folder, target.before));
    }
    container.addEventListener('dragover', event => {
      if (!dragging || !event.dataTransfer?.types.includes(MIME)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = saving ? 'none' : 'move'; highlight(targetAt(event.target));
    });
    container.addEventListener('drop', event => {
      if (!dragging || !event.dataTransfer?.types.includes(MIME)) return;
      event.preventDefault(); drop(dragging, targetAt(event.target)); dragging = null;
    });
    container.addEventListener('dragend', () => { dragging = null; clearHighlight(); });
    // The handle also supports touch/pen without relying on native HTML drag events.
    container.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.library-drag-handle');
      if (!handle || event.button !== 0 || !ready || saving) return;
      event.preventDefault(); handle.setPointerCapture(event.pointerId);
      pointer = { id: handle.closest('.deck-card').dataset.deckId, x: event.clientX, y: event.clientY, moved: false, handle };
    });
    container.addEventListener('pointermove', event => {
      if (!pointer) return;
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
      if (!pointer.moved) return;
      highlight(targetAt(document.elementFromPoint(event.clientX, event.clientY)));
      if (event.clientY < 80) window.scrollBy(0, -18);
      else if (event.clientY > innerHeight - 80) window.scrollBy(0, 18);
    });
    container.addEventListener('pointerup', event => {
      if (!pointer) return;
      const active = pointer; pointer = null;
      if (active.moved) drop(active.id, targetAt(document.elementFromPoint(event.clientX, event.clientY)));
      clearHighlight();
    });
    container.addEventListener('pointercancel', () => { pointer = null; clearHighlight(); });
    createButton.addEventListener('click', () => {
      if (!ready || saving) return;
      const title = prompt('資料夾名稱（最多 80 個字）');
      if (!title?.trim()) return;
      if (title.trim().length > 80 || layout.folders.length >= 200) { status('資料夾名稱最多 80 個字，最多建立 200 個資料夾。', true); return; }
      const id = 'folder-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2, '0')).join('');
      change({ ...layout, folders: [...layout.folders, { id, title: title.trim(), deckIds: [] }] });
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
        const summary = document.createElement('summary'); summary.textContent = `${folder.title}（${matches.length}）`;
        const cards = document.createElement('div'); cards.className = 'deck-grid gallery-folder-cards';
        if (folder.id) {
          const tools = document.createElement('div'); tools.className = 'library-folder-tools';
          for (const [label, action] of [
            ['重新命名', () => { const title = prompt('資料夾名稱（最多 80 個字）', folder.title); if (!title?.trim()) return; if (title.trim().length > 80) { status('資料夾名稱最多 80 個字。'); return; } change({ ...layout, folders: layout.folders.map(item => item.id === folder.id ? { ...item, title: title.trim() } : item) }); }],
            ['移除資料夾', () => { if (confirm(`移除「${folder.title}」？裡面的投影片會移回未分類，不會刪除投影片。`)) change({ folders: layout.folders.filter(item => item.id !== folder.id), unfiled: [...layout.unfiled, ...folder.deckIds] }); }]
          ]) { const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet-btn'; button.textContent = label; button.disabled = !ready || saving; button.addEventListener('click', action); tools.append(button); }
          section.append(summary, tools, cards);
        } else section.append(summary, cards);
        if (!matches.length) { const empty = document.createElement('p'); empty.className = 'gallery-folder-empty'; empty.textContent = '將投影片拖到這裡，或使用縮圖下方的資料夾選單。'; section.append(empty); }
        for (const deck of matches) {
          const card = createCard(deck); card.dataset.deckId = deck.deck_uid; card.draggable = ready && !saving;
          card.addEventListener('dragstart', event => { if (!ready || saving) { event.preventDefault(); return; } dragging = deck.deck_uid; event.dataTransfer.setData(MIME, dragging); event.dataTransfer.effectAllowed = 'move'; });
          const controls = document.createElement('div'); controls.className = 'library-card-controls';
          const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'library-drag-handle'; handle.textContent = '⠿'; handle.title = '拖曳至另一張投影片前方排序，或拖入資料夾'; handle.setAttribute('aria-label', `拖曳 ${deck.title}`); handle.disabled = !ready || saving;
          const select = document.createElement('select'); select.setAttribute('aria-label', `${deck.title} 的資料夾`);
          folders.forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.title; select.append(option); }); select.value = folder.id; select.disabled = !ready || saving;
          select.addEventListener('change', () => change(ASMLibraryLayout.move(layout, deck.deck_uid, select.value)));
          controls.append(handle, select);
          const index = folder.deckIds.indexOf(deck.deck_uid);
          for (const [label, delta] of [['往前', -1], ['往後', 1]]) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'library-order-button'; button.textContent = delta < 0 ? '↑' : '↓'; button.setAttribute('aria-label', `${deck.title} ${label}`); button.disabled = !ready || saving || index + delta < 0 || index + delta >= folder.deckIds.length;
            button.addEventListener('click', () => change(ASMLibraryLayout.move(layout, deck.deck_uid, folder.id, folder.deckIds[index + (delta < 0 ? -1 : 2)] || null))); controls.append(button);
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
        try { layout = (await api('/api/slide-library')).layout; ready = true; status('拖曳縮圖可排序；拖入資料夾可分類。'); }
        catch (error) { status(`無法讀取資料夾：${error.message}。請重新整理後再試。`, true); }
      },
      render(items, search = '') { decks = items; query = search; render(); }
    };
  };
})();
