// Shared explicit, user-triggered sampling. Never uploads or captures screen images.
(function () {
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6m-7-2L4 17v3h3l9-9m-3-3 5-5a2.1 2.1 0 0 1 3 3l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let pending = null;
  function cancel() { pending?.abort(); }
  function abortError() { return new DOMException('已取消取色', 'AbortError'); }
  function rgb(value) {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  }
  function composite(top, bottom) {
    const a = top[3] / 255, b = bottom[3] / 255, alpha = a + b * (1 - a);
    return alpha ? [0, 1, 2].map(i => Math.round((top[i] * a + bottom[i] * b * (1 - a)) / alpha)).concat(Math.round(alpha * 255)) : [0, 0, 0, 0];
  }
  async function loadImage(source) {
    const image = new Image(); image.src = source;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('無法讀取這個圖像的顏色，請改用 HTTPS 原生滴管')); });
    return image;
  }
  async function svgPixel(svg, x, y) {
    const box = svg.getBoundingClientRect(), clone = svg.cloneNode(true);
    const sourceNodes = [svg, ...svg.querySelectorAll('*')], cloneNodes = [clone, ...clone.querySelectorAll('*')];
    const properties = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'visibility', 'display'];
    sourceNodes.forEach((node, index) => { const style = node.ownerDocument.defaultView.getComputedStyle(node); for (const property of properties) cloneNodes[index].style.setProperty(property, style.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)')); });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', box.width); clone.setAttribute('height', box.height);
    const image = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone)));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(box.width)); c.height = Math.max(1, Math.ceil(box.height));
    const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0, c.width, c.height);
    return [...ctx.getImageData(Math.min(c.width - 1, Math.max(0, Math.floor(x - box.left))), Math.min(c.height - 1, Math.max(0, Math.floor(y - box.top))), 1, 1).data];
  }
  async function pageColor(doc, x, y, ignored, depth = 0) {
    if (depth > 4) throw new Error('無法讀取這個巢狀畫面');
    const nodes = doc.elementsFromPoint(x, y).filter(node => !ignored.has(node));
    const sampled = new Set(); let result = [0, 0, 0, 0];
    for (const node of nodes) {
      if (result[3] === 255) break;
      const view = doc.defaultView, style = view.getComputedStyle(node), box = node.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      let color = null;
      if (node.tagName === 'IFRAME') {
        try { if (!node.contentDocument) throw new Error(); color = rgb(await pageColor(node.contentDocument, (x - box.left) * node.clientWidth / box.width, (y - box.top) * node.clientHeight / box.height, new Set(), depth + 1)); }
        catch { throw new Error('無法讀取跨來源影片／網頁，請在 HTTPS 使用原生滴管'); }
      } else if (node.tagName === 'CANVAS' && box.width && box.height) {
        const context = node.getContext('2d');
        if (!context) throw new Error('這個畫布需在 HTTPS 使用原生滴管');
        if (context) color = [...context.getImageData(Math.min(node.width - 1, Math.max(0, Math.floor((x - box.left) * node.width / box.width))), Math.min(node.height - 1, Math.max(0, Math.floor((y - box.top) * node.height / box.height))), 1, 1).data];
      } else if (node instanceof view.SVGElement) {
        const svg = node.closest('svg');
        if (sampled.has(svg)) continue; sampled.add(svg); color = await svgPixel(svg, x, y);
      } else if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || style.backgroundImage !== 'none') {
        throw new Error('這類圖片、影片或漸層需在 HTTPS 使用原生滴管，尚未套用顏色');
      } else {
        const borders = [['left', x - box.left], ['right', box.right - x], ['top', y - box.top], ['bottom', box.bottom - y]];
        const border = borders.find(([side, distance]) => distance < parseFloat(style.getPropertyValue('border-' + side + '-width')) && style.getPropertyValue('border-' + side + '-style') !== 'none');
        if (border) color = rgb(style.getPropertyValue('border-' + border[0] + '-color'));
        // Use the actual foreground paint when the hit is within a text glyph's range.
        let range = doc.caretRangeFromPoint?.(x, y);
        if (!color && range?.startContainer.parentElement && node.contains(range.startContainer) && range.startContainer.nodeType === 3) {
          const text = range.startContainer, offset = Math.min(range.startOffset, text.length - 1);
          if (offset >= 0) { range = doc.createRange(); range.setStart(text, offset); range.setEnd(text, offset + 1); const r = range.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && text.textContent[offset].trim()) color = rgb(view.getComputedStyle(text.parentElement).color);
          }
        }
        if (!color) color = rgb(style.backgroundColor);
      }
      if (color) { color[3] = Math.round(color[3] * Number(style.opacity || 1)); result = composite(result, color); }
    }
    // CSS propagates a body's solid background to the viewport, even when an
    // empty body's own box has zero height (notably embedded animation frames).
    let backdrop = rgb(doc.defaultView.getComputedStyle(doc.documentElement).backgroundColor);
    if (!backdrop[3] && doc.body) backdrop = rgb(doc.defaultView.getComputedStyle(doc.body).backgroundColor);
    result = composite(composite(result, backdrop), [255, 255, 255, 255]);
    return '#' + result.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  }
  function pagePick(signal, status) {
    return new Promise((resolve, reject) => {
      const overlay = document.createElement('div'); overlay.className = 'asm-eyedropper-overlay';
      const hint = document.createElement('div'); hint.className = 'asm-eyedropper-hint'; hint.textContent = '點選頁面顏色，Esc 取消';
      overlay.append(hint); document.body.append(overlay); document.body.dataset.eyedropper = 'page';
      const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];
      let sampling = false;
      const close = () => { overlay.remove(); delete document.body.dataset.eyedropper; window.removeEventListener('keydown', key, true); events.forEach(type => window.removeEventListener(type, block, true)); signal.removeEventListener('abort', abort); window.removeEventListener('blur', abort); };
      const abort = () => { close(); reject(abortError()); };
      const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); abort(); } };
      overlay.addEventListener('pointermove', event => { hint.style.left = Math.min(innerWidth - 230, event.clientX + 18) + 'px'; hint.style.top = Math.min(innerHeight - 40, event.clientY + 18) + 'px'; });
      const pick = async event => {
        if (sampling) return; sampling = true;
        event.preventDefault(); event.stopImmediatePropagation(); overlay.style.pointerEvents = 'none';
        try { const value = await pageColor(document, event.clientX, event.clientY, new Set([overlay, hint])); if (!signal.aborted) { close(); resolve({ sRGBHex: value }); } }
        catch (error) { close(); reject(error); }
      };
      const block = event => { event.preventDefault(); event.stopImmediatePropagation(); if (event.type === 'click') void pick(event); };
      events.forEach(type => window.addEventListener(type, block, true));
      window.addEventListener('keydown', key, true); signal.addEventListener('abort', abort, { once: true }); window.addEventListener('blur', abort, { once: true });
      status.textContent = '頁面取色中';
    });
  }
  function install(parent, capture) {
    const row = document.createElement('div'); row.className = 'asm-eyedropper-row';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'asm-eyedropper-button'; button.title = '滴管取色（Esc 取消）'; button.setAttribute('aria-label', '滴管取色'); button.innerHTML = icon + '<span>滴管</span>';
    const status = document.createElement('span'); status.className = 'asm-eyedropper-status'; status.setAttribute('role', 'status'); row.append(button, status); parent.prepend(row);
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation(); cancel(); const apply = capture(); if (!apply) return;
      const controller = new AbortController(); pending = controller; button.disabled = true; button.setAttribute('aria-busy', 'true'); status.textContent = '取色中，Esc 取消';
      try { const result = window.EyeDropper && window.isSecureContext
        ? await new window.EyeDropper().open({ signal: controller.signal }) : await pagePick(controller.signal, status);
        if (!controller.signal.aborted) { apply(result.sRGBHex); status.textContent = result.sRGBHex; }
      } catch (error) { status.textContent = error.name === 'AbortError' ? '已取消取色' : (error.name === 'SecurityError' ? '此內容無法讀取，請在 HTTPS 使用原生滴管' : error.message); }
      finally { if (pending === controller) pending = null; button.disabled = false; button.removeAttribute('aria-busy'); }
    });
    return button;
  }
  window.ASMColorEyedropper = { install, cancel };
})();
