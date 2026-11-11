// -----------------------------------------------------------------------------
// 投影片清單共用介面行為
// 「我的投影片」與「範例投影片」使用同一套工具列與分類外觀；這裡放兩邊共用的行為：
// - bindExpandingSearch：放大鏡按鈕，點開後輸入框向左展開；Esc 清除並收起，留空離開時收起。
// - bindFolderAnimation：分類（<details>）展開／收合時以高度伸縮動畫，偏好減少動態效果時直接切換。
// -----------------------------------------------------------------------------
(() => {
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function bindExpandingSearch({ box, input, button, onChange }) {
    function setOpen(open, { focus = false } = {}) {
      box.dataset.open = String(open);
      button.setAttribute('aria-expanded', String(open));
      input.tabIndex = open ? 0 : -1;
      if (open && focus) input.focus();
    }
    button.addEventListener('click', () => {
      const open = box.dataset.open === 'true';
      if (open && !input.value.trim()) setOpen(false);
      else setOpen(true, { focus: true });
    });
    input.addEventListener('input', () => onChange?.());
    input.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      input.value = '';
      onChange?.();
      setOpen(false);
      button.focus();
    });
    input.addEventListener('blur', event => {
      if (event.relatedTarget === button) return;
      if (!input.value.trim()) setOpen(false);
    });
    setOpen(Boolean(input.value.trim()));
    return { setOpen };
  }

  const FOLDER_ANIMATION_MS = 220;

  // Height of a closed <details>: from its top to the bottom of its summary, plus its bottom border.
  function closedHeight(details, summary) {
    const style = getComputedStyle(details);
    return summary.getBoundingClientRect().bottom - details.getBoundingClientRect().top
      + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  }

  function bindFolderAnimation(details) {
    const summary = details.querySelector(':scope > summary');
    if (!summary || details.dataset.folderAnimation === 'bound') return;
    details.dataset.folderAnimation = 'bound';
    summary.addEventListener('click', event => {
      // Controls inside the summary (rename field, trash) stop the click themselves.
      if (event.defaultPrevented || reducedMotion() || !details.isConnected) return;
      event.preventDefault();
      // Clicking again mid-animation reverses it (a closing folder is still `open` until it finishes).
      const opening = details._folderAnimation ? details._folderClosing : !details.open;
      const from = details.getBoundingClientRect().height;
      details._folderAnimation?.cancel();
      details._folderClosing = !opening;
      if (opening) details.open = true;
      const to = opening ? details.getBoundingClientRect().height : closedHeight(details, summary);
      details.style.overflow = 'hidden';
      const animation = details.animate({ height: [`${from}px`, `${to}px`] }, { duration: FOLDER_ANIMATION_MS, easing: 'cubic-bezier(.2,.7,.3,1)' });
      details._folderAnimation = animation;
      const cleanup = () => {
        if (details._folderAnimation !== animation) return;
        details._folderAnimation = null;
        details.style.overflow = '';
      };
      animation.onfinish = () => { if (!opening) details.open = false; cleanup(); };
      animation.oncancel = cleanup;
    });
  }

  // 一個分類（資料夾）區塊：<details> > <summary>（名稱＋「共 N 份」）＋卡片格線＋空白提示。
  // 兩邊清單都從這裡建立，伸縮動畫在標題放好後才綁定；額外的按鈕（改名、垃圾桶）由呼叫端加到 summary。
  function createFolder({ title, count, open = true, emptyText = '', onToggle }) {
    const section = document.createElement('details');
    section.className = 'gallery-folder library-folder';
    section.open = open;
    const summary = document.createElement('summary');
    const heading = document.createElement('span'); heading.className = 'library-folder-title';
    const name = document.createElement('span'); name.className = 'library-folder-name'; name.textContent = title;
    const total = document.createElement('span'); total.className = 'library-folder-count'; total.textContent = `共 ${count} 份`;
    heading.append(name, total); summary.append(heading);
    const cards = document.createElement('div'); cards.className = 'deck-grid gallery-folder-cards';
    section.append(summary, cards);
    if (!count && emptyText) {
      const empty = document.createElement('p'); empty.className = 'gallery-folder-empty'; empty.textContent = emptyText;
      section.append(empty);
    }
    if (onToggle) section.addEventListener('toggle', () => { if (section.isConnected) onToggle(section.open); });
    bindFolderAnimation(section);
    return { section, summary, heading, name, cards };
  }

  // 工具列左側的分類捷徑：展開該分類、標示目前選取並捲動過去。
  // getSection 每次點擊時重新查找（清單可能已重繪）；beforeOpen 可先清除搜尋等。
  function createFolderChip({ title, nav, getSection, beforeOpen, controls }) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'gallery-category'; button.textContent = title;
    if (controls) button.setAttribute('aria-controls', controls);
    button.addEventListener('click', () => {
      beforeOpen?.();
      const section = getSection();
      if (!section) return;
      section.open = true;
      for (const item of nav.children) item.setAttribute('aria-pressed', String(item === button));
      section.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
    });
    nav.append(button);
    return button;
  }

  window.ASMLibraryUI = { bindExpandingSearch, bindFolderAnimation, createFolder, createFolderChip, FOLDER_ANIMATION_MS };
})();
