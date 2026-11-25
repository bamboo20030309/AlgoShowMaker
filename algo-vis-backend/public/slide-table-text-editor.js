// Table keeps its SVG glyphs; Fabric IText supplies the same caret, selection,
// clipboard and IME behavior used by slide text objects. This canvas is transient.
(function () {
  function create({ cell, value, event, placeCaret, refreshCaret, commit }) {
    const Fabric = window.fabric, svgText = cell.querySelector(':scope > text');
    const rect = cell.querySelector(':scope > rect'), style = getComputedStyle(svgText);
    const original = svgText.textContent;
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    host.classList.add('table-text-editor');
    const element = document.createElement('canvas'); host.appendChild(element); cell.appendChild(host);
    const canvas = new Fabric.Canvas(element, { selection: false, renderOnAddRemove: false,
      backgroundColor: 'transparent', stopContextMenu: true });
    const text = new Fabric.IText(value, { fontFamily: style.fontFamily, fontSize: parseFloat(style.fontSize),
      fontWeight: style.fontWeight, fontStyle: style.fontStyle, fill: style.fill, cursorColor: style.fill,
      charSpacing: parseFloat(style.letterSpacing) / parseFloat(style.fontSize) * 1000 || 0,
      hasBorders: false, hasControls: false, lockMovementX: true, lockMovementY: true,
      objectCaching: false, compositionColor: '#1d8f83' });
    // Never swap the painted SVG text for another renderer on entering edit.
    // Selection/caret still render through IText's standard overlay context.
    text._renderText = function () {};
    let disposed = false;
    function layout() {
      const probe = svgText.cloneNode(true); probe.textContent ||= 'Mg'; probe.style.visibility = 'hidden';
      cell.appendChild(probe);
      const bounds = probe.getBBox(), middleY = bounds.y;
      probe.style.dominantBaseline = 'alphabetic';
      const baseline = Number(svgText.getAttribute('y')) + middleY - probe.getBBox().y;
      probe.remove();
      const x = Math.min(Number(rect.getAttribute('x')), bounds.x) - 2;
      const y = Math.min(Number(rect.getAttribute('y')), bounds.y) - 2;
      const width = Math.ceil(Math.max(Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')), bounds.x + bounds.width) - x + 2);
      const height = Math.ceil(Math.max(Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')), bounds.y + bounds.height) - y + 2);
      for (const [key, number] of Object.entries({x,y,width,height})) host.setAttribute(key, String(number));
      if (canvas.width !== width || canvas.height !== height) canvas.setDimensions({width,height});
      const anchor = Number(svgText.getAttribute('x'));
      const left = style.textAnchor === 'start' ? anchor : style.textAnchor === 'end' ? anchor - text.width : anchor - text.width / 2;
      text.set({ left: left - x, top: baseline - y - text.getHeightOfLine(0) / text.lineHeight * (1 - text._fontSizeFraction) });
      text.setCoords(); text.cursorOffsetCache = {}; canvas.renderAll();
      if (text.isEditing) refreshCaret(text);
    }
    // Screen-space bounding rectangles lose rotation/skew. Use the SVG matrix
    // for Fabric's pointer coordinates so transformed tables select correctly.
    canvas.getPointer = function (pointer) {
      const point = new DOMPoint(pointer.clientX, pointer.clientY).matrixTransform(host.getScreenCTM().inverse());
      return {x:point.x - Number(host.getAttribute('x')),y:point.y - Number(host.getAttribute('y'))};
    };
    canvas.add(text); canvas.setActiveObject(text); layout();
    text.on('changed', () => { svgText.textContent = text.text; layout(); });
    // A click on Fabric's upper canvas briefly moves browser focus away from
    // the hidden textarea. That is an internal selection gesture, not a request
    // to commit the cell. Keep the editor alive until the pointer gesture ends.
    let internalPointer = false;
    const beginInternalPointer = e => { internalPointer = true; e.stopPropagation(); };
    const endInternalPointer = () => {
      if (!internalPointer || disposed) return;
      internalPointer = false;
      queueMicrotask(() => {
        if (!disposed && text.isEditing && text.hiddenTextarea) text.hiddenTextarea.focus({ preventScroll: true });
      });
    };
    host.addEventListener('pointerdown', beginInternalPointer, true);
    document.addEventListener('pointerup', endInternalPointer, true);
    document.addEventListener('pointercancel', endInternalPointer, true);
    for (const type of ['mousedown','click','dblclick','contextmenu']) host.addEventListener(type, e => e.stopPropagation());
    text.enterEditing(event);
    text.hiddenTextarea.classList.add('table-text-input');
    text.hiddenTextarea.setAttribute('aria-label', '編輯表格文字');
    if (event) placeCaret(text, event);
    else { text.selectionStart = text.selectionEnd = text._text.length; text._updateTextarea(); refreshCaret(text); }
    text.hiddenTextarea.addEventListener('keydown', e => {
      if (e.isComposing || text.inCompositionMode || e.keyCode === 229) return;
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); }
    });
    // Fabric itself can blur while exiting editing (Escape). Let that lifecycle
    // finish before disposing the overlay canvas it is still clearing.
    text.hiddenTextarea.addEventListener('blur', () => queueMicrotask(() => {
      if (disposed) return;
      if (internalPointer) {
        if (text.isEditing && text.hiddenTextarea) text.hiddenTextarea.focus({ preventScroll: true });
        return;
      }
      commit();
    }));
    return { canvas, text, host, input: text.hiddenTextarea, value: () => text.text,
      dispose(keep) {
        if (disposed) return; disposed = true;
        if (!keep) svgText.textContent = original;
        document.removeEventListener('pointerup', endInternalPointer, true);
        document.removeEventListener('pointercancel', endInternalPointer, true);
        text.exitEditing(); canvas.dispose(); host.remove();
      } };
  }
  window.ASMSlideTableTextEditor = { create };
})();
