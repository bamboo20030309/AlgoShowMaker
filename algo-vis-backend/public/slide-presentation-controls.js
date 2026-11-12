// 投影片瀏覽操作：滾輪採垂直優先的線性順序；雷射游標只影響展示畫面。
// 檢視狀態不寫回 deck，也不替演算法播放器增加新的輸入處理邏輯。
(function () {
  const installed = new WeakMap();

  function install({ reveal, groupSizes, overviewOpen = () => false }) {
    if (installed.has(reveal)) return installed.get(reveal);
    const frames = new Set(), documents = new WeakSet();
    const frameStyles = new URL('slide-presentation-controls.css?v=3', document.baseURI).href;
    let presentationMode = false;
    let accumulated = 0, previousDirection = 0, lastWheel = 0, lockedUntil = 0;
    const modalOpen = () => !!document.querySelector('dialog[open], #algorithmEditorModal:not([hidden]), #codeEditorModal:not([hidden])');
    const available = () => reveal.isReady() && !overviewOpen() && !reveal.isOverview() && !reveal.isPaused() && !modalOpen();
    const presenting = () => available() && !document.body.classList.contains('asm-edit-mode');
    const activeFrame = frame => frame.isConnected && frame.closest('section.asm-slide') === reveal.getCurrentSlide();

    const menu = document.createElement('div');
    menu.className = 'asm-presentation-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
    const menuButtons = [false, true].map(laser => {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('role', 'menuitemradio'); button.textContent = laser ? '簡報模式' : '一般游標';
      button.addEventListener('click', () => { presentationMode = laser; closeMenu(); sync(); });
      menu.append(button); return button;
    });
    document.body.append(menu);
    let menuTimer;
    function closeMenu() {
      if (menu.hidden) return;
      menu.classList.remove('is-open'); menu.classList.add('is-closing');
      clearTimeout(menuTimer); menuTimer = setTimeout(() => { menu.hidden = true; menu.classList.remove('is-closing'); }, 150);
    }
    function contextMenu(event, frame = null) {
      if (!presenting() || (frame ? !activeFrame(frame) : !event.target.closest?.('body > .reveal'))) return;
      // In an animation the laser-mode right click remains the next-step
      // shortcut; the slide background still offers the mode menu to exit it.
      if (frame && event.target.closest?.('#arraySvg')
        && (presentationMode || frame.contentWindow.isCanvasGestureDragged?.())) return;
      event.preventDefault(); event.stopImmediatePropagation();
      clearTimeout(menuTimer); menu.hidden = false; menu.classList.remove('is-closing');
      menuButtons.forEach((button, i) => button.setAttribute('aria-checked', String(presentationMode === Boolean(i))));
      const rect = frame?.getBoundingClientRect();
      const x = frame ? rect.left + event.clientX * rect.width / frame.clientWidth : event.clientX;
      const y = frame ? rect.top + event.clientY * rect.height / frame.clientHeight : event.clientY;
      menu.style.left = Math.max(4, Math.min(x, innerWidth - menu.offsetWidth - 4)) + 'px';
      menu.style.top = Math.max(4, Math.min(y, innerHeight - menu.offsetHeight - 4)) + 'px';
      menu.classList.add('is-open'); menuButtons[Number(presentationMode)].focus({ preventScroll: true });
    }
    window.addEventListener('contextmenu', event => contextMenu(event), true);
    document.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) closeMenu(); }, true);
    window.addEventListener('keydown', event => {
      if (menu.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeMenu(); }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation(); menuButtons[document.activeElement === menuButtons[0] ? 1 : 0].focus();
      }
    }, true);

    function scrollable(target) {
      for (let node = target; node?.nodeType === 1; node = node.parentElement) {
        if (node.matches('input, textarea, select, [contenteditable="true"], .ace_editor')) return true;
        const style = node.ownerDocument.defaultView.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) return true;
      }
      return false;
    }

    function navigate(direction) {
      const sizes = groupSizes(), indices = reveal.getIndices();
      let h = indices.h, v = indices.v || 0;
      if (direction > 0) {
        if (v + 1 < sizes[h]) v++;
        else if (h + 1 < sizes.length) { h++; v = 0; }
        else return;
      } else {
        if (v > 0) v--;
        else if (h > 0) { h--; v = Math.max(0, sizes[h] - 1); }
        else return;
      }
      reveal.slide(h, v);
    }

    function wheel(event, frame = null) {
      if (!available() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
        || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (frame ? !activeFrame(frame) : !event.target.closest?.('body > .reveal')) return;
      // 動畫畫布實際拖曳選取後才擁有滾輪縮放；未選取時沿用投影片切頁。
      // iframe 內的播放列等其他區域仍沿用投影片切頁操作。
      if (frame && event.target.closest?.('#canvasWrapper, #arraySvg')
        && frame.contentWindow.isCanvasWheelZoomSelected?.()) {
        accumulated = 0;
        return;
      }
      if (scrollable(event.target)) return;
      // 只攔截由投影片負責的區域，避免同一次滾輪觸發兩種操作。
      event.preventDefault();
      event.stopImmediatePropagation();
      const now = performance.now(), direction = Math.sign(event.deltaY);
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      if (now - lastWheel > 180 || direction !== previousDirection) accumulated = 0;
      previousDirection = direction;
      lastWheel = now;
      if (now < lockedUntil) { accumulated = 0; return; }
      accumulated += event.deltaY * units;
      if (Math.abs(accumulated) < 40) return;
      accumulated = 0;
      lockedUntil = now + 450;
      navigate(direction);
    }

    function attach(frame) {
      if (!frame.matches?.('iframe.algorithm-slide-frame')) return;
      frames.add(frame);
      let child;
      try { child = frame.contentDocument; } catch { return; }
      if (!child?.documentElement) return;
      if (!documents.has(child)) {
        documents.add(child);
        const link = child.createElement('link');
        link.rel = 'stylesheet'; link.href = frameStyles;
        (child.head || child.documentElement).appendChild(link);
        child.defaultView.addEventListener('contextmenu', event => contextMenu(event, frame), true);
        child.defaultView.addEventListener('pointerdown', closeMenu, true);
        child.defaultView.addEventListener('wheel', event => wheel(event, frame), { passive: false, capture: true });
      }
      child.documentElement.classList.toggle('asm-slide-laser-frame', presenting() && presentationMode && activeFrame(frame));
    }

    function sync() {
      if (document.body.classList.contains('asm-edit-mode')) presentationMode = false;
      if (!presenting()) closeMenu();
      const laser = presenting() && presentationMode;
      document.body.classList.toggle('asm-slide-view-mode', presenting());
      if (document.body.classList.contains('asm-slide-laser-mode') !== laser) document.body.classList.toggle('asm-slide-laser-mode', laser);
      document.querySelectorAll('iframe.algorithm-slide-frame').forEach(attach);
      frames.forEach(frame => { if (!frame.isConnected) frames.delete(frame); });
    }
    document.addEventListener('wheel', event => wheel(event), { passive: false, capture: true });
    // iframe load does not bubble; capture catches both initial and replaced
    // same-origin runtime documents without observing every SVG render.
    document.addEventListener('load', event => {
      if (event.target.matches?.('iframe.algorithm-slide-frame')) { attach(event.target); sync(); }
    }, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    ['slidechanged', 'overviewshown', 'overviewhidden', 'paused', 'resumed'].forEach(name => reveal.on(name, () => {
      frames.forEach(frame => { if (!activeFrame(frame)) frame.contentWindow?.resetCanvasWheelSelection?.(); });
      sync();
    }));
    installed.set(reveal, { sync });
    sync();
    return installed.get(reveal);
  }

  window.ASMSlidePresentation = { install };
})();
