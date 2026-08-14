(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const TREE_MODES = new Set(['binary_tree', 'heap', 'segment_tree', 'BIT']);
  const ONE_BASED_MODES = new Set(['heap', 'segment_tree', 'BIT']);
  const ORIGINAL_RENDERERS = {
    normal: 'draw_array_normal',
    heap: 'draw_array_heap',
    segment_tree: 'draw_array_segment_tree',
    BIT: 'draw_array_BIT',
    disk: 'draw_array_disk',
    stack: 'draw_array_stack',
    queue: 'draw_array_queue'
  };
  const MODE_LABELS = {
    normal: 'Array',
    matrix: '2D Array',
    binary_tree: 'Tree',
    heap: 'Heap',
    segment_tree: 'Segment Tree',
    BIT: 'Binary Indexed Tree',
    disk: 'Disk',
    stack: 'Stack',
    queue: 'Queue'
  };
  const NODE_W = 40;
  const INDEX_H = 12;

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function element(name, attributes = {}) {
    const node = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    });
    return node;
  }

  function valuesFromContent(content) {
    if (Array.isArray(content)) return content.map(value => String(value));
    return String(content || '')
      .split(/[\s,]+/)
      .map(value => value.trim())
      .filter(Boolean);
  }

  function matrixRowsFromContent(content) {
    const rows = String(content || '')
      .split(/\r?\n|;/)
      .map(row => row.split(',').map(value => value.trim()));
    return rows.some(row => row.some(value => value !== '')) ? rows : [['']];
  }

  function parseIndices(value, length = Infinity) {
    const indices = new Set();
    String(value || '').split(',').forEach(part => {
      const token = part.trim();
      if (!token) return;
      const range = token.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        const step = start <= end ? 1 : -1;
        for (let index = start; index !== end + step; index += step) {
          if (index >= 0 && index < length) indices.add(index);
        }
        return;
      }
      const index = Number(token);
      if (Number.isInteger(index) && index >= 0 && index < length) indices.add(index);
    });
    return [...indices];
  }

  function styleData(widget, length) {
    const entry = (type, color, source) => ({
      type,
      color,
      elements: parseIndices(source, length)
    });
    return {
      highlight: entry('highlight', widget.highlightColor || '#ef4444', widget.highlightIndices),
      focus: entry('focus', widget.focusColor || '#3b82f6', widget.focusIndices),
      point: entry('point', widget.pointColor || '#f59e0b', widget.pointIndices),
      mark: entry('mark', widget.markColor || '#8b5cf6', widget.markIndices),
      background: entry('background', widget.backgroundColor || '#10b981', widget.backgroundIndices)
    };
  }

  function originalStyles(widget, length, oneBased) {
    const offset = oneBased ? 1 : 0;
    return Object.values(styleData(widget, length))
      .map(item => ({ ...item, elements: item.elements.map(index => index + offset) }))
      .filter(item => item.elements.length);
  }

  function addOriginalAnimationDefs(svg) {
    const defs = element('defs');
    const style = element('style');
    style.textContent = `
      @keyframes blink-stroke {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0; }
      }
      .highlight-blink { animation: blink-stroke 1s infinite; }
      @keyframes arrow-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      .arrow-bounce {
        animation: arrow-bounce 1s infinite ease-in-out;
        transform-box: fill-box;
        transform-origin: center;
      }
    `;
    defs.appendChild(style);
    svg.appendChild(defs);
  }

  function ensureOriginalArrowMarker(svg, color) {
    const key = String(color || '').replace(/[^a-zA-Z0-9]+/g, '_') || 'default';
    const id = `tree-arrow-marker-${key}`;
    if (svg.querySelector(`#${CSS.escape(id)}`)) return id;
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = element('defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    const marker = element('marker', {
      id,
      viewBox: '0 0 10 10',
      refX: 0,
      refY: 5,
      markerWidth: 3,
      markerHeight: 3,
      markerUnits: 'strokeWidth',
      orient: 'auto-start-reverse'
    });
    marker.appendChild(element('path', {
      d: 'M 0 0 L 10 5 L 0 10 Z',
      fill: color || 'rgba(255, 58, 58, 0.7)'
    }));
    defs.appendChild(marker);
    return id;
  }

  function indexLabel(index, mode, length) {
    if (mode < 3) return String(index);
    const binary = index.toString(2);
    if (mode === 3) return binary;
    return binary.padStart(Math.max(1, (length - 1).toString(2).length), '0');
  }

  function treeNodes(values) {
    const isMissing = value => /^(null|nil|#)$/i.test(String(value));
    const isReachable = index => {
      let current = index;
      while (current >= 0) {
        if (current >= values.length || isMissing(values[current])) return false;
        if (current === 0) return true;
        current = Math.floor((current - 1) / 2);
      }
      return false;
    };
    return values
      .map((value, index) => ({ value, index }))
      .filter(item => isReachable(item.index))
      .map(item => {
        const depth = Math.floor(Math.log2(item.index + 1));
        return {
          ...item,
          depth,
          order: item.index - (2 ** depth - 1)
        };
      });
  }

  function treePositions(values, layout, horizontal, gap) {
    const existing = treeNodes(values);
    if (!existing.length) return new Map();
    const nodeKeys = new Set(existing.map(item => `${item.depth}:${item.order}`));
    const customX = new Map();
    const dx = 60 + gap;
    const dy = 120 + gap;
    const hasNode = (depth, order) => nodeKeys.has(`${depth}:${order}`);
    const key = (depth, order) => `${depth}:${order}`;

    const compact = () => {
      let cursor = 0;
      const calculate = (depth, order) => {
        if (!hasNode(depth, order)) return null;
        const childCenters = [];
        for (let branch = 0; branch < 2; branch += 1) {
          const child = calculate(depth + 1, order * 2 + branch);
          if (child !== null) childCenters.push(child);
        }
        if (!childCenters.length) {
          const center = cursor;
          customX.set(key(depth, order), center);
          cursor += dx;
          return center;
        }
        const center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
        customX.set(key(depth, order), center);
        return center;
      };
      calculate(0, 0);
    };

    if (layout === 'levelorder') {
      let cursor = 0;
      [...existing]
        .sort((a, b) => a.depth - b.depth || a.order - b.order)
        .forEach(item => {
          customX.set(key(item.depth, item.order), cursor);
          cursor += dx;
        });
    } else if (layout === 'inorder') {
      let cursor = 0;
      const visit = (depth, order) => {
        if (!hasNode(depth, order)) return;
        visit(depth + 1, order * 2);
        customX.set(key(depth, order), cursor);
        cursor += dx;
        visit(depth + 1, order * 2 + 1);
      };
      visit(0, 0);
    } else if (layout === 'binary') {
      const maxDepth = Math.max(...existing.map(item => item.depth));
      existing.forEach(item => {
        const span = (2 ** (maxDepth - item.depth)) * dx;
        customX.set(key(item.depth, item.order), item.order * span + span / 2);
      });
    } else if (layout === 'preorder' || layout === 'postorder') {
      let cursor = 0;
      const visit = (depth, order) => {
        if (!hasNode(depth, order)) return;
        if (layout === 'preorder') {
          customX.set(key(depth, order), cursor);
          cursor += dx;
        }
        visit(depth + 1, order * 2);
        visit(depth + 1, order * 2 + 1);
        if (layout === 'postorder') {
          customX.set(key(depth, order), cursor);
          cursor += dx;
        }
      };
      visit(0, 0);
    } else {
      compact();
    }

    const rootOffset = customX.get('0:0') || 0;
    customX.forEach((value, itemKey) => customX.set(itemKey, value - rootOffset));
    const positions = new Map();
    existing.forEach(item => {
      const offset = customX.get(key(item.depth, item.order)) || 0;
      positions.set(item.index, horizontal
        ? { x: item.depth * dy, y: offset, depth: item.depth, order: item.order }
        : { x: offset, y: item.depth * dy, depth: item.depth, order: item.order });
    });

    const points = [...positions.values()];
    const minX = Math.min(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    positions.forEach(point => {
      point.x -= minX;
      point.y -= minY;
    });
    return positions;
  }

  function explicitTreeGraph(widget, fallbackValues) {
    const stored = widget.treeData;
    const fallback = (fallbackValues.length ? fallbackValues : ['Root']).map((value, index) => ({
      id: `node-${index}`,
      value: String(value)
    }));
    const nodes = Array.isArray(stored?.nodes) && stored.nodes.length
      ? stored.nodes.map((node, index) => ({ id: String(node.id || `node-${index}`), value: String(node.value ?? '') }))
      : fallback;
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const rootId = nodeMap.has(String(stored?.rootId)) ? String(stored.rootId) : nodes[0].id;
    let edges = Array.isArray(stored?.edges) ? stored.edges.map((edge, index) => ({
      from: String(edge.from || ''),
      to: String(edge.to || ''),
      slot: String(edge.slot || 'child'),
      order: number(edge.order, index)
    })).filter(edge => nodeMap.has(edge.from) && nodeMap.has(edge.to) && edge.from !== edge.to) : [];
    if (!edges.length && nodes.length > 1) {
      edges = nodes.slice(1).map((node, index) => ({
        from: nodes[Math.floor(index / 2)].id,
        to: node.id,
        slot: index % 2 ? 'right' : 'left',
        order: index
      }));
    }
    const slotRank = slot => slot === 'left' ? 0 : (slot === 'right' ? 1 : 2);
    const children = new Map(nodes.map(node => [node.id, []]));
    edges.forEach(edge => children.get(edge.from)?.push(edge));
    children.forEach(list => list.sort((a, b) => slotRank(a.slot) - slotRank(b.slot) || a.order - b.order));
    const reachable = [];
    const seen = new Set();
    const visit = id => {
      if (seen.has(id) || !nodeMap.has(id)) return;
      seen.add(id);
      reachable.push(nodeMap.get(id));
      (children.get(id) || []).forEach(edge => visit(edge.to));
    };
    visit(rootId);
    return {
      rootId,
      nodes: reachable,
      edges: edges.filter(edge => seen.has(edge.from) && seen.has(edge.to)),
      nodeMap,
      children
    };
  }

  function explicitTreePositions(graph, layout, horizontal, gap) {
    const dx = 60 + gap;
    const dy = 120 + gap;
    const positions = new Map();
    let cursor = 0;
    const placeCompact = (id, depth, path = new Set()) => {
      if (path.has(id)) return null;
      const nextPath = new Set(path).add(id);
      const childPoints = (graph.children.get(id) || [])
        .map(edge => placeCompact(edge.to, depth + 1, nextPath))
        .filter(point => point !== null);
      const x = childPoints.length ? (childPoints[0] + childPoints[childPoints.length - 1]) / 2 : cursor++ * dx;
      positions.set(id, { x, y: depth * dy, depth, order: cursor });
      return x;
    };
    placeCompact(graph.rootId, 0);

    if (layout === 'levelorder') {
      const levels = new Map();
      positions.forEach((point, id) => {
        if (!levels.has(point.depth)) levels.set(point.depth, []);
        levels.get(point.depth).push(id);
      });
      levels.forEach(ids => ids.forEach((id, index) => positions.set(id, { ...positions.get(id), x: index * dx, order: index })));
    } else if (layout === 'preorder' || layout === 'postorder' || layout === 'inorder') {
      cursor = 0;
      const visited = new Set();
      const traverse = id => {
        if (visited.has(id) || !positions.has(id)) return;
        visited.add(id);
        const children = (graph.children.get(id) || []).map(edge => edge.to);
        if (layout === 'preorder') positions.get(id).x = cursor++ * dx;
        if (layout === 'inorder' && children.length) traverse(children.shift());
        if (layout === 'inorder') positions.get(id).x = cursor++ * dx;
        children.forEach(traverse);
        if (layout === 'postorder') positions.get(id).x = cursor++ * dx;
      };
      traverse(graph.rootId);
    }

    const points = [...positions.values()];
    if (!points.length) return positions;
    const minX = Math.min(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    positions.forEach(point => {
      point.x -= minX;
      point.y -= minY;
      if (horizontal) [point.x, point.y] = [point.y, point.x];
    });
    return positions;
  }

  function drawTree(group, widget, values) {
    const graph = explicitTreeGraph(widget, values);
    const indexMode = clamp(Math.round(number(widget.indexMode, 0)), 0, 4);
    const contentHeight = NODE_W + (indexMode === 1 || indexMode >= 3 ? INDEX_H : 0);
    const nodeWidth = NODE_W;
    const nodeHeight = contentHeight;
    const gap = clamp(number(widget.gap, 0), 0, 40);
    const layout = ['compact', 'levelorder', 'binary', 'inorder', 'preorder', 'postorder'].includes(widget.treeLayout)
      ? widget.treeLayout
      : 'compact';
    const horizontal = widget.treeHorizontal === true;
    const positions = explicitTreePositions(graph, layout, horizontal, gap);
    if (!positions.size) return;

    group.setAttribute('data-layout', 'tree');
    group.setAttribute('data-tree-layout', layout);
    group.setAttribute('data-tree-direction', horizontal ? 'horizontal' : 'vertical');
    const styles = styleData(widget, graph.nodes.length);
    const markerColor = widget.treeArrowColor || '#333333';
    const markerId = ensureOriginalArrowMarker(group.ownerSVGElement, markerColor);

    graph.edges.forEach(edge => {
      const parent = positions.get(edge.from);
      const point = positions.get(edge.to);
      if (!parent || !point) return;
      const startX = horizontal ? parent.x + nodeWidth : parent.x + nodeWidth / 2;
      const startY = horizontal ? parent.y + nodeHeight / 2 : parent.y + nodeHeight;
      const targetX = horizontal ? point.x : point.x + nodeWidth / 2;
      const targetY = horizontal ? point.y + nodeHeight / 2 : point.y;
      const deltaX = targetX - startX;
      const deltaY = targetY - startY;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      group.appendChild(element('line', {
        class: 'tree-edge',
        'data-tree-edge-from': edge.from,
        'data-tree-edge-to': edge.to,
        x1: startX,
        y1: startY,
        x2: targetX - (deltaX / distance) * 6,
        y2: targetY - (deltaY / distance) * 6,
        stroke: markerColor,
        'stroke-width': 2,
        'marker-end': `url(#${markerId})`
      }));
    });

    graph.nodes.forEach((treeNode, index) => {
      const point = positions.get(treeNode.id);
      if (!point) return;
      const content = indexMode === 2 ? index : treeNode.value;
      const nodeStyles = Object.values(styles).map(item => ({
        type: item.type,
        color: item.color,
        elements: item.elements.includes(index) ? [0] : []
      }));
      const node = element('g', {
        class: 'tree-node',
        transform: `translate(${point.x} ${point.y})`,
        'data-tree-node-id': treeNode.id,
        'data-tree-index': index,
        'data-tree-depth': point.depth,
        'data-tree-order': point.order
      });
      group.appendChild(node);
      window.draw_array_normal(node, `tree_${index}`, [content], nodeStyles, [0, 0], 1, indexMode, 0);
      node.querySelectorAll(':scope > .outerframe-bg, :scope > .outerframe-nb, :scope > .outerframe-label')
        .forEach(element => element.remove());
      node.querySelectorAll(':scope > g[id^="cell-"]').forEach(cell => {
        const transform = cell.getAttribute('transform');
        cell.setAttribute('transform', `${transform ? `${transform} ` : ''}translate(-8 -8)`);
      });
      tagEditableCells(node, 'binary_tree');
    });

    const maxX = Math.max(...[...positions.values()].map(point => point.x + nodeWidth));
    const maxY = Math.max(...[...positions.values()].map(point => point.y + nodeHeight));
    group.setAttribute('data-outerframe-left', '0');
    group.setAttribute('data-outerframe-top', '0');
    group.setAttribute('data-outerframe-right', String(maxX));
    group.setAttribute('data-outerframe-bottom', String(maxY));
  }

  function applyFrameBackground(group, widget, mode) {
    if (mode !== 'normal' && mode !== 'matrix') return;
    const background = group.querySelector(':scope > .outerframe-bg');
    if (!background) return;
    if (widget.frameBackgroundEnabled === false) {
      group.querySelectorAll(':scope > .outerframe-bg, :scope > .outerframe-nb, :scope > .outerframe-label')
        .forEach(element => element.remove());
      const cellRects = [...group.querySelectorAll('[id^="cell-"] > rect')];
      if (cellRects.length) {
        const left = Math.min(...cellRects.map(rect => number(rect.getAttribute('x'), 0)));
        const top = Math.min(...cellRects.map(rect => number(rect.getAttribute('y'), 0)));
        const right = Math.max(...cellRects.map(rect => number(rect.getAttribute('x'), 0) + number(rect.getAttribute('width'), 0)));
        const bottom = Math.max(...cellRects.map(rect => number(rect.getAttribute('y'), 0) + number(rect.getAttribute('height'), 0)));
        group.setAttribute('data-outerframe-left', String(left));
        group.setAttribute('data-outerframe-top', String(top));
        group.setAttribute('data-outerframe-right', String(right));
        group.setAttribute('data-outerframe-bottom', String(bottom));
      }
      return;
    }
    if (widget.frameBackgroundColor) background.setAttribute('fill', widget.frameBackgroundColor);
  }

  function tagEditableCells(group, mode, columns = 0) {
    group.querySelectorAll('g[id^="cell-"]').forEach(cell => {
      if (cell.id.endsWith('-index')) return;
      const match = cell.id.match(/-(\d+)$/);
      if (!match) return;
      const index = Number(match[1]);
      cell.setAttribute('data-structure-item-index', String(index));
      if (mode === 'matrix' && columns > 0) {
        cell.setAttribute('data-matrix-row', String(Math.floor(index / columns)));
        cell.setAttribute('data-matrix-column', String(index % columns));
      }
    });
  }

  function drawWithOriginalRenderer(group, widget, rawValues) {
    const mode = widget.structureMode === 'matrix'
      ? 'matrix'
      : (ORIGINAL_RENDERERS[widget.structureMode] ? widget.structureMode : 'normal');
    if (mode === 'matrix') {
      const rows = matrixRowsFromContent(widget.content);
      const columns = Math.max(1, ...rows.map(row => row.length));
      const values = rows.flatMap(row => Array.from({ length: columns }, (_, index) => row[index] ?? ''));
      window.draw_array_normal(
        group,
        MODE_LABELS.matrix,
        values,
        originalStyles(widget, values.length, false),
        [0, values.length - 1],
        columns,
        clamp(Math.round(number(widget.indexMode, 0)), 0, 4),
        clamp(number(widget.gap, 0), 0, 40)
      );
      applyFrameBackground(group, widget, mode);
      tagEditableCells(group, mode, columns);
      return true;
    }
    const renderer = window[ORIGINAL_RENDERERS[mode]];
    if (typeof renderer !== 'function') return false;
    const values = rawValues.length ? rawValues : [''];
    const oneBased = ONE_BASED_MODES.has(mode);
    const source = oneBased ? [null, ...values] : values;
    const range = oneBased ? [1, source.length - 1] : [0, source.length - 1];
    const styles = originalStyles(widget, values.length, oneBased);
    const indexMode = clamp(Math.round(number(widget.indexMode, 0)), 0, 4);
    const itemsPerRow = Math.max(0, Math.round(number(widget.itemsPerRow, 0))) || Infinity;
    const gap = clamp(number(widget.gap, 0), 0, 40);
    const label = MODE_LABELS[mode];

    if (mode === 'normal') renderer(group, label, source, styles, range, itemsPerRow, indexMode, gap);
    else if (mode === 'heap') renderer(group, label, source, styles, range, indexMode, gap);
    else if (mode === 'segment_tree') renderer(group, label, source, styles, range, indexMode, gap, [], [], [], [], [], [], []);
    else if (mode === 'BIT') renderer(group, label, source, styles, range, indexMode, gap);
    else if (mode === 'disk') {
      const numericValues = source.map((value, index) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
      });
      renderer(group, label, numericValues, styles, range, itemsPerRow, indexMode);
    } else renderer(group, label, source, styles, range, indexMode, gap);
    applyFrameBackground(group, widget, mode);
    tagEditableCells(group, mode);
    return true;
  }

  function originalBounds(group, mode) {
    const left = number(group.getAttribute('data-outerframe-left'), NaN);
    const top = number(group.getAttribute('data-outerframe-top'), NaN);
    const right = number(group.getAttribute('data-outerframe-right'), NaN);
    const bottom = number(group.getAttribute('data-outerframe-bottom'), NaN);
    if ([left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top) {
      return { left, top, right, bottom };
    }
    if (mode === 'disk') {
      const centerX = number(group.getAttribute('data-center-x'), 40);
      const bottomY = number(group.getAttribute('data-bottom-y'), 80);
      return { left: 0, top: 0, right: Math.max(80, centerX * 2), bottom: bottomY + 10 };
    }
    try {
      const box = group.getBBox();
      if (box.width > 0 && box.height > 0) {
        return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
      }
    } catch (error) {
      // Detached SVG elements may not expose getBBox in every browser.
    }
    return { left: 0, top: 0, right: 80, bottom: 80 };
  }

  function paddedBounds(group, mode, widget) {
    const bounds = originalBounds(group, mode);
    const edgePadding = 3;
    const pointPadding = parseIndices(widget.pointIndices, valuesFromContent(widget.content).length).length ? 28 : edgePadding;
    return {
      left: bounds.left - edgePadding,
      top: bounds.top - pointPadding,
      right: bounds.right + edgePadding,
      bottom: bounds.bottom + edgePadding
    };
  }

  function buildStructureSvg(widget) {
    const mode = widget.structureMode === 'binary_tree' || widget.structureMode === 'matrix' || ORIGINAL_RENDERERS[widget.structureMode]
      ? widget.structureMode
      : 'normal';
    const svg = element('svg', { xmlns: NS });
    addOriginalAnimationDefs(svg);
    const group = element('g', { 'data-slide-structure': mode });
    svg.appendChild(group);
    const values = valuesFromContent(widget.content);
    if (mode === 'binary_tree') drawTree(group, widget, values);
    else drawWithOriginalRenderer(group, { ...widget, structureMode: mode }, values);
    return { svg, group, mode, bounds: paddedBounds(group, mode, widget) };
  }

  function getNaturalSize(widget) {
    const { bounds } = buildStructureSvg(widget);
    return {
      width: Math.max(40, Math.ceil(bounds.right - bounds.left)),
      height: Math.max(40, Math.ceil(bounds.bottom - bounds.top))
    };
  }

  function createSvg(widget) {
    const width = Math.max(40, number(widget.w, 320));
    const height = Math.max(40, number(widget.h, 160));
    const { svg, mode, bounds } = buildStructureSvg(widget);
    const viewWidth = Math.max(1, bounds.right - bounds.left);
    const viewHeight = Math.max(1, bounds.bottom - bounds.top);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `${bounds.left} ${bounds.top} ${viewWidth} ${viewHeight}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${MODE_LABELS[mode]} data structure`);
    svg.setAttribute('data-renderer', mode === 'binary_tree' ? 'original-tree-adapter' : 'original-draw-array');
    svg.style.display = 'block';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'hidden';
    return svg;
  }

  function render(container, widget) {
    if (!container) return;
    container.replaceChildren(createSvg(widget));
  }

  async function drawCanvas(context, widget, scale = 1) {
    const svg = createSvg(widget);
    const serialized = new XMLSerializer().serializeToString(svg);
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = source;
    });
    context.drawImage(
      image,
      number(widget.x, 0) * scale,
      number(widget.y, 0) * scale,
      number(widget.w, 320) * scale,
      number(widget.h, 160) * scale
    );
  }

  window.AlgoStructureRenderer = {
    TREE_MODES,
    createSvg,
    drawCanvas,
    getNaturalSize,
    parseIndices,
    render,
    valuesFromContent
  };
})();
