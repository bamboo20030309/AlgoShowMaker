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

  async function showCover(entry, preview) {
    try {
      if (!thumbnails.has(entry.id)) thumbnails.set(entry.id, (async () => {
        const response = await fetch(entry.archive);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const archive = await window.ASMDeck.decode(await response.blob());
        return window.AlgoDeckThumbnail.create(archive.deck);
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
      const section = document.createElement('details');
      section.className = 'gallery-folder';
      section.id = `sample-category-${category}`;
      section.open = query ? true : expanded.get(category) !== false;
      const heading = document.createElement('summary');
      heading.textContent = `${label}（${entries.length}）`;
      section.append(heading);
      section.addEventListener('toggle', () => expanded.set(category, section.open));
      const cards = document.createElement('div');
      cards.className = 'deck-grid gallery-folder-cards';
      section.append(cards);
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'gallery-folder-empty';
        empty.textContent = '尚未收錄投影片';
        section.append(empty);
      }
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

  for (const [id, label] of Object.entries(categories)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-category';
    button.textContent = label;
    button.setAttribute('aria-controls', `sample-category-${id}`);
    button.addEventListener('click', () => {
      if (search.value) { search.value = ''; render(); }
      const section = document.getElementById(`sample-category-${id}`);
      if (!section) return;
      section.open = true;
      expanded.set(id, true);
      for (const item of nav.children) item.setAttribute('aria-pressed', String(item === button));
      section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
    nav.append(button);
  }
  search.addEventListener('input', render);
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
