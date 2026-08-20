(function () {
  const svg = document.getElementById('syntaxTreeSvg');
  const status = document.getElementById('syntaxTreeStatus');
  if (!svg || !status) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MIN_NODE_WIDTH = 52;
  const MAX_NODE_WIDTH = 152;
  const NODE_HEIGHT = 44;
  const LEAF_GAP = 18;
  const LEVEL_GAP = 78;
  const VIEW_PADDING = 36;
  const FALLBACK_COLORS = {
    declare: '#25824d',
    read: '#3976b8',
    write: '#c8483f',
    assign: '#c8483f',
    compare: '#c38a16',
    condition: '#7b61a8',
    swap: '#1d8f83',
    fixed: '#4caf50',
    call: '#65737a',
    'function-enter': '#59656b',
    'function-exit': '#59656b'
  };

  let lastSource = null;
  let requestSequence = 0;
  let baseView = null;
  let currentView = null;
  let panState = null;
  const measureContext = document.createElement('canvas').getContext('2d');

  function element(name, attributes = {}) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function colorFor(type) {
    return window.ASMTraceEvents?.color?.(type) || FALLBACK_COLORS[type] || '#65737a';
  }

  function contrastingText(hex) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return '#ffffff';
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return red * 0.299 + green * 0.587 + blue * 0.114 > 155 ? '#151718' : '#ffffff';
  }

  function shorten(value, maximum) {
    const text = String(value || '');
    return text.length > maximum ? `${text.slice(0, Math.max(1, maximum - 1))}...` : text;
  }

  function measuredTextWidth(value, font) {
    if (!measureContext) return String(value || '').length * 6;
    measureContext.font = font;
    return measureContext.measureText(String(value || '')).width;
  }

  function sizeNode(node) {
    node.typeLabel = shorten(node.type, 23);
    node.sourceLabel = shorten(node.text, 22);
    const typeWidth = measuredTextWidth(node.typeLabel, '700 11px Arial');
    const sourceWidth = node.sourceLabel
      ? measuredTextWidth(node.sourceLabel, '9px Arial')
      : 0;
    node.layoutWidth = Math.max(
      MIN_NODE_WIDTH,
      Math.min(MAX_NODE_WIDTH, Math.ceil(Math.max(typeWidth, sourceWidth) + 20))
    );
  }

  function assignLayout(root) {
    let maxDepth = 0;

    function measure(node) {
      maxDepth = Math.max(maxDepth, Number(node.depth) || 0);
      sizeNode(node);
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach(measure);
      const childrenWidth = children.reduce((total, child) => total + child.subtreeWidth, 0)
        + Math.max(0, children.length - 1) * LEAF_GAP;
      node.subtreeWidth = Math.max(node.layoutWidth, childrenWidth);
    }

    function place(node, left) {
      const children = Array.isArray(node.children) ? node.children : [];
      node.layoutX = left + (node.subtreeWidth - node.layoutWidth) / 2;
      node.layoutY = (Number(node.depth) || 0) * (NODE_HEIGHT + LEVEL_GAP);
      if (!children.length) return;
      const childrenWidth = children.reduce((total, child) => total + child.subtreeWidth, 0)
        + Math.max(0, children.length - 1) * LEAF_GAP;
      let childLeft = left + (node.subtreeWidth - childrenWidth) / 2;
      children.forEach(child => {
        place(child, childLeft);
        childLeft += child.subtreeWidth + LEAF_GAP;
      });
    }

    measure(root);
    place(root, 0);
    return {
      width: root.subtreeWidth,
      height: maxDepth * (NODE_HEIGHT + LEVEL_GAP) + NODE_HEIGHT
    };
  }

  function collectNodes(root) {
    const nodes = [];
    (function visit(node) {
      nodes.push(node);
      (node.children || []).forEach(visit);
    }(root));
    return nodes;
  }

  function applyViewBox(view) {
    currentView = { ...view };
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  }

  function fit() {
    if (baseView) applyViewBox(baseView);
  }

  function render(payload) {
    svg.replaceChildren();
    if (!payload?.root) {
      status.textContent = '沒有可顯示的語法樹';
      status.hidden = false;
      return;
    }

    const bounds = assignLayout(payload.root);
    const nodes = collectNodes(payload.root);
    const edgeLayer = element('g', { class: 'syntax-tree-edges' });
    const nodeLayer = element('g', { class: 'syntax-tree-nodes' });

    nodes.forEach(node => {
      (node.children || []).forEach(child => {
        edgeLayer.appendChild(element('path', {
          class: 'syntax-tree-edge',
          d: `M ${node.layoutX + node.layoutWidth / 2} ${node.layoutY + NODE_HEIGHT}`
            + ` V ${node.layoutY + NODE_HEIGHT + LEVEL_GAP / 2}`
            + ` H ${child.layoutX + child.layoutWidth / 2}`
            + ` V ${child.layoutY}`
        }));
      });
    });

    nodes.forEach(node => {
      const fill = colorFor(node.eventType);
      const foreground = contrastingText(fill);
      const group = element('g', {
        class: 'syntax-tree-node',
        transform: `translate(${node.layoutX} ${node.layoutY})`,
        'data-node-type': node.type,
        'data-event-type': node.eventType,
        'data-line': node.line
      });
      group.appendChild(element('rect', {
        width: node.layoutWidth,
        height: NODE_HEIGHT,
        fill,
        rx: 2,
        ry: 2
      }));

      const title = element('title');
      title.textContent = `${node.type} · 第 ${node.line} 行${node.text ? `\n${node.text}` : ''}`;
      group.appendChild(title);

      const typeText = element('text', {
        class: 'syntax-tree-node-type',
        x: node.layoutWidth / 2,
        y: node.text ? 17 : 27,
        fill: foreground,
        'text-anchor': 'middle'
      });
      typeText.textContent = node.typeLabel;
      group.appendChild(typeText);

      if (node.text) {
        const sourceText = element('text', {
          class: 'syntax-tree-node-source',
          x: node.layoutWidth / 2,
          y: 34,
          fill: foreground,
          'text-anchor': 'middle'
        });
        sourceText.textContent = node.sourceLabel;
        group.appendChild(sourceText);
      }
      nodeLayer.appendChild(group);
    });

    svg.append(edgeLayer, nodeLayer);
    baseView = {
      x: -VIEW_PADDING,
      y: -VIEW_PADDING,
      width: bounds.width + VIEW_PADDING * 2,
      height: bounds.height + VIEW_PADDING * 2
    };
    fit();
    status.hidden = true;
    svg.dataset.nodeCount = String(payload.nodeCount || nodes.length);
  }

  async function refresh(source) {
    const code = String(source ?? '');
    lastSource = code;
    const sequence = ++requestSequence;
    status.textContent = '正在產生語法樹...';
    status.hidden = false;
    try {
      const response = await fetch('/syntax-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '無法建立語法樹');
      if (sequence !== requestSequence) return;
      render(payload);
    } catch (error) {
      if (sequence !== requestSequence) return;
      svg.replaceChildren();
      baseView = null;
      currentView = null;
      status.textContent = error.message || '無法建立語法樹';
      status.hidden = false;
    }
  }

  function ensureCurrent(source) {
    const code = String(source ?? '');
    if (code !== lastSource || !svg.childElementCount) return refresh(code);
    return Promise.resolve();
  }

  svg.addEventListener('wheel', event => {
    if (!currentView || !baseView) return;
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const scale = Math.min(rect.width / currentView.width, rect.height / currentView.height);
    const offsetX = (rect.width - currentView.width * scale) / 2;
    const offsetY = (rect.height - currentView.height * scale) / 2;
    const pointerX = currentView.x + (event.clientX - rect.left - offsetX) / scale;
    const pointerY = currentView.y + (event.clientY - rect.top - offsetY) / scale;
    const factor = Math.exp(event.deltaY * 0.0014);
    const minimumWidth = Math.max(MAX_NODE_WIDTH * 1.25, baseView.width * 0.035);
    const nextWidth = Math.min(baseView.width, Math.max(minimumWidth, currentView.width * factor));
    const ratio = nextWidth / currentView.width;
    const nextHeight = currentView.height * ratio;
    if (Math.abs(nextWidth - currentView.width) < 0.01) return;

    applyViewBox({
      x: pointerX - (pointerX - currentView.x) * ratio,
      y: pointerY - (pointerY - currentView.y) * ratio,
      width: nextWidth,
      height: nextHeight
    });
  }, { passive: false });

  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !currentView) return;
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(rect.width / currentView.width, rect.height / currentView.height);
    panState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scale,
      view: { ...currentView }
    };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add('is-panning');
  });

  svg.addEventListener('pointermove', event => {
    if (!panState || event.pointerId !== panState.pointerId) return;
    applyViewBox({
      ...panState.view,
      x: panState.view.x - (event.clientX - panState.startX) / panState.scale,
      y: panState.view.y - (event.clientY - panState.startY) / panState.scale
    });
  });

  function finishPan(event) {
    if (!panState || event.pointerId !== panState.pointerId) return;
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    panState = null;
    svg.classList.remove('is-panning');
  }

  svg.addEventListener('pointerup', finishPan);
  svg.addEventListener('pointercancel', finishPan);

  window.ASMSyntaxTree = { refresh, ensureCurrent, fit };
}());
