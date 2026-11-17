// -----------------------------------------------------------------------------
// 訪客範例資料轉接器
// 載入公開 deck 索引、整理分類並產生可供首頁渲染的卡片資料。
// -----------------------------------------------------------------------------
(() => {
  const categories = {
    Basic: '基礎', Sorting: '排序', Data_Structure: '資料結構',
    Tree: '樹', Graph: '圖論', DP: '動態規劃', Backtracking: '回溯', Math: '數學'
  };
  const grid = document.getElementById('galleryGrid');
  const message = document.getElementById('galleryMessage');
  const search = document.getElementById('gallerySearch');
  const count = document.getElementById('galleryCount');
  const nav = document.getElementById('galleryCategories');
  let decks = [];
  const expanded = new Map();
  let ready = false;
  const thumbnails = new Map();
  // -----------------------------------------------------------------------------
  // 範例分類正規化
  // 合併單一與多重分類欄位並去重，標籤維持來源順序供卡片呈現。
  // -----------------------------------------------------------------------------
  function entryCategories(entry) {
    return [...new Set((Array.isArray(entry.categories) ? entry.categories : [entry.category]).filter(id => Object.hasOwn(categories, id)))];
  }

  function entryLabels(entry) {
    const categoryLabels = entryCategories(entry).map(id => categories[id]);
    const hints = Array.isArray(entry.hints)
      ? entry.hints.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
      : [];
    return [...new Set([...categoryLabels, ...hints])];
  }

  // -----------------------------------------------------------------------------
  // 範例封面載入
  // 只使用建置時寫入索引的封面；首頁不下載或解析投影片內容。
  // -----------------------------------------------------------------------------
  async function showCover(entry, preview) {
    try {
      if (!thumbnails.has(entry.id)) thumbnails.set(entry.id, (async () => {
        if (!entry.cover_thumbnail) throw new Error('範例尚未建立封面快取');
        return entry.cover_thumbnail;
      })());
      const src = await thumbnails.get(entry.id);
      const image = document.createElement('img');
      image.className = 'deck-cover-image';
      image.alt = '';
      image.src = src;
      preview.replaceChildren(image);
      preview.classList.add('has-cover');
    } catch (error) {
      thumbnails.delete(entry.id);
      preview.textContent = '縮圖暫時無法載入，點選開啟投影片';
      console.warn('Public deck thumbnail failed', error);
    }
  }

  // -----------------------------------------------------------------------------
  // 分類篩選與卡片渲染
  // 目前分類只影響可見 entry，不修改原索引；點擊以 sample id 開啟唯讀投影片頁。
  // -----------------------------------------------------------------------------
  function render() {
    if (!ready) return;
    const query = search.value.trim().toLocaleLowerCase();
    const visible = decks.filter(entry => `${entry.title} ${entryLabels(entry).join(' ')}`.toLocaleLowerCase().includes(query));
    count.textContent = `共 ${visible.length} 份`;
    message.textContent = visible.length || !query ? '' : '找不到符合搜尋的投影片。';
    grid.replaceChildren();
    for (const [category, label] of Object.entries(categories)) {
      const entries = visible.filter(entry => entryCategories(entry).includes(category));
      if (query && !entries.length) continue;
      // 分類區塊與「我的投影片」共用（library-ui.js）；範例的名稱不可編輯。
      const { section, cards } = window.ASMLibraryUI.createFolder({
        title: label,
        count: entries.length,
        open: query ? true : expanded.get(category) !== false,
        emptyText: '尚未收錄投影片',
        onToggle: open => expanded.set(category, open)
      });
      section.id = `sample-category-${category}`;
      grid.append(section);
      for (const entry of entries) {
        const card = document.createElement('article');
        card.className = 'deck-card';
        const link = document.createElement('a');
        link.className = 'deck-open';
        link.href = `/slides.html?sample=${encodeURIComponent(entry.id)}`;
        link.setAttribute('aria-label', `觀賞 ${entry.title}`);
        const preview = document.createElement('div');
        preview.className = 'deck-preview';
        const loading = document.createElement('span');
        loading.className = 'gallery-cover-status';
        loading.textContent = '正在載入縮圖…';
        preview.append(loading);
        const info = document.createElement('div');
        info.className = 'deck-info';
        const title = document.createElement('strong');
        title.className = 'deck-title';
        title.textContent = entry.title;
        const meta = document.createElement('span');
        meta.className = 'deck-meta';
        const labels = entryLabels(entry);
        meta.setAttribute('aria-label', labels.join('、'));
        meta.replaceChildren(...labels.map(label => {
          const hint = document.createElement('span');
          hint.className = 'deck-hint';
          hint.textContent = label;
          return hint;
        }));
        info.append(title, meta);
        link.append(preview, info);
        card.append(link);
        cards.append(card);
        showCover(entry, preview);
        }
    }
  }

  // 分類捷徑與放大鏡搜尋：與「我的投影片」共用（library-ui.js）。
  for (const [id, label] of Object.entries(categories)) {
    window.ASMLibraryUI.createFolderChip({
      title: label,
      nav,
      controls: `sample-category-${id}`,
      beforeOpen: () => { if (search.value) { search.value = ''; render(); } },
      getSection: () => document.getElementById(`sample-category-${id}`)
    });
  }
  window.ASMLibraryUI.bindExpandingSearch({
    box: search.closest('.library-search'),
    input: search,
    button: document.getElementById('gallerySearchToggleBtn'),
    onChange: render
  });
  message.textContent = '正在載入公開投影片…';
  fetch('/guest-decks.json').then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    decks = catalog.decks;
    ready = true;
    render();
  }).catch(error => {
    message.textContent = '公開投影片載入失敗，請重新整理後再試。';
    console.warn('Public gallery failed', error);
  });
})();
