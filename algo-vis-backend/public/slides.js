(function () {
  const STORAGE_KEY = 'asm_reveal_fabric_deck_v5';
  const OLD_STORAGE_KEY = 'asm_reveal_fabric_deck_v4';
  const SLIDE_W = 1280;
  const SLIDE_H = 720;
  const fabricCanvases = new Map();
  const slidePositions = new Map();
  const MAX_HISTORY = 80;
  const CODE_SCROLLBAR_HIT_GUTTER = 5;
  const FABRIC_LAYER_INDEX = 1000;
  const WIDGET_LAYER_BELOW_BASE = 100;
  const WIDGET_LAYER_ABOVE_BASE = 2000;
  const STACK_LAYER_BASE = 100;
  const STACK_LAYER_STEP = 10;
  const FABRIC_CUSTOM_PROPS = ['transitionId', 'fragmentEnabled', 'fragmentStyle', 'fragmentIndex', 'fragmentProxyId', 'cornerRadius', 'layerIndex'];
  const FRAGMENT_STYLE_CLASSES = ['fade-out', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'grow', 'shrink', 'zoom-in', 'current-visible'];

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const defaultDeck = {
    groups: [
      {
        id: randomId(),
        slides: [
          {
            id: randomId(),
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
        id: randomId(),
        slides: [
          {
            id: randomId(),
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
  let revealReady = false;
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
  let overviewSelectedSlideIds = new Set();
  let overviewSelectionAnchorId = null;
  let draggedSlideId = null;
  let pointerDrag = null;
  let dropPreview = null;
  let overviewDropLine = null;
  let overviewDropPlaceholder = null;
  let suppressOverviewClick = false;
  let overviewPanX = 0;
  let overviewPanY = 0;
  let suppressOverviewScrollbar = false;
  let customOverviewOpen = false;
  let customOverviewDrag = null;
  let suppressCustomOverviewClick = false;
  let customOverviewRightMouseDown = false;
  let slideClipboard = [];
  let objectClipboard = { fabric: [], widgets: [], cut: false };
  let history = [];
  let historyIndex = -1;
  let editingAlgorithmSlideId = null;
  let modeLayoutAnimationTimer = null;
  let activeFabricAutoAnimation = null;
  let activeCodeAutoAnimation = null;

  const slidesRoot = document.getElementById('slidesRoot');
  const overviewHScrollbar = document.getElementById('overviewHScrollbar');
  const overviewVScrollbar = document.getElementById('overviewVScrollbar');
  const overviewHScrollContent = document.getElementById('overviewHScrollContent');
  const overviewVScrollContent = document.getElementById('overviewVScrollContent');
  const overviewEventShield = document.getElementById('overviewEventShield');
  const customOverview = document.getElementById('customOverview');
  const customOverviewViewport = document.getElementById('customOverviewViewport');
  const customOverviewBoard = document.getElementById('customOverviewBoard');
  const exportDeckBtn = document.getElementById('exportDeckBtn');
  const importDeckBtn = document.getElementById('importDeckBtn');
  const importDeckInput = document.getElementById('importDeckInput');
  const objectToolbar = document.getElementById('objectToolbar');
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeInput = document.getElementById('fontSizeInput');
  const boldBtn = document.getElementById('boldBtn');
  const italicBtn = document.getElementById('italicBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  const strikeBtn = document.getElementById('strikeBtn');
  const alignLeftBtn = document.getElementById('alignLeftBtn');
  const alignCenterBtn = document.getElementById('alignCenterBtn');
  const alignRightBtn = document.getElementById('alignRightBtn');
  const listStyleBtn = document.getElementById('listStyleBtn');
  const textColorBtn = document.getElementById('textColorBtn');
  const bgColorBtn = document.getElementById('bgColorBtn');
  const shapeStrokeBtn = document.getElementById('shapeStrokeBtn');
  const shapeColorBtn = document.getElementById('shapeColorBtn');
  const iroPopup = document.getElementById('iroPopup');
  const shapeStyleControls = document.getElementById('shapeStyleControls');
  const shapeStrokeWidthInput = document.getElementById('shapeStrokeWidthInput');
  const shapeStrokeWidthValue = document.getElementById('shapeStrokeWidthValue');
  const shapeCornerRadiusControls = document.getElementById('shapeCornerRadiusControls');
  const shapeCornerRadiusInput = document.getElementById('shapeCornerRadiusInput');
  const shapeCornerRadiusValue = document.getElementById('shapeCornerRadiusValue');
  const shapeMenu = document.getElementById('shapeMenu');
  const shapeMenuBtn = document.getElementById('shapeMenuBtn');
  const overviewChrome = document.getElementById('overviewChrome');
  const defaultToolPanel = document.getElementById('defaultToolPanel');
  const overviewSidebarPanel = document.getElementById('overviewSidebarPanel');
  const latexEditorPanel = document.getElementById('latexEditorPanel');
  const codeEditorPanel = document.getElementById('codeEditorPanel');
  const latexEditorInput = document.getElementById('latexEditorInput');
  const openCodeEditorBtn = document.getElementById('openCodeEditorBtn');
  const codeEditorModal = document.getElementById('codeEditorModal');
  const codeAceEditorEl = document.getElementById('codeAceEditor');
  const codeEditorModalStatus = document.getElementById('codeEditorModalStatus');
  const closeCodeEditorModalBtn = document.getElementById('closeCodeEditorModalBtn');
  const saveCodeEditorModalBtn = document.getElementById('saveCodeEditorModalBtn');
  const codeLanguageSelect = document.getElementById('codeLanguageSelect');
  const latexFontSizeInput = document.getElementById('latexFontSizeInput');
  const codeFontSizeInput = document.getElementById('codeFontSizeInput');
  const codeFocusLinesInput = document.getElementById('codeFocusLinesInput');
  const codeShowLineNumbersInput = document.getElementById('codeShowLineNumbersInput');
  const animationEditorPanel = document.getElementById('animationEditorPanel');
  const layerToTopBtn = document.getElementById('layerToTopBtn');
  const layerUpBtn = document.getElementById('layerUpBtn');
  const layerDownBtn = document.getElementById('layerDownBtn');
  const layerToBottomBtn = document.getElementById('layerToBottomBtn');
  const shapeEditorControls = document.getElementById('shapeEditorControls');
  const shapeChoiceButtons = Array.from(document.querySelectorAll('[data-shape-choice]'));
  const transitionIdInput = document.getElementById('transitionIdInput');
  const fragmentEnabledInput = document.getElementById('fragmentEnabledInput');
  const fragmentStyleSelect = document.getElementById('fragmentStyleSelect');
  const fragmentIndexInput = document.getElementById('fragmentIndexInput');
  const algorithmEditSlideBtn = document.getElementById('algorithmEditSlideBtn');
  const algorithmEditorModal = document.getElementById('algorithmEditorModal');
  const algorithmEditorFrame = document.getElementById('algorithmEditorFrame');
  const algorithmEditorStatus = document.getElementById('algorithmEditorStatus');
  let aceCodeEditor = null;
  let editingCodeWidgetId = null;

  function f() {
    return window.fabric;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createBlankSlide(title = 'New slide') {
    return {
      id: randomId(),
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

  function createAlgorithmAnimationSlide() {
    return {
      id: randomId(),
      kind: 'algorithm-animation',
      canvas: { objects: [] },
      widgets: [],
      animation: normalizeAlgorithmAnimation()
    };
  }

  function cloneSlideForPaste(slide) {
    return {
      ...clone(slide),
      id: randomId(),
      widgets: normalizeWidgets(slide.widgets).map(widget => ({
        ...clone(widget),
        id: randomId()
      }))
    };
  }

  function normalizeDeck(raw) {
    if (raw && Array.isArray(raw.groups)) {
      raw.groups = raw.groups
        .filter(group => group && Array.isArray(group.slides) && group.slides.length)
        .map(group => ({
          id: group.id || randomId(),
          slides: group.slides.map(normalizeSlide)
        }));
      return raw.groups.length ? raw : clone(defaultDeck);
    }

    if (raw && Array.isArray(raw.slides)) {
      return {
        groups: raw.slides.map(slide => ({
          id: randomId(),
          slides: [normalizeSlide(slide)]
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

  function exportDeckJson() {
    const payload = {
      format: 'AlgoShowMaker.slides',
      version: 'AV_V4.3',
      exportedAt: new Date().toISOString(),
      deck
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `algoshowmaker-slides-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function importDeckJsonText(text) {
    const parsed = JSON.parse(text);
    const importedDeck = parsed && parsed.deck ? parsed.deck : parsed;
    const nextDeck = normalizeDeck(importedDeck);
    const previousDeck = deck;
    deck = nextDeck;
    currentH = 0;
    currentV = 0;
    saveDeck();
    if (canRestoreDeckInPlace(previousDeck, deck)) restoreDeckInPlace(previousDeck);
    else renderDeck();
  }

  function importDeckJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importDeckJsonText(String(reader.result || ''));
        flashHint('已匯入投影片 JSON');
      } catch (err) {
        console.error('Failed to import deck JSON', err);
        flashHint('匯入 JSON 失敗，請確認檔案格式');
      } finally {
        if (importDeckInput) importDeckInput.value = '';
      }
    };
    reader.readAsText(file);
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

  function deckSlideStructure(deckState) {
    return deckState.groups.map(group => ({
      id: group.id,
      slides: group.slides.map(slide => ({
        id: slide.id,
        kind: slide.kind || ''
      }))
    }));
  }

  function canRestoreDeckInPlace(previousDeck, nextDeck) {
    return JSON.stringify(deckSlideStructure(previousDeck)) === JSON.stringify(deckSlideStructure(nextDeck));
  }

  function restoreHistory(index) {
    if (index < 0 || index >= history.length) return;
    suppressHistory = true;
    const previousDeck = deck;
    historyIndex = index;
    deck = normalizeDeck(JSON.parse(history[historyIndex]));
    clampPosition();
    saveDeck({ history: false });
    if (canRestoreDeckInPlace(previousDeck, deck)) restoreDeckInPlace(previousDeck);
    else renderDeck();
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

  function isOverviewEditing() {
    return customOverviewOpen || !!(reveal && reveal.isOverview && reveal.isOverview());
  }

  function isRevealEditOverviewActive() {
    return !!(
      reveal
      && reveal.isOverview
      && reveal.isOverview()
      && document.body.classList.contains('asm-edit-mode')
      && !customOverviewOpen
    );
  }

  function normalizeCanvasJson(canvasJson) {
    return {
      version: canvasJson && canvasJson.version,
      objects: ((canvasJson && canvasJson.objects) || []).map(obj => {
        if (!obj || typeof obj.type !== 'string') return obj;
        const type = obj.type.toLowerCase();
        if (type.includes('text') && type !== 'textbox' && f()?.Textbox) {
          return sanitizeFabricTextBaseline({
            ...obj,
            type: 'textbox',
            textBaseline: normalizeTextBaselineValue(obj.textBaseline),
            width: Number.isFinite(obj.width) ? Math.max(40, obj.width) : 360
          });
        }
        return sanitizeFabricTextBaseline({
          ...obj,
          textBaseline: normalizeTextBaselineValue(obj.textBaseline)
        });
      })
    };
  }

  function normalizeTextBaselineValue(value) {
    return value === 'alphabetical' ? 'alphabetic' : value;
  }

  function sanitizeFabricTextBaseline(target) {
    if (!target) return target;
    if (target.textBaseline === 'alphabetical') {
      if (target.set) target.set('textBaseline', 'alphabetic');
      else target.textBaseline = 'alphabetic';
    }
    const styles = target.styles;
    if (styles && typeof styles === 'object') {
      Object.values(styles).forEach(lineStyles => {
        if (!lineStyles || typeof lineStyles !== 'object') return;
        Object.values(lineStyles).forEach(style => {
          if (style && style.textBaseline === 'alphabetical') style.textBaseline = 'alphabetic';
        });
      });
    }
    return target;
  }

  function normalizeAnimationSettings(source = {}) {
    return {
      transitionId: typeof source.transitionId === 'string' ? source.transitionId : '',
      fragmentEnabled: source.fragmentEnabled === true,
      fragmentStyle: FRAGMENT_STYLE_CLASSES.includes(source.fragmentStyle) ? source.fragmentStyle : '',
      fragmentIndex: Number.isFinite(Number(source.fragmentIndex)) && source.fragmentIndex !== ''
        ? Math.max(0, Math.round(Number(source.fragmentIndex)))
        : null
    };
  }

  function serializeFabricCanvas(canvas) {
    canvas.getObjects().forEach(sanitizeFabricTextBaseline);
    const serialized = canvas.toJSON(FABRIC_CUSTOM_PROPS);
    serialized.objects = (serialized.objects || []).map(obj => ({
      ...sanitizeFabricTextBaseline(obj),
      visible: true
    }));
    return serialized;
  }

  function normalizeAlgorithmAnimation(animation = {}) {
    return {
      code: typeof animation.code === 'string' ? animation.code : '',
      input: typeof animation.input === 'string' ? animation.input : '',
      scriptContent: typeof animation.scriptContent === 'string' ? animation.scriptContent : ''
    };
  }

  function normalizeSlide(slide = {}) {
    const normalized = {
      ...slide,
      id: slide.id || randomId(),
      canvas: normalizeCanvasJson(slide.canvas),
      widgets: normalizeWidgets(slide.widgets)
    };
    if (slide.kind === 'algorithm-animation') {
      normalized.kind = 'algorithm-animation';
      normalized.animation = normalizeAlgorithmAnimation(slide.animation);
    }
    return normalized;
  }

  function normalizeWidgets(widgets) {
    return Array.isArray(widgets) ? widgets.map((widget, index) => {
      const type = widget.type === 'code' ? 'code' : 'latex';
      const normalized = {
        id: widget.id || randomId(),
        type,
        x: Number.isFinite(widget.x) ? widget.x : 160,
        y: Number.isFinite(widget.y) ? widget.y : 160,
        w: Number.isFinite(widget.w) ? widget.w : (type === 'code' ? 560 : 320),
        h: Number.isFinite(widget.h) ? widget.h : (type === 'code' ? 220 : 96),
        language: typeof widget.language === 'string' ? widget.language : 'cpp',
        fontSize: Number.isFinite(widget.fontSize) ? widget.fontSize : (type === 'code' ? 21 : 34),
        focusLines: typeof widget.focusLines === 'string' ? widget.focusLines : '',
        showLineNumbers: widget.showLineNumbers === true,
        scale: Number.isFinite(widget.scale) ? widget.scale : 1,
        manualSize: widget.manualSize === true,
        layerIndex: Number.isFinite(Number(widget.layerIndex)) ? Number(widget.layerIndex) : WIDGET_LAYER_ABOVE_BASE + index,
        content: typeof widget.content === 'string' ? widget.content : '',
        ...normalizeAnimationSettings(widget)
      };
      if (type === 'latex') {
        normalized.cropX = Number.isFinite(widget.cropX) ? widget.cropX : 0;
        normalized.cropY = Number.isFinite(widget.cropY) ? widget.cropY : 0;
      }
      return normalized;
    }) : [];
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
    finishCodeAutoAnimation();
    finishFabricAutoAnimation();
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
        if (reveal.isOverview && reveal.isOverview()) {
          prepareOverview();
          refreshOverviewScrollbars();
        }
        if (customOverviewOpen) renderCustomOverview();
      }, 40);
    }
  }

  async function restoreDeckInPlace(previousDeck) {
    finishCodeAutoAnimation();
    finishFabricAutoAnimation();
    rebuildPositions();
    const previousSlides = new Map();
    previousDeck.groups.forEach(group => {
      group.slides.forEach(slide => previousSlides.set(slide.id, slide));
    });

    for (const group of deck.groups) {
      for (const slide of group.slides) {
        const section = document.querySelector(`section.asm-slide[data-slide-id="${slide.id}"]`);
        applySlideAutoAnimateAttributes(section, slide);
        if (slide.kind === 'algorithm-animation') continue;
        reconcileSlideWidgets(section?.querySelector('.widget-layer'), slide, previousSlides.get(slide.id));
        const canvas = fabricCanvases.get(slide.id);
        if (!canvas) continue;
        await loadSlideCanvas(canvas, slide);
        syncFabricFragmentProxies(slide.id, canvas);
      }
    }

    if (selectedWidgetId && !getWidget(selectedWidgetId).widget) selectedWidgetId = null;
    applyEditMode(document.body.classList.contains('asm-edit-mode'));
    if (reveal) {
      syncRevealPreservingPosition();
      reveal.layout();
    }
    if (selectedWidgetId) showWidgetEditor(selectedWidgetId);
    else showDefaultPanel();
    updateAlgorithmEditButton();
    updateDiagnostics();
  }

  function refreshRevealWidgets() {
    const highlightPlugin = reveal && reveal.getPlugin && reveal.getPlugin('highlight');
    document.body.dataset.highlightApi = highlightPlugin ? Object.keys(highlightPlugin).join(',') : 'missing';
    document.querySelectorAll('.code-widget').forEach(el => {
      const found = getWidget(el.dataset.widgetId);
      if (!found.widget) return;
      paintWidgetElement(el, found.widget);
      highlightCodeWidget(el);
    });
    renderMathWidgets(slidesRoot);
    autoSizeLatexWidgets();
    if (reveal) reveal.layout();
  }

  function refreshWidgetElement(el, widget) {
    if (!el || !widget) return;
    if (widget.type === 'code') {
      paintWidgetElement(el, widget);
      highlightCodeWidget(el);
    } else {
      renderMathWidgets(el);
      autoSizeLatexWidgets();
    }
    if (reveal) reveal.layout();
  }

  function highlightCodeWidget(el) {
    const code = el && el.querySelector('code');
    if (!code) return;
    code.removeAttribute('data-highlighted');
    const highlightPlugin = reveal && reveal.getPlugin && reveal.getPlugin('highlight');
    if (highlightPlugin && highlightPlugin.highlightBlock) {
      highlightPlugin.highlightBlock(code);
    } else if (window.hljs) {
      window.hljs.highlightElement(code);
    }
    if (!el.dataset.codeAutoAnimating) {
      const widget = getWidget(el.dataset.widgetId).widget;
      scrollCodeWidgetToFocus(el, widget);
      requestAnimationFrame(() => scrollCodeWidgetToFocus(el, widget));
    }
  }

  function focusedCodeLineNumbers(focusLines, totalLines) {
    const selected = new Set();
    String(focusLines || '').split(',').forEach(part => {
      const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!match) return;
      const start = Math.max(1, Math.min(totalLines, Number(match[1])));
      const end = Math.max(1, Math.min(totalLines, Number(match[2] || match[1])));
      for (let line = Math.min(start, end); line <= Math.max(start, end); line += 1) selected.add(line);
    });
    return Array.from(selected).sort((a, b) => a - b);
  }

  function codeFocusScrollTop(el, widget) {
    const pre = el?.querySelector('pre');
    const code = pre?.querySelector('code');
    if (!pre || !code || !widget) return 0;
    const lines = focusedCodeLineNumbers(widget.focusLines, String(widget.content || '').split('\n').length);
    if (!lines.length) return 0;
    const rows = Array.from(code.querySelectorAll('.hljs-ln tr'));
    const firstRow = rows[lines[0] - 1];
    const lastRow = rows[lines[lines.length - 1] - 1];
    const lineHeight = parseFloat(getComputedStyle(code).lineHeight) || (Number(widget.fontSize) || 21) * 1.2;
    const preRect = pre.getBoundingClientRect();
    const scaleY = pre.clientHeight ? preRect.height / pre.clientHeight : 1;
    const top = firstRow
      ? ((firstRow.getBoundingClientRect().top - preRect.top) / (scaleY || 1)) + pre.scrollTop
      : (lines[0] - 1) * lineHeight;
    const bottom = lastRow
      ? ((lastRow.getBoundingClientRect().bottom - preRect.top) / (scaleY || 1)) + pre.scrollTop
      : lines[lines.length - 1] * lineHeight;
    const viewportHeight = Math.max(1, pre.clientHeight);
    const focusCenter = (top + bottom - 1) / 2;
    const targetScrollTop = Math.max(0, Math.min(pre.scrollHeight - viewportHeight, focusCenter - (viewportHeight / 2)));
    return targetScrollTop;
  }

  function scrollCodeWidgetToFocus(el, widget, behavior = 'auto') {
    const pre = el?.querySelector('pre');
    if (!pre || !widget) return;
    pre.scrollTo({ top: codeFocusScrollTop(el, widget), behavior });
  }

  function renderMathWidgets(root) {
    if (window.renderMathInElement) {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ]
      });
    }
  }

  function autoSizeLatexWidgets() {
    let changed = false;
    document.querySelectorAll('.latex-widget').forEach(el => {
      if (!slidesRoot.contains(el)) return;
      const content = el.querySelector('.latex-content');
      const rendered = content && (content.querySelector('.katex') || content);
      if (!content || !rendered) return;
      const renderedRect = rendered.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const layerRect = el.closest('.widget-layer').getBoundingClientRect();
      if (layerRect.width <= 1 || layerRect.height <= 1) return;
      const scaleX = layerRect.width / SLIDE_W;
      const scaleY = layerRect.height / SLIDE_H;
      const rawOffsetX = (renderedRect.left - contentRect.left) / scaleX;
      const rawOffsetY = (renderedRect.top - contentRect.top) / scaleY;
      const width = Math.max(20, renderedRect.width / scaleX);
      const height = Math.max(20, renderedRect.height / scaleY);
      const found = getWidget(el.dataset.widgetId);
      if (!found.widget) return;
      const changedWidget = Math.abs((found.widget.w || 0) - width) > 0.5
        || Math.abs((found.widget.h || 0) - height) > 0.5
        || Math.abs((found.widget.cropX || 0) - rawOffsetX) > 0.5
        || Math.abs((found.widget.cropY || 0) - rawOffsetY) > 0.5;
      if (changedWidget) changed = true;
      found.widget.w = width;
      found.widget.h = height;
      found.widget.cropX = rawOffsetX;
      found.widget.cropY = rawOffsetY;
      found.widget.manualSize = false;
      el.dataset.manualSize = 'false';
      el.style.left = `${found.widget.x}px`;
      el.style.top = `${found.widget.y}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      positionWidgetContent(el, found.widget);
    });
    if (changed) saveDeck({ history: false });
  }

  function applyAnimationAttributes(el, source) {
    const animation = normalizeAnimationSettings(source);
    FRAGMENT_STYLE_CLASSES.forEach(className => el.classList.remove(className));
    el.classList.toggle('fragment', animation.fragmentEnabled);
    if (animation.fragmentEnabled && animation.fragmentStyle) el.classList.add(animation.fragmentStyle);
    if (source.type === 'code' && animation.transitionId) el.dataset.codeTransition = 'true';
    else delete el.dataset.codeTransition;
    if (source.type !== 'code' && animation.transitionId) el.dataset.id = animation.transitionId;
    else delete el.dataset.id;
    if (animation.fragmentEnabled && animation.fragmentIndex !== null) {
      el.dataset.fragmentIndex = String(animation.fragmentIndex);
    } else {
      delete el.dataset.fragmentIndex;
    }
  }

  function slideUsesAutoAnimate(slide) {
    const widgets = normalizeWidgets(slide.widgets);
    const objects = ((slide.canvas && slide.canvas.objects) || []);
    return [...widgets, ...objects].some(item => normalizeAnimationSettings(item).transitionId);
  }

  function applySlideAutoAnimateAttributes(section, slide) {
    if (!section) return;
    if (slideUsesAutoAnimate(slide)) {
      if (!section.hasAttribute('data-auto-animate')) section.setAttribute('data-auto-animate', '');
      section.setAttribute('data-auto-animate-unmatched', 'false');
    } else {
      section.removeAttribute('data-auto-animate');
      section.removeAttribute('data-auto-animate-unmatched');
    }
  }

  function syncSlideAutoAnimate(slide) {
    if (!slide) return;
    const section = document.querySelector(`section.asm-slide[data-slide-id="${slide.id}"]`);
    applySlideAutoAnimateAttributes(section, slide);
  }

  function createSlideSection(slide, h, v) {
    const section = document.createElement('section');
    section.className = 'asm-slide';
    section.dataset.slideId = slide.id;
    section.dataset.h = String(h);
    section.dataset.v = String(v);
    applySlideAutoAnimateAttributes(section, slide);
    if (slide.kind === 'algorithm-animation') {
      section.classList.add('algorithm-animation-slide');
      renderAlgorithmSlide(section, slide);
      appendSlideEdgeAddButtons(section, slide.id);
      return section;
    }
      section.innerHTML = `
        <div class="asm-slide-frame-content">
          <div class="fabric-host" data-slide-id="${slide.id}">
            <canvas id="fabric-${slide.id}" width="${SLIDE_W}" height="${SLIDE_H}"></canvas>
          </div>
          <div class="widget-layer" data-slide-id="${slide.id}"></div>
        </div>
      `;
    renderSlideWidgets(section.querySelector('.widget-layer'), slide);
    appendSlideEdgeAddButtons(section, slide.id);
    return section;
  }

  function renderAlgorithmSlide(section, slide) {
    const hasScript = !!normalizeAlgorithmAnimation(slide.animation).scriptContent;
    section.innerHTML = `
      <div class="asm-slide-frame-content">
        <iframe
          class="algorithm-slide-frame"
          data-slide-id="${slide.id}"
          title="Algorithm animation"
          src="${hasScript ? 'index.html?asmEmbed=runtime' : 'about:blank'}"
          ${hasScript ? '' : 'hidden'}
        ></iframe>
        <div class="algorithm-slide-placeholder" ${hasScript ? 'hidden' : ''}>
          <div>演算法動畫投影片<span>點選左側橘色按鈕輸入程式碼並編譯</span></div>
        </div>
      </div>
    `;
  }

  function appendSlideEdgeAddButtons(section, slideId) {
    section.insertAdjacentHTML('beforeend', `
      <button class="slide-edge-add slide-edge-add-right" type="button" data-add-slide-right="${slideId}" title="在右側新增投影片" aria-label="在右側新增投影片">+</button>
      <button class="slide-edge-add slide-edge-add-bottom" type="button" data-add-slide-bottom="${slideId}" title="在下方新增投影片" aria-label="在下方新增投影片">+</button>
    `);
  }

  function disposeCanvases() {
    fabricCanvases.forEach(canvas => canvas.dispose());
    fabricCanvases.clear();
  }

  function renderSlideWidgets(layer, slide) {
    if (!layer) return;
    layer.innerHTML = '';
    normalizeWidgets(slide.widgets).forEach(widget => {
      layer.appendChild(createWidgetElement(widget));
    });
  }

  function reconcileSlideWidgets(layer, slide, previousSlide) {
    if (!layer) return;
    const previousWidgets = new Map(normalizeWidgets(previousSlide?.widgets).map(widget => [widget.id, widget]));
    const widgets = normalizeWidgets(slide.widgets);
    const widgetIds = new Set(widgets.map(widget => widget.id));
    layer.querySelectorAll('.slide-widget').forEach(el => {
      if (!widgetIds.has(el.dataset.widgetId)) el.remove();
    });
    widgets.forEach(widget => {
      let el = layer.querySelector(`.slide-widget[data-widget-id="${widget.id}"]`);
      if (!el) {
        el = createWidgetElement(widget);
        layer.appendChild(el);
        refreshWidgetElement(el, widget);
        return;
      }
      syncWidgetElementInPlace(el, widget, previousWidgets.get(widget.id));
      layer.appendChild(el);
    });
  }

  function syncWidgetElementInPlace(el, widget, previousWidget) {
    el.dataset.widgetType = widget.type;
    el.dataset.manualSize = widget.manualSize ? 'true' : 'false';
    el.style.left = `${widget.x}px`;
    el.style.top = `${widget.y}px`;
    el.style.width = `${widget.w}px`;
    el.style.height = `${widget.h}px`;
    el.style.fontSize = `${widget.fontSize}px`;
    el.style.zIndex = String(Math.round(Number(widget.layerIndex) || WIDGET_LAYER_ABOVE_BASE));
    applyAnimationAttributes(el, widget);
    const contentChanged = !previousWidget || [
      'type', 'content', 'language', 'focusLines', 'showLineNumbers', 'fontSize', 'scale', 'cropX', 'cropY'
    ].some(key => previousWidget[key] !== widget[key]);
    if (contentChanged) refreshWidgetElement(el, widget);
    else positionWidgetContent(el, widget);
    el.classList.toggle('is-selected', el.dataset.widgetId === selectedWidgetId);
  }

  function createWidgetElement(widget) {
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
    el.style.zIndex = String(Math.round(Number(widget.layerIndex) || WIDGET_LAYER_ABOVE_BASE));
    applyAnimationAttributes(el, widget);
    paintWidgetElement(el, widget);
    return el;
  }

  function appendWidgetsToCurrentSlide(widgets) {
    const slide = getSlide();
    const layer = slide && document.querySelector(`.widget-layer[data-slide-id="${slide.id}"]`);
    if (!layer) return;
    document.querySelectorAll('.slide-widget.is-selected').forEach(el => el.classList.remove('is-selected'));
    widgets.forEach(widget => layer.appendChild(createWidgetElement(widget)));
  }

  function paintWidgetElement(el, widget) {
    el.innerHTML = '';
    if (widget.type === 'code') {
      el.innerHTML = `<div class="code-frame"><pre class="widget-content"><code class="language-${widget.language || 'cpp'}"></code></pre></div>`;
      const code = el.querySelector('code');
      code.textContent = widget.content || defaultCode();
      applyCodeFocusLines(code, widget.focusLines, widget.showLineNumbers);
    } else {
      const content = document.createElement('div');
      content.className = 'widget-content latex-content';
      content.textContent = widget.content || String.raw`\(\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\)`;
      el.appendChild(content);
    }
    positionWidgetContent(el, widget);
    const handles = widget.type === 'code'
      ? ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left']
        .map(edge => ['widget-edge-handle', 'resizeEdge', edge])
      : [];
    handles.forEach(([className, dataKey, value]) => {
      const handle = document.createElement('span');
      handle.className = className;
      handle.dataset[dataKey] = value;
      el.appendChild(handle);
    });
  }

  function positionWidgetContent(el, widget) {
    const content = el.querySelector('.widget-content');
    if (!content) return;
    if (widget.type === 'code') {
      const code = content.querySelector('code');
      const frame = el.querySelector('.code-frame');
      if (frame) {
        frame.style.width = `${widget.w}px`;
        frame.style.height = `${widget.h}px`;
      }
      content.style.left = '0px';
      content.style.top = '0px';
      content.style.width = `${widget.w}px`;
      content.style.height = `${widget.h}px`;
      content.style.transform = '';
      if (code) {
        code.style.left = '0px';
        code.style.width = '100%';
        code.style.transform = '';
      }
      return;
    }
    content.style.left = `${-(widget.cropX || 0)}px`;
    content.style.top = `${-(widget.cropY || 0)}px`;
    content.style.transformOrigin = '0 0';
    content.style.transform = widget.type === 'latex' ? `scale(${widget.scale || 1})` : '';
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
            backgroundColor: 'rgba(0,0,0,0)',
            preserveObjectStacking: true,
            selection: true,
            stopContextMenu: true,
            uniformScaling: false,
            uniScaleKey: 'shiftKey'
          });

          fabricCanvases.set(slide.id, canvas);
          blockRevealNavigationWhileEditing(canvas);
          wireCanvas(canvas, slide);
          await loadSlideCanvas(canvas, slide);
          syncFabricFragmentProxies(slide.id, canvas);
          syncUnifiedLayerStyles(slide, canvas);
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
    const sync = (event, { syncFragments = false } = {}) => {
      if (suppressCanvasSave) return;
      normalizeShapeGeometry(event && event.target, canvas);
      slide.canvas = serializeFabricCanvas(canvas);
      saveDeck();
      syncSlideAutoAnimate(slide);
      if (syncFragments) syncFabricFragmentProxies(slide.id, canvas);
      updateObjectToolbar(canvas.getActiveObject(), canvas);
    };
    canvas.on('object:added', event => sync(event, { syncFragments: true }));
    canvas.on('object:modified', sync);
    canvas.on('object:removed', event => sync(event, { syncFragments: true }));
    canvas.on('text:changed', sync);
    canvas.on('selection:created', e => {
      exitWidgetEditorIfNeeded();
      updateObjectToolbar(e.selected && e.selected[0], canvas);
    });
    canvas.on('selection:updated', e => {
      exitWidgetEditorIfNeeded();
      updateObjectToolbar(e.selected && e.selected[0], canvas);
    });
    canvas.on('selection:cleared', () => {
      hideObjectToolbar();
      if (!selectedWidgetId) showDefaultPanel();
    });
    canvas.on('object:moving', e => {
      finishFabricAutoAnimation();
      updateObjectToolbar(e.target, canvas);
    });
    canvas.on('object:scaling', e => {
      keepShapeStrokeUniform(e.target, canvas);
      normalizeTextBoxResize(e.target, canvas);
      updateObjectToolbar(e.target, canvas);
    });
    canvas.on('object:rotating', e => updateObjectToolbar(e.target, canvas));
    canvas.on('mouse:up', () => updateObjectToolbar(canvas.getActiveObject(), canvas));
    canvas.on('text:selection:changed', e => updateObjectToolbar(e.target, canvas));
    canvas.on('text:editing:entered', e => updateObjectToolbar(e.target, canvas));
    canvas.on('text:editing:exited', () => {
      textSelection = null;
      hideObjectToolbar({ keepAnimation: true });
      showFabricObjectEditor(canvas.getActiveObject());
    });
  }

  function configureObject(obj) {
    sanitizeFabricTextBaseline(obj);
    const animation = normalizeAnimationSettings(obj);
    obj.set({
      cornerColor: '#1d8f83',
      cornerStrokeColor: '#ffffff',
      borderColor: '#1d8f83',
      cornerStyle: 'circle',
      transparentCorners: false,
      padding: 6,
      lockScalingFlip: true,
      strokeUniform: true,
      objectCaching: isShapeObject(obj) ? false : !isTextObject(obj),
      noScaleCache: isShapeObject(obj) ? false : obj.noScaleCache,
      ...animation,
      fragmentProxyId: obj.fragmentProxyId || randomId(),
      layerIndex: Number.isFinite(Number(obj.layerIndex)) ? Number(obj.layerIndex) : FABRIC_LAYER_INDEX,
      cornerRadius: Number.isFinite(Number(obj.cornerRadius)) ? Math.max(0, Number(obj.cornerRadius)) : (Number(obj.rx) || 0)
    });
  }

  function blockRevealNavigationWhileEditing(canvas) {
    if (!canvas || !canvas.upperCanvasEl) return;
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend'].forEach(type => {
      canvas.upperCanvasEl.addEventListener(type, event => {
        if (document.body.classList.contains('asm-edit-mode')) event.stopPropagation();
      });
    });
  }

  function keepShapeStrokeUniform(obj, canvas) {
    if (!isShapeObject(obj)) return;
    obj.set({ strokeUniform: true, objectCaching: false, noScaleCache: false });
    obj.dirty = true;
    if (canvas) canvas.requestRenderAll();
  }

  function normalizeShapeGeometry(obj, canvas) {
    if (!isShapeObject(obj)) return;
    const scaleX = Number.isFinite(obj.scaleX) ? obj.scaleX : 1;
    const scaleY = Number.isFinite(obj.scaleY) ? obj.scaleY : 1;
    if (Math.abs(Math.abs(scaleX) - 1) < 0.001 && Math.abs(Math.abs(scaleY) - 1) < 0.001) return;
    if (obj.type === 'circle' && Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) > 0.001) return;
    const center = obj.getCenterPoint();
    if (obj.type === 'circle') {
      obj.set({ radius: Math.max(2, (Number(obj.radius) || 2) * Math.abs(scaleX)) });
    } else {
      obj.set({
        width: Math.max(4, (Number(obj.width) || 4) * Math.abs(scaleX)),
        height: Math.max(4, (Number(obj.height) || 4) * Math.abs(scaleY))
      });
    }
    obj.set({ scaleX: Math.sign(scaleX) || 1, scaleY: Math.sign(scaleY) || 1 });
    obj.setPositionByOrigin(center, 'center', 'center');
    obj.setCoords();
    obj.dirty = true;
    if (canvas) canvas.requestRenderAll();
  }

  function syncRevealPreservingPosition() {
    if (!revealReady || !reveal) return;
    const indices = reveal.getIndices ? reveal.getIndices() : { h: currentH, v: currentV };
    reveal.sync();
    if (!indices || !Number.isFinite(indices.h)) return;
    const v = Number.isFinite(indices.v) ? indices.v : 0;
    if (Number.isFinite(indices.f)) reveal.slide(indices.h, v, indices.f);
    else reveal.slide(indices.h, v);
  }

  function fabricAnimationState(obj) {
    const properties = [
      'left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'opacity',
      'strokeWidth', 'rx', 'ry', 'radius', 'fontSize'
    ];
    const numeric = properties.reduce((state, property) => {
      if (Number.isFinite(Number(obj[property]))) state[property] = Number(obj[property]);
      return state;
    }, {});
    const colors = ['fill', 'stroke', 'backgroundColor', 'textBackgroundColor'].reduce((state, property) => {
      if (typeof obj[property] === 'string') state[property] = obj[property];
      return state;
    }, {});
    return { numeric, colors };
  }

  function interpolateFabricColor(from, to, progress) {
    const Fabric = f();
    if (!Fabric?.Color || typeof from !== 'string' || typeof to !== 'string') return to;
    const start = new Fabric.Color(from).getSource();
    const end = new Fabric.Color(to).getSource();
    return `rgba(${start.map((value, index) => {
      const next = value + ((end[index] - value) * progress);
      return index < 3 ? Math.round(next) : Math.round(next * 1000) / 1000;
    }).join(',')})`;
  }

  function applyFabricAnimationState(obj, from, to, progress) {
    const patch = {};
    Object.keys(to.numeric).forEach(property => {
      patch[property] = Number.isFinite(from.numeric[property])
        ? from.numeric[property] + ((to.numeric[property] - from.numeric[property]) * progress)
        : to.numeric[property];
    });
    Object.keys(to.colors).forEach(property => {
      patch[property] = from.colors[property]
        ? interpolateFabricColor(from.colors[property], to.colors[property], progress)
        : to.colors[property];
    });
    obj.set(patch);
    obj.setCoords();
    obj.dirty = true;
  }

  function finishFabricAutoAnimation() {
    if (!activeFabricAutoAnimation) return;
    cancelAnimationFrame(activeFabricAutoAnimation.frame);
    const canvases = new Set();
    activeFabricAutoAnimation.targets.forEach(({ canvas, object, final }) => {
      applyFabricAnimationState(object, final, final, 1);
      canvases.add(canvas);
    });
    canvases.forEach(canvas => canvas.requestRenderAll());
    activeFabricAutoAnimation = null;
  }

  function finishCodeAutoAnimation() {
    if (!activeCodeAutoAnimation) return;
    cancelAnimationFrame(activeCodeAutoAnimation.frame);
    activeCodeAutoAnimation.targets.forEach(({ el, widget, finalScroll }) => {
      setCodeAutoAnimationBox(el, widget);
      const pre = el.querySelector('pre');
      if (pre) {
        pre.scrollTop = Number.isFinite(finalScroll) ? finalScroll : codeFocusScrollTop(el, widget);
      }
      el.style.removeProperty('visibility');
      delete el.dataset.codeAutoAnimating;
    });
    activeCodeAutoAnimation = null;
  }

  function setCodeAutoAnimationBox(el, box) {
    const keys = { left: 'x', top: 'y', width: 'w', height: 'h' };
    ['left', 'top', 'width', 'height'].forEach(property => {
      el.style.setProperty(property, `${box[keys[property]]}px`, 'important');
    });
    el.style.setProperty('transform', 'none', 'important');
    syncCodeContentBox(el, box);
  }

  function syncCodeContentBox(el, box) {
    if (!el?.classList?.contains('code-widget')) return;
    const frame = el.querySelector('.code-frame');
    const pre = el.querySelector('pre.widget-content');
    if (frame) {
      frame.style.width = `${box.w}px`;
      frame.style.height = `${box.h}px`;
    }
    if (pre) {
      pre.style.width = `${box.w}px`;
      pre.style.height = `${box.h}px`;
    }
  }

  function disableRevealCodeAnimation(el) {
    [el, ...el.querySelectorAll('[data-auto-animate-target]')].forEach(node => {
      node.removeAttribute('data-auto-animate-target');
      node.style.removeProperty('transform');
      node.style.removeProperty('transition');
    });
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('transition', 'none', 'important');
  }

  function resetCodeWidgetRuntimeStyles(el, widget) {
    if (!el || !widget) return;
    disableRevealCodeAnimation(el);
    setCodeAutoAnimationBox(el, widget);
    positionWidgetContent(el, widget);
  }

  function animateCodeAutoTransition(event) {
    finishCodeAutoAnimation();
    const fromSlide = getSlideById(event?.fromSlide?.dataset.slideId);
    const toSlide = getSlideById(event?.toSlide?.dataset.slideId);
    if (!fromSlide || !toSlide) return;
    const fromWidgets = new Map(normalizeWidgets(fromSlide.widgets)
      .filter(widget => widget.type === 'code' && widget.transitionId.trim())
      .map(widget => [widget.transitionId.trim(), widget]));
    const targets = normalizeWidgets(toSlide.widgets).reduce((matches, widget) => {
      const source = widget.type === 'code' && fromWidgets.get(widget.transitionId.trim());
      const el = source && event.toSlide.querySelector(`.code-widget[data-widget-id="${widget.id}"]`);
      if (!source || !el) return matches;
      el.dataset.codeAutoAnimating = 'true';
      el.style.setProperty('visibility', 'hidden', 'important');
      disableRevealCodeAnimation(el);
      const sourceEl = event.fromSlide.querySelector(`.code-widget[data-widget-id="${source.id}"]`);
      resetCodeWidgetRuntimeStyles(sourceEl, source);
      const initialScroll = sourceEl?.querySelector('pre')?.scrollTop || 0;
      setCodeAutoAnimationBox(el, source);
      const pre = el.querySelector('pre');
      if (pre) pre.scrollTop = initialScroll;
      void el.offsetHeight;
      matches.push({ el, source, widget, initialScroll, finalScroll: null });
      return matches;
    }, []);
    document.body.dataset.codeAutoAnimateCount = String(targets.length);
    if (!targets.length) return;

    const duration = Math.max(0, Number(reveal?.getConfig?.().autoAnimateDuration) || 1) * 1000;
    const startedAt = performance.now();
    const animation = { frame: 0, targets };
    activeCodeAutoAnimation = animation;
    const tick = now => {
      if (activeCodeAutoAnimation !== animation) return;
      const elapsed = duration ? Math.min(1, (now - startedAt) / duration) : 1;
      const boxProgress = Math.min(1, elapsed / 0.5);
      const boxEased = 1 - Math.pow(1 - boxProgress, 3);
      const scrollProgress = Math.max(0, Math.min(1, (elapsed - 0.5) / 0.5));
      const scrollEased = Math.pow(scrollProgress, 4);
      targets.forEach(target => {
        const { el, source, widget, initialScroll } = target;
        setCodeAutoAnimationBox(el, {
          x: source.x + ((widget.x - source.x) * boxEased),
          y: source.y + ((widget.y - source.y) * boxEased),
          w: source.w + ((widget.w - source.w) * boxEased),
          h: source.h + ((widget.h - source.h) * boxEased)
        });
        const pre = el.querySelector('pre');
        if (pre) {
          if (scrollProgress > 0 && !Number.isFinite(target.finalScroll)) {
            target.finalScroll = codeFocusScrollTop(el, widget);
          }
          const finalScroll = Number.isFinite(target.finalScroll) ? target.finalScroll : initialScroll;
          pre.scrollTop = initialScroll + ((finalScroll - initialScroll) * scrollEased);
        }
      });
      if (elapsed < 1) animation.frame = requestAnimationFrame(tick);
      else {
        targets.forEach(({ el, widget, finalScroll }) => {
          setCodeAutoAnimationBox(el, widget);
          const pre = el.querySelector('pre');
          if (pre) {
            pre.scrollTop = Number.isFinite(finalScroll) ? finalScroll : codeFocusScrollTop(el, widget);
          }
          el.style.removeProperty('visibility');
          delete el.dataset.codeAutoAnimating;
        });
        activeCodeAutoAnimation = null;
      }
    };
    animation.frame = requestAnimationFrame(now => {
      targets.forEach(({ el }) => el.style.removeProperty('visibility'));
      tick(now);
    });
  }

  function animateSlideAutoTransition(event) {
    animateFabricAutoTransition(event);
    animateCodeAutoTransition(event);
  }

  function animateFabricAutoTransition(event) {
    finishFabricAutoAnimation();
    const fromSlideId = event?.fromSlide?.dataset.slideId;
    const toSlideId = event?.toSlide?.dataset.slideId;
    const fromCanvas = fabricCanvases.get(fromSlideId);
    const toCanvas = fabricCanvases.get(toSlideId);
    if (!fromCanvas || !toCanvas) return;

    const fromObjects = new Map();
    fromCanvas.getObjects().forEach(obj => {
      const id = normalizeAnimationSettings(obj).transitionId.trim();
      if (id && !fromObjects.has(id)) fromObjects.set(id, obj);
    });
    const targets = toCanvas.getObjects().reduce((matches, object) => {
      const id = normalizeAnimationSettings(object).transitionId.trim();
      const source = id && fromObjects.get(id);
      if (!source) return matches;
      const initial = fabricAnimationState(source);
      const final = fabricAnimationState(object);
      applyFabricAnimationState(object, initial, final, 0);
      matches.push({ canvas: toCanvas, object, initial, final });
      return matches;
    }, []);
    document.body.dataset.fabricAutoAnimateCount = String(targets.length);
    if (!targets.length) return;

    const duration = Math.max(0, Number(reveal?.getConfig?.().autoAnimateDuration) || 1) * 1000;
    const startedAt = performance.now();
    const animation = { frame: 0, targets };
    activeFabricAutoAnimation = animation;
    const tick = now => {
      if (activeFabricAutoAnimation !== animation) return;
      const elapsed = duration ? Math.min(1, (now - startedAt) / duration) : 1;
      const eased = 1 - Math.pow(1 - elapsed, 3);
      targets.forEach(({ canvas, object, initial, final }) => {
        applyFabricAnimationState(object, initial, final, eased);
        canvas.requestRenderAll();
      });
      if (elapsed < 1) animation.frame = requestAnimationFrame(tick);
      else activeFabricAutoAnimation = null;
    };
    animation.frame = requestAnimationFrame(tick);
  }

  function syncFabricFragmentProxies(slideId, canvas) {
    const layer = document.querySelector(`.widget-layer[data-slide-id="${slideId}"]`);
    if (!layer || !canvas) return;
    const existing = new Map(Array.from(layer.querySelectorAll('.fabric-fragment-proxy'))
      .map(proxy => [proxy.dataset.fabricProxyId, proxy]));
    let fragmentsChanged = false;
    canvas.getObjects().forEach(obj => {
      configureObject(obj);
      let proxy = existing.get(obj.fragmentProxyId);
      if (!obj.fragmentEnabled) {
        if (proxy) {
          proxy.remove();
          existing.delete(obj.fragmentProxyId);
          fragmentsChanged = true;
        }
        return;
      }
      if (!proxy) {
        proxy = document.createElement('span');
        proxy.className = 'fabric-fragment-proxy';
        layer.appendChild(proxy);
        fragmentsChanged = true;
      }
      const previousIndex = proxy.dataset.fragmentIndex || '';
      proxy.dataset.fabricProxyId = obj.fragmentProxyId;
      applyAnimationAttributes(proxy, obj);
      if (previousIndex !== (proxy.dataset.fragmentIndex || '')) fragmentsChanged = true;
      existing.delete(obj.fragmentProxyId);
    });
    existing.forEach(proxy => {
      proxy.remove();
      fragmentsChanged = true;
    });
    if (fragmentsChanged) syncRevealPreservingPosition();
    refreshFabricFragmentVisibility();
  }

  function refreshFabricFragmentVisibility() {
    const editing = document.body.classList.contains('asm-edit-mode');
    fabricCanvases.forEach((canvas, slideId) => {
      const layer = document.querySelector(`.widget-layer[data-slide-id="${slideId}"]`);
      const proxies = new Map(Array.from(layer?.querySelectorAll('.fabric-fragment-proxy') || [])
        .map(proxy => [proxy.dataset.fabricProxyId, proxy]));
      canvas.getObjects().forEach(obj => {
        const proxy = obj.fragmentEnabled && proxies.get(obj.fragmentProxyId);
        obj.visible = !obj.fragmentEnabled || editing || !!proxy?.classList.contains('visible');
      });
      canvas.requestRenderAll();
    });
  }

  function normalizeTextBoxResize(obj, canvas) {
    if (!isTextObject(obj)) return;
    const scaleX = Number.isFinite(obj.scaleX) ? obj.scaleX : 1;
    if (Math.abs(scaleX - 1) < 0.001 && Math.abs((obj.scaleY || 1) - 1) < 0.001) return;
    const nextWidth = Math.max(40, (obj.width || 40) * scaleX);
    obj.set({
      width: nextWidth,
      scaleX: 1,
      scaleY: 1
    });
    if (obj.initDimensions) obj.initDimensions();
    obj.dirty = true;
    obj.setCoords();
    if (canvas) {
      if (canvas.clearContext && canvas.contextTop) canvas.clearContext(canvas.contextTop);
      canvas.requestRenderAll();
    }
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
        const TextClass = Fabric.Textbox || Fabric.IText || Fabric.Text;
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
      id: randomId(),
      type,
      x: Math.max(24, Math.min(point.x - 120, SLIDE_W - 360)),
      y: Math.max(24, Math.min(point.y - 54, SLIDE_H - 180)),
      w: type === 'code' ? 560 : 360,
      h: type === 'code' ? 230 : 104,
      language: 'cpp',
      fontSize: type === 'code' ? 21 : 34,
      focusLines: '',
      showLineNumbers: false,
      scale: 1,
      ...normalizeAnimationSettings(),
      content: type === 'code' ? defaultCode() : String.raw`\(\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\)`
    };
    slide.widgets.push(widget);
    saveDeck();
    pendingTool = null;
    updateArmedTool();
    document.body.dataset.lastToolStatus = `added:${type}`;
    appendWidgetsToCurrentSlide([widget]);
    const el = document.querySelector(`.slide-widget[data-widget-id="${widget.id}"]`);
    if (el) refreshWidgetElement(el, widget);
    selectWidget(widget.id);
  }

  function createShape(shape, left, top) {
    const fill = shape === 'triangle' ? '#fff2d8' : (shape === 'rect' ? '#dff4ef' : '#eee7fb');
    const stroke = shape === 'triangle' ? '#b87927' : (shape === 'rect' ? '#1d8f83' : '#875bc7');
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
    if (shape === 'rect') {
      return new Fabric.Rect({
        left,
        top,
        width: 210,
        height: 150,
        fill,
        stroke,
        strokeWidth: 4,
        rx: 12,
        ry: 12,
        cornerRadius: 12
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
    slide.canvas = serializeFabricCanvas(canvas);
    saveDeck();
    syncSlideAutoAnimate(slide);
    syncFabricFragmentProxies(slide.id, canvas);
  }

  function isEditableDomTarget(event) {
    const target = event.target;
    return !!(target && target.closest && target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function activeFabricObjects() {
    const canvas = currentFabricCanvas();
    return canvas ? canvas.getActiveObjects() : [];
  }

  function selectAllCurrentObjects() {
    const canvas = currentFabricCanvas();
    if (canvas && !isTypingInFabric(canvas)) {
      const objects = canvas.getObjects();
      if (objects.length) {
        const Fabric = f();
        if (objects.length === 1) {
          canvas.setActiveObject(objects[0]);
        } else if (Fabric.ActiveSelection) {
          canvas.setActiveObject(new Fabric.ActiveSelection(objects, { canvas }));
        }
        canvas.requestRenderAll();
        updateObjectToolbar(canvas.getActiveObject(), canvas);
      }
    }
    selectAllCurrentWidgets();
  }

  function copyCurrentObjects() {
    const slide = getSlide();
    const fabricObjects = activeFabricObjects();
    const widgetIds = selectedWidgetIdsInCurrentSlide();
    objectClipboard = {
      fabric: fabricObjects.map(obj => obj.toObject ? obj.toObject(FABRIC_CUSTOM_PROPS) : clone(obj)),
      widgets: normalizeWidgets(slide?.widgets).filter(widget => widgetIds.includes(widget.id)).map(widget => clone(widget)),
      cut: false
    };
  }

  function cutCurrentObjects() {
    copyCurrentObjects();
    objectClipboard.cut = true;
    deleteCurrentObjectSelection();
  }

  async function pasteCurrentObjects() {
    const canvas = currentFabricCanvas();
    const slide = getSlide();
    if (!slide || (!objectClipboard.fabric.length && !objectClipboard.widgets.length)) return;
    if (canvas && objectClipboard.fabric.length) {
      const objects = await enlivenFabricObjects(objectClipboard.fabric);
      const offset = objectClipboard.cut ? 0 : 32;
      objects.forEach(obj => {
        configureObject(obj);
        obj.set({
          left: (obj.left || 0) + offset,
          top: (obj.top || 0) + offset
        });
        canvas.add(obj);
      });
      if (objects.length === 1) {
        canvas.setActiveObject(objects[0]);
      } else if (objects.length > 1 && f().ActiveSelection) {
        canvas.setActiveObject(new (f().ActiveSelection)(objects, { canvas }));
      }
      canvas.requestRenderAll();
      syncCurrentSlideCanvas();
      updateObjectToolbar(canvas.getActiveObject(), canvas);
    }
    if (objectClipboard.widgets.length) {
      slide.widgets = normalizeWidgets(slide.widgets);
      const offset = objectClipboard.cut ? 0 : 32;
      const pastedWidgets = objectClipboard.widgets.map(widget => ({
        ...clone(widget),
        id: randomId(),
        x: Math.min(SLIDE_W - Math.max(20, widget.w || 20), (widget.x || 0) + offset),
        y: Math.min(SLIDE_H - Math.max(20, widget.h || 20), (widget.y || 0) + offset)
      }));
      slide.widgets.push(...pastedWidgets);
      selectedWidgetId = pastedWidgets.length === 1 ? pastedWidgets[0].id : null;
      saveDeck();
      appendWidgetsToCurrentSlide(pastedWidgets);
      pastedWidgets.forEach(widget => {
        document.querySelector(`.slide-widget[data-widget-id="${widget.id}"]`)?.classList.add('is-selected');
      });
      if (selectedWidgetId) showWidgetEditor(selectedWidgetId);
      else showDefaultPanel();
      refreshRevealWidgets();
    }
    objectClipboard.cut = false;
  }

  function deleteCurrentObjectSelection() {
    let changed = false;
    const canvas = currentFabricCanvas();
    if (canvas && !isTypingInFabric(canvas)) {
      const active = canvas.getActiveObjects();
      if (active.length) {
        active.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        syncCurrentSlideCanvas();
        changed = true;
      }
    }
    if (deleteSelectedWidget()) changed = true;
    return changed;
  }

  function enlivenFabricObjects(jsonObjects) {
    const Fabric = f();
    return new Promise(resolve => {
      const done = objects => resolve(objects || []);
      const result = Fabric.util.enlivenObjects(jsonObjects.map(obj => clone(obj)), done);
      if (result && typeof result.then === 'function') result.then(done);
    });
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
    const canvas = currentFabricCanvas();
    if (canvas) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
    hideObjectToolbar();
    selectedWidgetId = widgetId;
    document.querySelectorAll('.slide-widget.is-selected').forEach(el => el.classList.remove('is-selected'));
    const el = document.querySelector(`.slide-widget[data-widget-id="${widgetId}"]`);
    if (el) el.classList.add('is-selected');
    showWidgetEditor(widgetId);
  }

  function clearWidgetSelection() {
    selectedWidgetId = null;
    document.querySelectorAll('.slide-widget.is-selected').forEach(el => el.classList.remove('is-selected'));
    if (codeEditorModal && !codeEditorModal.hidden) closeCodeEditorModal();
    showDefaultPanel();
  }

  function selectedWidgetIdsInCurrentSlide() {
    const slide = getSlide();
    if (!slide) return [];
    const selectedIds = Array.from(document.querySelectorAll(`.widget-layer[data-slide-id="${slide.id}"] .slide-widget.is-selected`))
      .map(el => el.dataset.widgetId)
      .filter(Boolean);
    if (selectedWidgetId && !selectedIds.includes(selectedWidgetId)) selectedIds.push(selectedWidgetId);
    const existingIds = new Set(normalizeWidgets(slide.widgets).map(widget => widget.id));
    return selectedIds.filter(id => existingIds.has(id));
  }

  function selectAllCurrentWidgets() {
    const slide = getSlide();
    if (!slide) return [];
    const ids = normalizeWidgets(slide.widgets).map(widget => widget.id);
    document.querySelectorAll(`.widget-layer[data-slide-id="${slide.id}"] .slide-widget`).forEach(el => {
      el.classList.add('is-selected');
    });
    selectedWidgetId = ids.length === 1 ? ids[0] : null;
    if (ids.length !== 1) showDefaultPanel();
    return ids;
  }

  function showDefaultPanel() {
    if (customOverviewOpen) {
      showOverviewSidebarPanel();
      return;
    }
    defaultToolPanel.hidden = false;
    if (overviewSidebarPanel) overviewSidebarPanel.hidden = true;
    latexEditorPanel.hidden = true;
    codeEditorPanel.hidden = true;
    hideAnimationEditor();
    updateAlgorithmEditButton();
  }

  function applyCodeFocusLines(code, focusLines, showLineNumbers) {
    const value = typeof focusLines === 'string' ? focusLines.trim() : '';
    code.classList.toggle('asm-hide-line-numbers', !showLineNumbers);
    if (value || showLineNumbers) code.setAttribute('data-line-numbers', value);
    else code.removeAttribute('data-line-numbers');
  }

  function showOverviewSidebarPanel() {
    defaultToolPanel.hidden = true;
    if (overviewSidebarPanel) overviewSidebarPanel.hidden = false;
    latexEditorPanel.hidden = true;
    codeEditorPanel.hidden = true;
    hideAnimationEditor();
  }

  function updateAlgorithmEditButton() {
    if (!algorithmEditSlideBtn) return;
    algorithmEditSlideBtn.hidden = getSlide()?.kind !== 'algorithm-animation';
  }

  function showWidgetEditor(widgetId) {
    const found = getWidget(widgetId);
    if (!found.widget) return;
    defaultToolPanel.hidden = true;
    if (overviewSidebarPanel) overviewSidebarPanel.hidden = true;
    latexEditorPanel.hidden = found.widget.type !== 'latex';
    codeEditorPanel.hidden = found.widget.type !== 'code';
    if (found.widget.type === 'latex') {
      latexFontSizeInput.value = Math.round(found.widget.fontSize || 34);
      latexEditorInput.value = found.widget.content;
    } else {
      codeLanguageSelect.value = found.widget.language || 'cpp';
      codeFontSizeInput.value = Math.round(found.widget.fontSize || 21);
      codeFocusLinesInput.value = found.widget.focusLines || '';
      codeShowLineNumbersInput.checked = found.widget.showLineNumbers === true;
      if (codeEditorModalStatus) codeEditorModalStatus.textContent = `目前 code 物件：${found.widget.id}`;
    }
    showAnimationEditor(found.widget);
  }

  function showFabricObjectEditor(obj) {
    if (!obj || obj.type === 'activeSelection') return;
    defaultToolPanel.hidden = true;
    if (overviewSidebarPanel) overviewSidebarPanel.hidden = true;
    latexEditorPanel.hidden = true;
    codeEditorPanel.hidden = true;
    showAnimationEditor(obj);
  }

  function showAnimationEditor(source) {
    if (!animationEditorPanel || !source) return;
    const animation = normalizeAnimationSettings(source);
    animationEditorPanel.hidden = false;
    if (shapeEditorControls) shapeEditorControls.hidden = !isShapeObject(source);
    shapeChoiceButtons.forEach(button => {
      button.classList.toggle('is-active', isShapeObject(source) && button.dataset.shapeChoice === source.type);
    });
    transitionIdInput.value = animation.transitionId;
    fragmentEnabledInput.checked = animation.fragmentEnabled;
    fragmentStyleSelect.value = animation.fragmentStyle;
    fragmentIndexInput.value = animation.fragmentIndex === null ? '' : String(animation.fragmentIndex);
    fragmentStyleSelect.disabled = !animation.fragmentEnabled;
    fragmentIndexInput.disabled = !animation.fragmentEnabled;
    updateLayerControlsState();
  }

  function hideAnimationEditor() {
    if (animationEditorPanel) animationEditorPanel.hidden = true;
    layerButtonList().forEach(button => { button.disabled = true; });
  }

  function aceModeForLanguage(language) {
    return {
      c: 'c_cpp',
      cpp: 'c_cpp',
      java: 'java',
      javascript: 'javascript',
      python: 'python',
      plaintext: 'text'
    }[language] || 'text';
  }

  function ensureAceCodeEditor() {
    if (aceCodeEditor || !codeAceEditorEl || !window.ace?.edit) return aceCodeEditor;
    codeAceEditorEl.textContent = '';
    aceCodeEditor = window.ace.edit(codeAceEditorEl);
    aceCodeEditor.setTheme('ace/theme/monokai');
    aceCodeEditor.session.setUseWorker(false);
    aceCodeEditor.setOptions({
      fontSize: '15px',
      showPrintMargin: false,
      wrap: false,
      useSoftTabs: true,
      tabSize: 2
    });
    return aceCodeEditor;
  }

  function openCodeEditorModal() {
    const found = getWidget(selectedWidgetId);
    if (!found.widget || found.widget.type !== 'code' || !codeEditorModal) return;
    editingCodeWidgetId = selectedWidgetId;
    codeEditorModal.hidden = false;
    if (codeEditorModalStatus) codeEditorModalStatus.textContent = `目前 code 物件：${found.widget.id}`;
    const editor = ensureAceCodeEditor();
    if (!editor) {
      if (codeAceEditorEl) codeAceEditorEl.textContent = 'ACE editor 尚未載入，請重啟伺服器後再開啟。';
      return;
    }
    editor.session.setMode(`ace/mode/${aceModeForLanguage(found.widget.language)}`);
    editor.setValue(found.widget.content || '', -1);
    requestAnimationFrame(() => {
      editor.resize();
      editor.focus();
    });
  }

  function closeCodeEditorModal() {
    if (codeEditorModal) codeEditorModal.hidden = true;
    editingCodeWidgetId = null;
  }

  function saveCodeEditorModal() {
    if (!editingCodeWidgetId || !aceCodeEditor) {
      closeCodeEditorModal();
      return;
    }
    const found = getWidget(editingCodeWidgetId);
    if (!found.widget || found.widget.type !== 'code') {
      closeCodeEditorModal();
      return;
    }
    selectedWidgetId = editingCodeWidgetId;
    updateSelectedWidget({ content: aceCodeEditor.getValue() });
    showWidgetEditor(editingCodeWidgetId);
    closeCodeEditorModal();
  }

  function layerButtonList() {
    return [layerToTopBtn, layerUpBtn, layerDownBtn, layerToBottomBtn].filter(Boolean);
  }

  function syncWidgetLayerStyles(slide) {
    const layer = slide && document.querySelector(`.widget-layer[data-slide-id="${slide.id}"]`);
    if (!layer) return;
    normalizeWidgets(slide.widgets).forEach(widget => {
      const el = layer.querySelector(`.slide-widget[data-widget-id="${widget.id}"]`);
      if (el) {
        el.style.zIndex = String(Math.round(Number(widget.layerIndex) || WIDGET_LAYER_ABOVE_BASE));
        layer.appendChild(el);
      }
    });
  }

  function syncUnifiedLayerStyles(slide, canvas = currentFabricCanvas()) {
    if (!slide) return;
    const entries = unifiedLayerEntries(slide, canvas);
    const host = document.querySelector(`.fabric-host[data-slide-id="${slide.id}"]`);
    let fabricZ = null;
    entries.forEach((entry, index) => {
      const z = STACK_LAYER_BASE + index * STACK_LAYER_STEP;
      if (entry.kind === 'widget') {
        const el = document.querySelector(`.slide-widget[data-widget-id="${entry.id}"]`);
        if (el) el.style.zIndex = String(z);
      } else if (entry.kind === 'fabric') {
        fabricZ = Math.max(fabricZ ?? z, z);
      }
    });
    if (host) host.style.zIndex = String(fabricZ ?? FABRIC_LAYER_INDEX);
  }

  function unifiedLayerEntries(slide, canvas = currentFabricCanvas()) {
    if (!slide) return [];
    const widgets = normalizeWidgets(slide.widgets);
    const entries = widgets.map((widget, index) => ({
      kind: 'widget',
      id: widget.id,
      widget,
      originalIndex: index,
      layerIndex: Number.isFinite(Number(widget.layerIndex)) ? Number(widget.layerIndex) : WIDGET_LAYER_ABOVE_BASE + index
    }));
    (canvas?.getObjects() || []).forEach((object, index) => {
      if (!object.fragmentProxyId) object.set?.({ fragmentProxyId: randomId() });
      entries.push({
        kind: 'fabric',
        id: object.fragmentProxyId,
        object,
        originalIndex: index,
        layerIndex: Number.isFinite(Number(object.layerIndex)) ? Number(object.layerIndex) : FABRIC_LAYER_INDEX + index
      });
    });
    return entries.sort((a, b) => (a.layerIndex - b.layerIndex) || (a.originalIndex || 0) - (b.originalIndex || 0));
  }

  function applyUnifiedLayerEntries(slide, canvas, entries) {
    const firstFabricIndex = entries.findIndex(entry => entry.kind === 'fabric');
    let belowWidgetCount = 0;
    let aboveWidgetCount = 0;
    let fabricCount = 0;
    entries.forEach((entry, index) => {
      if (entry.kind === 'widget') {
        entry.widget.layerIndex = STACK_LAYER_BASE + index * STACK_LAYER_STEP;
      } else if (entry.kind === 'fabric') {
        entry.object.set?.({ layerIndex: STACK_LAYER_BASE + index * STACK_LAYER_STEP });
      }
    });
    slide.widgets = entries.filter(entry => entry.kind === 'widget').map(entry => entry.widget);
    syncWidgetLayerStyles(slide);
    syncUnifiedLayerStyles(slide, canvas);
    if (canvas) {
      entries.filter(entry => entry.kind === 'fabric').forEach((entry, index) => {
        if (typeof canvas.moveTo === 'function') canvas.moveTo(entry.object, index);
        else {
          canvas.remove(entry.object);
          canvas.insertAt(entry.object, index, false);
        }
      });
      canvas.requestRenderAll();
    }
  }

  function selectedLayerPosition() {
    const canvas = currentFabricCanvas();
    if (selectedWidgetId) {
      const found = getWidget(selectedWidgetId);
      if (!found.slide || !found.widget) return null;
      const entries = unifiedLayerEntries(found.slide, canvas);
      const index = entries.findIndex(entry => entry.kind === 'widget' && entry.id === selectedWidgetId);
      return index >= 0 ? { index, count: entries.length } : null;
    }
    const slide = getSlide();
    const target = selectedFabricAnimationTarget();
    if (!slide || !target.canvas || !target.object) return null;
    const entries = unifiedLayerEntries(slide, target.canvas);
    const index = entries.findIndex(entry => entry.kind === 'fabric' && entry.object === target.object);
    return index >= 0 ? { index, count: entries.length } : null;
  }

  function updateLayerControlsState() {
    const position = selectedLayerPosition();
    const hasMovableSelection = !!position && position.count > 1;
    layerButtonList().forEach(button => { button.disabled = !hasMovableSelection; });
    if (!hasMovableSelection) return;
    const atBottom = position.index <= 0;
    const atTop = position.index >= position.count - 1;
    if (layerToTopBtn) layerToTopBtn.disabled = atTop;
    if (layerUpBtn) layerUpBtn.disabled = atTop;
    if (layerDownBtn) layerDownBtn.disabled = atBottom;
    if (layerToBottomBtn) layerToBottomBtn.disabled = atBottom;
  }

  function selectedFabricAnimationTarget() {
    const canvas = currentFabricCanvas();
    const object = canvas && canvas.getActiveObject();
    return object && object.type !== 'activeSelection' ? { canvas, object } : {};
  }

  function moveArrayItem(items, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return false;
    const [item] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, item);
    return true;
  }

  function targetLayerIndex(action, index, count) {
    if (action === 'top') return count - 1;
    if (action === 'up') return Math.min(count - 1, index + 1);
    if (action === 'down') return Math.max(0, index - 1);
    if (action === 'bottom') return 0;
    return index;
  }

  function reorderWidgetLayer(action) {
    if (!selectedWidgetId) return false;
    const found = getWidget(selectedWidgetId);
    if (!found.slide || !found.widget) return false;
    const canvas = currentFabricCanvas();
    const entries = unifiedLayerEntries(found.slide, canvas);
    const index = entries.findIndex(entry => entry.kind === 'widget' && entry.id === selectedWidgetId);
    const nextIndex = targetLayerIndex(action, index, entries.length);
    if (!moveArrayItem(entries, index, nextIndex)) return false;
    applyUnifiedLayerEntries(found.slide, canvas, entries);
    if (canvas) found.slide.canvas = serializeFabricCanvas(canvas);
    syncSlideAutoAnimate(found.slide);
    saveDeck();
    const layer = document.querySelector(`.widget-layer[data-slide-id="${found.slide.id}"]`);
    if (layer) {
      normalizeWidgets(found.slide.widgets).forEach(widget => {
        const el = layer.querySelector(`.slide-widget[data-widget-id="${widget.id}"]`);
        if (el) {
          el.style.zIndex = String(Math.round(Number(widget.layerIndex) || WIDGET_LAYER_ABOVE_BASE));
          layer.appendChild(el);
        }
      });
    }
    selectWidget(selectedWidgetId);
    updateLayerControlsState();
    return true;
  }

  function reorderFabricLayer(action) {
    const target = selectedFabricAnimationTarget();
    if (!target.canvas || !target.object) return false;
    const slide = getSlide();
    if (!slide) return false;
    const entries = unifiedLayerEntries(slide, target.canvas);
    const index = entries.findIndex(entry => entry.kind === 'fabric' && entry.object === target.object);
    const nextIndex = targetLayerIndex(action, index, entries.length);
    if (!moveArrayItem(entries, index, nextIndex)) return false;
    applyUnifiedLayerEntries(slide, target.canvas, entries);
    target.canvas.setActiveObject(target.object);
    target.canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(target.object, target.canvas);
    updateLayerControlsState();
    return true;
  }

  function reorderSelectedLayer(action) {
    const moved = selectedWidgetId ? reorderWidgetLayer(action) : reorderFabricLayer(action);
    if (moved) syncRevealPreservingPosition();
  }

  function updateSelectedAnimation(patch) {
    if (selectedWidgetId) {
      updateSelectedWidget(patch);
      syncRevealPreservingPosition();
      showAnimationEditor(getWidget(selectedWidgetId).widget);
      return;
    }
    const target = selectedFabricAnimationTarget();
    if (!target.canvas || !target.object) return;
    target.object.set(patch);
    configureObject(target.object);
    target.canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    showAnimationEditor(target.object);
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
      el.style.zIndex = String(Math.round(Number(found.widget.layerIndex) || WIDGET_LAYER_ABOVE_BASE));
      el.dataset.manualSize = found.widget.manualSize ? 'true' : 'false';
      applyAnimationAttributes(el, found.widget);
      if (found.widget.type !== 'code') {
        updateWidgetContentElement(el, found.widget);
      }
      el.classList.add('is-selected');
      syncSlideAutoAnimate(found.slide);
      refreshWidgetElement(el, found.widget);
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
      applyCodeFocusLines(code, widget.focusLines, widget.showLineNumbers);
    } else {
      let content = el.querySelector('.latex-content');
      if (!content) {
        paintWidgetElement(el, widget);
        return;
      }
      content.textContent = widget.content || String.raw`\(\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\)`;
    }
    positionWidgetContent(el, widget);
  }

  function deleteSelectedWidget() {
    const widgetIds = selectedWidgetIdsInCurrentSlide();
    if (!widgetIds.length) return false;
    const slide = getSlide();
    if (!slide) return false;
    const idSet = new Set(widgetIds);
    slide.widgets = normalizeWidgets(slide.widgets).filter(widget => !idSet.has(widget.id));
    document.querySelectorAll(`.widget-layer[data-slide-id="${slide.id}"] .slide-widget`).forEach(el => {
      if (idSet.has(el.dataset.widgetId)) el.remove();
    });
    selectedWidgetId = null;
    showDefaultPanel();
    saveDeck();
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
    refreshFabricFragmentVisibility();
  }

  function setEditMode(enabled) {
    if (!enabled && customOverviewOpen) closeCustomOverview();
    if (enabled && reveal && reveal.isOverview && reveal.isOverview()) reveal.toggleOverview();
    document.body.classList.add('mode-layout-animating');
    if (modeLayoutAnimationTimer) clearTimeout(modeLayoutAnimationTimer);
    document.body.classList.toggle('asm-edit-mode', enabled);
    const modeToggleBtn = document.getElementById('modeToggleBtn');
    const nextMode = enabled ? 'Present' : 'Edit';
    if (modeToggleBtn) {
      modeToggleBtn.title = `切換至 ${nextMode} 模式`;
      modeToggleBtn.setAttribute('aria-label', `切換至 ${nextMode} 模式`);
    }
    applyEditMode(enabled);
    if (reveal) setTimeout(() => reveal.layout(), 20);
    modeLayoutAnimationTimer = setTimeout(() => {
      if (reveal) reveal.layout();
      document.body.classList.remove('mode-layout-animating');
      modeLayoutAnimationTimer = null;
    }, 380);
  }

  function clearSelectionWhenClickingOutsideSlide(event) {
    if (!document.body.classList.contains('asm-edit-mode') || isOverviewEditing() || event.button !== 0) return;
    const target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('.asm-slide-frame-content, #controlChrome, #editorChrome, #objectToolbar, #overviewChrome, #customOverview, #algorithmEditorModal, #codeEditorModal, .slide-edge-add')) return;
    const canvas = currentFabricCanvas();
    const hadFabricSelection = !!(canvas && canvas.getActiveObject());
    if (canvas && hadFabricSelection) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
    if (selectedWidgetId) {
      clearWidgetSelection();
    } else if (hadFabricSelection) {
      hideObjectToolbar();
      showDefaultPanel();
    }
  }

  function bindChrome() {
    document.getElementById('modeToggleBtn').addEventListener('click', () => {
      setEditMode(!document.body.classList.contains('asm-edit-mode'));
    });
    exportDeckBtn?.addEventListener('click', exportDeckJson);
    importDeckBtn?.addEventListener('click', () => importDeckInput?.click());
    importDeckInput?.addEventListener('change', () => importDeckJsonFile(importDeckInput.files && importDeckInput.files[0]));
    document.getElementById('addSlideBtn').addEventListener('click', addSlideNearCurrent);
    document.getElementById('overviewAddSlideBtn')?.addEventListener('click', addSlideNearCurrent);
    document.getElementById('overviewAddAlgorithmSlideBtn')?.addEventListener('click', addAlgorithmSlideNearCurrent);
    algorithmEditSlideBtn?.addEventListener('click', () => {
      const slide = getSlide();
      if (slide?.kind === 'algorithm-animation') openAlgorithmEditor(slide.id);
    });
    document.getElementById('saveAlgorithmEditorBtn')?.addEventListener('click', saveAlgorithmEditor);
    window.addEventListener('message', handleAlgorithmEmbedMessage);
    document.addEventListener('mousedown', clearSelectionWhenClickingOutsideSlide, true);
    slidesRoot.addEventListener('click', event => {
      if (handleSlideEdgeAddClick(event)) return;
    });

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
        pendingTool = null;
        updateArmedTool();
        shapeMenu.hidden = true;
        addObject(tool, { x: SLIDE_W / 2, y: SLIDE_H / 2 });
        flashHint('已在投影片中央新增範本。');
      });
    });


    document.getElementById('exitLatexEditorBtn').addEventListener('click', clearWidgetSelection);
    document.getElementById('exitCodeEditorBtn').addEventListener('click', clearWidgetSelection);
    latexEditorInput.addEventListener('input', () => updateSelectedWidget({ content: latexEditorInput.value }));
    openCodeEditorBtn?.addEventListener('click', openCodeEditorModal);
    closeCodeEditorModalBtn?.addEventListener('click', closeCodeEditorModal);
    saveCodeEditorModalBtn?.addEventListener('click', saveCodeEditorModal);
    codeEditorModal?.addEventListener('mousedown', event => {
      if (event.target === codeEditorModal) closeCodeEditorModal();
    });
    codeEditorModal?.querySelector('.code-editor-dialog')?.addEventListener('mousedown', event => {
      event.stopPropagation();
    });
    codeLanguageSelect.addEventListener('change', () => {
      updateSelectedWidget({ language: codeLanguageSelect.value });
      if (aceCodeEditor && codeEditorModal && !codeEditorModal.hidden && editingCodeWidgetId === selectedWidgetId) {
        aceCodeEditor.session.setMode(`ace/mode/${aceModeForLanguage(codeLanguageSelect.value)}`);
      }
    });
    latexFontSizeInput.addEventListener('input', () => updateSelectedWidget({ fontSize: Number(latexFontSizeInput.value) || 34 }));
    codeFontSizeInput.addEventListener('input', () => updateSelectedWidget({ fontSize: Number(codeFontSizeInput.value) || 21 }));
    codeFocusLinesInput.addEventListener('input', () => updateSelectedWidget({ focusLines: codeFocusLinesInput.value }));
    codeShowLineNumbersInput.addEventListener('change', () => updateSelectedWidget({ showLineNumbers: codeShowLineNumbersInput.checked }));
    layerToTopBtn?.addEventListener('click', () => reorderSelectedLayer('top'));
    layerUpBtn?.addEventListener('click', () => reorderSelectedLayer('up'));
    layerDownBtn?.addEventListener('click', () => reorderSelectedLayer('down'));
    layerToBottomBtn?.addEventListener('click', () => reorderSelectedLayer('bottom'));
    transitionIdInput.addEventListener('input', () => updateSelectedAnimation({ transitionId: transitionIdInput.value }));
    fragmentEnabledInput.addEventListener('change', () => updateSelectedAnimation({ fragmentEnabled: fragmentEnabledInput.checked }));
    fragmentStyleSelect.addEventListener('change', () => updateSelectedAnimation({ fragmentStyle: fragmentStyleSelect.value }));
    fragmentIndexInput.addEventListener('input', () => updateSelectedAnimation({
      fragmentIndex: fragmentIndexInput.value === '' ? null : Math.max(0, Math.round(Number(fragmentIndexInput.value) || 0))
    }));
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
    alignLeftBtn.addEventListener('click', () => applyTextObjectStyle({ textAlign: 'left' }));
    alignCenterBtn.addEventListener('click', () => applyTextObjectStyle({ textAlign: 'center' }));
    alignRightBtn.addEventListener('click', () => applyTextObjectStyle({ textAlign: 'right' }));
    listStyleBtn.addEventListener('click', cycleTextList);
    textColorBtn.addEventListener('click', () => openIro('text'));
    bgColorBtn.addEventListener('click', () => openIro('background'));
    shapeStrokeBtn.addEventListener('click', () => openIro('shape-stroke'));
    shapeColorBtn.addEventListener('click', () => openIro('shape-fill'));
    shapeChoiceButtons.forEach(button => {
      button.addEventListener('click', () => replaceSelectedShape(button.dataset.shapeChoice));
    });
    shapeStrokeWidthInput.addEventListener('input', () => applyShapeStyle({ strokeWidth: Number(shapeStrokeWidthInput.value) || 0 }));
    shapeCornerRadiusInput.addEventListener('input', () => applyShapeStyle({ cornerRadius: Number(shapeCornerRadiusInput.value) || 0 }));
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
    shapeMenuBtn.classList.toggle('is-armed', pendingTool === 'rect' || pendingTool === 'circle' || pendingTool === 'triangle');
  }

  function bindSlideDrop() {
    let widgetDrag = null;

    const isCodeScrollbarInteraction = (event, widgetEl) => {
      if (!widgetEl?.classList.contains('code-widget')) return false;
      if (event.target.closest?.('.widget-edge-handle')) return false;
      const pre = event.target.closest?.('.code-widget pre') || widgetEl.querySelector('pre');
      if (!pre) return false;
      const rect = pre.getBoundingClientRect();
      const hitsVertical = pre.scrollHeight > pre.clientHeight && event.clientX >= rect.right - CODE_SCROLLBAR_HIT_GUTTER;
      return hitsVertical;
    };

    const beginWidgetDrag = event => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      let widgetEl = event.target.closest && event.target.closest('.slide-widget');
      if (!widgetEl && event.target.closest?.('.upper-canvas, .lower-canvas, .fabric-host') && !pointHitsFabricObject(event)) {
        widgetEl = widgetElementAtPoint(event);
      }
      const insideEditorUi = event.target.closest && event.target.closest('#controlChrome, #editorChrome, #objectToolbar, #codeEditorModal, .mode-switch, #overviewChrome');
      if (selectedWidgetId && !widgetEl && !insideEditorUi && event.button === 0) {
        exitWidgetEditorIfNeeded();
      }
      if (!widgetEl || event.button !== 0 || isOverviewEditing() || widgetDrag) return;
      if (isCodeScrollbarInteraction(event, widgetEl)) return;
      event.stopPropagation();
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
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
      if (found.widget.type === 'code') {
        finishCodeAutoAnimation();
        resetCodeWidgetRuntimeStyles(widgetEl, found.widget);
      }
      const edge = found.widget.type === 'code' ? (event.target.dataset.resizeEdge || inferResizeEdge(widgetEl, event)) : null;
      const layerRect = widgetEl.closest('.widget-layer').getBoundingClientRect();
      const scaleX = layerRect.width / SLIDE_W;
      const scaleY = layerRect.height / SLIDE_H;
      widgetDrag = {
        widgetId: widgetEl.dataset.widgetId,
        mode: edge ? 'resize' : 'move',
        edge,
        startX: event.clientX,
        startY: event.clientY,
        originalX: found.widget.x,
        originalY: found.widget.y,
        originalW: found.widget.w,
        originalH: found.widget.h,
        originalFontSize: found.widget.fontSize || (found.widget.type === 'code' ? 21 : 34),
        originalScale: found.widget.scale || 1,
        scaleX,
        scaleY,
        moved: false
      };
      widgetEl.classList.toggle('is-resizing', !!edge);
    };

    function inferResizeEdge(widgetEl, event) {
      if (!widgetEl.classList.contains('is-selected')) return null;
      const rect = widgetEl.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const pad = 10;
      const nearTop = Math.abs(y) <= pad;
      const nearBottom = Math.abs(y - rect.height) <= pad;
      const nearLeft = Math.abs(x) <= pad;
      const nearRight = Math.abs(x - rect.width) <= pad;
      if (nearTop && nearLeft) return 'top-left';
      if (nearTop && nearRight) return 'top-right';
      if (nearBottom && nearLeft) return 'bottom-left';
      if (nearBottom && nearRight) return 'bottom-right';
      if (nearTop && x > rect.width * 0.25 && x < rect.width * 0.75) return 'top';
      if (nearBottom && x > rect.width * 0.25 && x < rect.width * 0.75) return 'bottom';
      if (nearLeft && y > rect.height * 0.25 && y < rect.height * 0.75) return 'left';
      if (nearRight && y > rect.height * 0.25 && y < rect.height * 0.75) return 'right';
      return null;
    }

    const updateWidgetDrag = event => {
      if (!widgetDrag) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      const found = getWidget(widgetDrag.widgetId);
      if (!found.widget) return;
      const clientX = Number.isFinite(event.clientX) ? event.clientX : (Number.isFinite(event.pageX) ? event.pageX : widgetDrag.startX);
      const clientY = Number.isFinite(event.clientY) ? event.clientY : (Number.isFinite(event.pageY) ? event.pageY : widgetDrag.startY);
      const dx = (clientX - widgetDrag.startX) / widgetDrag.scaleX;
      const dy = (clientY - widgetDrag.startY) / widgetDrag.scaleY;
      const movedPixels = Math.abs(clientX - widgetDrag.startX) + Math.abs(clientY - widgetDrag.startY);
      if (!widgetDrag.moved && movedPixels < 5) return;
      widgetDrag.moved = true;
      if (widgetDrag.mode === 'resize') {
        resizeWidgetFromEdge(found.widget, widgetDrag, dx, dy);
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
        el.style.fontSize = `${found.widget.fontSize}px`;
        el.dataset.manualSize = found.widget.manualSize ? 'true' : 'false';
        positionWidgetContent(el, found.widget);
        if (widgetDrag.mode === 'resize') void el.offsetHeight;
      }
    };

    const endWidgetDrag = event => {
      if (!widgetDrag) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      }
      if (widgetDrag.moved) {
        saveDeck();
      }
      document.querySelector(`.slide-widget[data-widget-id="${widgetDrag.widgetId}"]`)?.classList.remove('is-resizing');
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

    slidesRoot.addEventListener('wheel', event => {
      const pre = event.target.closest?.('.code-widget pre');
      if (!pre) return;
      event.stopPropagation();
    }, { passive: true, capture: true });

    ['dragstart', 'selectstart'].forEach(type => {
      slidesRoot.addEventListener(type, event => {
        if (event.target.closest && event.target.closest('.slide-widget')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
    });

    function resizeWidgetFromEdge(widget, drag, dx, dy) {
      const minW = 40;
      const minH = 40;
      if (drag.edge.includes('right')) {
        widget.w = Math.max(minW, Math.min(drag.originalW + dx, SLIDE_W - widget.x));
      }
      if (drag.edge.includes('bottom')) {
        widget.h = Math.max(minH, Math.min(drag.originalH + dy, SLIDE_H - widget.y));
      }
      if (drag.edge.includes('left')) {
        const opposite = drag.originalX + drag.originalW;
        const nextX = Math.max(0, Math.min(drag.originalX + dx, opposite - minW));
        widget.x = nextX;
        widget.w = opposite - nextX;
      }
      if (drag.edge.includes('top')) {
        const opposite = drag.originalY + drag.originalH;
        const nextY = Math.max(0, Math.min(drag.originalY + dy, opposite - minH));
        widget.y = nextY;
        widget.h = opposite - nextY;
      }
    }

    slidesRoot.addEventListener('dblclick', event => {
      const widgetEl = event.target.closest('.slide-widget') || (
        event.target.closest?.('.upper-canvas, .lower-canvas, .fabric-host') && !pointHitsFabricObject(event)
          ? widgetElementAtPoint(event)
          : null
      );
      if (!widgetEl || isOverviewEditing()) return;
      event.preventDefault();
      event.stopPropagation();
      selectWidget(widgetEl.dataset.widgetId);
      const found = getWidget(widgetEl.dataset.widgetId);
      if (found.widget?.type === 'code') openCodeEditorModal();
    });

    slidesRoot.addEventListener('click', event => {
      const widgetEl = event.target.closest('.slide-widget') || (
        event.target.closest?.('.upper-canvas, .lower-canvas, .fabric-host') && !pointHitsFabricObject(event)
          ? widgetElementAtPoint(event)
          : null
      );
      if (!widgetEl || isOverviewEditing() || !document.body.classList.contains('asm-edit-mode')) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      selectWidget(widgetEl.dataset.widgetId);
    }, true);

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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && codeEditorModal && !codeEditorModal.hidden) {
        event.preventDefault();
        saveCodeEditorModal();
        return;
      }
      if (event.key === 'Escape' && codeEditorModal && !codeEditorModal.hidden) {
        event.preventDefault();
        closeCodeEditorModal();
        return;
      }
      if (event.key === 'Escape' && algorithmEditorModal && !algorithmEditorModal.hidden) {
        event.preventDefault();
        saveAlgorithmEditor();
        return;
      }
      if (event.key === 'Escape' && document.body.classList.contains('asm-edit-mode')) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (customOverviewOpen) closeCustomOverview();
        else openCustomOverview();
        return;
      }

      if (customOverviewOpen && (event.ctrlKey || event.metaKey)) {
        const key = event.key.toLowerCase();
        if (['a', 'c', 'x', 'v'].includes(key)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          if (key === 'a') selectAllCustomOverviewSlides();
          if (key === 'c') copyCustomOverviewSlides();
          if (key === 'x') cutCustomOverviewSlides();
          if (key === 'v') pasteCustomOverviewSlides();
          return;
        }
      }

      if (isEditableDomTarget(event)) return;

      if (document.body.classList.contains('asm-edit-mode') && !isOverviewEditing() && (event.ctrlKey || event.metaKey) && !isEditableDomTarget(event)) {
        const canvas = currentFabricCanvas();
        if (!canvas || !isTypingInFabric(canvas)) {
          const key = event.key.toLowerCase();
          const hasSelection = activeFabricObjects().length > 0 || selectedWidgetIdsInCurrentSlide().length > 0;
          const hasClipboard = objectClipboard.fabric.length > 0 || objectClipboard.widgets.length > 0;
          if (key === 'a') {
            event.preventDefault();
            selectAllCurrentObjects();
            return;
          }
          if (key === 'c' && hasSelection) {
            event.preventDefault();
            copyCurrentObjects();
            return;
          }
          if (key === 'x' && hasSelection) {
            event.preventDefault();
            cutCurrentObjects();
            return;
          }
          if (key === 'v' && hasClipboard) {
            event.preventDefault();
            pasteCurrentObjects();
            return;
          }
        }
      }

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

      if (isOverviewEditing()) {
        event.preventDefault();
        deleteOverviewSelectedSlide();
        return;
      }

      if (deleteCurrentObjectSelection()) event.preventDefault();
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

  function applyShapeStyle(style) {
    const canvas = currentFabricCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || isTextObject(active) || isImageObject(active)) return;
    const patch = { ...style };
    if ('strokeWidth' in patch) {
      applyInwardShapeStrokeWidth(active, patch.strokeWidth);
      delete patch.strokeWidth;
    }
    if ('cornerRadius' in patch) {
      if (active.type !== 'rect') return;
      patch.cornerRadius = Math.max(0, Number(patch.cornerRadius) || 0);
      patch.rx = patch.cornerRadius;
      patch.ry = patch.cornerRadius;
    }
    active.set(patch);
    active.setCoords();
    canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(active, canvas);
  }

  function replaceSelectedShape(type) {
    const canvas = currentFabricCanvas();
    const active = canvas?.getActiveObject();
    if (!canvas || !isShapeObject(active) || !['rect', 'circle', 'triangle'].includes(type) || active.type === type) return;
    finishFabricAutoAnimation();
    const index = canvas.getObjects().indexOf(active);
    const center = active.getCenterPoint();
    const width = Math.max(4, (Number(active.width) || (Number(active.radius) || 2) * 2) * Math.abs(Number(active.scaleX) || 1));
    const height = Math.max(4, (Number(active.height) || (Number(active.radius) || 2) * 2) * Math.abs(Number(active.scaleY) || 1));
    const replacement = createShape(type, 0, 0);
    const animation = normalizeAnimationSettings(active);
    replacement.set({
      fill: active.fill,
      stroke: active.stroke,
      strokeWidth: Number(active.strokeWidth) || 0,
      strokeUniform: true,
      angle: Number(active.angle) || 0,
      opacity: Number.isFinite(Number(active.opacity)) ? Number(active.opacity) : 1,
      ...animation,
      fragmentProxyId: active.fragmentProxyId || randomId()
    });
    if (type === 'circle') {
      replacement.set({ radius: Math.max(2, Math.min(width, height) / 2), scaleX: 1, scaleY: 1 });
    } else {
      replacement.set({ width, height, scaleX: 1, scaleY: 1 });
    }
    if (type === 'rect') {
      const radius = Math.max(0, Number(active.cornerRadius) || Number(active.rx) || 0);
      replacement.set({ cornerRadius: radius, rx: radius, ry: radius });
    }
    configureObject(replacement);
    replacement.setPositionByOrigin(center, 'center', 'center');
    replacement.setCoords();
    suppressCanvasSave = true;
    try {
      canvas.remove(active);
      canvas.insertAt(replacement, index, false);
      canvas.setActiveObject(replacement);
    } finally {
      suppressCanvasSave = false;
    }
    canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(replacement, canvas);
  }

  function applyInwardShapeStrokeWidth(obj, value) {
    const nextStrokeWidth = Math.max(0, Number(value) || 0);
    const previousStrokeWidth = Math.max(0, Number(obj.strokeWidth) || 0);
    const delta = nextStrokeWidth - previousStrokeWidth;
    if (Math.abs(delta) < 0.001) return;
    const center = obj.getCenterPoint();
    const scaleX = Math.max(0.001, Math.abs(Number(obj.scaleX) || 1));
    const scaleY = Math.max(0.001, Math.abs(Number(obj.scaleY) || 1));
    if (obj.type === 'circle') {
      const diameter = Math.max(4, (Number(obj.radius) || 2) * 2);
      obj.set({
        scaleX: Math.max(0.01, (diameter * scaleX - delta) / diameter),
        scaleY: Math.max(0.01, (diameter * scaleY - delta) / diameter)
      });
    } else {
      obj.set({
        width: Math.max(4, (Number(obj.width) || 4) - delta / scaleX),
        height: Math.max(4, (Number(obj.height) || 4) - delta / scaleY)
      });
    }
    obj.set({ strokeWidth: nextStrokeWidth, strokeUniform: true });
    obj.setPositionByOrigin(center, 'center', 'center');
  }

  function updateObjectToolbar(obj, canvas) {
    if (!obj || !document.body.classList.contains('asm-edit-mode')) {
      hideObjectToolbar();
      return;
    }
    showFabricObjectEditor(obj);
    if (isImageObject(obj)) {
      hideObjectToolbar({ keepAnimation: true });
      return;
    }
    if (isTextObject(obj)) {
      if (!obj.isEditing || obj.selectionStart === obj.selectionEnd) {
        hideObjectToolbar({ keepAnimation: true });
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
      alignLeftBtn.classList.toggle('is-active', (obj.textAlign || 'left') === 'left');
      alignCenterBtn.classList.toggle('is-active', obj.textAlign === 'center');
      alignRightBtn.classList.toggle('is-active', obj.textAlign === 'right');
      updateListButton(obj);
    } else {
      const strokeWidth = Number.isFinite(Number(obj.strokeWidth)) ? Number(obj.strokeWidth) : 0;
      const cornerRadius = Number.isFinite(Number(obj.cornerRadius)) ? Number(obj.cornerRadius) : (Number(obj.rx) || 0);
      const strokeColor = normalizeColor(obj.stroke || '#875bc7');
      const fillColor = normalizeColor(obj.fill || '#eee7fb');
      shapeStrokeBtn.style.setProperty('--shape-stroke-color', strokeColor);
      shapeStrokeBtn.style.setProperty('--shape-stroke-width', `${Math.max(1, Math.min(9, strokeWidth))}px`);
      shapeStrokeBtn.style.setProperty('--shape-corner-radius', `${Math.min(12, cornerRadius)}px`);
      shapeColorBtn.style.setProperty('--shape-fill-color', fillColor);
      shapeStrokeWidthInput.value = String(strokeWidth);
      shapeStrokeWidthValue.value = String(strokeWidth);
      shapeCornerRadiusControls.hidden = obj.type !== 'rect';
      shapeCornerRadiusInput.value = String(cornerRadius);
      shapeCornerRadiusValue.value = String(cornerRadius);
    }
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const bounds = obj.getBoundingRect(true, true);
    const scaleX = rect.width / SLIDE_W;
    const scaleY = rect.height / SLIDE_H;
    objectToolbar.hidden = false;
    const toolbarHeight = objectToolbar.offsetHeight || 44;
    const rotationControlClearance = !isTextObject(obj) ? 56 * scaleY : 8;
    objectToolbar.style.left = `${rect.left + (bounds.left + bounds.width / 2) * scaleX}px`;
    objectToolbar.style.top = `${Math.max(8, rect.top + bounds.top * scaleY - toolbarHeight - rotationControlClearance)}px`;
    objectToolbar.style.transform = 'translateX(-50%)';
  }

  function hideObjectToolbar({ keepAnimation = false } = {}) {
    objectToolbar.hidden = true;
    iroPopup.hidden = true;
    if (!keepAnimation && !selectedWidgetId) hideAnimationEditor();
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

  function widgetElementAtPoint(event) {
    const slide = getSlide();
    const layer = slide && document.querySelector(`.widget-layer[data-slide-id="${slide.id}"]`);
    if (!layer) return null;
    return Array.from(layer.querySelectorAll('.slide-widget'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return event.clientX >= rect.left
          && event.clientX <= rect.right
          && event.clientY >= rect.top
          && event.clientY <= rect.bottom;
      })
      .sort((a, b) => (Number(getComputedStyle(b).zIndex) || 0) - (Number(getComputedStyle(a).zIndex) || 0))[0] || null;
  }

  function isTextObject(obj) {
    return !!(obj && obj.type && obj.type.toLowerCase().includes('text'));
  }

  function isImageObject(obj) {
    return !!(obj && obj.type && obj.type.toLowerCase().includes('image'));
  }

  function isShapeObject(obj) {
    return !!(obj && ['rect', 'circle', 'triangle'].includes(obj.type));
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

  function activeTextObject() {
    const canvas = currentFabricCanvas();
    const active = canvas && canvas.getActiveObject();
    if (active && isTextObject(active)) return { canvas, object: active };
    if (canvas && textSelection && textSelection.object && canvas.getObjects().includes(textSelection.object)) {
      return { canvas, object: textSelection.object };
    }
    return {};
  }

  function applyTextObjectStyle(style) {
    const target = activeTextObject();
    if (!target.canvas || !target.object) return;
    target.object.set(style);
    target.object.setCoords();
    target.canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(target.object, target.canvas);
  }

  function lineRanges(text) {
    let offset = 0;
    return text.split('\n').map(line => {
      const range = { text: line, start: offset, end: offset + line.length };
      offset += line.length + 1;
      return range;
    });
  }

  function selectedLineIndexes(obj, start = obj?.selectionStart, end = obj?.selectionEnd) {
    if (!obj || typeof obj.text !== 'string' || start === end) return [];
    return lineRanges(obj.text)
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.end > start && line.start < end && line.text.trim().length)
      .map(({ index }) => index);
  }

  function listMarkerPattern(kind = 'any') {
    if (kind === 'bullet') return /^•(?:\s|\u00a0)+/;
    if (kind === 'number') return /^\d+\.(?:\s|\u00a0)+/;
    return /^(?:•|\d+\.)(?:\s|\u00a0)+/;
  }

  function textListState(obj) {
    if (!obj || typeof obj.text !== 'string') return 'none';
    const indexes = selectedLineIndexes(obj);
    if (!indexes.length) return 'none';
    const allLines = obj.text.split('\n');
    const lines = indexes.map(index => allLines[index]).filter(line => line.trim().length);
    if (!lines.length) return 'none';
    if (lines.every(line => listMarkerPattern('bullet').test(line))) return 'bullet';
    if (lines.every(line => listMarkerPattern('number').test(line))) return 'number';
    return 'none';
  }

  function updateListButton(obj) {
    const state = textListState(obj);
    listStyleBtn.textContent = state === 'bullet' ? '1.' : (state === 'number' ? '×' : '•');
    listStyleBtn.classList.toggle('is-active', state !== 'none');
  }

  function cycleTextList() {
    const target = getTextTarget();
    if (!target.canvas || !target.object || typeof target.object.text !== 'string' || target.start === target.end) return;
    const state = textListState(target.object);
    const kind = state === 'none' ? 'bullet' : (state === 'bullet' ? 'number' : 'none');
    const selectedIndexes = new Set(selectedLineIndexes(target.object, target.start, target.end));
    const lines = target.object.text.split('\n');
    const nextLines = lines.map((line, index) => {
      if (!selectedIndexes.has(index) || !line.trim()) return line;
      const clean = line.replace(listMarkerPattern(), '');
      if (kind === 'none') return clean;
      const selectedNumber = Array.from(selectedIndexes).filter(item => item <= index).length;
      return kind === 'number' ? `${selectedNumber}.\u00a0${clean}` : `•\u00a0${clean}`;
    });
    target.object.text = nextLines.join('\n');
    if (target.object.initDimensions) target.object.initDimensions();
    target.object.dirty = true;
    target.object.selectionStart = target.start;
    target.object.selectionEnd = Math.min(target.object.text.length, target.end + (target.object.text.length - lines.join('\n').length));
    target.object.setCoords();
    target.canvas.requestRenderAll();
    syncCurrentSlideCanvas();
    updateObjectToolbar(target.object, target.canvas);
  }

  function openIro(target) {
    const shouldClose = !iroPopup.hidden && activeColorTarget === target;
    activeColorTarget = target;
    iroPopup.hidden = shouldClose;
    if (iroPopup.hidden) return;
    shapeStyleControls.hidden = activeColorTarget !== 'shape-stroke';
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
        if (activeColorTarget === 'shape-fill') {
          applyShapeStyle({ fill: value });
        } else if (activeColorTarget === 'shape-stroke') {
          applyShapeStyle({ stroke: value });
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
    const current = activeColorTarget === 'shape-fill'
      ? (active?.fill || 'rgba(238, 231, 251, 1)')
      : activeColorTarget === 'shape-stroke'
        ? (active?.stroke || 'rgba(135, 91, 199, 1)')
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

  function getSlideById(slideId) {
    const pos = slidePositions.get(slideId);
    return pos && deck.groups[pos.h]?.slides[pos.v];
  }

  function sendAlgorithmAnimationToFrame(frame, slide) {
    if (!frame?.contentWindow || !slide || slide.kind !== 'algorithm-animation') return;
    frame.contentWindow.postMessage({
      type: 'asm-load-animation',
      animation: normalizeAlgorithmAnimation(slide.animation)
    }, window.location.origin);
  }

  function handleAlgorithmEmbedMessage(event) {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'asm-embed-ready') {
      if (event.source === algorithmEditorFrame?.contentWindow) {
        sendAlgorithmAnimationToFrame(algorithmEditorFrame, getSlideById(editingAlgorithmSlideId));
        return;
      }
      const runtimeFrame = Array.from(document.querySelectorAll('.algorithm-slide-frame'))
        .find(frame => frame.contentWindow === event.source);
      if (runtimeFrame) sendAlgorithmAnimationToFrame(runtimeFrame, getSlideById(runtimeFrame.dataset.slideId));
      return;
    }
    if (!['asm-animation-compiled', 'asm-save-animation'].includes(event.data.type)
      || event.source !== algorithmEditorFrame?.contentWindow) return;
    const slide = getSlideById(editingAlgorithmSlideId);
    if (!slide || slide.kind !== 'algorithm-animation') return;
    if (event.data.type === 'asm-animation-compiled') {
      if (algorithmEditorStatus) algorithmEditorStatus.textContent = '已取得最新編譯腳本。按右上角「儲存」寫入投影片並關閉。';
      return;
    }
    slide.animation = normalizeAlgorithmAnimation(event.data.animation);
    saveDeck();
    renderDeck();
    closeAlgorithmEditor();
    flashHint('已將目前演算法動畫腳本儲存到投影片。');
  }

  function openAlgorithmEditor(slideId) {
    const slide = getSlideById(slideId);
    if (!algorithmEditorModal || !algorithmEditorFrame || !slide || slide.kind !== 'algorithm-animation') return;
    editingAlgorithmSlideId = slideId;
    if (algorithmEditorStatus) algorithmEditorStatus.textContent = '編譯成功後，動畫腳本會儲存在這張投影片中。';
    algorithmEditorModal.hidden = false;
    algorithmEditorFrame.src = 'index.html?asmEmbed=editor';
  }

  function closeAlgorithmEditor() {
    if (!algorithmEditorModal || !algorithmEditorFrame) return;
    algorithmEditorModal.hidden = true;
    algorithmEditorFrame.src = 'about:blank';
    editingAlgorithmSlideId = null;
  }

  function saveAlgorithmEditor() {
    if (!algorithmEditorFrame?.contentWindow || !editingAlgorithmSlideId) return;
    if (algorithmEditorStatus) algorithmEditorStatus.textContent = '正在將目前程式碼、輸入與動畫腳本儲存到投影片...';
    algorithmEditorFrame.contentWindow.postMessage({
      type: 'asm-request-save-animation'
    }, window.location.origin);
  }

  function insertSlideNearCurrent(slide) {
    const group = getGroup();
    if (!group) return;
    if (group.slides.length > 1 || currentV > 0) {
      group.slides.splice(currentV + 1, 0, slide);
      currentV += 1;
    } else {
      deck.groups.splice(currentH + 1, 0, {
        id: randomId(),
        slides: [slide]
      });
      currentH += 1;
      currentV = 0;
    }
    saveDeck();
    renderDeck();
    if (customOverviewOpen) {
      overviewSelectedSlideId = slide.id;
      overviewSelectedSlideIds = new Set([slide.id]);
      overviewSelectionAnchorId = slide.id;
      renderCustomOverview();
      requestAnimationFrame(() => scrollCustomOverviewSelectionIntoView());
    }
  }

  function addSlideNearCurrent() {
    insertSlideNearCurrent(createBlankSlide());
  }

  function insertSlideRightOf(slideId, slide) {
    const pos = slidePositions.get(slideId);
    if (!pos) return;
    deck.groups.splice(pos.h + 1, 0, {
      id: randomId(),
      slides: [slide]
    });
    currentH = pos.h + 1;
    currentV = 0;
    saveDeck();
    renderDeck();
    refreshCustomOverviewAfterInsert(slide.id);
  }

  function insertSlideBelow(slideId, slide) {
    const pos = slidePositions.get(slideId);
    const group = pos && deck.groups[pos.h];
    if (!group) return;
    group.slides.splice(pos.v + 1, 0, slide);
    currentH = pos.h;
    currentV = pos.v + 1;
    saveDeck();
    renderDeck();
    refreshCustomOverviewAfterInsert(slide.id);
  }

  function refreshCustomOverviewAfterInsert(slideId) {
    if (!customOverviewOpen) return;
    overviewSelectedSlideId = slideId;
    overviewSelectedSlideIds = new Set([slideId]);
    overviewSelectionAnchorId = slideId;
    renderCustomOverview();
    requestAnimationFrame(() => scrollCustomOverviewSelectionIntoView());
  }

  function handleSlideEdgeAddClick(event) {
    const rightButton = event.target.closest && event.target.closest('[data-add-slide-right]');
    const bottomButton = event.target.closest && event.target.closest('[data-add-slide-bottom]');
    const button = rightButton || bottomButton;
    if (!button) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    const slideId = rightButton ? rightButton.dataset.addSlideRight : bottomButton.dataset.addSlideBottom;
    if (rightButton) insertSlideRightOf(slideId, createBlankSlide());
    else insertSlideBelow(slideId, createBlankSlide());
    return true;
  }

  function addAlgorithmSlideNearCurrent() {
    const slide = createAlgorithmAnimationSlide();
    insertSlideNearCurrent(slide);
    requestAnimationFrame(() => openAlgorithmEditor(slide.id));
  }

  function deleteOverviewSelectedSlide() {
    const ids = customOverviewOpen
      ? selectedOverviewSlideIds()
      : [getSlide()?.id].filter(Boolean);
    if (!ids.length || totalSlides() <= 1) return;
    const removableIds = ids.slice(0, Math.max(0, totalSlides() - 1));
    if (!removableIds.length) return;
    const beforeOrder = flatSlideIds();
    const firstDeletedIndex = beforeOrder.findIndex(id => removableIds.includes(id));
    removeSlidesByIds(removableIds);
    const afterOrder = flatSlideIds();
    const fallbackId = afterOrder[Math.min(Math.max(0, firstDeletedIndex), afterOrder.length - 1)] || afterOrder[0] || null;
    if (fallbackId) {
      overviewSelectedSlideId = fallbackId;
      overviewSelectedSlideIds = new Set([fallbackId]);
      overviewSelectionAnchorId = fallbackId;
      const pos = slidePositions.get(fallbackId);
      if (pos) {
        currentH = pos.h;
        currentV = pos.v;
      }
    }
    saveDeck();
    renderDeck();
    if (customOverviewOpen) renderCustomOverview();
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

  function removeSlidesByIds(slideIds) {
    const idSet = new Set(slideIds);
    const orderedIds = flatSlideIds().filter(id => idSet.has(id));
    const removed = new Map();
    const positions = orderedIds
      .map(id => ({ id, pos: slidePositions.get(id) }))
      .filter(item => item.pos)
      .sort((a, b) => b.pos.h - a.pos.h || b.pos.v - a.pos.v);
    positions.forEach(({ id, pos }) => {
      const [slide] = deck.groups[pos.h].slides.splice(pos.v, 1);
      if (slide) removed.set(id, slide);
    });
    deck.groups = deck.groups.filter(group => group.slides.length);
    rebuildPositions();
    return orderedIds.map(id => removed.get(id)).filter(Boolean);
  }

  function moveSlide(sourceId, targetId, side, { selectMoved = true } = {}) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const previousSelectedSlideId = overviewSelectedSlideId;
    const previousCurrentSlideId = getSlide()?.id;
    let targetPos = slidePositions.get(targetId);
    if (!targetPos) return;
    const moved = removeSlideById(sourceId);
    if (!moved) return;
    targetPos = slidePositions.get(targetId);
    if (!targetPos) return;

    if (side === 'left' || side === 'right') {
      const insertAt = targetPos.h + (side === 'right' ? 1 : 0);
      deck.groups.splice(insertAt, 0, { id: randomId(), slides: [moved] });
      currentH = insertAt;
      currentV = 0;
    } else {
      const group = deck.groups[targetPos.h];
      const insertAt = targetPos.v + (side === 'down' ? 1 : 0);
      group.slides.splice(insertAt, 0, moved);
      currentH = targetPos.h;
      currentV = insertAt;
    }

    rebuildPositions();
    if (selectMoved) {
      overviewSelectedSlideId = moved.id;
      overviewSelectedSlideIds = new Set([moved.id]);
      overviewSelectionAnchorId = moved.id;
      const movedPos = slidePositions.get(moved.id);
      if (movedPos) {
        currentH = movedPos.h;
        currentV = movedPos.v;
      }
    } else {
      overviewSelectedSlideId = previousSelectedSlideId;
      const currentPos = slidePositions.get(previousCurrentSlideId);
      if (currentPos) {
        currentH = currentPos.h;
        currentV = currentPos.v;
      }
    }
    saveDeck();
    renderDeck();
    if (customOverviewOpen) renderCustomOverview();
  }

  function moveSlidesAsHorizontalRow(sourceIds, targetId, side) {
    const orderedSourceIds = orderedOverviewIds(sourceIds);
    if (orderedSourceIds.length <= 1) {
      moveSlide(orderedSourceIds[0], targetId, side, { selectMoved: false });
      return;
    }
    if (!targetId || orderedSourceIds.includes(targetId)) return;
    const previousCurrentSlideId = getSlide()?.id;
    const normalizedSide = (side === 'right' || side === 'down') ? 'right' : 'left';
    const movedSlides = removeSlidesByIds(orderedSourceIds);
    if (!movedSlides.length) return;
    const targetPos = slidePositions.get(targetId);
    if (!targetPos) return;
    const insertAt = targetPos.h + (normalizedSide === 'right' ? 1 : 0);
    const groups = movedSlides.map(slide => ({ id: randomId(), slides: [slide] }));
    deck.groups.splice(insertAt, 0, ...groups);
    rebuildPositions();
    overviewSelectedSlideIds = new Set(movedSlides.map(slide => slide.id));
    overviewSelectedSlideId = movedSlides[0]?.id || null;
    overviewSelectionAnchorId = overviewSelectedSlideId;
    const movedPos = overviewSelectedSlideId && slidePositions.get(overviewSelectedSlideId);
    const previousPos = previousCurrentSlideId && slidePositions.get(previousCurrentSlideId);
    if (previousPos) {
      currentH = previousPos.h;
      currentV = previousPos.v;
    } else if (movedPos) {
      currentH = movedPos.h;
      currentV = movedPos.v;
    }
    saveDeck();
    renderDeck();
    if (customOverviewOpen) renderCustomOverview();
  }

  function selectAllCustomOverviewSlides() {
    applyCustomOverviewSelection(flatSlideIds(), overviewSelectedSlideId || getSlide()?.id || flatSlideIds()[0], overviewSelectionAnchorId || getSlide()?.id);
  }

  function copyCustomOverviewSlides() {
    const selectedIds = selectedOverviewSlideIds();
    slideClipboard = selectedIds
      .map(id => {
        const pos = slidePositions.get(id);
        return pos ? getSlide(pos.h, pos.v) : null;
      })
      .filter(Boolean)
      .map(slide => clone(slide));
  }

  function cutCustomOverviewSlides() {
    copyCustomOverviewSlides();
    if (!slideClipboard.length) return;
    deleteOverviewSelectedSlide();
  }

  function pasteCustomOverviewSlides() {
    if (!slideClipboard.length) return;
    const targetId = overviewSelectedSlideId || getSlide()?.id;
    const targetPos = targetId && slidePositions.get(targetId);
    if (!targetPos) return;
    const pastedSlides = slideClipboard.map(cloneSlideForPaste);
    const insertAt = targetPos.h + 1;
    deck.groups.splice(insertAt, 0, ...pastedSlides.map(slide => ({ id: randomId(), slides: [slide] })));
    rebuildPositions();
    overviewSelectedSlideIds = new Set(pastedSlides.map(slide => slide.id));
    overviewSelectedSlideId = pastedSlides[0]?.id || null;
    overviewSelectionAnchorId = overviewSelectedSlideId;
    const pos = overviewSelectedSlideId && slidePositions.get(overviewSelectedSlideId);
    if (pos) {
      currentH = pos.h;
      currentV = pos.v;
    }
    saveDeck();
    renderDeck();
    if (customOverviewOpen) {
      renderCustomOverview();
      requestAnimationFrame(() => scrollCustomOverviewSelectionIntoView());
    }
  }

  function openCustomOverview() {
    if (!customOverview || customOverviewOpen || !document.body.classList.contains('asm-edit-mode')) return;
    if (reveal && reveal.isOverview && reveal.isOverview()) reveal.toggleOverview();
    customOverviewOpen = true;
    overviewSelectedSlideId = getSlide()?.id || overviewSelectedSlideId;
    overviewSelectedSlideIds = new Set([overviewSelectedSlideId].filter(Boolean));
    overviewSelectionAnchorId = overviewSelectedSlideId;
    customOverview.hidden = false;
    overviewChrome.hidden = true;
    document.body.classList.add('custom-overview-open');
    showOverviewSidebarPanel();
    hideObjectToolbar();
    exitWidgetEditorIfNeeded();
    fabricCanvases.forEach(canvas => {
      canvas.skipTargetFind = true;
      canvas.discardActiveObject();
    });
    renderCustomOverview();
    requestAnimationFrame(() => scrollCustomOverviewSelectionIntoView());
  }

  function closeCustomOverview() {
    if (!customOverviewOpen) return;
    const pos = overviewSelectedSlideId && slidePositions.get(overviewSelectedSlideId);
    if (pos) {
      currentH = pos.h;
      currentV = pos.v;
    }
    customOverviewOpen = false;
    customOverviewDrag = null;
    clearDropPreview();
    clearCustomOverviewDragGhost();
    if (customOverview) customOverview.hidden = true;
    overviewChrome.hidden = true;
    document.body.classList.remove('custom-overview-open');
    showDefaultPanel();
    fabricCanvases.forEach(canvas => {
      canvas.skipTargetFind = false;
    });
    if (reveal) {
      reveal.slide(currentH, currentV);
      reveal.layout();
    }
    applyEditMode(document.body.classList.contains('asm-edit-mode'));
  }

  function renderCustomOverview() {
    if (!customOverviewBoard || !customOverviewOpen) return;
    rebuildPositions();
    customOverviewBoard.innerHTML = '';
    deck.groups.forEach((group, h) => {
      const column = document.createElement('div');
      column.className = 'custom-overview-column';
      column.dataset.h = String(h);
      group.slides.forEach((slide, v) => column.appendChild(createCustomOverviewThumb(slide, h, v)));
      customOverviewBoard.appendChild(column);
    });
  }

  function flatSlideIds() {
    return deck.groups.flatMap(group => group.slides.map(slide => slide.id));
  }

  function orderedOverviewIds(ids) {
    const idSet = new Set(ids);
    return flatSlideIds().filter(id => idSet.has(id));
  }

  function selectedOverviewSlideIds() {
    const ordered = orderedOverviewIds(overviewSelectedSlideIds);
    if (ordered.length) return ordered;
    return [overviewSelectedSlideId || getSlide()?.id].filter(Boolean);
  }

  function createCustomOverviewThumb(slide, h, v) {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'custom-overview-thumb';
    thumb.dataset.slideId = slide.id;
    thumb.dataset.h = String(h);
    thumb.dataset.v = String(v);
    thumb.classList.toggle('is-selected', overviewSelectedSlideIds.has(slide.id));
    thumb.setAttribute('aria-label', `Slide ${h + 1}${v ? `.${v + 1}` : ''}`);

    const mini = document.createElement('div');
    mini.className = 'custom-overview-mini';

    if (slide.kind === 'algorithm-animation') {
      const preview = document.createElement('div');
      preview.className = 'algorithm-overview-preview';
      preview.innerHTML = '<div>{;}<span>演算法動畫</span></div>';
      mini.appendChild(preview);
      thumb.appendChild(mini);
      return thumb;
    }

    const image = document.createElement('img');
    image.alt = '';
    image.draggable = false;
    image.src = slideCanvasDataUrl(slide);
    mini.appendChild(image);

    const renderedLayer = document.querySelector(`.widget-layer[data-slide-id="${slide.id}"]`);
    if (renderedLayer) {
      mini.appendChild(renderedLayer.cloneNode(true));
    } else {
      const layer = document.createElement('div');
      layer.className = 'widget-layer';
      renderSlideWidgets(layer, slide);
      mini.appendChild(layer);
    }

    thumb.appendChild(mini);
    return thumb;
  }

  function slideCanvasDataUrl(slide) {
    const canvas = fabricCanvases.get(slide.id);
    try {
      if (canvas && canvas.toDataURL) return canvas.toDataURL({ format: 'png' });
      const el = document.getElementById(`fabric-${slide.id}`);
      if (el && el.toDataURL) return el.toDataURL('image/png');
    } catch (err) {
      // A blank fallback keeps the overview usable even if a canvas cannot be exported.
    }
    return 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"%3E%3Crect width="1280" height="720" fill="%23fbfcfa"/%3E%3C/svg%3E';
  }

  function scrollCustomOverviewSelectionIntoView() {
    const selected = customOverviewBoard && customOverviewBoard.querySelector('.custom-overview-thumb.is-selected');
    if (selected) selected.scrollIntoView({ block: 'center', inline: 'center' });
  }

  function selectCustomOverviewSlide(slideId) {
    if (!slideId) return;
    overviewSelectedSlideIds = new Set([slideId]);
    overviewSelectionAnchorId = slideId;
    overviewSelectedSlideId = slideId;
    const pos = slidePositions.get(slideId);
    if (pos) {
      currentH = pos.h;
      currentV = pos.v;
    }
    customOverviewBoard?.querySelectorAll('.custom-overview-thumb').forEach(thumb => {
      thumb.classList.toggle('is-selected', thumb.dataset.slideId === slideId);
    });
  }

  function applyCustomOverviewSelection(slideIds, focusId, anchorId = focusId) {
    const orderedIds = orderedOverviewIds(slideIds);
    overviewSelectedSlideIds = new Set(orderedIds);
    overviewSelectedSlideId = focusId || orderedIds[orderedIds.length - 1] || null;
    overviewSelectionAnchorId = anchorId || overviewSelectedSlideId;
    const pos = overviewSelectedSlideId && slidePositions.get(overviewSelectedSlideId);
    if (pos) {
      currentH = pos.h;
      currentV = pos.v;
    }
    customOverviewBoard?.querySelectorAll('.custom-overview-thumb').forEach(thumb => {
      thumb.classList.toggle('is-selected', overviewSelectedSlideIds.has(thumb.dataset.slideId));
    });
  }

  function selectCustomOverviewSlideFromEvent(slideId, event) {
    if (!slideId) return;
    const order = flatSlideIds();
    if (event.shiftKey && overviewSelectionAnchorId && order.includes(overviewSelectionAnchorId)) {
      const start = order.indexOf(overviewSelectionAnchorId);
      const end = order.indexOf(slideId);
      const [from, to] = start <= end ? [start, end] : [end, start];
      applyCustomOverviewSelection(order.slice(from, to + 1), slideId, overviewSelectionAnchorId);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      const next = new Set(overviewSelectedSlideIds);
      if (next.has(slideId)) next.delete(slideId);
      else next.add(slideId);
      if (!next.size) next.add(slideId);
      const ordered = orderedOverviewIds(next);
      applyCustomOverviewSelection(next, next.has(slideId) ? slideId : ordered[ordered.length - 1], slideId);
      return;
    }
    selectCustomOverviewSlide(slideId);
  }

  function bindOverviewEvents() {
    reveal.on('overviewshown', () => {
      if (!document.body.classList.contains('asm-edit-mode')) return;
      overviewChrome.hidden = false;
      hideObjectToolbar();
      flashHint('拖曳投影片到目標的上、下、左、右來排序。');
      fabricCanvases.forEach(canvas => {
        canvas.skipTargetFind = true;
        canvas.discardActiveObject();
      });
      prepareOverview();
      applyOverviewPan();
      refreshOverviewScrollbars();
      setOverviewShieldVisible(true);
    });

    reveal.on('overviewhidden', () => {
      overviewChrome.hidden = true;
      clearDropPreview();
      overviewPanX = 0;
      overviewPanY = 0;
      applyOverviewPan();
      setOverviewScrollbarsVisible(false);
      setOverviewShieldVisible(false);
      applyEditMode(document.body.classList.contains('asm-edit-mode'));
    });
  }

  function prepareOverview() {
    document.querySelectorAll('section.asm-slide').forEach(section => {
      section.draggable = false;
      section.classList.remove('is-overview-selected');
    });
  }

  function bindCustomOverview() {
    customOverviewViewport?.addEventListener('wheel', event => {
      if (!customOverviewOpen) return;
      event.preventDefault();
      const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const unit = event.deltaMode === 1 ? 28 : (event.deltaMode === 2 ? window.innerWidth : 1);
      if (customOverviewRightMouseDown || (event.buttons & 2)) customOverviewViewport.scrollTop += dominantDelta * unit;
      else customOverviewViewport.scrollLeft += dominantDelta * unit;
    }, { passive: false });

    customOverviewViewport?.addEventListener('contextmenu', event => {
      if (!customOverviewOpen) return;
      event.preventDefault();
    });

    customOverviewViewport?.addEventListener('pointerdown', event => {
      if (!customOverviewOpen || event.button !== 2) return;
      customOverviewRightMouseDown = true;
      event.preventDefault();
    }, true);

    document.addEventListener('pointerup', event => {
      if (event.button === 2 || event.buttons === 0) customOverviewRightMouseDown = false;
    }, true);

    document.addEventListener('pointercancel', () => {
      customOverviewRightMouseDown = false;
    }, true);

    window.addEventListener('blur', () => {
      customOverviewRightMouseDown = false;
    });

    customOverviewBoard?.addEventListener('click', event => {
      if (!customOverviewOpen) return;
      if (suppressCustomOverviewClick) {
        event.preventDefault();
        suppressCustomOverviewClick = false;
        return;
      }
      const thumb = event.target.closest('.custom-overview-thumb');
      if (!thumb) return;
      selectCustomOverviewSlideFromEvent(thumb.dataset.slideId, event);
    });

    const begin = event => {
      if (!customOverviewOpen || event.button !== 0) return;
      const thumb = event.target.closest && event.target.closest('.custom-overview-thumb');
      if (!thumb) return;
      event.preventDefault();
      event.stopPropagation();
      const slideId = thumb.dataset.slideId;
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !overviewSelectedSlideIds.has(slideId)) {
        selectCustomOverviewSlide(slideId);
      }
      const sourceIds = overviewSelectedSlideIds.has(slideId) ? selectedOverviewSlideIds() : [slideId];
      customOverviewDrag = {
        sourceId: slideId,
        sourceIds,
        sourceEl: thumb,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        ghost: null
      };
      if (event.pointerId != null && customOverviewViewport.setPointerCapture) {
        try {
          customOverviewViewport.setPointerCapture(event.pointerId);
        } catch (err) {
          // Document listeners keep the drag alive if pointer capture is unavailable.
        }
      }
    };

    const move = event => {
      if (!customOverviewDrag || !customOverviewOpen) return;
      if (customOverviewDrag.pointerId != null && event.pointerId != null && event.pointerId !== customOverviewDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const moved = Math.abs(event.clientX - customOverviewDrag.startX) + Math.abs(event.clientY - customOverviewDrag.startY);
      if (moved < 8) return;
      if (!customOverviewDrag.active) {
        customOverviewDrag.active = true;
        customOverviewDrag.sourceEls = customOverviewDrag.sourceIds
          .map(id => customOverviewBoard.querySelector(`.custom-overview-thumb[data-slide-id="${id}"]`))
          .filter(Boolean);
        customOverviewDrag.sourceEls.forEach(el => el.classList.add('is-overview-drag-source'));
        customOverviewDrag.ghost = createCustomOverviewDragGhost(customOverviewDrag.sourceEls);
      }
      updateCustomOverviewDragGhost(customOverviewDrag, event);
      const candidate = customOverviewDropCandidate(event.clientX, event.clientY, customOverviewDrag.sourceIds);
      if (!candidate) {
        clearDropPreview();
        return;
      }
      showCustomOverviewDropPreview(candidate);
    };

    const end = event => {
      if (!customOverviewDrag) return;
      if (customOverviewDrag.pointerId != null && event.pointerId != null && event.pointerId !== customOverviewDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const drag = customOverviewDrag;
      customOverviewDrag = null;
      clearDropPreview();
      clearCustomOverviewDragGhost(drag);
      suppressCustomOverviewClick = true;
      setTimeout(() => {
        suppressCustomOverviewClick = false;
      }, 120);
      if (event.pointerId != null && customOverviewViewport.releasePointerCapture) {
        try {
          customOverviewViewport.releasePointerCapture(event.pointerId);
        } catch (err) {
          // The browser may have already released this pointer.
        }
      }
      if (!drag.active) {
        selectCustomOverviewSlideFromEvent(drag.sourceId, event);
        return;
      }
      const candidate = customOverviewDropCandidate(event.clientX, event.clientY, drag.sourceIds);
      if (!candidate || candidate.noOp) {
        renderCustomOverview();
        return;
      }
      if (drag.sourceIds.length > 1) {
        moveSlidesAsHorizontalRow(drag.sourceIds, candidate.section.dataset.slideId, candidate.side);
      } else {
        moveSlide(drag.sourceId, candidate.section.dataset.slideId, candidate.side, { selectMoved: false });
      }
    };

    customOverviewViewport?.addEventListener('pointerdown', begin, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
  }

  function customOverviewThumbFromPoint(x, y, excludedIds = new Set()) {
    return document.elementsFromPoint(x, y)
      .find(el => el.matches && el.matches('.custom-overview-thumb') && !excludedIds.has(el.dataset.slideId));
  }

  function nearestCustomOverviewThumbFromPoint(x, y, excludedIds = new Set()) {
    const direct = customOverviewThumbFromPoint(x, y, excludedIds);
    if (direct) return direct;
    let best = null;
    customOverviewBoard?.querySelectorAll('.custom-overview-thumb').forEach(thumb => {
      if (excludedIds.has(thumb.dataset.slideId)) return;
      const rect = thumb.getBoundingClientRect();
      const dx = x < rect.left ? rect.left - x : (x > rect.right ? x - rect.right : 0);
      const dy = y < rect.top ? rect.top - y : (y > rect.bottom ? y - rect.bottom : 0);
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) best = { thumb, distance };
    });
    if (!best) return null;
    const rect = best.thumb.getBoundingClientRect();
    const maxDistance = Math.max(70, Math.min(rect.width, rect.height) * 0.75);
    return best.distance <= maxDistance * maxDistance ? best.thumb : null;
  }

  function customOverviewDropCandidate(x, y, sourceIds) {
    const ids = Array.isArray(sourceIds) ? sourceIds.filter(Boolean) : [sourceIds].filter(Boolean);
    if (!ids.length) return null;
    const excludedIds = new Set(ids);
    const section = nearestCustomOverviewThumbFromPoint(x, y, excludedIds);
    if (!section) return null;
    const sideInfo = dropSideInfo({ clientX: x, clientY: y }, section);
    if (!sideInfo || sideInfo.distance > 0.5) return null;
    const side = ids.length > 1
      ? ((sideInfo.side === 'right' || sideInfo.side === 'down') ? 'right' : 'left')
      : sideInfo.side;
    const noOp = ids.length === 1 && isNoOpSlideMove(ids[0], section.dataset.slideId, side);
    if (ids.length === 1 && !noOp && !isValidSlideMove(ids[0], section.dataset.slideId, side)) return null;
    return { section, side, sourceId: ids[0], sourceIds: ids, noOp };
  }

  function showCustomOverviewDropPreview(candidate) {
    clearDropPreview();
    const line = ensureOverviewDropLine();
    const rect = customOverviewInsertionLineRect(candidate.section, candidate.side);
    const thickness = 6;
    if (candidate.side === 'up' || candidate.side === 'down') {
      line.style.left = `${rect.left}px`;
      line.style.top = `${rect.y - thickness / 2}px`;
      line.style.width = `${rect.width}px`;
      line.style.height = `${thickness}px`;
    } else {
      line.style.left = `${rect.x - thickness / 2}px`;
      line.style.top = `${rect.top}px`;
      line.style.width = `${thickness}px`;
      line.style.height = `${rect.height}px`;
    }
    line.style.display = 'block';
    dropPreview = { section: candidate.section, side: candidate.side };
  }

  function customOverviewInsertionLineRect(section, side) {
    const rect = section.getBoundingClientRect();
    const gapX = customOverviewGap('x');
    const gapY = customOverviewGap('y', Number(section.dataset.h || 0));
    const fake = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    if (side === 'left') {
      fake.left = rect.left - gapX - rect.width;
      fake.right = fake.left + rect.width;
    }
    if (side === 'right') {
      fake.left = rect.right + gapX;
      fake.right = fake.left + rect.width;
    }
    if (side === 'up') {
      fake.top = rect.top - gapY - rect.height;
      fake.bottom = fake.top + rect.height;
    }
    if (side === 'down') {
      fake.top = rect.bottom + gapY;
      fake.bottom = fake.top + rect.height;
    }
    const overhang = 8;
    if (side === 'up' || side === 'down') {
      const y = side === 'up' ? (fake.bottom + rect.top) / 2 : (rect.bottom + fake.top) / 2;
      return {
        left: Math.min(rect.left, fake.left) - overhang,
        y,
        width: Math.max(rect.right, fake.right) - Math.min(rect.left, fake.left) + overhang * 2
      };
    }
    const x = side === 'left' ? (fake.right + rect.left) / 2 : (rect.right + fake.left) / 2;
    return {
      x,
      top: Math.min(rect.top, fake.top) - overhang,
      height: Math.max(rect.bottom, fake.bottom) - Math.min(rect.top, fake.top) + overhang * 2
    };
  }

  function customOverviewGap(axis, h = null) {
    const selector = axis === 'x'
      ? '.custom-overview-column'
      : `.custom-overview-thumb[data-h="${h}"]`;
    const intervals = Array.from(customOverviewBoard?.querySelectorAll(selector) || [])
      .map(el => {
        const rect = el.getBoundingClientRect();
        return axis === 'x' ? { start: rect.left, end: rect.right } : { start: rect.top, end: rect.bottom };
      })
      .filter(interval => interval.end - interval.start > 1)
      .sort((a, b) => a.start - b.start);
    let gap = Infinity;
    for (let index = 1; index < intervals.length; index += 1) {
      const nextGap = intervals[index].start - intervals[index - 1].end;
      if (nextGap > 0.5 && nextGap < gap) gap = nextGap;
    }
    return Number.isFinite(gap) ? gap : (axis === 'x' ? 34 : 28);
  }

  function createCustomOverviewDragGhost(thumbs) {
    const sourceThumbs = Array.isArray(thumbs) ? thumbs : [thumbs].filter(Boolean);
    if (!sourceThumbs.length) return null;
    const rect = sourceThumbs[0].getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'overview-drag-ghost custom-overview-multi-ghost';
    sourceThumbs.forEach(thumb => {
      const clone = thumb.cloneNode(true);
      clone.classList.remove('is-selected', 'is-overview-drag-source');
      clone.setAttribute('aria-hidden', 'true');
      ghost.appendChild(clone);
    });
    if (sourceThumbs.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'custom-overview-drag-count';
      badge.textContent = String(sourceThumbs.length);
      ghost.appendChild(badge);
    }
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function updateCustomOverviewDragGhost(drag, event) {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.transform = `translate(${event.clientX - drag.startX}px, ${event.clientY - drag.startY}px)`;
  }

  function clearCustomOverviewDragGhost(drag = customOverviewDrag) {
    if (!drag) return;
    if (drag.sourceEls) drag.sourceEls.forEach(el => el.classList.remove('is-overview-drag-source'));
    drag.sourceEl?.classList.remove('is-overview-drag-source');
    if (drag.ghost) drag.ghost.remove();
  }

  function bindOverviewDrag() {
    const haltOverviewEvent = event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    };

    const isOverviewPassthroughTarget = event => {
      const target = event.target;
      if (target && target.closest && target.closest([
        '.controls',
        '.navigate-left',
        '.navigate-right',
        '.navigate-up',
        '.navigate-down',
        '#overviewHScrollbar',
        '#overviewVScrollbar',
        '#overviewChrome',
        '#controlChrome',
        '#editorChrome',
        '.mode-switch',
        'button',
        'input',
        'select',
        'textarea',
        'a'
      ].join(','))) {
        return true;
      }
      const x = event.clientX;
      const y = event.clientY;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      return [overviewHScrollbar, overviewVScrollbar].some(el => {
        if (!el || el.hidden) return false;
        const rect = el.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });
    };

    const startOverviewDrag = event => {
      if (!isRevealEditOverviewActive()) return false;
      if (isOverviewPassthroughTarget(event)) return false;
      const section = (event.target.closest && event.target.closest('section.asm-slide')) || overviewSlideFromPoint(event.clientX, event.clientY);
      if (!section || event.button !== 0) return false;
      haltOverviewEvent(event);
      if (pointerDrag) return true;
      draggedSlideId = section.dataset.slideId;
      pointerDrag = {
        sourceId: section.dataset.slideId,
        sourceEl: section,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false
      };
      overviewEventShield?.classList.add('is-dragging');
      if (event.pointerId != null && slidesRoot.setPointerCapture) {
        try {
          slidesRoot.setPointerCapture(event.pointerId);
        } catch (err) {
          // Capture is best-effort; document-level listeners keep the drag alive.
        }
      }
      return true;
    };

    const updateOverviewDrag = event => {
      if (!pointerDrag || !isRevealEditOverviewActive()) return false;
      if (pointerDrag.pointerId != null && event.pointerId != null && event.pointerId !== pointerDrag.pointerId) return false;
      haltOverviewEvent(event);
      const moved = Math.abs(event.clientX - pointerDrag.startX) + Math.abs(event.clientY - pointerDrag.startY);
      if (moved < 8) return true;
      if (!pointerDrag.active) {
        pointerDrag.active = true;
        pointerDrag.sourceEl?.classList.add('is-overview-drag-source');
        pointerDrag.ghost = createOverviewDragGhost(pointerDrag.sourceEl);
      }
      updateOverviewDragGhost(pointerDrag, event);
      const candidate = overviewDropCandidate(event.clientX, event.clientY, pointerDrag.sourceId);
      if (!candidate) {
        clearDropPreview();
        return true;
      }
      showDropPreview(candidate);
      return true;
    };

    const endOverviewDrag = event => {
      if (!pointerDrag) return false;
      if (pointerDrag.pointerId != null && event.pointerId != null && event.pointerId !== pointerDrag.pointerId) return false;
      haltOverviewEvent(event);
      const drag = pointerDrag;
      pointerDrag = null;
      draggedSlideId = null;
      clearDropPreview();
      clearOverviewDragVisuals(drag);
      overviewEventShield?.classList.remove('is-dragging');
      if (event.pointerId != null && slidesRoot.releasePointerCapture) {
        try {
          slidesRoot.releasePointerCapture(event.pointerId);
        } catch (err) {
          // The pointer may already have been released by the browser.
        }
      }
      if (!drag.active || !isRevealEditOverviewActive()) {
        suppressOverviewClick = true;
        setTimeout(() => {
          suppressOverviewClick = false;
        }, 120);
        return true;
      }
      suppressOverviewClick = true;
      setTimeout(() => {
        suppressOverviewClick = false;
      }, 120);
      const candidate = overviewDropCandidate(event.clientX, event.clientY, drag.sourceId);
      if (!candidate) {
        return true;
      }
      if (candidate.noOp) return true;
      moveSlide(drag.sourceId, candidate.section.dataset.slideId, candidate.side, { selectMoved: false });
      return true;
    };

    slidesRoot.addEventListener('click', event => {
      if (!isRevealEditOverviewActive()) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      suppressOverviewClick = false;
    }, true);

    slidesRoot.addEventListener('dragstart', event => {
      if (!isRevealEditOverviewActive()) return;
      haltOverviewEvent(event);
      draggedSlideId = null;
      clearDropPreview();
    });

    slidesRoot.addEventListener('dragover', event => {
      if (!isRevealEditOverviewActive()) return;
      haltOverviewEvent(event);
    });

    slidesRoot.addEventListener('dragleave', event => {
      if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) clearDropPreview();
    });

    slidesRoot.addEventListener('drop', event => {
      if (!isRevealEditOverviewActive()) return;
      haltOverviewEvent(event);
      clearDropPreview();
      draggedSlideId = null;
    });

    slidesRoot.addEventListener('dragend', event => {
      if (isRevealEditOverviewActive()) haltOverviewEvent(event);
      draggedSlideId = null;
      clearDropPreview();
    });

    const handleOverviewWheel = event => {
      if (!isRevealEditOverviewActive()) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const unit = event.deltaMode === 1 ? 28 : (event.deltaMode === 2 ? window.innerWidth : 1);
      if (event.buttons & 2) {
        overviewPanY = clampOverviewPanY(overviewPanY - dominantDelta * unit);
      } else {
        overviewPanX = clampOverviewPanX(overviewPanX - dominantDelta * unit);
      }
      applyOverviewPan();
      syncOverviewScrollbarPositions();
      syncOverviewRevealToPan();
    };

    document.addEventListener('wheel', handleOverviewWheel, { passive: false, capture: true });

    document.addEventListener('contextmenu', event => {
      if (!isRevealEditOverviewActive()) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }, true);

    overviewHScrollbar?.addEventListener('scroll', () => {
      if (suppressOverviewScrollbar || !isRevealEditOverviewActive()) return;
      const range = overviewPanRangeX();
      overviewPanX = range.max - overviewHScrollbar.scrollLeft;
      overviewPanX = clampOverviewPanX(overviewPanX);
      applyOverviewPan();
      syncOverviewRevealToPan();
    });

    overviewVScrollbar?.addEventListener('scroll', () => {
      if (suppressOverviewScrollbar || !isRevealEditOverviewActive()) return;
      const range = overviewPanRangeY();
      overviewPanY = range.max - overviewVScrollbar.scrollTop;
      overviewPanY = clampOverviewPanY(overviewPanY);
      applyOverviewPan();
      syncOverviewRevealToPan();
    });

    slidesRoot.addEventListener('pointerdown', event => startOverviewDrag(event), true);
    overviewEventShield?.addEventListener('pointerdown', event => startOverviewDrag(event), true);
    window.addEventListener('pointerdown', event => startOverviewDrag(event), true);

    document.addEventListener('pointermove', event => updateOverviewDrag(event), true);
    window.addEventListener('pointermove', event => updateOverviewDrag(event), true);

    document.addEventListener('pointerup', event => endOverviewDrag(event), true);
    window.addEventListener('pointerup', event => endOverviewDrag(event), true);

    document.addEventListener('pointercancel', event => {
      if (!endOverviewDrag(event)) return;
      clearDropPreview();
    }, true);
    window.addEventListener('pointercancel', event => {
      if (!endOverviewDrag(event)) return;
      clearDropPreview();
    }, true);

    slidesRoot.addEventListener('mousedown', event => startOverviewDrag(event), true);
    overviewEventShield?.addEventListener('mousedown', event => startOverviewDrag(event), true);
    window.addEventListener('mousedown', event => startOverviewDrag(event), true);

    document.addEventListener('mousemove', event => updateOverviewDrag(event), true);
    window.addEventListener('mousemove', event => updateOverviewDrag(event), true);

    document.addEventListener('mouseup', event => endOverviewDrag(event), true);
    window.addEventListener('mouseup', event => endOverviewDrag(event), true);

    overviewEventShield?.addEventListener('click', event => {
      if (!isRevealEditOverviewActive()) return;
      haltOverviewEvent(event);
    }, true);

    window.addEventListener('click', event => {
      if (!suppressOverviewClick || !isRevealEditOverviewActive()) return;
      haltOverviewEvent(event);
      suppressOverviewClick = false;
    }, true);

    document.addEventListener('click', event => {
      if (!suppressOverviewClick || !isRevealEditOverviewActive()) return;
      haltOverviewEvent(event);
      suppressOverviewClick = false;
    }, true);
  }

  function overviewSlideFromPoint(x, y) {
    return document.elementsFromPoint(x, y).find(el => el.matches && el.matches('section.asm-slide'));
  }

  function nearestOverviewSlideFromPoint(x, y, sourceId) {
    const direct = overviewSlideFromPoint(x, y);
    if (direct) return direct;
    let best = null;
    document.querySelectorAll('section.asm-slide').forEach(section => {
      if (section.dataset.slideId === sourceId) return;
      const rect = section.getBoundingClientRect();
      const dx = x < rect.left ? rect.left - x : (x > rect.right ? x - rect.right : 0);
      const dy = y < rect.top ? rect.top - y : (y > rect.bottom ? y - rect.bottom : 0);
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) best = { section, distance };
    });
    if (!best) return null;
    const rect = best.section.getBoundingClientRect();
    const maxDistance = Math.max(80, Math.min(rect.width, rect.height) * 0.55);
    return best.distance <= maxDistance * maxDistance ? best.section : null;
  }

  function overviewDropCandidate(x, y, sourceId) {
    if (!sourceId) return null;
    const section = nearestOverviewSlideFromPoint(x, y, sourceId);
    if (!section) return null;
    const sideInfo = dropSideInfo({ clientX: x, clientY: y }, section);
    if (!sideInfo || sideInfo.distance > 0.5) return null;
    const side = sideInfo.side;
    const noOp = isNoOpSlideMove(sourceId, section.dataset.slideId, side);
    if (!noOp && !isValidSlideMove(sourceId, section.dataset.slideId, side)) return null;
    return { section, side, sourceId, noOp };
  }

  function isValidSlideMove(sourceId, targetId, side) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const sourcePos = slidePositions.get(sourceId);
    const targetPos = slidePositions.get(targetId);
    if (!sourcePos || !targetPos) return false;
    if (isNoOpSlideMove(sourceId, targetId, side)) return false;
    return true;
  }

  function isNoOpSlideMove(sourceId, targetId, side) {
    if (!sourceId || !targetId) return false;
    if (sourceId === targetId) return true;
    const sourcePos = slidePositions.get(sourceId);
    const targetPos = slidePositions.get(targetId);
    if (!sourcePos || !targetPos) return false;
    if (side === 'up' || side === 'down') {
      if (sourcePos.h === targetPos.h) {
        if (side === 'up' && sourcePos.v === targetPos.v - 1) return true;
        if (side === 'down' && sourcePos.v === targetPos.v + 1) return true;
      }
      return false;
    }
    const sourceGroup = deck.groups[sourcePos.h];
    if (sourceGroup && sourceGroup.slides.length === 1) {
      if (side === 'left' && sourcePos.h === targetPos.h - 1) return true;
      if (side === 'right' && sourcePos.h === targetPos.h + 1) return true;
    }
    return false;
  }

  function dropSide(event, section) {
    return dropSideInfo(event, section).side;
  }

  function dropSideInfo(event, section) {
    const rect = section.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (!isTopOverviewSlide(section)) {
      const up = y;
      const down = 1 - y;
      return up <= down ? { side: 'up', distance: up } : { side: 'down', distance: down };
    }
    const left = x;
    const right = 1 - x;
    const up = y;
    const down = 1 - y;
    const min = Math.min(left, right, up, down);
    if (min === left) return { side: 'left', distance: left };
    if (min === right) return { side: 'right', distance: right };
    if (min === up) return { side: 'up', distance: up };
    return { side: 'down', distance: down };
  }

  function isTopOverviewSlide(section) {
    return Number(section.dataset.v || 0) === 0;
  }

  function showDropPreview(candidate) {
    clearDropPreview();
    const { section, side } = candidate;
    const line = ensureOverviewDropLine();
    const placeholderRect = placeOverviewDropPlaceholder(section, side);
    const rect = insertionLineRect(section, side, placeholderRect);
    const thickness = 6;
    if (side === 'up' || side === 'down') {
      line.style.left = `${rect.left}px`;
      line.style.top = `${rect.y - thickness / 2}px`;
      line.style.width = `${rect.width}px`;
      line.style.height = `${thickness}px`;
    } else {
      line.style.left = `${rect.x - thickness / 2}px`;
      line.style.top = `${rect.top}px`;
      line.style.width = `${thickness}px`;
      line.style.height = `${rect.height}px`;
    }
    line.style.display = 'block';
    dropPreview = { section, side };
  }

  function insertionLineRect(section, side, placeholderRect) {
    const rect = section.getBoundingClientRect();
    const overhang = 14;

    if (side === 'up' || side === 'down') {
      const y = side === 'up'
        ? (placeholderRect.bottom + rect.top) / 2
        : (rect.bottom + placeholderRect.top) / 2;
      const left = Math.min(rect.left, placeholderRect.left) - overhang;
      const right = Math.max(rect.right, placeholderRect.right) + overhang;
      return {
        left,
        y,
        width: right - left
      };
    }

    const x = side === 'left'
      ? (placeholderRect.right + rect.left) / 2
      : (rect.right + placeholderRect.left) / 2;
    const top = Math.min(rect.top, placeholderRect.top) - overhang;
    const bottom = Math.max(rect.bottom, placeholderRect.bottom) + overhang;
    return {
      x,
      top,
      height: Math.max(12, bottom - top)
    };
  }

  function placeOverviewDropPlaceholder(section, side) {
    const rect = section.getBoundingClientRect();
    const placeholder = ensureOverviewDropPlaceholder();
    const gapX = overviewSlideGap('x');
    const gapY = overviewSlideGap('y', Number(section.dataset.h || 0));
    let left = rect.left;
    let top = rect.top;
    if (side === 'left') left = rect.left - gapX - rect.width;
    if (side === 'right') left = rect.right + gapX;
    if (side === 'up') top = rect.top - gapY - rect.height;
    if (side === 'down') top = rect.bottom + gapY;
    placeholder.style.left = `${left}px`;
    placeholder.style.top = `${top}px`;
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    return placeholder.getBoundingClientRect();
  }

  function ensureOverviewDropPlaceholder() {
    if (!overviewDropPlaceholder) {
      overviewDropPlaceholder = document.createElement('div');
      overviewDropPlaceholder.className = 'overview-drop-placeholder';
      overviewDropPlaceholder.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overviewDropPlaceholder);
    }
    return overviewDropPlaceholder;
  }

  function groupBounds(h, excludedId = null) {
    const sections = Array.from(document.querySelectorAll(`section.asm-slide[data-h="${h}"]`))
      .filter(section => section.dataset.slideId !== excludedId)
      .filter(section => {
        const rect = section.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      });
    if (!sections.length) return null;
    const rects = sections.map(section => section.getBoundingClientRect());
    const left = Math.min(...rects.map(rect => rect.left));
    const right = Math.max(...rects.map(rect => rect.right));
    const top = Math.min(...rects.map(rect => rect.top));
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function overviewSlideGap(axis, h = null, excludedId = null) {
    const intervals = axis === 'x'
      ? deck.groups.map((group, index) => groupBounds(index, excludedId)).filter(Boolean).map(bounds => ({ start: bounds.left, end: bounds.right }))
      : Array.from(document.querySelectorAll(`section.asm-slide[data-h="${h}"]`))
        .filter(section => section.dataset.slideId !== excludedId)
        .map(section => {
          const rect = section.getBoundingClientRect();
          return { start: rect.top, end: rect.bottom };
        })
        .filter(interval => interval.end - interval.start > 1);
    intervals.sort((a, b) => a.start - b.start);
    let gap = Infinity;
    for (let index = 1; index < intervals.length; index += 1) {
      const currentGap = intervals[index].start - intervals[index - 1].end;
      if (currentGap > 0.5 && currentGap < gap) gap = currentGap;
    }
    if (Number.isFinite(gap)) return gap;
    const fallbackSize = intervals[0] ? Math.max(6, (intervals[0].end - intervals[0].start) * 0.055) : 10;
    return fallbackSize;
  }

  function clampOverviewPanX(nextPanX) {
    const range = overviewPanRangeX();
    return Math.max(range.min, Math.min(range.max, nextPanX));
  }

  function clampOverviewPanY(nextPanY) {
    const range = overviewPanRangeY();
    return Math.max(range.min, Math.min(range.max, nextPanY));
  }

  function overviewPanRangeX() {
    const centers = overviewEdgeCenters();
    if (!centers) return { min: 0, max: 0 };
    const viewportCenter = window.innerWidth / 2;
    const min = overviewPanX + viewportCenter - centers.last;
    const max = overviewPanX + viewportCenter - centers.first;
    return min > max ? { min: max, max } : { min, max };
  }

  function overviewPanRangeY() {
    const centers = overviewVerticalEdgeCenters();
    if (!centers) return { min: 0, max: 0 };
    const viewportCenter = window.innerHeight / 2;
    const min = overviewPanY + viewportCenter - centers.last;
    const max = overviewPanY + viewportCenter - centers.first;
    return min > max ? { min: max, max } : { min, max };
  }

  function overviewEdgeCenters() {
    const groups = deck.groups
      .map((group, index) => ({ index, bounds: groupBounds(index) }))
      .filter(item => item.bounds);
    if (!groups.length) return null;
    groups.sort((a, b) => a.index - b.index);
    const first = groups[0].bounds;
    const last = groups[groups.length - 1].bounds;
    return {
      first: (first.left + first.right) / 2,
      last: (last.left + last.right) / 2
    };
  }

  function overviewVerticalEdgeCenters() {
    const sections = Array.from(document.querySelectorAll('section.asm-slide'))
      .map(section => ({ section, rect: section.getBoundingClientRect() }))
      .filter(item => item.rect.width > 1 && item.rect.height > 1)
      .sort((a, b) => a.rect.top - b.rect.top);
    if (!sections.length) return null;
    const first = sections[0].rect;
    const last = sections[sections.length - 1].rect;
    return {
      first: (first.top + first.bottom) / 2,
      last: (last.top + last.bottom) / 2
    };
  }

  function applyOverviewPan() {
    const active = reveal && reveal.isOverview && reveal.isOverview();
    slidesRoot.style.marginLeft = active && overviewPanX ? `${overviewPanX}px` : '';
    slidesRoot.style.marginTop = active && overviewPanY ? `${overviewPanY}px` : '';
  }

  function syncOverviewRevealToPan() {
    if (!reveal || !reveal.isOverview || !reveal.isOverview() || pointerDrag) return;
    const target = nearestOverviewSlideToCenter();
    if (!target || (target.h === currentH && target.v === currentV)) return;
    currentH = target.h;
    currentV = target.v;
    syncOverviewClasses();
    syncOverviewControls();
  }

  function nearestOverviewSlideToCenter() {
    const viewportX = window.innerWidth / 2;
    const viewportY = window.innerHeight / 2;
    let best = null;
    document.querySelectorAll('section.asm-slide').forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return;
      const centerX = (rect.left + rect.right) / 2;
      const centerY = (rect.top + rect.bottom) / 2;
      const distance = Math.abs(centerX - viewportX) + Math.abs(centerY - viewportY) * 0.45;
      if (!best || distance < best.distance) {
        best = {
          h: Number(section.dataset.h || 0),
          v: Number(section.dataset.v || 0),
          distance
        };
      }
    });
    return best;
  }

  function syncOverviewClasses() {
    document.querySelectorAll('section.asm-slide').forEach(section => {
      const h = Number(section.dataset.h || 0);
      const v = Number(section.dataset.v || 0);
      section.classList.toggle('present', h === currentH && v === currentV);
      section.classList.toggle('past', h < currentH || (h === currentH && v < currentV));
      section.classList.toggle('future', h > currentH || (h === currentH && v > currentV));
    });
  }

  function syncOverviewControls() {
    const left = document.querySelector('.navigate-left');
    const right = document.querySelector('.navigate-right');
    const up = document.querySelector('.navigate-up');
    const down = document.querySelector('.navigate-down');
    const hasLeft = currentH > 0;
    const hasRight = currentH < deck.groups.length - 1;
    const group = deck.groups[currentH];
    const hasUp = currentV > 0;
    const hasDown = !!group && currentV < group.slides.length - 1;
    setControlEnabled(left, hasLeft);
    setControlEnabled(right, hasRight);
    setControlEnabled(up, hasUp);
    setControlEnabled(down, hasDown);
  }

  function setControlEnabled(el, enabled) {
    if (!el) return;
    el.classList.toggle('enabled', enabled);
    if (!enabled) el.classList.remove('highlight');
    el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function setOverviewScrollbarsVisible(visible) {
    if (overviewHScrollbar) overviewHScrollbar.hidden = !visible;
    if (overviewVScrollbar) overviewVScrollbar.hidden = !visible;
  }

  function setOverviewShieldVisible(visible) {
    if (!overviewEventShield) return;
    overviewEventShield.hidden = !visible;
    if (!visible) overviewEventShield.classList.remove('is-dragging');
  }

  function refreshOverviewScrollbars() {
    if (!reveal || !reveal.isOverview || !reveal.isOverview()) {
      setOverviewScrollbarsVisible(false);
      return;
    }
    setOverviewScrollbarsVisible(true);
    const xRange = overviewPanRangeX();
    const yRange = overviewPanRangeY();
    const xScrollable = Math.max(1, xRange.max - xRange.min);
    const yScrollable = Math.max(1, yRange.max - yRange.min);
    if (overviewHScrollContent && overviewHScrollbar) {
      overviewHScrollContent.style.width = `${Math.ceil(overviewHScrollbar.clientWidth + xScrollable)}px`;
    }
    if (overviewVScrollContent && overviewVScrollbar) {
      overviewVScrollContent.style.height = `${Math.ceil(overviewVScrollbar.clientHeight + yScrollable)}px`;
    }
    syncOverviewScrollbarPositions();
  }

  function syncOverviewScrollbarPositions() {
    if (!overviewHScrollbar || !overviewVScrollbar) return;
    const xRange = overviewPanRangeX();
    const yRange = overviewPanRangeY();
    suppressOverviewScrollbar = true;
    overviewHScrollbar.scrollLeft = Math.max(0, xRange.max - overviewPanX);
    overviewVScrollbar.scrollTop = Math.max(0, yRange.max - overviewPanY);
    requestAnimationFrame(() => {
      suppressOverviewScrollbar = false;
    });
  }

  function clearDropPreview() {
    if (overviewDropLine) overviewDropLine.style.display = 'none';
    if (overviewDropPlaceholder) {
      overviewDropPlaceholder.remove();
      overviewDropPlaceholder = null;
    }
    dropPreview = null;
  }

  function ensureOverviewDropLine() {
    if (!overviewDropLine) {
      overviewDropLine = document.createElement('div');
      overviewDropLine.className = 'overview-drop-line';
      document.body.appendChild(overviewDropLine);
    }
    return overviewDropLine;
  }

  function createOverviewDragGhost(section) {
    if (!section) return null;
    const rect = section.getBoundingClientRect();
    const ghost = section.cloneNode(true);
    ghost.classList.add('overview-drag-ghost');
    ghost.classList.remove('asm-slide', 'present', 'past', 'future', 'is-overview-selected', 'is-overview-drag-source');
    ghost.removeAttribute('data-slide-id');
    ghost.removeAttribute('data-h');
    ghost.removeAttribute('data-v');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    const originalCanvases = Array.from(section.querySelectorAll('canvas'));
    const ghostCanvases = Array.from(ghost.querySelectorAll('canvas'));
    ghostCanvases.forEach((canvas, index) => {
      const original = originalCanvases[index];
      if (!original || !original.toDataURL) return;
      const image = document.createElement('img');
      try {
        image.src = original.toDataURL('image/png');
      } catch (err) {
        return;
      }
      image.className = canvas.className;
      image.style.cssText = canvas.style.cssText;
      image.style.width = `${canvas.getBoundingClientRect().width || rect.width}px`;
      image.style.height = `${canvas.getBoundingClientRect().height || rect.height}px`;
      canvas.replaceWith(image);
    });
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function updateOverviewDragGhost(drag, event) {
    if (!drag || !drag.ghost) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.ghost.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function clearOverviewDragVisuals(drag) {
    if (!drag) return;
    drag.sourceEl?.classList.remove('is-overview-drag-source');
    if (drag.ghost) drag.ghost.remove();
  }

  function flashHint(text) {
    const hint = document.getElementById('editHint');
    hint.textContent = text;
    clearTimeout(flashHint.timer);
    flashHint.timer = setTimeout(() => {
      hint.textContent = 'ESC 開啟 overview，可拖曳排序投影片。';
    }, 1800);
  }

  function debugNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
  }

  function debugPreview(value, limit = 120) {
    if (typeof value !== 'string') return '';
    const preview = value.replace(/\s+/g, ' ').trim();
    return preview.length > limit ? `${preview.slice(0, limit)}...` : preview;
  }

  function debugAnimation(source = {}) {
    const animation = normalizeAnimationSettings(source);
    return {
      transitionId: animation.transitionId,
      fragmentEnabled: animation.fragmentEnabled,
      fragmentStyle: animation.fragmentStyle,
      fragmentIndex: animation.fragmentIndex
    };
  }

  function debugFabricObject(savedObject, runtimeObject, index, isSelected) {
    const source = runtimeObject || savedObject || {};
    return {
      index,
      type: source.type || savedObject?.type || 'unknown',
      textPreview: debugPreview(source.text || savedObject?.text),
      position: {
        left: debugNumber(source.left),
        top: debugNumber(source.top),
        angle: debugNumber(source.angle)
      },
      size: {
        width: debugNumber(source.width),
        height: debugNumber(source.height),
        radius: debugNumber(source.radius),
        scaleX: debugNumber(source.scaleX),
        scaleY: debugNumber(source.scaleY),
        strokeWidth: debugNumber(source.strokeWidth)
      },
      colors: {
        fill: source.fill ?? null,
        stroke: source.stroke ?? null
      },
      selected: !!isSelected,
      savedVisible: savedObject ? savedObject.visible !== false : null,
      runtimeVisible: runtimeObject ? runtimeObject.visible !== false : null,
      fragmentProxyId: source.fragmentProxyId || savedObject?.fragmentProxyId || '',
      animation: debugAnimation(source)
    };
  }

  function debugWidget(widget, index, layer) {
    const el = layer?.querySelector(`.slide-widget[data-widget-id="${widget.id}"]`);
    const style = el && getComputedStyle(el);
    return {
      index,
      id: widget.id,
      type: widget.type,
      position: {
        x: debugNumber(widget.x),
        y: debugNumber(widget.y)
      },
      size: {
        width: debugNumber(widget.w),
        height: debugNumber(widget.h),
        fontSize: debugNumber(widget.fontSize)
      },
      contentPreview: debugPreview(widget.content),
      focusLines: widget.type === 'code' ? widget.focusLines : undefined,
      showLineNumbers: widget.type === 'code' ? widget.showLineNumbers : undefined,
      selected: widget.id === selectedWidgetId || !!el?.classList.contains('is-selected'),
      runtime: el ? {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        fragmentVisible: el.classList.contains('visible')
      } : null,
      animation: debugAnimation(widget)
    };
  }

  function getSelectedObjectInfo() {
    const revealIndices = reveal && reveal.getIndices ? reveal.getIndices() : null;
    const slide = getSlide();
    const context = {
      generatedAt: new Date().toISOString(),
      chapter: currentH + 1,
      slideInChapter: currentV + 1,
      h: currentH,
      v: currentV,
      slideId: slide?.id || null,
      revealIndices
    };
    if (!slide) return { context, selected: null };

    if (selectedWidgetId) {
      const widgets = normalizeWidgets(slide.widgets);
      const index = widgets.findIndex(widget => widget.id === selectedWidgetId);
      const widget = widgets[index];
      const layer = document.querySelector(`.widget-layer[data-slide-id="${slide.id}"]`);
      return {
        context,
        selected: widget ? {
          kind: 'widget',
          ...debugWidget(widget, index, layer)
        } : null
      };
    }

    const canvas = currentFabricCanvas();
    const runtimeObject = canvas?.getActiveObject();
    if (!runtimeObject || runtimeObject.type === 'activeSelection') {
      return {
        context,
        selected: runtimeObject?.type === 'activeSelection'
          ? { kind: 'fabric-active-selection', count: canvas.getActiveObjects().length }
          : null
      };
    }
    const runtimeObjects = canvas.getObjects();
    const savedObjects = (slide.canvas && slide.canvas.objects) || [];
    const index = runtimeObjects.indexOf(runtimeObject);
    const savedObject = savedObjects.find(obj => obj.fragmentProxyId && obj.fragmentProxyId === runtimeObject.fragmentProxyId)
      || savedObjects[index];
    return {
      context,
      selected: {
        kind: 'fabric',
        ...debugFabricObject(savedObject, runtimeObject, index, true)
      }
    };
  }

  function logSelectedObjectInfo() {
    return getSelectedObjectInfo();
  }

  window.asmDebugSelected = logSelectedObjectInfo;
  window.asmDebugSelectedText = () => JSON.stringify(getSelectedObjectInfo(), null, 2);

  function updateDiagnostics() {
    const totalObjects = deck.groups.reduce((sum, group) => {
      return sum + group.slides.reduce((slideSum, slide) => {
        return slideSum + (((slide.canvas || {}).objects || []).length);
      }, 0);
    }, 0);
    const totalWidgets = deck.groups.reduce((sum, group) => {
      return sum + group.slides.reduce((slideSum, slide) => slideSum + normalizeWidgets(slide.widgets).length, 0);
    }, 0);
    const totalAlgorithmSlides = deck.groups.reduce((sum, group) => {
      return sum + group.slides.filter(slide => slide.kind === 'algorithm-animation').length;
    }, 0);
    document.body.dataset.slideCount = String(totalSlides());
    document.body.dataset.groupCount = String(deck.groups.length);
    document.body.dataset.fabricObjectCount = String(totalObjects);
    document.body.dataset.widgetCount = String(totalWidgets);
    document.body.dataset.algorithmSlideCount = String(totalAlgorithmSlides);
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
      scrollActivationWidth: null,
      plugins: [
        window.RevealNotes,
        window.RevealSearch,
        window.RevealZoom,
        window.RevealHighlight,
        window.RevealMath && window.RevealMath.KaTeX
      ].filter(Boolean)
    }).then(() => {
      revealReady = true;
      document.body.dataset.revealPlugins = Object.keys(reveal.getPlugins ? reveal.getPlugins() : {}).join(',');
      reveal.on('slidechanged', event => {
        if (pointerDrag) return;
        currentH = event.indexh;
        currentV = event.indexv || 0;
        updateAlgorithmEditButton();
        refreshFabricFragmentVisibility();
      });
      reveal.on('autoanimate', animateSlideAutoTransition);
      reveal.on('fragmentshown', refreshFabricFragmentVisibility);
      reveal.on('fragmenthidden', refreshFabricFragmentVisibility);
      bindOverviewEvents();
      setTimeout(refreshRevealWidgets, 1200);
    });
  }

  bindChrome();
  bindSlideDrop();
  bindCustomOverview();
  bindOverviewDrag();
  renderDeck();
  updateAlgorithmEditButton();
  saveDeck({ history: false });
  pushHistorySnapshot();
  initReveal();
})();
