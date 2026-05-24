(function () {
  const STORAGE_KEY = 'asm_reveal_fabric_deck_v5';
  const OLD_STORAGE_KEY = 'asm_reveal_fabric_deck_v4';
  const SLIDE_W = 1280;
  const SLIDE_H = 720;
  const fabricCanvases = new Map();
  const slidePositions = new Map();
  const MAX_HISTORY = 80;

  const defaultDeck = {
    groups: [
      {
        id: crypto.randomUUID(),
        slides: [
          {
            id: crypto.randomUUID(),
            canvas: {
              objects: [
                {
                  type: 'i-text',
                  left: 116,
                  top: 112,
                  width: 720,
                  text: 'AlgoShowMaker Slides',
                  fill: '#1f282d',
                  fontSize: 48,
                  fontFamily: 'Segoe UI',
                  fontWeight: 'bold',
                  styles: {}
                },
                {
                  type: 'i-text',
                  left: 126,
                  top: 260,
                  width: 700,
                  text: 'Edit directly on the Reveal.js slide. Fabric.js handles object selection, resize, rotate, text, shapes, and pasted images.',
                  fill: '#49545a',
                  fontSize: 28,
                  fontFamily: 'Segoe UI',
                  styles: {}
                },
                {
                  type: 'rect',
                  left: 864,
                  top: 156,
                  width: 230,
                  height: 230,
                  fill: '#dff4ef',
                  stroke: '#1d8f83',
                  strokeWidth: 4,
                  rx: 10,
                  ry: 10,
                  angle: 8
                }
              ]
            }
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        slides: [
          {
            id: crypto.randomUUID(),
            canvas: {
              objects: [
                {
                  type: 'i-text',
                  left: 130,
                  top: 112,
                  width: 680,
                  text: 'Use the left tools to add text, circles, and triangles',
                  fill: '#1f282d',
                  fontSize: 44,
                  fontFamily: 'Segoe UI',
                  fontWeight: 'bold',
                  styles: {}
                },
                {
                  type: 'circle',
                  left: 166,
                  top: 282,
                  radius: 82,
                  fill: '#eee7fb',
                  stroke: '#875bc7',
                  strokeWidth: 4
                },
                {
                  type: 'triangle',
                  left: 444,
                  top: 276,
                  width: 190,
                  height: 170,
                  fill: '#fff2d8',
                  stroke: '#b87927',
                  strokeWidth: 4,
                  angle: -8
                }
              ]
            }
          }
        ]
      }
    ]
  };

  let deck = loadDeck();
  let reveal = null;
  let currentH = 0;
  let currentV = 0;
  let pendingTool = null;
  let suppressCanvasSave = false;
  let suppressHistory = false;
  let activeColorTarget = 'text';
  let iroPicker = null;
  let textSelection = null;
  let selectedWidgetId = null;
  let overviewSelectedSlideId = null;
  let draggedSlideId = null;
  let pointerDrag = null;
  let dropPreview = null;
  let history = [];
  let historyIndex = -1;

  const slidesRoot = document.getElementById('slidesRoot');
  const objectToolbar = document.getElementById('objectToolbar');
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeInput = document.getElementById('fontSizeInput');
  const boldBtn = document.getElementById('boldBtn');
  const italicBtn = document.getElementById('italicBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  const strikeBtn = document.getElementById('strikeBtn');
  const textColorBtn = document.getElementById('textColorBtn');
  const bgColorBtn = document.getElementById('bgColorBtn');
  const shapeColorBtn = document.getElementById('shapeColorBtn');
  const iroPopup = document.getElementById('iroPopup');
  const shapeMenu = document.getElementById('shapeMenu');
  const shapeMenuBtn = document.getElementById('shapeMenuBtn');
  const overviewChrome = document.getElementById('overviewChrome');
  const defaultToolPanel = document.getElementById('defaultToolPanel');
  const latexEditorPanel = document.getElementById('latexEditorPanel');
  const codeEditorPanel = document.getElementById('codeEditorPanel');
  const latexEditorInput = document.getElementById('latexEditorInput');
  const codeEditorInput = document.getElementById('codeEditorInput');
  const codeLanguageSelect = document.getElementById('codeLanguageSelect');
  const latexFontSizeInput = document.getElementById('latexFontSizeInput');
  const codeFontSizeInput = document.getElementById('codeFontSizeInput');

  function f() {
    return window.fabric;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createBlankSlide(title = 'New slide') {
    return {
      id: crypto.randomUUID(),
      canvas: {
        objects: [
          {
            type: 'i-text',
            left: 120,
            top: 112,
            width: 600,
            text: title,
            fill: '#1f282d',
            fontSize: 44,
            fontFamily: 'Segoe UI',
            fontWeight: 'bold',
            styles: {}
          }
        ]
      }
    };
  }

  function normalizeDeck(raw) {
    if (raw && Array.isArray(raw.groups)) {
      raw.groups = raw.groups
        .filter(group => group && Array.isArray(group.slides) && group.slides.length)
        .map(group => ({
          id: group.id || crypto.randomUUID(),
          slides: group.slides.map(slide => ({
            id: slide.id || crypto.randomUUID(),
            canvas: normalizeCanvasJson(slide.canvas),
            widgets: normalizeWidgets(slide.widgets)
          }))
        }));
      return raw.groups.length ? raw : clone(defaultDeck);
    }

    if (raw && Array.isArray(raw.slides)) {
      return {
        groups: raw.slides.map(slide => ({
          id: crypto.randomUUID(),
          slides: [{
            id: slide.id || crypto.randomUUID(),
            canvas: normalizeCanvasJson(slide.canvas),
            widgets: normalizeWidgets(slide.widgets)
          }]
        }))
      };
    }

    return clone(defaultDeck);
  }

  function loadDeck() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
      if (saved) return normalizeDeck(JSON.parse(saved));
    } catch (err) {
      console.warn('Failed to load deck', err);
    }
    return clone(defaultDeck);
  }

  function saveDeck({ history: pushHistory = true } = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
    updateDiagnostics();
    if (pushHistory && !suppressHistory) pushHistorySnapshot();
  }

  function pushHistorySnapshot() {
    const snapshot = JSON.stringify(deck);
    if (history[historyIndex] === snapshot) return;
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    updateDiagnostics();
  }

  function restoreHistory(index) {
    if (index < 0 || index >= history.length) return;
    suppressHistory = true;
    historyIndex = index;
    deck = normalizeDeck(JSON.parse(history[historyIndex]));
    clampPosition();
    saveDeck({ history: false });
    renderDeck();
    suppressHistory = false;
  }

  function undo() {
    restoreHistory(historyIndex - 1);
  }

  function redo() {
    restoreHistory(historyIndex + 1);
  }

  function getGroup(h = currentH) {
    return deck.groups[h];
  }

  function getSlide(h = currentH, v = currentV) {
    const group = getGroup(h);
    return group && group.slides[Math.min(v, group.slides.length - 1)];
  }

  function currentFabricCanvas() {
    const slide = getSlide();
    return slide && fabricCanvases.get(slide.id);
  }

  function normalizeCanvasJson(canvasJson) {
    return {
      version: canvasJson && canvasJson.version,
      objects: (canvasJson && canvasJson.objects) || []
    };
  }

  function normalizeWidgets(widgets) {
    return Array.isArray(widgets) ? widgets.map(widget => ({
      id: widget.id || crypto.randomUUID(),
      type: widget.type === 'code' ? 'code' : 'latex',
      x: Number.isFinite(widget.x) ? widget.x : 160,
      y: Number.isFinite(widget.y) ? widget.y : 160,
      w: Number.isFinite(widget.w) ? widget.w : (widget.type === 'code' ? 560 : 320),
      h: Number.isFinite(widget.h) ? widget.h : (widget.type === 'code' ? 220 : 96),
      language: typeof widget.language === 'string' ? widget.language : 'cpp',
      fontSize: Number.isFinite(widget.fontSize) ? widget.fontSize : (widget.type === 'code' ? 21 : 34),
      manualSize: widget.manualSize === true,
      content: typeof widget.content === 'string' ? widget.content : ''
    })) : [];
  }

  function rebuildPositions() {
    slidePositions.clear();
    deck.groups.forEach((group, h) => {
      group.slides.forEach((slide, v) => {
        slidePositions.set(slide.id, { h, v });
      });
    });
  }

  function clampPosition() {
    currentH = Math.max(0, Math.min(currentH, deck.groups.length - 1));
    const group = getGroup(currentH);
    currentV = Math.max(0, Math.min(currentV, group ? group.slides.length - 1 : 0));
  }

  function renderDeck() {
    disposeCanvases();
    rebuildPositions();
    slidesRoot.innerHTML = '';

    deck.groups.forEach((group, h) => {
      if (group.slides.length === 1) {
        slidesRoot.appendChild(createSlideSection(group.slides[0], h, 0));
        return;
      }

      const stack = document.createElement('section');
      stack.className = 'asm-stack';
      stack.dataset.groupId = group.id;
      group.slides.forEach((slide, v) => {
        stack.appendChild(createSlideSection(slide, h, v));
      });
      slidesRoot.appendChild(stack);
    });

    buildFabricCanvases();
    applyEditMode(document.body.classList.contains('asm-edit-mode'));

    if (reveal) {
      reveal.sync();
      clampPosition();
      reveal.slide(currentH, currentV);
      setTimeout(() => {
        reveal.layout();
        refreshRevealWidgets();
        if (reveal.isOverview && reveal.isOverview()) prepareOverview();
      }, 40);
    }
  }

  function refreshRevealWidgets() {
    if (window.hljs) {
      document.querySelectorAll('.code-widget pre code').forEach(block => {
        block.removeAttribute('data-highlighted');
        window.hljs.highlightElement(block);
      });
    }
    const highlightPlugin = reveal && reveal.getPlugin && reveal.getPlugin('highlight');
    if (highlightPlugin && highlightPlugin.highlightBlock) {
      document.querySelectorAll('.code-widget pre code').forEach(block => highlightPlugin.highlightBlock(block));
    }
    document.body.dataset.highlightApi = highlightPlugin ? Object.keys(highlightPlugin).join(',') : 'missing';
    if (window.renderMathInElement) {
      window.renderMathInElement(slidesRoot, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ]
      });
    }
    autoSizeLatexWidgets();
    if (reveal) reveal.layout();
  }

  function autoSizeLatexWidgets() {
    let changed = false;
    document.querySelectorAll('.latex-widget').forEach(el => {
      if (el.dataset.manualSize === 'true') return;
      const content = el.querySelector('.katex') || el;
      const rect = content.getBoundingClientRect();
      const layerRect = el.closest('.widget-layer').getBoundingClientRect();
      const scaleX = layerRect.width / SLIDE_W;
      const scaleY = layerRect.height / SLIDE_H;
      const width = Math.max(20, rect.width / scaleX);
      const height = Math.max(20, rect.height / scaleY);
      const found = getWidget(el.dataset.widgetId);
      if (!found.widget) return;
      if (Math.abs((found.widget.w || 0) - width) > 0.5 || Math.abs((found.widget.h || 0) - height) > 0.5) changed = true;
      found.widget.w = width;
      found.widget.h = height;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    });
    if (changed) saveDeck({ history: false });
  }

  function createSlideSection(slide, h, v) {
    const section = document.createElement('section');
    section.className = 'asm-slide';
    section.dataset.slideId = slide.id;
    section.dataset.h = String(h);
    section.dataset.v = String(v);
      section.innerHTML = `
        <div class="fabric-host" data-slide-id="${slide.id}">
          <canvas id="fabric-${slide.id}" width="${SLIDE_W}" height="${SLIDE_H}"></canvas>
        </div>
        <div class="widget-layer" data-slide-id="${slide.id}"></div>
      `;
    renderSlideWidgets(section.querySelector('.widget-layer'), slide);
    return section;
  }

  function disposeCanvases() {
    fabricCanvases.forEach(canvas => canvas.dispose());
    fabricCanvases.clear();
  }

  function renderSlideWidgets(layer, slide) {
    if (!layer) return;
    layer.innerHTML = '';
    normalizeWidgets(slide.widgets).forEach(widget => {
      const el = document.createElement('div');
      el.className = `slide-widget ${widget.type}-widget`;
      el.dataset.widgetId = widget.id;
      el.dataset.widgetType = widget.type;
      el.dataset.manualSize = widget.manualSize ? 'true' : 'false';
      el.draggable = false;
      el.style.left = `${widget.x}px`;
      el.style.top = `${widget.y}px`;
      el.style.width = `${widget.w}px`;
      el.style.height = `${widget.h}px`;
      el.style.fontSize = `${widget.fontSize}px`;
      paintWidgetElement(el, widget);
      layer.appendChild(el);
    });
  }

  function paintWidgetElement(el, widget) {
    el.innerHTML = '';
    if (widget.type === 'code') {
      el.innerHTML = `<pre><code class="language-${widget.language || 'cpp'}"></code></pre>`;
      el.querySelector('code').textContent = widget.content || defaultCode();
    } else {
      el.textContent = widget.content || String.raw`\(\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\)`;
    }
    ['top', 'right', 'bottom', 'left'].forEach(edge => {
      const handle = document.createElement('span');
      handle.className = 'widget-edge-handle';
      handle.dataset.resizeEdge = edge;
      el.appendChild(handle);
    });
  }

  async function buildFabricCanvases() {
    document.body.dataset.fabricBuild = 'starting';
    for (const group of deck.groups) {
      for (const slide of group.slides) {
        const el = document.getElementById(`fabric-${slide.id}`);
        if (!el) continue;
        try {
          const Fabric = f();
          const canvas = new Fabric.Canvas(el, {
            width: SLIDE_W,
            height: SLIDE_H,
            backgroundColor: '#fbfcfa',
            preserveObjectStacking: true,
            selection: true,
            stopContextMenu: true,
            uniformScaling: false,
            uniScaleKey: 'shiftKey'
          });

          fabricCanvases.set(slide.id, canvas);
          wireCanvas(canvas, slide);
          await loadSlideCanvas(canvas, slide);
        } catch (err) {
          document.body.dataset.fabricBuild = `failed: ${err.message}`;
          console.error('Fabric canvas initialization failed', err);
          return;
        }
      }
    }
    document.body.dataset.fabricBuild = `ready:${fabricCanvases.size}`;
    updateDiagnostics();
  }

  async function loadSlideCanvas(canvas, slide) {
    const json = normalizeCanvasJson(slide.canvas);
    suppressCanvasSave = true;
    try {
      await new Promise(resolve => {
        canvas.loadFromJSON(json, () => {
          canvas.getObjects().forEach(configureObject);
          canvas.renderAll();
          resolve();
        });
      });
    } finally {
      suppressCanvasSave = false;
    }
  }

  function wireCanvas(canvas, slide) {
    const sync = () => {
      if (suppressCanvasSave) return;
      slide.canvas = canvas.toJSON();
      saveDeck();
      updateObjectToolbar(canvas.getActiveObject(), canvas);
    };
    canvas.on('object:added', sync);
    canvas.on('object:modified', sync);
    canvas.on('object:removed', sync);
    canvas.on('text:changed', sync);
    canvas.on('selection:created', e => {
      exitWidgetEditorIfNeeded();
      updateObjectToolbar(e.selected && e.selected[0], canvas);
    });
    canvas.on('selection:updated', e => {
      exitWidgetEditorIfNeeded();
      updateObjectToolbar(e.selected && e.selected[0], canvas);
    });
    canvas.on('selection:cleared', () => hideObjectToolbar());
    canvas.on('object:moving', e => updateObjectToolbar(e.target, canvas));
    canvas.on('object:scaling', e => updateObjectToolbar(e.target, canvas));
    canvas.on('object:rotating', e => updateObjectToolbar(e.target, canvas));
    canvas.on('mouse:up', () => updateObjectToolbar(canvas.getActiveObject(), canvas));
    canvas.on('text:selection:changed', e => updateObjectToolbar(e.target, canvas));
    canvas.on('text:editing:entered', e => updateObjectToolbar(e.target, canvas));
    canvas.on('text:editing:exited', () => {
      textSelection = null;
      hideObjectToolbar();
    });
  }

  function configureObject(obj) {
    obj.set({
      cornerColor: '#1d8f83',
      cornerStrokeColor: '#ffffff',
      borderColor: '#1d8f83',
      cornerStyle: 'circle',
      transparentCorners: false,
      padding: 6
    });
  }

  function addObject(kind, point) {
    if (kind === 'latex' || kind === 'code') {
      addWidget(kind, point);
      return;
    }

    const canvas = currentFabricCanvas();
    document.body.dataset.lastTool = kind;
    if (!canvas) {
      document.body.dataset.lastToolStatus = 'missing-canvas';
      return;
    }
    const left = Math.max(24, Math.min(point.x - 100, SLIDE_W - 240));
    const top = Math.max(24, Math.min(point.y - 50, SLIDE_H - 160));
    let obj = null;

    try {
      if (kind === 'text') {
        const Fabric = f();
        const TextClass = Fabric.IText || Fabric.Text || Fabric.Textbox;
        obj = new TextClass('New text', {
          left,
          top,
          width: 360,
          fontSize: 34,
          fontFamily: 'Segoe UI',
          fontWeight: 'bold',
          fill: '#1f282d',
          styles: {}
        });
      } else {
        obj = createShape(kind, left, top);
      }
    } catch (err) {
      document.body.dataset.lastToolStatus = `failed:${err.message}`;
      console.error('Failed to add Fabric object', err);
      return;
    }

    if (!obj) {
      document.body.dataset.lastToolStatus = 'no-object';
      return;
    }

    try {
      configureObject(obj);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      syncCurrentSlideCanvas();
      updateObjectToolbar(obj, canvas);
      pendingTool = null;
      updateArmedTool();
      document.body.dataset.lastToolStatus = `added:${kind}`;
    } catch (err) {
      document.body.dataset.lastToolStatus = `failed-add:${err.message}`;
      console.error('Failed to attach Fabric object', err);
    }
  }

  function defaultCode() {
    return [
      '#include <bits/stdc++.h>',
      'using namespace std;',
      '',
      'int main() {',
      '    cout << "AlgoShowMaker";',
      '    return 0;',
      '}'
    ].join('\n');
  }

  function addWidget(type, point) {
    const slide = getSlide();
    if (!slide) return;
    slide.widgets = normalizeWidgets(slide.widgets);
    const widget = {
      id: crypto.randomUUID(),
      type,
      x: Math.max(24, Math.min(point.x - 120, SLIDE_W - 360)),
      y: Math.max(24, Math.min(point.y - 54, SLIDE_H - 180)),
      w: type === 'code' ? 560 : 360,
      h: type === 'code' ? 230 : 104,
      language: 'cpp',
      fontSize: type === 'code' ? 21 : 34,
      content: type === 'code' ? defaultCode() : String.raw`\(\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\)`
    };
    slide.widgets.push(widget);
    saveDeck();
    pendingTool = null;
    updateArmedTool();
    document.body.dataset.lastToolStatus = `added:${type}`;
    renderDeck();
    setTimeout(() => selectWidget(widget.id), 80);
  }

  function createShape(shape, left, top) {
    const fill = shape === 'triangle' ? '#fff2d8' : '#eee7fb';
    const stroke = shape === 'triangle' ? '#b87927' : '#875bc7';
    const Fabric = f();
    if (shape === 'triangle') {
      return new Fabric.Triangle({
        left,
        top,
        width: 190,
        height: 170,
        fill,
        stroke,
        strokeWidth: 4
      });
    }
    return new Fabric.Circle({
      left,
      top,
      radius: 82,
      fill,
      stroke,
      strokeWidth: 4
    });
  }

  function insertImageFromDataUrl(src, left, top) {
    const canvas = currentFabricCanvas();
    const Fabric = f();
    const ImageClass = Fabric.FabricImage || Fabric.Image;
    if (!canvas || !ImageClass) return;

    const img = new Image();
    img.onload = () => {
      const obj = new ImageClass(img, { left, top });
      obj.scaleToWidth(320);
      configureObject(obj);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      syncCurrentSlideCanvas();
      updateObjectToolbar(obj, canvas);
    };
    img.src = src;
  }

  function syncCurrentSlideCanvas() {
    const canvas = currentFabricCanvas();
    const slide = getSlide();
    if (!canvas || !slide) return;
    slide.canvas = canvas.toJSON();
    saveDeck();
  }

  function getWidget(widgetId) {
    for (const group of deck.groups) {
      for (const slide of group.slides) {
        slide.widgets = normalizeWidgets(slide.widgets);
        const widget = slide.widgets.find(item => item.id === widgetId);
        if (widget) return { slide, widget };
      }
    }
    return {};
  }

  function selectWidget(widgetId) {
    selectedWidgetId = widgetId;
    document.querySelectorAll('.slide-widget.is-selected').forEach(el => el.classList.remove('is-selected'));
    const el = document.querySelector(`.slide-widget[data-widget-id="${widgetId}"]`);
    if (el) el.classList.add('is-selected');
    showWidgetEditor(widgetId);
  }

  function clearWidgetSelection() {
    selectedWidgetId = null;
    document.querySelectorAll('.slide-widget.is-selected').forEach(el => el.classList.remove('is-selected'));
    showDefaultPanel();
  }

  function showDefaultPanel() {
    defaultToolPanel.hidden = false;
    latexEditorPanel.hidden = true;
    codeEditorPanel.hidden = true;
  }

  function showWidgetEditor(widgetId) {
    const found = getWidget(widgetId);
    if (!found.widget) return;
    defaultToolPanel.hidden = true;
    latexEditorPanel.hidden = found.widget.type !== 'latex';
    codeEditorPanel.hidden = found.widget.type !== 'code';
    if (found.widget.type === 'latex') {
      latexFontSizeInput.value = Math.round(found.widget.fontSize || 34);
      latexEditorInput.value = found.widget.content;
    } else {
      codeLanguageSelect.value = found.widget.language || 'cpp';
      codeFontSizeInput.value = Math.round(found.widget.fontSize || 21);
      codeEditorInput.value = found.widget.content;
    }
  }

  function updateSelectedWidget(patch) {
    if (!selectedWidgetId) return;
    const found = getWidget(selectedWidgetId);
    if (!found.widget) return;
    if (found.widget.type === 'latex' && ('content' in patch || 'fontSize' in patch)) {
      patch.manualSize = false;
    }
    Object.assign(found.widget, patch);
    saveDeck();
    const el = document.querySelector(`.slide-widget[data-widget-id="${selectedWidgetId}"]`);
    if (el) {
      el.style.left = `${found.widget.x}px`;
      el.style.top = `${found.widget.y}px`;
      el.style.width = `${found.widget.w}px`;
      el.style.height = `${found.widget.h}px`;
      el.style.fontSize = `${found.widget.fontSize}px`;
      el.dataset.manualSize = found.widget.manualSize ? 'true' : 'false';
      updateWidgetContentElement(el, found.widget);
      el.classList.add('is-selected');
      refreshRevealWidgets();
    }
  }

  function updateWidgetContentElement(el, widget) {
    if (widget.type === 'code') {
      let code = el.querySelector('code');
      if (!code) {
        paintWidgetElement(el, widget);
        return;
      }
      code.removeAttribute('data-highlighted');
      code.className = `language-${widget.language || 'cpp'}`;
      code.textContent = widget.content || defaultCode();
    } else {
      Array.from(el.childNodes).forEach(node => {
        if (!(node.nodeType === Node.ELEMENT_NODE && node.classList.contains('widget-edge-handle'))) node.remove();
      });
      el.insertBefore(document.createTextNode(widget.content || String.raw`\(\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\)`), el.firstChild);
    }
  }

  function deleteSelectedWidget() {
    const widgetId = selectedWidgetId || document.querySelector('.slide-widget.is-selected')?.dataset.widgetId;
    if (!widgetId) return false;
    const found = getWidget(widgetId);
    if (!found.slide) return false;
    found.slide.widgets = normalizeWidgets(found.slide.widgets).filter(widget => widget.id !== widgetId);
    selectedWidgetId = null;
    showDefaultPanel();
    saveDeck();
    renderDeck();
    return true;
  }

  function slidePointFromEvent(event) {
    const slide = getSlide();
    const host = slide && document.querySelector(`.fabric-host[data-slide-id="${slide.id}"]`);
    if (!host) return { x: SLIDE_W / 2, y: SLIDE_H / 2 };
    const rect = host.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SLIDE_W,
      y: ((event.clientY - rect.top) / rect.height) * SLIDE_H
    };
  }

  function applyEditMode(enabled) {
    fabricCanvases.forEach(canvas => {
      canvas.selection = enabled;
      canvas.skipTargetFind = !enabled;
      canvas.getObjects().forEach(obj => {
        obj.selectable = enabled;
        obj.evented = enabled;
        obj.hasControls = enabled;
        obj.hasBorders = enabled;
      });
      if (!enabled) canvas.discardActiveObject();
      canvas.requestRenderAll();
    });
    if (!enabled) hideObjectToolbar();
  }

  function setEditMode(enabled) {
    document.body.classList.toggle('asm-edit-mode', enabled);
    document.getElementById('editModeBtn').classList.toggle('is-active', enabled);
    document.getElementById('presentModeBtn').classList.toggle('is-active', !enabled);
    applyEditMode(enabled);
    if (reveal) setTimeout(() => reveal.layout(), 20);
  }

  function bindChrome() {
    document.getElementById('editModeBtn').addEventListener('click', () => setEditMode(true));
    document.getElementById('presentModeBtn').addEventListener('click', () => setEditMode(false));
    document.getElementById('addSlideBtn').addEventListener('click', addSlideNearCurrent);

    shapeMenuBtn.addEventListener('click', event => {
      event.stopPropagation();
      shapeMenu.hidden = !shapeMenu.hidden;
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('.shape-tool')) shapeMenu.hidden = true;
    });

    document.querySelectorAll('[data-tool]').forEach(item => {
      item.addEventListener('dragstart', event => {
        const tool = item.dataset.tool === 'shape' ? item.dataset.shape : item.dataset.tool;
        event.dataTransfer.setData('application/x-asm-tool', tool);
        event.dataTransfer.effectAllowed = 'copy';
      });
      item.addEventListener('click', () => {
        exitWidgetEditorIfNeeded();
        const tool = item.dataset.tool === 'shape' ? item.dataset.shape : item.dataset.tool;
        pendingTool = pendingTool === tool ? null : tool;
        updateArmedTool();
        shapeMenu.hidden = true;
        flashHint(pendingTool ? '在投影片上點一下來放置物件。' : '已取消放置工具。');
      });
    });

    document.getElementById('exitLatexEditorBtn').addEventListener('click', clearWidgetSelection);
    document.getElementById('exitCodeEditorBtn').addEventListener('click', clearWidgetSelection);
    latexEditorInput.addEventListener('input', () => updateSelectedWidget({ content: latexEditorInput.value }));
    codeEditorInput.addEventListener('input', () => updateSelectedWidget({ content: codeEditorInput.value }));
    codeLanguageSelect.addEventListener('change', () => updateSelectedWidget({ language: codeLanguageSelect.value }));
    latexFontSizeInput.addEventListener('input', () => updateSelectedWidget({ fontSize: Number(latexFontSizeInput.value) || 34 }));
    codeFontSizeInput.addEventListener('input', () => updateSelectedWidget({ fontSize: Number(codeFontSizeInput.value) || 21 }));
    document.querySelectorAll('[data-insert]').forEach(button => {
      button.addEventListener('click', () => insertAtCursor(latexEditorInput, button.dataset.insert));
    });

    objectToolbar.addEventListener('mousedown', event => {
      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'SELECT') event.preventDefault();
    });

    fontFamilySelect.addEventListener('change', () => applyTextStyle({ fontFamily: fontFamilySelect.value }));
    fontSizeInput.addEventListener('input', () => applyTextStyle({ fontSize: Number(fontSizeInput.value) || 34 }));
    boldBtn.addEventListener('click', () => toggleTextStyle('fontWeight', 'bold', 'normal'));
    italicBtn.addEventListener('click', () => toggleTextStyle('fontStyle', 'italic', 'normal'));
    underlineBtn.addEventListener('click', () => toggleTextStyle('underline', true, false));
    strikeBtn.addEventListener('click', () => toggleTextStyle('linethrough', true, false));
    textColorBtn.addEventListener('click', () => openIro('text'));
    bgColorBtn.addEventListener('click', () => openIro('background'));
    shapeColorBtn.addEventListener('click', () => openIro('shape'));
  }

  function insertAtCursor(input, text) {
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
    input.focus();
    input.selectionStart = input.selectionEnd = start + text.length;
    updateSelectedWidget({ content: input.value });
  }

  function updateArmedTool() {
    document.querySelectorAll('[data-tool]').forEach(item => {
      const tool = item.dataset.tool === 'shape' ? item.dataset.shape : item.dataset.tool;
      item.classList.toggle('is-armed', tool === pendingTool);
    });
    shapeMenuBtn.classList.toggle('is-armed', pendingTool === 'circle' || pendingTool === 'triangle');
  }

  function bindSlideDrop() {
    let widgetDrag = null;

    const beginWidgetDrag = event => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      if (selectedWidgetId && !event.target.closest('.slide-widget') && pointHitsFabricObject(event)) {
        exitWidgetEditorIfNeeded();
      }
      const widgetEl = event.target.closest && event.target.closest('.slide-widget');
      if (!widgetEl || event.button !== 0 || reveal?.isOverview?.() || widgetDrag) return;
      event.stopPropagation();
      event.preventDefault();
      if (event.pointerId != null && widgetEl.setPointerCapture) {
        try {
          widgetEl.setPointerCapture(event.pointerId);
        } catch (err) {
          // Pointer capture is best-effort; document-level listeners still track movement.
        }
      }
      selectWidget(widgetEl.dataset.widgetId);
      const found = getWidget(widgetEl.dataset.widgetId);
      if (!found.widget) return;
      const layerRect = widgetEl.closest('.widget-layer').getBoundingClientRect();
      const scaleX = layerRect.width / SLIDE_W;
      const scaleY = layerRect.height / SLIDE_H;
      widgetDrag = {
        widgetId: widgetEl.dataset.widgetId,
        mode: event.target.dataset.resizeEdge ? 'resize' : 'move',
        edge: event.target.dataset.resizeEdge || null,
        startX: event.clientX,
        startY: event.clientY,
        originalX: found.widget.x,
        originalY: found.widget.y,
        originalW: found.widget.w,
        originalH: found.widget.h,
        scaleX,
        scaleY,
        moved: false
      };
    };

    const updateWidgetDrag = event => {
      if (!widgetDrag) return;
      event.preventDefault();
      event.stopPropagation();
      const found = getWidget(widgetDrag.widgetId);
      if (!found.widget) return;
      const clientX = Number.isFinite(event.clientX) ? event.clientX : (Number.isFinite(event.pageX) ? event.pageX : widgetDrag.startX);
      const clientY = Number.isFinite(event.clientY) ? event.clientY : (Number.isFinite(event.pageY) ? event.pageY : widgetDrag.startY);
      const dx = (clientX - widgetDrag.startX) / widgetDrag.scaleX;
      const dy = (clientY - widgetDrag.startY) / widgetDrag.scaleY;
      if (Math.abs(dx) + Math.abs(dy) > 2) widgetDrag.moved = true;
      if (widgetDrag.mode === 'resize') {
        resizeWidgetFromEdge(found.widget, widgetDrag, dx, dy);
        if (found.widget.type === 'latex') found.widget.manualSize = true;
      } else {
        found.widget.x = Math.max(0, Math.min(widgetDrag.originalX + dx, SLIDE_W - found.widget.w));
        found.widget.y = Math.max(0, Math.min(widgetDrag.originalY + dy, SLIDE_H - found.widget.h));
      }
      const el = document.querySelector(`.slide-widget[data-widget-id="${widgetDrag.widgetId}"]`);
      if (el) {
        el.style.left = `${found.widget.x}px`;
        el.style.top = `${found.widget.y}px`;
        el.style.width = `${found.widget.w}px`;
        el.style.height = `${found.widget.h}px`;
      }
    };

    const endWidgetDrag = event => {
      if (!widgetDrag) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (widgetDrag.moved) {
        saveDeck();
        refreshRevealWidgets();
      }
      widgetDrag = null;
    };

    slidesRoot.addEventListener('mousedown', event => {
      beginWidgetDrag(event);
    }, true);
    document.addEventListener('mousedown', event => beginWidgetDrag(event), true);

    document.addEventListener('mousemove', event => {
      updateWidgetDrag(event);
    }, true);

    document.addEventListener('mouseup', () => {
      endWidgetDrag();
    }, true);

    slidesRoot.addEventListener('pointerdown', event => beginWidgetDrag(event), true);
    document.addEventListener('pointerdown', event => beginWidgetDrag(event), true);
    document.addEventListener('pointermove', event => updateWidgetDrag(event), true);
    document.addEventListener('pointerup', event => endWidgetDrag(event), true);

    ['dragstart', 'selectstart'].forEach(type => {
      slidesRoot.addEventListener(type, event => {
        if (event.target.closest && event.target.closest('.slide-widget')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
    });

    function resizeWidgetFromEdge(widget, drag, dx, dy) {
      const minW = 120;
      const minH = 52;
      if (drag.edge === 'right') {
        widget.w = Math.max(minW, Math.min(drag.originalW + dx, SLIDE_W - widget.x));
      }
      if (drag.edge === 'bottom') {
        widget.h = Math.max(minH, Math.min(drag.originalH + dy, SLIDE_H - widget.y));
      }
      if (drag.edge === 'left') {
        const opposite = drag.originalX + drag.originalW;
        const nextX = Math.max(0, Math.min(drag.originalX + dx, opposite - minW));
        widget.x = nextX;
        widget.w = opposite - nextX;
      }
      if (drag.edge === 'top') {
        const opposite = drag.originalY + drag.originalH;
        const nextY = Math.max(0, Math.min(drag.originalY + dy, opposite - minH));
        widget.y = nextY;
        widget.h = opposite - nextY;
      }
    }

    slidesRoot.addEventListener('dblclick', event => {
      const widgetEl = event.target.closest('.slide-widget');
      if (!widgetEl || reveal?.isOverview?.()) return;
      event.stopPropagation();
      selectWidget(widgetEl.dataset.widgetId);
    });

    slidesRoot.addEventListener('dragover', event => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      if (!event.dataTransfer.types.includes('application/x-asm-tool')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });

    slidesRoot.addEventListener('drop', event => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      const tool = event.dataTransfer.getData('application/x-asm-tool');
      if (!tool) return;
      event.preventDefault();
      addObject(tool, slidePointFromEvent(event));
    });

    slidesRoot.addEventListener('click', event => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      if (!pendingTool) return;
      const targetCanvas = event.target.closest('.upper-canvas, .lower-canvas, .fabric-host');
      if (!targetCanvas) return;
      exitWidgetEditorIfNeeded();
      addObject(pendingTool, slidePointFromEvent(event));
    });

    document.addEventListener('paste', event => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      const items = Array.from(event.clipboardData && event.clipboardData.items || []);
      const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
      if (!imageItem) return;
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => insertImageFromDataUrl(reader.result, SLIDE_W / 2 - 160, SLIDE_H / 2 - 100);
      reader.readAsDataURL(file);
    });

    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (!document.body.classList.contains('asm-edit-mode')) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      if (deleteSelectedWidget()) {
        event.preventDefault();
        return;
      }

      if (reveal && reveal.isOverview && reveal.isOverview()) {
        event.preventDefault();
        deleteOverviewSelectedSlide();
        return;
      }

      const canvas = currentFabricCanvas();
      if (!canvas || isTypingInFabric(canvas)) return;
      const active = canvas.getActiveObjects();
      if (!active.length) return;
      active.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      syncCurrentSlideCanvas();
    });

    document.addEventListener('keyup', event => {
      if (event.target.closest && event.target.closest('#objectToolbar')) return;
      const canvas = currentFabricCanvas();
      if (canvas) updateObjectToolbar(canvas.getActiveObject(), canvas);
    });

    document.addEventListener('mouseup', event => {
      if (event.target.closest && event.target.closest('#objectToolbar')) return;
      const canvas = currentFabricCanvas();
      if (canvas) updateObjectToolbar(canvas.getActiveObject(), canvas);
    });
  }

  function isTypingInFabric(canvas) {
    const active = canvas.getActiveObject();
    return !!(active && active.isEditing);
  }

  function getTextTarget() {
    const canvas = currentFabricCanvas();
    const active = canvas && canvas.getActiveObject();
    if (active && isTextObject(active) && active.selectionStart !== active.selectionEnd) {
      textSelection = { object: active, start: active.selectionStart, end: active.selectionEnd };
      return { canvas, object: active, start: active.selectionStart, end: active.selectionEnd };
    }
    if (canvas && textSelection && textSelection.object && canvas.getObjects().includes(textSelection.object)) {
      return { canvas, object: textSelection.object, start: textSelection.start, end: textSelection.end };
    }
    return {};
  }

  function applyShapeColor(color) {
    const canvas = currentFabricCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || isTextObject(active) || isImageObject(active)) return;
    active.set('fill', color);
    canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(active, canvas);
  }

  function updateObjectToolbar(obj, canvas) {
    if (!obj || !document.body.classList.contains('asm-edit-mode')) {
      hideObjectToolbar();
      return;
    }
    if (isImageObject(obj)) {
      hideObjectToolbar();
      return;
    }
    if (isTextObject(obj)) {
      if (!obj.isEditing || obj.selectionStart === obj.selectionEnd) {
        hideObjectToolbar();
        return;
      }
      textSelection = { object: obj, start: obj.selectionStart, end: obj.selectionEnd };
    }

    objectToolbar.classList.toggle('is-shape', !isTextObject(obj));
    if (isTextObject(obj)) {
      const style = getTextSelectionStyle(obj);
      fontFamilySelect.value = style.fontFamily || obj.fontFamily || 'Segoe UI';
      fontSizeInput.value = Math.round(style.fontSize || obj.fontSize || 34);
      boldBtn.classList.toggle('is-active', (style.fontWeight || obj.fontWeight) === 'bold');
      italicBtn.classList.toggle('is-active', (style.fontStyle || obj.fontStyle) === 'italic');
      underlineBtn.classList.toggle('is-active', !!(style.underline ?? obj.underline));
      strikeBtn.classList.toggle('is-active', !!(style.linethrough ?? obj.linethrough));
    } else {
      shapeColorBtn.style.color = normalizeColor(obj.fill || '#eee7fb');
    }
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const bounds = obj.getBoundingRect(true, true);
    const scaleX = rect.width / SLIDE_W;
    const scaleY = rect.height / SLIDE_H;
    objectToolbar.hidden = false;
    objectToolbar.style.left = `${rect.left + (bounds.left + bounds.width / 2) * scaleX}px`;
    objectToolbar.style.top = `${Math.max(8, rect.top + bounds.top * scaleY - 48)}px`;
    objectToolbar.style.transform = 'translateX(-50%)';
  }

  function hideObjectToolbar() {
    objectToolbar.hidden = true;
    iroPopup.hidden = true;
  }

  function exitWidgetEditorIfNeeded() {
    if (!selectedWidgetId) return;
    clearWidgetSelection();
  }

  function pointHitsFabricObject(event) {
    const canvas = currentFabricCanvas();
    if (!canvas || !canvas.upperCanvasEl) return false;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SLIDE_W;
    const y = ((event.clientY - rect.top) / rect.height) * SLIDE_H;
    return canvas.getObjects().some(obj => {
      if (!obj.visible) return false;
      const bounds = obj.getBoundingRect(true, true);
      return x >= bounds.left && x <= bounds.left + bounds.width && y >= bounds.top && y <= bounds.top + bounds.height;
    });
  }

  function isTextObject(obj) {
    return !!(obj && obj.type && obj.type.toLowerCase().includes('text'));
  }

  function isImageObject(obj) {
    return !!(obj && obj.type && obj.type.toLowerCase().includes('image'));
  }

  function getTextSelectionStyle(obj) {
    if (!obj || !obj.getSelectionStyles || obj.selectionStart === obj.selectionEnd) return {};
    return obj.getSelectionStyles(obj.selectionStart, obj.selectionEnd)[0] || {};
  }

  function applyTextStyle(style) {
    const target = getTextTarget();
    if (!target.canvas || !target.object || target.start === target.end) return;
    if (target.object.setSelectionStyles) {
      target.object.setSelectionStyles(style, target.start, target.end);
    }
    target.canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(target.object, target.canvas);
  }

  function toggleTextStyle(key, onValue, offValue) {
    const target = getTextTarget();
    if (!target.object || target.start === target.end) return;
    const style = getTextSelectionStyle(target.object);
    const current = style[key] ?? target.object[key];
    applyTextStyle({ [key]: current === onValue ? offValue : onValue });
  }

  function openIro(target) {
    activeColorTarget = target;
    iroPopup.hidden = !iroPopup.hidden && activeColorTarget === target;
    if (iroPopup.hidden) return;
    if (!iroPicker) {
      iroPicker = new window.iro.ColorPicker('#iroPicker', {
        width: 150,
        color: 'rgba(31, 40, 45, 1)',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        layout: [
          { component: window.iro.ui.Box },
          { component: window.iro.ui.Slider, options: { sliderType: 'hue', sliderHeight: 20, handleRadius: 8 } },
          { component: window.iro.ui.Slider, options: { sliderType: 'alpha', sliderHeight: 20, handleRadius: 8 } }
        ]
      });
      iroPicker.on('color:change', color => {
        const value = color.rgbaString;
        if (activeColorTarget === 'shape') {
          applyShapeColor(value);
        } else if (activeColorTarget === 'text') {
          applyTextStyle({ fill: value });
        } else {
          applyTextStyle({ textBackgroundColor: value });
        }
      });
    }
    const canvas = currentFabricCanvas();
    const active = canvas && canvas.getActiveObject();
    const style = active && isTextObject(active) ? getTextSelectionStyle(active) : {};
    const current = activeColorTarget === 'shape'
      ? (active?.fill || 'rgba(238, 231, 251, 1)')
      : activeColorTarget === 'text'
        ? (style.fill || active?.fill || 'rgba(31, 40, 45, 1)')
        : (style.textBackgroundColor || 'rgba(255, 255, 255, 1)');
    iroPicker.color.set(normalizeColor(current));
  }

  function normalizeColor(value) {
    if (typeof value !== 'string') return '#1f282d';
    if (value.startsWith('rgba') || value.startsWith('rgb')) return value;
    if (!value.startsWith('#')) return '#1f282d';
    if (value.length === 4) {
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return value.slice(0, 7);
  }

  function addSlideNearCurrent() {
    const group = getGroup();
    if (!group) return;
    const slide = createBlankSlide();
    if (group.slides.length > 1 || currentV > 0) {
      group.slides.splice(currentV + 1, 0, slide);
      currentV += 1;
    } else {
      deck.groups.splice(currentH + 1, 0, {
        id: crypto.randomUUID(),
        slides: [slide]
      });
      currentH += 1;
      currentV = 0;
    }
    overviewSelectedSlideId = slide.id;
    saveDeck();
    renderDeck();
  }

  function deleteOverviewSelectedSlide() {
    const slideId = overviewSelectedSlideId || getSlide()?.id;
    if (!slideId || totalSlides() <= 1) return;
    const pos = slidePositions.get(slideId);
    if (!pos) return;
    deck.groups[pos.h].slides.splice(pos.v, 1);
    if (!deck.groups[pos.h].slides.length) deck.groups.splice(pos.h, 1);
    currentH = Math.min(pos.h, deck.groups.length - 1);
    currentV = 0;
    overviewSelectedSlideId = getSlide()?.id || null;
    saveDeck();
    renderDeck();
  }

  function totalSlides() {
    return deck.groups.reduce((sum, group) => sum + group.slides.length, 0);
  }

  function removeSlideById(slideId) {
    const pos = slidePositions.get(slideId);
    if (!pos) return null;
    const [slide] = deck.groups[pos.h].slides.splice(pos.v, 1);
    if (!deck.groups[pos.h].slides.length) deck.groups.splice(pos.h, 1);
    rebuildPositions();
    return slide;
  }

  function moveSlide(sourceId, targetId, side) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    let targetPos = slidePositions.get(targetId);
    if (!targetPos) return;
    const moved = removeSlideById(sourceId);
    if (!moved) return;
    targetPos = slidePositions.get(targetId);
    if (!targetPos) return;

    if (side === 'left' || side === 'right') {
      const insertAt = targetPos.h + (side === 'right' ? 1 : 0);
      deck.groups.splice(insertAt, 0, { id: crypto.randomUUID(), slides: [moved] });
      currentH = insertAt;
      currentV = 0;
    } else {
      const group = deck.groups[targetPos.h];
      const insertAt = targetPos.v + (side === 'down' ? 1 : 0);
      group.slides.splice(insertAt, 0, moved);
      currentH = targetPos.h;
      currentV = insertAt;
    }

    overviewSelectedSlideId = moved.id;
    saveDeck();
    renderDeck();
  }

  function bindOverviewEvents() {
    reveal.on('overviewshown', () => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      overviewChrome.hidden = false;
      hideObjectToolbar();
      overviewSelectedSlideId = getSlide()?.id || overviewSelectedSlideId;
      flashHint('拖曳投影片到目標的上、下、左、右來排序。');
      fabricCanvases.forEach(canvas => {
        canvas.skipTargetFind = true;
        canvas.discardActiveObject();
      });
      prepareOverview();
    });

    reveal.on('overviewhidden', () => {
      overviewChrome.hidden = true;
      clearDropPreview();
      applyEditMode(document.body.classList.contains('asm-edit-mode'));
    });
  }

  function prepareOverview() {
    document.querySelectorAll('section.asm-slide').forEach(section => {
      section.draggable = true;
      section.classList.toggle('is-overview-selected', section.dataset.slideId === overviewSelectedSlideId);
    });
  }

  function bindOverviewDrag() {
    slidesRoot.addEventListener('click', event => {
      if (!reveal || !reveal.isOverview || !reveal.isOverview()) return;
      const section = event.target.closest('section.asm-slide');
      if (!section) return;
      overviewSelectedSlideId = section.dataset.slideId;
      const pos = slidePositions.get(overviewSelectedSlideId);
      if (pos) {
        currentH = pos.h;
        currentV = pos.v;
        reveal.slide(pos.h, pos.v);
      }
      prepareOverview();
    });

    slidesRoot.addEventListener('dragstart', event => {
      if (!reveal || !reveal.isOverview || !reveal.isOverview()) return;
      const section = event.target.closest('section.asm-slide');
      if (!section) return;
      draggedSlideId = section.dataset.slideId;
      event.dataTransfer.setData('application/x-asm-slide', draggedSlideId);
      event.dataTransfer.effectAllowed = 'move';
    });

    slidesRoot.addEventListener('dragover', event => {
      if (!reveal || !reveal.isOverview || !reveal.isOverview()) return;
      if (!event.dataTransfer.types.includes('application/x-asm-slide')) return;
      const section = event.target.closest('section.asm-slide');
      if (!section || section.dataset.slideId === draggedSlideId) return;
      event.preventDefault();
      const side = dropSide(event, section);
      showDropPreview(section, side);
    });

    slidesRoot.addEventListener('dragleave', event => {
      if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) clearDropPreview();
    });

    slidesRoot.addEventListener('drop', event => {
      if (!reveal || !reveal.isOverview || !reveal.isOverview()) return;
      const section = event.target.closest('section.asm-slide');
      const sourceId = event.dataTransfer.getData('application/x-asm-slide') || draggedSlideId;
      if (!section || !sourceId) return;
      event.preventDefault();
      const side = dropSide(event, section);
      clearDropPreview();
      moveSlide(sourceId, section.dataset.slideId, side);
      draggedSlideId = null;
    });

    slidesRoot.addEventListener('dragend', () => {
      draggedSlideId = null;
      clearDropPreview();
    });

    slidesRoot.addEventListener('mousedown', event => {
      if (!reveal || !reveal.isOverview || !reveal.isOverview()) return;
      const section = event.target.closest('section.asm-slide');
      if (!section || event.button !== 0) return;
      pointerDrag = {
        sourceId: section.dataset.slideId,
        startX: event.clientX,
        startY: event.clientY,
        active: false
      };
    });

    document.addEventListener('mousemove', event => {
      if (!pointerDrag || !reveal || !reveal.isOverview || !reveal.isOverview()) return;
      const moved = Math.abs(event.clientX - pointerDrag.startX) + Math.abs(event.clientY - pointerDrag.startY);
      if (moved < 8) return;
      pointerDrag.active = true;
      const section = overviewSlideFromPoint(event.clientX, event.clientY);
      if (!section || section.dataset.slideId === pointerDrag.sourceId) {
        clearDropPreview();
        return;
      }
      showDropPreview(section, dropSide(event, section));
    });

    document.addEventListener('mouseup', event => {
      if (!pointerDrag) return;
      const drag = pointerDrag;
      pointerDrag = null;
      if (!drag.active || !reveal || !reveal.isOverview || !reveal.isOverview()) return;
      const section = overviewSlideFromPoint(event.clientX, event.clientY);
      if (!section || section.dataset.slideId === drag.sourceId) {
        clearDropPreview();
        return;
      }
      const side = dropSide(event, section);
      clearDropPreview();
      moveSlide(drag.sourceId, section.dataset.slideId, side);
    });
  }

  function overviewSlideFromPoint(x, y) {
    return document.elementsFromPoint(x, y).find(el => el.matches && el.matches('section.asm-slide'));
  }

  function dropSide(event, section) {
    const rect = section.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const left = x;
    const right = 1 - x;
    const up = y;
    const down = 1 - y;
    const min = Math.min(left, right, up, down);
    if (min === left) return 'left';
    if (min === right) return 'right';
    if (min === up) return 'up';
    return 'down';
  }

  function showDropPreview(section, side) {
    clearDropPreview();
    dropPreview = { section, side };
    section.classList.add(`is-drop-${side}`);
  }

  function clearDropPreview() {
    if (dropPreview) dropPreview.section.classList.remove(`is-drop-${dropPreview.side}`);
    dropPreview = null;
  }

  function flashHint(text) {
    const hint = document.getElementById('editHint');
    hint.textContent = text;
    clearTimeout(flashHint.timer);
    flashHint.timer = setTimeout(() => {
      hint.textContent = 'ESC 開啟 overview，可拖曳排序投影片。';
    }, 1800);
  }

  function updateDiagnostics() {
    const totalObjects = deck.groups.reduce((sum, group) => {
      return sum + group.slides.reduce((slideSum, slide) => {
        return slideSum + (((slide.canvas || {}).objects || []).length);
      }, 0);
    }, 0);
    const totalWidgets = deck.groups.reduce((sum, group) => {
      return sum + group.slides.reduce((slideSum, slide) => slideSum + normalizeWidgets(slide.widgets).length, 0);
    }, 0);
    document.body.dataset.slideCount = String(totalSlides());
    document.body.dataset.groupCount = String(deck.groups.length);
    document.body.dataset.fabricObjectCount = String(totalObjects);
    document.body.dataset.widgetCount = String(totalWidgets);
    document.body.dataset.historyIndex = String(historyIndex);
    document.body.dataset.historyLength = String(history.length);
  }

  function initReveal() {
    reveal = window.Reveal;
    reveal.initialize({
      hash: false,
      controls: true,
      progress: true,
      overview: true,
      center: false,
      width: SLIDE_W,
      height: SLIDE_H,
      margin: 0.05,
      transition: 'slide',
      plugins: [
        window.RevealNotes,
        window.RevealSearch,
        window.RevealZoom,
        window.RevealHighlight,
        window.RevealMath && window.RevealMath.KaTeX
      ].filter(Boolean)
    }).then(() => {
      document.body.dataset.revealPlugins = Object.keys(reveal.getPlugins ? reveal.getPlugins() : {}).join(',');
      reveal.on('slidechanged', event => {
        currentH = event.indexh;
        currentV = event.indexv || 0;
        overviewSelectedSlideId = getSlide()?.id || overviewSelectedSlideId;
      });
      bindOverviewEvents();
      setTimeout(refreshRevealWidgets, 1200);
    });
  }

  bindChrome();
  bindSlideDrop();
  bindOverviewDrag();
  renderDeck();
  saveDeck({ history: false });
  pushHistorySnapshot();
  initReveal();
})();
