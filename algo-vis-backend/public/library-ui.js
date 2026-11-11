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

  window.ASMLibraryUI = { bindExpandingSearch, bindFolderAnimation, FOLDER_ANIMATION_MS };
})();
