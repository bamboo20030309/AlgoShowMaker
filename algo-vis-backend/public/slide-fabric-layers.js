// Fabric objects share one interactive canvas, while widgets are DOM elements.
// Paint lower Fabric bands on transparent sibling canvases so adding a topmost
// text object cannot also lift old backgrounds above every widget.
(function () {
  function install(canvas, getWidgets, bleed) {
    const layers = new Map();
    const renderObjects = canvas._renderObjects;
    const renderBackground = canvas._renderBackground;
    const exportCanvas = canvas.toCanvasElement;
    const dispose = canvas.dispose;
    const drawControls = canvas.drawControls;
    const cursorHooks = new Map();
    let editingLayer = null;
    // Controls and the blinking text caret are editor UI, independent of the
    // object's saved stacking order. Mirror them above the painted bands while
    // retaining Fabric's original event canvas and pointer routing.
    function renderEditingLayer() {
      if (!widgetLevels().length || exporting) { editingLayer?.remove(); editingLayer = null; return; }
      const host = canvas.lowerCanvasEl.closest('.fabric-host');
      if (!host?.parentElement) return;
      if (!editingLayer) {
        editingLayer = document.createElement('canvas');
        editingLayer.className = 'asm-fabric-editing-layer';
        editingLayer.setAttribute('aria-hidden', 'true');
        Object.assign(editingLayer.style, { position: 'absolute', pointerEvents: 'none',
          left: `${-bleed}px`, top: `${-bleed}px`, zIndex: '100001' });
        host.parentElement.appendChild(editingLayer);
      }
      editingLayer.style.width = `${canvas.width}px`; editingLayer.style.height = `${canvas.height}px`;
      if (editingLayer.width !== canvas.lowerCanvasEl.width || editingLayer.height !== canvas.lowerCanvasEl.height) {
        editingLayer.width = canvas.lowerCanvasEl.width; editingLayer.height = canvas.lowerCanvasEl.height;
      }
      const ctx = editingLayer.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, editingLayer.width, editingLayer.height);
      if (canvas.upperCanvasEl) ctx.drawImage(canvas.upperCanvasEl, 0, 0);
      ctx.save(); ctx.scale(editingLayer.width / canvas.width, editingLayer.height / canvas.height);
      const active = canvas.getActiveObject();
      if (!canvas.__asmMixedSelection) drawControls.call(canvas, ctx);
      // IText hides standard controls during editing; retain the editor's
      // explicit resize border without depending on cursor blink timing.
      if (active?.isEditing) active._renderControls(ctx, { hasBorders: true, hasControls: true,
        cornerColor: active.cornerColor, cornerStrokeColor: active.cornerStrokeColor, borderColor: active.borderColor });
      ctx.restore();
    }
    function hookCursor(object) {
      if (!object?.renderCursorOrSelection || cursorHooks.has(object)) return;
      const original = object.renderCursorOrSelection;
      cursorHooks.set(object, original);
      object.renderCursorOrSelection = function (...args) {
        const result = original.apply(this, args);
        if (this.canvas === canvas) renderEditingLayer();
        return result;
      };
    }
    const onObjectAdded = event => hookCursor(event.target);
    canvas.getObjects().forEach(hookCursor);
    const onObjectRemoved = event => {
      const original = cursorHooks.get(event.target);
      if (original) { event.target.renderCursorOrSelection = original; cursorHooks.delete(event.target); }
    };
    canvas.on('object:added', onObjectAdded);
    canvas.on('object:removed', onObjectRemoved);
    canvas.on('after:render', renderEditingLayer);
    canvas.drawControls = function (ctx) {
      if (exporting || !widgetLevels().length) return drawControls.call(this, ctx);
      renderEditingLayer();
    };
    let exporting = false;
    const widgetLevels = () => getWidgets().map((widget, index) => Number.isFinite(Number(widget.layerIndex))
      ? Number(widget.layerIndex) : 2000 + index).sort((a, b) => a - b);
    function clear() { for (const layer of layers.values()) layer.remove(); layers.clear(); }
    canvas._renderBackground = function (ctx) {
      if (exporting || !widgetLevels().length) renderBackground.call(this, ctx);
    };
    canvas._renderObjects = function (ctx, objects) {
      const levels = widgetLevels();
      if (exporting || !levels.length) {
        if (!exporting) clear();
        return renderObjects.call(this, ctx, objects);
      }
      const bands = new Map();
      const top = [];
      objects.forEach((object, index) => {
        const level = Number.isFinite(Number(object.layerIndex)) ? Number(object.layerIndex) : 1000 + index;
        if (level > levels.at(-1)) { top.push(object); return; }
        const key = levels.filter(value => value < level).length;
        if (!bands.has(key)) bands.set(key, { objects: [], level });
        bands.get(key).objects.push(object);
        bands.get(key).level = Math.max(bands.get(key).level, level);
      });
      // Native canvas backgrounds also belong below widgets, never to the
      // highest Fabric object's foreground band.
      if (!bands.has(0)) bands.set(0, { objects: [], level: levels[0] - 1 });
      const host = this.lowerCanvasEl.closest('.fabric-host');
      if (!host?.parentElement) return renderObjects.call(this, ctx, objects);
      for (const [key, band] of bands) {
        let layer = layers.get(key);
        if (!layer) {
          layer = document.createElement('canvas');
          layer.className = 'asm-fabric-render-layer';
          layer.setAttribute('aria-hidden', 'true');
          Object.assign(layer.style, { position: 'absolute', pointerEvents: 'none', left: `${-bleed}px`, top: `${-bleed}px` });
          host.parentElement.appendChild(layer); layers.set(key, layer);
        }
        layer.style.zIndex = String(band.level);
        layer.style.width = `${this.width}px`; layer.style.height = `${this.height}px`;
        if (layer.width !== this.lowerCanvasEl.width || layer.height !== this.lowerCanvasEl.height) {
          layer.width = this.lowerCanvasEl.width; layer.height = this.lowerCanvasEl.height;
        }
        const context = layer.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, layer.width, layer.height);
        const density = layer.width / this.width;
        context.scale(density, density);
        context.imageSmoothingEnabled = this.imageSmoothingEnabled;
        if (key === 0) renderBackground.call(this, context);
        context.save(); context.transform(...this.viewportTransform);
        renderObjects.call(this, context, band.objects); context.restore();
        if (this.clipPath) {
          this.clipPath.canvas = this; this.clipPath.shouldCache(); this.clipPath._transformDone = true;
          this.clipPath.renderCache({ forClipping: true }); this.drawClipPathOnCanvas(context);
        }
      }
      for (const [key, layer] of layers) if (!bands.has(key)) { layer.remove(); layers.delete(key); }
      renderObjects.call(this, ctx, top);
    };
    // Thumbnail/export renderings are single images and must still include all
    // Fabric objects. Splitting is only for the interactive DOM presentation.
    canvas.toCanvasElement = function (...args) {
      exporting = true;
      try { return exportCanvas.apply(this, args); }
      finally { exporting = false; this.requestRenderAll(); }
    };
    canvas.dispose = function (...args) {
      clear(); editingLayer?.remove(); editingLayer = null;
      canvas.off('object:added', onObjectAdded); canvas.off('object:removed', onObjectRemoved);
      canvas.off('after:render', renderEditingLayer);
      for (const [object, original] of cursorHooks) object.renderCursorOrSelection = original;
      cursorHooks.clear(); canvas.drawControls = drawControls;
      return dispose.apply(this, args);
    };
  }
  window.ASMSlideFabricLayers = { install };
})();
