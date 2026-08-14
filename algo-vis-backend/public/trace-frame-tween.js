(function () {
  let activeRun = 0;
  let finishActiveRun = null;

  const COMPARE_COLORS = Object.freeze({
    true: 'rgb(165, 214, 167)',
    false: 'rgb(239, 154, 154)'
  });
  const EVENT_GAP = 0;
  const COMPARE_TIMING = Object.freeze({ popup: 180, wait: 400, size: 300, result: 420, reset: 260 });
  const ASSIGN_TIMING = Object.freeze({ frame: 160, drop: 320, hold: 180, exit: 140 });
  const APPEAR_TIMING = Object.freeze({ duration: 220, offsetY: -16 });

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function parseColor(value, alpha = 1) {
    if (!value) return null;
    const source = String(value).trim().toLowerCase();
    const rgba = source.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
    const rgb = source.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: alpha };
    const hex = source.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
      const value6 = hex[1].length === 3
        ? hex[1].split('').map(character => character + character).join('')
        : hex[1];
      return {
        r: parseInt(value6.slice(0, 2), 16),
        g: parseInt(value6.slice(2, 4), 16),
        b: parseInt(value6.slice(4, 6), 16),
        a: alpha
      };
    }
    const context = parseColor.context
      || (parseColor.context = document.createElement('canvas').getContext('2d'));
    if (!context) return null;
    context.fillStyle = '#000000';
    context.fillStyle = source;
    if (context.fillStyle === source || context.fillStyle.startsWith('#') || context.fillStyle.startsWith('rgb')) {
      return parseColor(context.fillStyle, alpha);
    }
    return null;
  }

  function interpolateColor(from, to, t) {
    return {
      r: Math.round(from.r + (to.r - from.r) * t),
      g: Math.round(from.g + (to.g - from.g) * t),
      b: Math.round(from.b + (to.b - from.b) * t),
      a: from.a + (to.a - from.a) * t
    };
  }

  function rectKey(rect, index, fallbackKey = '$object') {
    const owner = rect.closest?.('[data-trace-object-key]');
    const ownerKey = owner?.dataset?.traceObjectKey || fallbackKey;
    return `${ownerKey}|${rect.getAttribute('data-av-key') || index}`;
  }

  function rectStates(element, fallbackKey = '$object') {
    const states = new Map();
    [...(element?.querySelectorAll?.('rect') || [])].forEach((rect, index) => {
      const opacity = rect.hasAttribute('fill-opacity')
        ? Number(rect.getAttribute('fill-opacity'))
        : 1;
      states.set(rectKey(rect, index, fallbackKey), {
        fill: rect.getAttribute('fill') || '',
        opacity: Number.isFinite(opacity) ? opacity : 1
      });
    });
    return states;
  }

  function topLevelKey(element, root) {
    let current = element;
    let key = element?.dataset?.traceObjectKey || '';
    while (current?.parentElement && current.parentElement !== root) {
      const parentObject = current.parentElement.closest?.('[data-trace-object-key]');
      if (!parentObject || !root.contains(parentObject)) break;
      current = parentObject;
      key = current.dataset.traceObjectKey || key;
    }
    return key;
  }

  function parentObjectKey(element, root) {
    const parent = element?.parentElement?.closest?.('[data-trace-object-key]');
    return parent && root.contains(parent) ? parent.dataset.traceObjectKey || '' : '';
  }

  function swapSources(document, frame, eventTimeline = []) {
    const sources = new Map();
    (frame?.events || []).filter(event => event.type === 'swap').forEach(event => {
      const targets = (event.targets || []).filter(target => target.variableId && target.indexExpression);
      if (targets.length < 2 || targets[0].variableId !== targets[1].variableId) return;
      const indices = targets.slice(0, 2).map(target => Number(
        window.ASMTraceRules?.resolveExpression?.(document, frame, target.indexExpression)
      ));
      if (indices.some(index => !Number.isInteger(index)) || indices[0] === indices[1]) return;
      const variableKey = objectKeyForVariable(frame, targets[0].variableId);
      const keys = indices.map(index => `${variableKey}#${index}`);
      const slot = eventTimeline.find(item => item.event === event);
      const start = Math.max(0, Number(slot?.start) || 0);
      sources.set(keys[0], { sourceKey: keys[1], start });
      sources.set(keys[1], { sourceKey: keys[0], start });
    });
    return sources;
  }

  function objectKeyForVariable(frame, variableId) {
    const source = frame?.source || {};
    if (source.objectId && source.primaryVariableId === variableId) return source.objectId;
    return variableId;
  }

  function displayEventValue(value) {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if (Object.prototype.hasOwnProperty.call(value, 'value')) return String(value.value ?? '');
    if (Array.isArray(value.items)) return `[${value.items.map(displayEventValue).join(', ')}]`;
    return String(value.label || value.type || value.kind || '');
  }

  function eventTargetKey(traceDocument, eventFrame, target) {
    if (!target?.variableId) return '';
    const variableKey = objectKeyForVariable(eventFrame, target.variableId);
    const expression = String(target.indexExpression ?? '').trim();
    if (!expression) return variableKey;
    const indices = expression.split(',').map(part => Number(
      window.ASMTraceRules?.resolveExpression?.(traceDocument, eventFrame, part.trim())
    ));
    if (!indices.length || indices.some(index => !Number.isInteger(index))) return variableKey;
    return `${variableKey}#${indices.join(',')}`;
  }

  function comparisonPoint(placements, key) {
    const box = placements?.get?.(key);
    if (!box) return null;
    return {
      x: (Number(box.x) || 0) + (Number(box.width) || 0) / 2,
      y: Number(box.y) || 0,
      width: Number(box.width) || 0,
      height: Number(box.height) || 0
    };
  }

  function markerVisualKey(elements, variableId) {
    for (const [key, element] of elements || []) {
      if (element?.dataset?.traceSourceVariableId === variableId) return key;
    }
    return '';
  }

  function eventOperand(traceDocument, eventFrame, target, value, placements, elements, visualKeyForSource) {
    const logicalKey = eventTargetKey(traceDocument, eventFrame, target);
    let visualKey = typeof visualKeyForSource === 'function' ? visualKeyForSource(logicalKey) : logicalKey;
    if (!elements?.has?.(visualKey)) visualKey = markerVisualKey(elements, target?.variableId) || visualKey;
    const element = elements?.get?.(visualKey) || elements?.get?.(logicalKey);
    const point = comparisonPoint(placements, visualKey) || comparisonPoint(placements, logicalKey);
    if (!element || !point) return null;
    return {
      target,
      logicalKey,
      visualKey,
      element,
      point,
      value: displayEventValue(value),
      numericValue: Number(displayEventValue(value)),
      marker: Boolean(element.dataset?.traceSourceVariableId)
    };
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function animationPlaybackRate() {
    const cssRate = Number(getComputedStyle(document.documentElement)
      .getPropertyValue('--asm-animation-playback-rate'));
    return Math.max(0.25, Math.min(4, Number(window.asmGetAnimationPlaybackRate?.()) || cssRate || 1));
  }

  function createSvg(name, attributes = {}, text = '') {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== '') element.textContent = text;
    return element;
  }

  function compareValuesEqual(operands) {
    if (operands.length < 2) return false;
    const leftNumber = operands[0].numericValue;
    const rightNumber = operands[1].numericValue;
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
    return String(operands[0].value) === String(operands[1].value);
  }

  function compareContactTargets(operands, equalValues) {
    if (operands.length < 2) return [];
    const order = operands
      .map((operand, index) => ({ operand, index }))
      .sort((left, right) => left.operand.point.x - right.operand.point.x || left.index - right.index);
    const left = order[0];
    const right = order[1];
    const contactX = (left.operand.point.x + right.operand.point.x) / 2;
    const leftWidth = Math.max(1, Number(left.operand.point.width) || 1);
    const rightWidth = Math.max(1, Number(right.operand.point.width) || 1);
    const verticalGap = equalValues ? 0 : 5;
    const targets = [];
    targets[left.index] = {
      x: contactX - leftWidth / 2 - left.operand.point.x,
      y: -verticalGap
    };
    targets[right.index] = {
      x: contactX + rightWidth / 2 - right.operand.point.x,
      y: verticalGap
    };
    return targets;
  }

  function compareScaleTargets(operands) {
    if (operands.length < 2) return [];
    const left = operands[0].numericValue;
    const right = operands[1].numericValue;
    if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) return [1, 1];
    return left > right ? [1.14, 0.86] : [0.86, 1.14];
  }

  function addHighlight(element, color) {
    const source = element?.matches?.('rect') ? element : element?.querySelector?.('rect');
    if (!source) return null;
    const highlight = createSvg('rect', {
      class: 'asm-trace-compare-highlight',
      x: source.getAttribute('x') || 0,
      y: source.getAttribute('y') || 0,
      width: source.getAttribute('width') || 0,
      height: source.getAttribute('height') || 0,
      rx: source.getAttribute('rx') || 0,
      fill: 'none',
      stroke: color,
      'stroke-width': 3,
      'pointer-events': 'none'
    });
    element.append(highlight);
    return highlight;
  }

  function displayOperator(operation) {
    return ({ '!=': '≠', '==': '=', '<=': '≤', '>=': '≥' })[operation] || String(operation || '?');
  }

  function createComparisonExpression(root, event, operands, color, preferredTop = null) {
    if (operands.length < 2) return null;
    const centerX = (operands[0].point.x + operands[1].point.x) / 2;
    const top = Number.isFinite(preferredTop)
      ? preferredTop
      : Math.min(operands[0].point.y, operands[1].point.y) - 15;
    const operation = displayOperator(event?.operation);
    const left = `${operands[0].target?.expression || 'left'}(${operands[0].value})`;
    const right = `${operands[1].target?.expression || 'right'}(${operands[1].value})`;
    const fontSize = 14;
    const fallbackWidth = value => Math.max(fontSize * 0.58, Array.from(value).length * fontSize * 0.58);
    const gap = 6;
    const group = createSvg('g', {
      class: 'asm-trace-compare-operator',
      transform: `translate(${centerX}, ${top})`,
      'pointer-events': 'none'
    });
    const textAttributes = {
      y: 0, 'dominant-baseline': 'middle', 'font-family': 'Arial',
      'font-size': fontSize, 'font-weight': 'bold', fill: color
    };
    const leftText = createSvg('text', { ...textAttributes, 'text-anchor': 'start' }, left);
    const operationText = createSvg('text', { ...textAttributes, 'text-anchor': 'middle' }, operation);
    const rightText = createSvg('text', { ...textAttributes, 'text-anchor': 'start' }, right);
    group.append(leftText, operationText, rightText);
    root.append(group);
    const measuredWidth = (node, fallback) => {
      try {
        const width = node.getComputedTextLength();
        return width > 0 ? width : fallback;
      } catch (error) {
        return fallback;
      }
    };
    const leftWidth = measuredWidth(leftText, fallbackWidth(left));
    const operationWidth = measuredWidth(operationText, fallbackWidth(operation));
    const rightWidth = measuredWidth(rightText, fallbackWidth(right));
    const totalWidth = leftWidth + operationWidth + rightWidth + gap * 2;
    const startX = -totalWidth / 2;
    const operationX = startX + leftWidth + gap + operationWidth / 2;
    leftText.setAttribute('x', String(startX));
    operationText.setAttribute('x', String(operationX));
    rightText.setAttribute('x', String(startX + leftWidth + gap + operationWidth + gap));
    if (event?.result !== true) {
      group.append(createSvg('line', {
        x1: operationX - operationWidth / 2 - 2, y1: -8,
        x2: operationX + operationWidth / 2 + 2, y2: 8,
        stroke: color,
        'stroke-width': 2,
        'stroke-linecap': 'square'
      }));
    }
    return group;
  }

  function createMarkerPopup(root, operand, className = 'asm-trace-compare-marker-popup') {
    const source = operand.element.matches?.('rect')
      ? operand.element
      : operand.element.querySelector?.('rect');
    const width = Math.max(16, Number(source?.getAttribute?.('width')) || 18);
    const height = Math.max(16, Number(source?.getAttribute?.('height')) || 18);
    const stroke = source?.getAttribute?.('stroke') || '#333';
    const strokeWidth = source?.getAttribute?.('stroke-width') || 1;
    const group = createSvg('g', {
      class: className,
      'pointer-events': 'none', opacity: 0
    });
    const rect = createSvg('rect', {
      x: -width / 2, y: -height, width, height,
      fill: 'none', stroke, 'stroke-width': strokeWidth,
      'stroke-dasharray': '4 3'
    });
    const text = createSvg('text', {
      x: 0, y: -height / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'Arial', 'font-size': Math.max(7, Math.min(13, height * 0.55)),
      'font-weight': 'bold', fill: source?.nextElementSibling?.getAttribute?.('fill') || '#1f282d'
    }, operand.value);
    group.append(rect, text);
    root.append(group);
    return { group, rect, text, width, height };
  }

  function createAssignEffect(root, event, traceDocument, eventFrame, placements, elements, rawDeltas) {
    const target = (event?.targets || []).find(item => item.role === 'target') || event?.targets?.[0];
    const source = (event?.targets || []).find(item => item.role === 'source');
    if (!target) return null;
    const operand = eventOperand(
      traceDocument, eventFrame, target, event?.payload?.after,
      placements, elements, key => key
    );
    if (!operand) return null;
    const rawDelta = rawDeltas?.get?.(operand.visualKey) || { x: 0, y: 0 };
    const x = operand.point.x + (operand.marker ? Number(rawDelta.x) || 0 : 0);
    const y = operand.point.y + (operand.marker ? Number(rawDelta.y) || 0 : 0);
    const beforeValue = displayEventValue(event?.payload?.before);
    const afterValue = displayEventValue(event?.payload?.after);
    const sourceLabel = String(source?.expression || afterValue || '').trim();
    let popup = null;
    let fallingText = null;
    let targetText = null;
    let finalText = '';
    let originalOpacity = null;
    let landed = false;

    if (operand.marker) {
      popup = createMarkerPopup(
        root,
        { ...operand, value: sourceLabel },
        'asm-trace-assign-marker-popup'
      );
      popup.text.setAttribute('opacity', '0');
      popup.text.setAttribute('transform', 'translate(0, -20)');
    } else {
      targetText = operand.element.matches?.('text')
        ? operand.element
        : operand.element.querySelector?.('text');
      finalText = targetText?.textContent ?? afterValue;
      originalOpacity = targetText?.getAttribute?.('opacity');
      if (targetText) targetText.textContent = beforeValue;
      const targetY = y + operand.point.height / 2;
      fallingText = createSvg('text', {
        class: 'asm-trace-assign-falling-value',
        x,
        y: targetY - Math.max(24, operand.point.height * 0.8),
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-family': targetText?.getAttribute?.('font-family') || 'Arial',
        'font-size': targetText?.getAttribute?.('font-size') || Math.max(12, operand.point.height * 0.48),
        'font-weight': targetText?.getAttribute?.('font-weight') || 'normal',
        fill: targetText?.getAttribute?.('fill') || '#1f282d',
        opacity: 0,
        'pointer-events': 'none'
      }, afterValue);
      fallingText.dataset.targetY = String(targetY);
      root.append(fallingText);
    }

    function landValue() {
      if (landed) return;
      landed = true;
      if (targetText) targetText.textContent = finalText;
      fallingText?.setAttribute('opacity', '0');
    }

    return {
      update(elapsed) {
        const frameProgress = easeOutCubic(clamp01(elapsed / ASSIGN_TIMING.frame));
        const dropStart = operand.marker ? ASSIGN_TIMING.frame : 0;
        const dropProgress = easeOutCubic(clamp01((elapsed - dropStart) / ASSIGN_TIMING.drop));
        const exitStart = ASSIGN_TIMING.frame + ASSIGN_TIMING.drop + ASSIGN_TIMING.hold;
        const exit = elapsed > exitStart
          ? easeOutCubic(clamp01((elapsed - exitStart) / ASSIGN_TIMING.exit))
          : 0;
        if (popup) {
          popup.group.setAttribute('opacity', String(frameProgress * (1 - exit)));
          popup.group.setAttribute(
            'transform',
            `translate(${x}, ${y}) scale(${0.82 + 0.18 * frameProgress})`
          );
          popup.text.setAttribute('opacity', String(dropProgress * (1 - exit)));
          popup.text.setAttribute('transform', `translate(0, ${-20 * (1 - dropProgress)})`);
        }
        if (fallingText) {
          const targetY = Number(fallingText.dataset.targetY) || y;
          const startY = targetY - Math.max(24, operand.point.height * 0.8);
          fallingText.setAttribute('y', String(startY + (targetY - startY) * dropProgress));
          fallingText.setAttribute('opacity', String(dropProgress < 1 ? clamp01(dropProgress * 4) : 0));
        }
        if (dropProgress >= 1) landValue();
      },
      remove() {
        landValue();
        if (targetText) {
          if (originalOpacity == null) targetText.removeAttribute('opacity');
          else targetText.setAttribute('opacity', originalOpacity);
        }
        popup?.group.remove();
        fallingText?.remove();
      }
    };
  }

  function createSelfCompareSplit(operand, splitDistance, verticalGap = 0) {
    const original = operand?.element;
    const parent = original?.parentNode;
    if (!original || !parent) return null;
    const originalOpacity = original.getAttribute('opacity');
    const clones = [-1, 1].map(direction => {
      const wrapper = createSvg('g', {
        class: 'asm-trace-compare-self-clone',
        opacity: 0,
        'pointer-events': 'none'
      });
      const clone = original.cloneNode(true);
      [clone, ...clone.querySelectorAll('[id], [data-trace-object-key]')].forEach(node => {
        node.removeAttribute?.('id');
        node.removeAttribute?.('data-trace-object-key');
      });
      clone.classList.remove('selected', 'draggable-object', 'asm-trace-selectable');
      clone.querySelectorAll('animate, animateTransform, animateMotion').forEach(node => node.remove());
      wrapper.append(clone);
      parent.insertBefore(wrapper, original.nextSibling);
      return { direction, wrapper, clone };
    });
    return {
      clones,
      update(lift, split, stay) {
        const amount = split * stay;
        original.setAttribute('opacity', String(1 - amount));
        clones.forEach(item => {
          item.wrapper.setAttribute('opacity', String(amount));
          item.wrapper.setAttribute(
            'transform',
            `translate(${item.direction * splitDistance * amount}, ${(-15 * lift + item.direction * verticalGap * split) * stay})`
          );
        });
      },
      remove() {
        if (originalOpacity == null) original.removeAttribute('opacity');
        else original.setAttribute('opacity', originalOpacity);
        clones.forEach(item => item.wrapper.remove());
      }
    };
  }

  function promoteCompareElements(operands) {
    const promoted = [];
    const seen = new Set();
    operands.forEach(operand => {
      const element = operand?.element;
      const parent = element?.parentNode;
      if (operand?.marker || !element || !parent || seen.has(element)) return;
      seen.add(element);
      const placeholder = document.createComment('asm-trace-compare-order');
      parent.insertBefore(placeholder, element);
      parent.append(element);
      promoted.push({ element, parent, placeholder });
    });
    return {
      remove() {
        promoted.forEach(({ element, parent, placeholder }) => {
          if (placeholder.parentNode === parent && element.parentNode === parent) {
            parent.insertBefore(element, placeholder);
          }
          placeholder.remove();
        });
        promoted.length = 0;
      }
    };
  }

  function createCompareEffect(root, event, traceDocument, eventFrame, placements, elements, visualKeyForSource) {
    const color = COMPARE_COLORS[String(event?.result === true)];
    const values = [event?.payload?.left, event?.payload?.right];
    const operands = (event?.targets || []).slice(0, 2).map((target, index) => (
      eventOperand(traceDocument, eventFrame, target, values[index], placements, elements, visualKeyForSource)
    )).filter(Boolean);
    const equalValues = compareValuesEqual(operands);
    const equalityComparison = ['==', '!='].includes(String(event?.operation || ''));
    const contactTargets = equalityComparison ? compareContactTargets(operands, equalValues) : [];
    const scaleTargets = equalityComparison ? operands.map(() => 1) : compareScaleTargets(operands);
    const selfCompare = operands.length >= 2 && operands[0].visualKey === operands[1].visualKey;
    const selfSplitDistance = selfCompare
      ? Math.max(8, operands[0].point.width / 2)
      : 0;
    const highlights = [];
    const popups = new Map();
    const promotedElements = promoteCompareElements(operands);
    const selfSplit = selfCompare && !operands[0].marker
      ? createSelfCompareSplit(operands[0], selfSplitDistance, equalValues ? 0 : 5)
      : null;
    let expression = null;
    let attachedTop = Infinity;
    elements?.forEach?.((element, key) => {
      if (!element?.dataset?.traceSourceVariableId) return;
      if (!operands.some(operand => operand.logicalKey === element.dataset.traceBindingTarget)) return;
      const point = comparisonPoint(placements, key);
      if (point) attachedTop = Math.min(attachedTop, point.y);
    });
    const expressionTop = (Number.isFinite(attachedTop)
      ? attachedTop
      : Math.min(...operands.map(operand => operand.point.y))) - 30;

    const popupKey = (operand, index) => selfCompare
      ? `${operand.visualKey}:${index}`
      : operand.visualKey;

    function ensurePopups() {
      operands.forEach((operand, index) => {
        if (!operand.marker) return;
        const key = popupKey(operand, index);
        if (!popups.has(key)) popups.set(key, createMarkerPopup(root, operand));
      });
    }

    function showResult() {
      if (!highlights.length) {
        if (selfSplit) {
          selfSplit.clones.forEach(item => {
            const highlight = addHighlight(item.clone, color);
            if (highlight) highlights.push(highlight);
          });
        } else {
          const highlighted = new Set();
          operands.filter(operand => !operand.marker).forEach(operand => {
            if (highlighted.has(operand.visualKey)) return;
            highlighted.add(operand.visualKey);
            const highlight = addHighlight(operand.element, color);
            if (highlight) highlights.push(highlight);
          });
        }
      }
      popups.forEach(popup => popup.rect.setAttribute('stroke', color));
      if (!expression) expression = createComparisonExpression(root, event, operands, color, expressionTop);
    }

    function setResultOpacity(opacity) {
      const value = String(clamp01(opacity));
      highlights.forEach(highlight => highlight.setAttribute('opacity', value));
      expression?.setAttribute('opacity', value);
    }

    return {
      adjustments: new Map(),
      logicalAdjustments: new Map(),
      update(elapsed) {
        const popupEnd = COMPARE_TIMING.popup;
        const waitEnd = popupEnd + COMPARE_TIMING.wait;
        const sizeEnd = waitEnd + COMPARE_TIMING.size;
        const resultEnd = sizeEnd + COMPARE_TIMING.result;
        const resetEnd = resultEnd + COMPARE_TIMING.reset;
        const popupReveal = easeOutCubic(clamp01(elapsed / COMPARE_TIMING.popup));
        const lift = popupReveal;
        const size = elapsed < waitEnd
          ? 0
          : easeOutCubic(clamp01((elapsed - waitEnd) / COMPARE_TIMING.size));
        const reset = elapsed < resultEnd
          ? 0
          : easeOutCubic(clamp01((elapsed - resultEnd) / COMPARE_TIMING.reset));
        ensurePopups();
        if (elapsed >= waitEnd) {
          showResult();
          setResultOpacity(size * (1 - reset));
        }
        const stay = 1 - reset;
        this.adjustments.clear();
        this.logicalAdjustments.clear();
        operands.forEach((operand, index) => {
          const contact = contactTargets[index] || { x: 0, y: 0 };
          const adjustment = {
            x: operand.marker ? 0 : contact.x * size * stay,
            y: operand.marker ? 0 : (-15 * lift + contact.y * size) * stay,
            scale: operand.marker
              ? 1
              : 1 + ((scaleTargets[index] || 1) - 1) * size * stay
          };
          this.adjustments.set(operand.visualKey, adjustment);
          this.logicalAdjustments.set(operand.logicalKey, adjustment);
          const popup = popups.get(popupKey(operand, index));
          if (popup) {
            const popupScale = 0.82 + 0.18 * popupReveal;
            const popupOpacity = popupReveal * stay;
            const splitX = contact.x * size * stay;
            const contactY = contact.y * size * stay;
            const compareScale = 1 + ((scaleTargets[index] || 1) - 1) * size * stay;
            popup.group.setAttribute('opacity', String(popupOpacity));
            popup.group.setAttribute(
              'transform',
              `translate(${operand.point.x + splitX}, ${operand.point.y + contactY}) scale(${popupScale * compareScale})`
            );
          }
        });
        selfSplit?.update(lift, size, stay);
        elements?.forEach?.((element, key) => {
          const targetKey = element?.dataset?.traceBindingTarget;
          if (!targetKey || !this.logicalAdjustments.has(targetKey)) return;
          const target = this.logicalAdjustments.get(targetKey);
          this.adjustments.set(key, { x: target.x, y: target.y, scale: 1 });
        });
        if (elapsed >= resetEnd) this.remove();
      },
      remove() {
        highlights.forEach(highlight => highlight.remove());
        expression?.remove();
        popups.forEach(popup => popup.group.remove());
        selfSplit?.remove();
        promotedElements.remove();
        highlights.length = 0;
        expression = null;
        popups.clear();
        this.adjustments.clear();
        this.logicalAdjustments.clear();
      }
    };
  }

  function eventAnimation(document, type) {
    return window.ASMTraceEvents?.animation?.(type) || 'none';
  }

  function buildEventTimeline(traceDocument, eventFrame, direction, swapDuration) {
    if (Number(direction) < 0) return [];
    const compareDuration = Object.values(COMPARE_TIMING).reduce((sum, value) => sum + value, 0);
    const assignDuration = Object.values(ASSIGN_TIMING).reduce((sum, value) => sum + value, 0);
    const slots = [];
    let cursor = 0;
    (eventFrame?.events || []).forEach(event => {
      const animation = eventAnimation(traceDocument, event.type);
      let duration = 0;
      if (event.type === 'assign' && animation === 'assign') duration = swapDuration + assignDuration;
      if (event.type === 'compare' && animation === 'compare') duration = compareDuration;
      if (event.type === 'swap' && animation === 'swap') duration = swapDuration;
      if (!duration) return;
      if (slots.length) cursor += EVENT_GAP;
      const effectStart = cursor;
      const motionStart = cursor + (event.type === 'assign' ? assignDuration : 0);
      slots.push({
        event, type: event.type, start: cursor, effectStart, motionStart,
        duration, end: cursor + duration
      });
      cursor += duration;
    });
    return slots;
  }

  function assignmentMotionDelays(traceDocument, eventFrame, eventTimeline, placements, elements) {
    const delays = new Map();
    eventTimeline.filter(slot => slot.type === 'assign').forEach(slot => {
      const target = (slot.event?.targets || []).find(item => item.role === 'target')
        || slot.event?.targets?.[0];
      const operand = eventOperand(
        traceDocument, eventFrame, target, slot.event?.payload?.after,
        placements, elements, key => key
      );
      if (!operand) return;
      delays.set(
        operand.visualKey,
        Math.max(delays.get(operand.visualKey) || 0, slot.motionStart ?? slot.start)
      );
    });
    return delays;
  }

  function assignmentSequence(options, eventFrame, eventTimeline) {
    const slots = eventTimeline.filter(slot => slot.type === 'assign');
    if (!slots.length) return null;
    let activeSlot = null;
    let activeEffect = null;
    return {
      update(elapsed) {
        const slot = slots.find(item => elapsed >= item.start && elapsed <= item.end) || null;
        if (slot !== activeSlot) {
          activeEffect?.remove?.();
          activeSlot = slot;
          activeEffect = slot
            ? createAssignEffect(
              options.root, slot.event, options.document, eventFrame,
              options.currentPlacements, options.currentElements, options.rawDeltas
            )
            : null;
        }
        if (slot && activeEffect) activeEffect.update(elapsed - (slot.effectStart ?? slot.start));
      },
      finish() {
        activeEffect?.remove?.();
        activeEffect = null;
        activeSlot = null;
      }
    };
  }

  function compareSequence(options, eventFrame, eventTimeline) {
    const slots = eventTimeline.filter(slot => slot.type === 'compare');
    if (!slots.length) return null;
    let activeSlot = null;
    let activeEffect = null;
    return {
      get adjustments() { return activeEffect?.adjustments || new Map(); },
      update(elapsed) {
        const slot = slots.find(item => elapsed >= item.start && elapsed <= item.end) || null;
        if (slot !== activeSlot) {
          activeEffect?.remove?.();
          activeSlot = slot;
          activeEffect = slot
            ? createCompareEffect(
              options.root, slot.event, options.document, eventFrame,
              options.currentPlacements, options.currentElements, options.visualKeyForSource
            )
            : null;
        }
        if (slot && activeEffect) activeEffect.update(Math.max(0, elapsed - slot.start));
      },
      finish() {
        activeEffect?.remove?.();
        activeEffect = null;
        activeSlot = null;
      }
    };
  }

  function removeAnimationNodes(element) {
    element?.querySelectorAll?.('animate, animateTransform, animateMotion').forEach(node => node.remove());
  }

  function wrapAttachedVisual(element) {
    const parent = element?.parentNode;
    if (!parent) return null;
    const wrapper = createSvg('g', {
      class: 'asm-trace-attached-motion',
      'pointer-events': 'none'
    });
    parent.insertBefore(wrapper, element);
    wrapper.append(element);
    return { wrapper, element, baseOpacity: wrapper.getAttribute('opacity') };
  }

  function unwrapAttachedVisual(attachment) {
    const { wrapper, element } = attachment || {};
    if (!wrapper?.parentNode || !element) return;
    wrapper.parentNode.insertBefore(element, wrapper);
    wrapper.remove();
  }

  function play(options = {}) {
    const {
      root, document: traceDocument, frame, previousPlacements, currentPlacements,
      previousObjects, currentElements, transitionForKey
    } = options;
    if (!root || !currentPlacements || !currentElements) return Promise.resolve();

    const duration = Math.max(0, Number(options.duration) || 520);
    if (!duration) return Promise.resolve();
    const runId = ++activeRun;
    let resolveRun = null;
    const completion = new Promise(resolve => { resolveRun = resolve; });
    const finishRun = () => {
      if (!resolveRun) return;
      const resolve = resolveRun;
      resolveRun = null;
      if (finishActiveRun === finishRun) finishActiveRun = null;
      resolve();
    };
    finishActiveRun = finishRun;
    const eventFrame = options.eventFrame || frame;
    const eventTimeline = buildEventTimeline(traceDocument, eventFrame, options.direction, duration);
    const swapMap = swapSources(traceDocument, eventFrame, eventTimeline);
    const assignDelays = assignmentMotionDelays(
      traceDocument, eventFrame, eventTimeline, currentPlacements, currentElements
    );
    const visualKeyBySource = new Map();
    swapMap.forEach((swap, visualKey) => visualKeyBySource.set(swap.sourceKey, visualKey));
    const rawDeltas = new Map();
    const entries = [];
    const currentTopKeys = new Set();
    const attachmentsByKey = new Map();

    root.querySelectorAll('[data-trace-attached-to]').forEach(element => {
      const key = element.getAttribute('data-trace-attached-to') || '';
      if (!key) return;
      if (!attachmentsByKey.has(key)) attachmentsByKey.set(key, []);
      attachmentsByKey.get(key).push(element);
    });

    currentElements.forEach((element, key) => {
      if (!element?.isConnected) return;
      const current = currentPlacements.get(key);
      if (!current) return;
      const plan = transitionForKey?.(key) || { mode: 'move', sourceKey: key, duration };
      const swap = swapMap.get(key);
      const sourceKey = swap?.sourceKey || plan.sourceKey || key;
      const previous = previousPlacements?.get(sourceKey);
      const mode = plan.mode || (previous ? 'move' : 'lift');
      const raw = previous
        ? { x: (Number(previous.x) || 0) - (Number(current.x) || 0), y: (Number(previous.y) || 0) - (Number(current.y) || 0) }
        : { x: 0, y: 24 };
      rawDeltas.set(key, raw);
      const topKey = topLevelKey(element, root);
      if (topKey === key) currentTopKeys.add(key);
      entries.push({
        key, sourceKey, element, current, previous, plan, mode, topKey,
        motionDelay: Math.max(swap?.start || 0, assignDelays.get(key) || 0)
      });
    });

    entries.forEach(entry => {
      const parentKey = parentObjectKey(entry.element, root);
      const own = rawDeltas.get(entry.key) || { x: 0, y: 0 };
      const parent = rawDeltas.get(parentKey) || { x: 0, y: 0 };
      entry.dx = own.x - parent.x;
      entry.dy = own.y - parent.y;
      entry.target = entry.key === entry.topKey
        ? entry.element.querySelector(':scope > .asm-trace-motion') || entry.element
        : entry.element;
      entry.baseTransform = entry.target.getAttribute('transform') || '';
      entry.baseOpacity = entry.target.getAttribute('opacity');
      entry.appearing = !entry.previous;
      entry.attachedVisuals = (attachmentsByKey.get(entry.key) || [])
        .map(wrapAttachedVisual)
        .filter(Boolean);
      try {
        const box = entry.element.getBBox();
        entry.compareCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      } catch (error) {
        entry.compareCenter = { x: 0, y: 0 };
      }
      entry.rects = [...entry.element.querySelectorAll('rect')];
      const previousTop = previousObjects?.get(entry.topKey);
      entry.previousRectStates = previousTop ? rectStates(previousTop, entry.topKey) : new Map();
      entry.currentRectStates = rectStates(entry.element, entry.topKey);
    });

    const ghosts = [];
    previousObjects?.forEach((clone, key) => {
      if (currentTopKeys.has(key)) return;
      removeAnimationNodes(clone);
      clone.removeAttribute('id');
      clone.removeAttribute('data-trace-object-key');
      clone.classList.add('asm-trace-transition-ghost');
      clone.setAttribute('pointer-events', 'none');
      const wrapper = createSvg('g', { class: 'asm-trace-transition-ghost-motion', 'pointer-events': 'none' });
      wrapper.append(clone);
      root.prepend(wrapper);
      ghosts.push(wrapper);
    });

    const comparison = compareSequence({
      ...options,
      visualKeyForSource: key => visualKeyBySource.get(key) || key
    }, eventFrame, eventTimeline);
    const assignment = assignmentSequence({ ...options, rawDeltas }, eventFrame, eventTimeline);
    const eventTimelineDuration = eventTimeline.reduce((end, slot) => Math.max(end, slot.end), 0);
    const motionDuration = entries.reduce((end, entry) => (
      Math.max(end, entry.motionDelay + Math.max(1, Number(entry.plan?.duration) || duration))
    ), duration);
    const totalDuration = Math.max(eventTimelineDuration, motionDuration);
    let previousTick = performance.now();
    let elapsed = 0;
    function tick(now) {
      if (runId !== activeRun) return;
      elapsed += Math.max(0, now - previousTick) * animationPlaybackRate();
      previousTick = now;
      const progress = Math.max(0, Math.min(1, elapsed / duration));
      const eased = easeOutCubic(progress);

      if (elapsed < eventTimelineDuration) {
        assignment?.update(elapsed);
        comparison?.update(elapsed);
      } else {
        assignment?.finish();
        comparison?.finish();
      }

      entries.forEach(entry => {
        const motionElapsed = Math.max(0, elapsed - entry.motionDelay);
        const localDuration = Math.max(1, Number(entry.plan?.duration) || duration);
        const localProgress = Math.max(0, Math.min(1, motionElapsed / localDuration));
        const localEased = easeOutCubic(localProgress);
        const appearProgress = clamp01(elapsed / Math.min(APPEAR_TIMING.duration, localDuration));
        const appearEased = easeOutCubic(appearProgress);
        let dx = entry.dx * (1 - localEased);
        let dy = entry.dy * (1 - localEased);
        if (entry.mode === 'arc' && entry.previous) {
          dy -= Math.sin(Math.PI * localEased) * Math.max(18, Math.min(90, Math.hypot(entry.dx, entry.dy) * 0.22));
        }
        if (entry.mode === 'instant' || entry.mode === 'fade') dx = dy = 0;
        if (entry.appearing) {
          dx = 0;
          dy = APPEAR_TIMING.offsetY * (1 - appearEased);
        }
        const adjustment = comparison?.adjustments?.get?.(entry.key) || { x: 0, y: 0, scale: 1 };
        const adjustedX = dx + (Number(adjustment.x) || 0);
        const adjustedY = dy + (Number(adjustment.y) || 0);
        const translate = Math.abs(adjustedX) > 0.01 || Math.abs(adjustedY) > 0.01
          ? `translate(${adjustedX}, ${adjustedY})`
          : '';
        const scale = Number(adjustment.scale) || 1;
        const pivot = entry.compareCenter || { x: 0, y: 0 };
        const scaleTransform = Math.abs(scale - 1) > 0.001
          ? `translate(${pivot.x}, ${pivot.y}) scale(${scale}) translate(${-pivot.x}, ${-pivot.y})`
          : '';
        entry.target.setAttribute('transform', [translate, entry.baseTransform, scaleTransform].filter(Boolean).join(' '));
        entry.attachedVisuals.forEach(attachment => {
          attachment.wrapper.setAttribute('transform', [translate, scaleTransform].filter(Boolean).join(' '));
        });

        if (entry.appearing) {
          entry.target.setAttribute('opacity', String(appearEased));
          entry.attachedVisuals.forEach(attachment => {
            attachment.wrapper.setAttribute('opacity', String(appearEased));
          });
        } else if (entry.mode === 'fade') {
          entry.target.setAttribute('opacity', String(localEased));
        }

        entry.rects.forEach((rect, index) => {
          const key = rectKey(rect, index);
          const before = entry.previousRectStates.get(key);
          const after = entry.currentRectStates.get(key);
          if (!before || !after || (before.fill === after.fill && before.opacity === after.opacity)) return;
          const fromColor = parseColor(before.fill, before.opacity);
          const toColor = parseColor(after.fill, after.opacity);
          if (!fromColor || !toColor) return;
          const color = interpolateColor(fromColor, toColor, localEased);
          rect.setAttribute('fill', `rgb(${color.r},${color.g},${color.b})`);
          rect.setAttribute('fill-opacity', String(color.a));
        });
      });

      ghosts.forEach(ghost => {
        ghost.setAttribute('opacity', String(1 - eased));
        ghost.setAttribute('transform', `translate(0, ${-15 * eased})`);
      });

      if (elapsed < totalDuration) {
        requestAnimationFrame(tick);
        return;
      }

      entries.forEach(entry => {
        if (entry.baseTransform) entry.target.setAttribute('transform', entry.baseTransform);
        else entry.target.removeAttribute('transform');
        if (entry.baseOpacity != null) entry.target.setAttribute('opacity', entry.baseOpacity);
        else entry.target.removeAttribute('opacity');
        entry.attachedVisuals.forEach(attachment => unwrapAttachedVisual(attachment));
        entry.currentRectStates.forEach((state, key) => {
          const rect = entry.rects.find((item, index) => rectKey(item, index) === key);
          if (!rect) return;
          if (state.fill) rect.setAttribute('fill', state.fill);
          rect.setAttribute('fill-opacity', String(state.opacity));
        });
      });
      ghosts.forEach(ghost => ghost.remove());
      assignment?.finish?.();
      comparison?.finish?.();
      finishRun();
    }
    tick(previousTick);
    return completion;
  }

  function cancel() {
    activeRun += 1;
    finishActiveRun?.();
    document.querySelectorAll(
      '.asm-trace-compare-highlight, .asm-trace-compare-operator, '
      + '.asm-trace-compare-marker-popup, .asm-trace-assign-marker-popup, '
      + '.asm-trace-assign-falling-value, .asm-trace-compare-self-clone'
    ).forEach(element => element.remove());
  }

  window.ASMTraceFrameTween = { play, cancel };
})();
