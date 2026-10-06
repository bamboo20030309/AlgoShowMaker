// Native Fabric controls over geometry-only proxies. Content stays in its renderer;
// this editor-only canvas is never part of the saved deck or exported slide.
(function () {
  function create(main, adapter, bleed) {
    const element = document.createElement('canvas');
    const host = main.lowerCanvasEl.closest('.fabric-host');
    host.parentElement.appendChild(element);
    const canvas = new fabric.Canvas(element, { width: main.width, height: main.height,
      selection: false, preserveObjectStacking: true, renderOnAddRemove: false });
    canvas.wrapperEl.classList.add('asm-native-selection-controls');
    Object.assign(canvas.wrapperEl.style, { position:'absolute', left:`${-bleed}px`, top:`${-bleed}px`, zIndex:'100002', pointerEvents:'none' });
    canvas.upperCanvasEl.style.pointerEvents = 'none';
    canvas.setViewportTransform(main.viewportTransform.slice());
    let enabled = false, editing = false, signature = '', initialMatrix;
    const ids = new WeakMap(); let nextId = 0;
    const selectionRect = item => item.kind === 'widget'
      ? window.AlgoStructureRenderer.getWidgetGeometry(item.widget).selection : {};
    const fingerprint = items => JSON.stringify(items.map(item => {
      if (item.kind === 'widget') return ['w',item.widget.id,item.widget.x,item.widget.y,item.widget.w,item.widget.h,item.widget.angle || 0,item.widget.skewX || 0,selectionRect(item)];
      if (!ids.has(item.object)) ids.set(item.object,++nextId);
      return ['f',ids.get(item.object), ...item.object.calcTransformMatrix()].map(v => typeof v==='number' ? Math.round(v*10000)/10000 : v);
    }));
    function sync(items) {
      if (editing) return;
      canvas.setViewportTransform(main.viewportTransform.slice());
      enabled = items.some(item => item.kind === 'widget') && document.body.classList.contains('asm-edit-mode');
      canvas.wrapperEl.hidden = !enabled;
      if (!enabled) return;
      const key = fingerprint(items);
      if (key === signature) return;
      signature = key;
      canvas.discardActiveObject(); canvas.clear();
      const proxies = items.map(item => {
        const box = selectionRect(item);
        const rect = new fabric.Rect({ originX:'center', originY:'center', fill:null, stroke:null, strokeWidth:0,
          width:item.kind==='widget' ? box.width : item.object.width + (item.object.strokeWidth || 0),
          height:item.kind==='widget' ? box.height : item.object.height + (item.object.strokeWidth || 0),
          excludeFromExport:true });
        if (item.kind === 'widget') {
          const center = window.AlgoStructureRenderer.getWidgetGeometry(item.widget).center;
          rect.set({ left:center.x, top:center.y, angle:item.widget.angle || 0, skewX:item.widget.skewX || 0 });
        }
        else {
          const t = fabric.util.qrDecompose(item.object.calcTransformMatrix());
          rect.set({ left:t.translateX, top:t.translateY, angle:t.angle, scaleX:Math.abs(t.scaleX), scaleY:Math.abs(t.scaleY),
            skewX:t.skewX, flipX:t.scaleX<0, flipY:t.scaleY<0 });
        }
        rect.setCoords(); canvas.add(rect); return rect;
      });
      const active = proxies.length===1 ? proxies[0] : new fabric.ActiveSelection(proxies,{canvas});
      adapter.configure(active); canvas.setActiveObject(active); canvas.renderAll();
    }
    const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    let suppressClickUntil = 0;
    function down(e) {
      if (!enabled || e.button!==0 || e.ctrlKey || e.metaKey || e.shiftKey || !adapter.allow(e)) return;
      canvas.calcOffset();
      const active = canvas.getActiveObject();
      const corner = active?._findTargetCorner(canvas.getPointer(e,true));
      if (!corner && !adapter.bodyHit(e)) return;
      adapter.start(); initialMatrix = active.calcTransformMatrix().slice(); editing = true;
      main.__asmNativeSelectionEditing = true;
      canvas._onMouseDown(e); stop(e); return true;
    }
    function move(e) {
      if (!editing) return;
      canvas._onMouseMove(e); stop(e);
    }
    function changed() {
      const active = canvas.getActiveObject();
      const matrix = fabric.util.multiplyTransformMatrices(active.calcTransformMatrix(), fabric.util.invertTransform(initialMatrix));
      adapter.transform(matrix); canvas.renderAll();
    }
    canvas.on('object:moving',changed); canvas.on('object:scaling',changed); canvas.on('object:rotating',changed);
    function up(e) {
      if (!editing) return;
      canvas._onMouseUp(e);
      adapter.end(); signature = fingerprint(adapter.items());
      editing = false; main.__asmNativeSelectionEditing = false;
      suppressClickUntil = performance.now()+250; stop(e);
    }
    const click = e => { if(performance.now()<suppressClickUntil) { suppressClickUntil=0; stop(e); } };
    const mouse = e => { if(editing) stop(e); };
    document.addEventListener('pointerdown',down,true); document.addEventListener('pointermove',move,true);
    document.addEventListener('pointerup',up,true); document.addEventListener('pointercancel',up,true);
    document.addEventListener('mousedown',mouse,true); document.addEventListener('mousemove',mouse,true);
    document.addEventListener('click',click,true);
    return { canvas, sync, down, dispose() {
      document.removeEventListener('pointerdown',down,true); document.removeEventListener('pointermove',move,true);
      document.removeEventListener('pointerup',up,true); document.removeEventListener('pointercancel',up,true);
      document.removeEventListener('mousedown',mouse,true); document.removeEventListener('mousemove',mouse,true);
      document.removeEventListener('click',click,true); canvas.dispose(); canvas.wrapperEl?.remove();
    } };
  }
  window.ASMFabricSelection = {create};
})();
