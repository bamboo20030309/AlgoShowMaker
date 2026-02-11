;(function () {
  const NS = 'http://www.w3.org/2000/svg';

  // 有箭頭的那一端，固定自動縮短的距離（px）
  const ARROW_HEAD_SHRINK = 12;

  // 預設 tween 時間（毫秒）
  const DEFAULT_TWEEN_MS = 200;

  // 給每條箭頭一個唯一 id，用來綁 label
  let arrowIdCounter = 0;

  // 每幀自動配對用的序號（auto-0, auto-1...）
  let frameAutoKeyCounter = 0;

  // 沿線飛行的「箭頭頭」
  // Map<lineElement, { heads:[{g,inner,from}], duration, startTime }>
  const emitArrowMap = new Map();
  let emitAnimRunning = false;

  // tween 動畫 Map：key -> rafId（用來取消舊動畫）
  const tweenRafMap = new Map();

  // 工具：顏色字串轉安全 key
  function colorKey(color) {
    return String(color || '').replace(/[^a-zA-Z0-9]+/g, '_') || 'default';
  }

  // 判斷 spec 是否為 outerframe 連接點
  // 例如 { group:"num", direction:"down" }
  function isOuterframeSpec(spec) {
    return !!spec && typeof spec === 'object' && typeof spec.direction === 'string';
  }

  // ---------------------------------------
  // Marker：三角箭頭（整個畫在線段外側）
  // ---------------------------------------
  function ensureArrowMarker(svg, color) {
    if (!svg) return null;

    const key = colorKey(color);
    const markerId = 'arrow-marker-' + key;

    let marker = svg.querySelector('#' + markerId);
    if (marker) return markerId;

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }

    marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '0');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '3');
    marker.setAttribute('markerHeight', '3');
    marker.setAttribute('markerUnits', 'strokeWidth');
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 Z');
    path.setAttribute('fill', color || 'rgba(255, 58, 58, 0.7)');

    marker.appendChild(path);
    defs.appendChild(marker);
    return markerId;
  }

  // ---------------------------------------
  // Marker：圓點（整個畫在外側）
  // ---------------------------------------
  function ensureDotMarker(svg, color) {
    if (!svg) return null;

    const key = colorKey(color);
    const markerId = 'dot-marker-' + key;

    let marker = svg.querySelector('#' + markerId);
    if (marker) return markerId;

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }

    marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '0');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('markerUnits', 'strokeWidth');
    marker.setAttribute('orient', 'auto');

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', '5');
    circle.setAttribute('cy', '5');
    circle.setAttribute('r', '3.5');
    circle.setAttribute('fill', color || 'rgba(255, 58, 58, 0.7)');

    marker.appendChild(circle);
    defs.appendChild(marker);
    return markerId;
  }

  // ---------------------------------------
  // 計算 marker 額外縮短長度（目前都交給 ARROW_HEAD_SHRINK）
  // ---------------------------------------
  function computeMarkerLen(svg, type, color) {
    if (type === 'arrow') {
      ensureArrowMarker(svg, color);
      return 0;
    }
    if (type === 'dot') {
      ensureDotMarker(svg, color);
      return 0;
    }
    return 0;
  }

  // ---------------------------------------
  // 取/建 arrow-layer
  // ---------------------------------------
  function ensureArrowLayer(vp) {
    let layer = vp.querySelector('#arrow-layer');
    if (!layer) {
      layer = document.createElementNS(NS, 'g');
      layer.setAttribute('id', 'arrow-layer');
      vp.appendChild(layer);
    } else {
      vp.appendChild(layer);
    }
    return layer;
  }

  // ---------------------------------------
  // 小工具：線性補間
  // ---------------------------------------
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // ---------------------------------------
  // tween：把 line 從 (x1,y1,x2,y2) 平滑移到新的座標
  // ---------------------------------------
  function tweenLine(line, from, to, duration) {
    const key = line.getAttribute('data-arrow-key') || '';
    if (tweenRafMap.has(key)) {
      cancelAnimationFrame(tweenRafMap.get(key));
      tweenRafMap.delete(key);
    }

    const startTime = performance.now();
    const dur = Math.max(0, duration | 0);

    // 若 duration=0 就直接套用
    if (dur <= 0) {
      line.setAttribute('x1', to.x1);
      line.setAttribute('y1', to.y1);
      line.setAttribute('x2', to.x2);
      line.setAttribute('y2', to.y2);
      return;
    }

    const raf = (now) => {
      const t = Math.min((now - startTime) / dur, 1);

      const x1 = lerp(from.x1, to.x1, t);
      const y1 = lerp(from.y1, to.y1, t);
      const x2 = lerp(from.x2, to.x2, t);
      const y2 = lerp(from.y2, to.y2, t);

      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);

      // label 跟著走
      const lineId = line.getAttribute('id');
      const vp = window.getViewport && window.getViewport();
      if (vp && lineId) {
        const label = vp.querySelector(
          '#arrow-layer text[data-arrow-id="' + CSS.escape(lineId) + '"]'
        );
        if (label) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          label.setAttribute('x', mx);
          label.setAttribute('y', my - 4);
        }
      }

      if (t < 1) {
        const id = requestAnimationFrame(raf);
        tweenRafMap.set(key, id);
      } else {
        tweenRafMap.delete(key);
      }
    };

    const id = requestAnimationFrame(raf);
    tweenRafMap.set(key, id);
  }

  // ---------------------------------------
  // 更新：重算所有箭頭座標 & label 位置（拖曳/縮放時用）
  // ---------------------------------------
  function updateArrows() {
    const vp = window.getViewport && window.getViewport();
    if (!vp || !window.resolvePos) return;

    const lines = vp.querySelectorAll('#arrow-layer line[data-bind="resolvePos"]');
    lines.forEach(line => {
      const sStr = line.getAttribute('data-start-spec');
      const eStr = line.getAttribute('data-end-spec');
      if (!sStr || !eStr) return;

      let startSpec, endSpec;
      try {
        startSpec = JSON.parse(sStr);
        endSpec   = JSON.parse(eStr);
      } catch {
        return;
      }

      const p1 = window.resolvePos(startSpec);
      const p2 = window.resolvePos(endSpec);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;

      const ux = dx / len;
      const uy = dy / len;

      const marginStart = parseFloat(line.getAttribute('data-margin-start') || '0');
      const marginEnd   = parseFloat(line.getAttribute('data-margin-end')   || '0');

      const x1 = p1.x + ux * marginStart;
      const y1 = p1.y + uy * marginStart;
      const x2 = p2.x - ux * marginEnd;
      const y2 = p2.y - uy * marginEnd;

      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);

      const lineId = line.getAttribute('id');
      if (lineId && vp.querySelector) {
        const label = vp.querySelector(
          '#arrow-layer text[data-arrow-id="' + CSS.escape(lineId) + '"]'
        );
        if (label) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          label.setAttribute('x', mx);
          label.setAttribute('y', my - 4);
        }
      }
    });

    // emitArrowMap 的 head 位置由動畫迴圈每 frame 自己算（它讀 line 的 x1..y2），不用額外處理
  }

  // ---------------------------------------
  // 新動畫迴圈：讓「箭頭頭」沿著線跑
  // ---------------------------------------
  function stepEmitAnim(now) {
    if (!emitAnimRunning) return;
    if (emitArrowMap.size === 0) {
      emitAnimRunning = false;
      return;
    }

    emitArrowMap.forEach((info, line) => {
      if (!line.ownerSVGElement) {
        emitArrowMap.delete(line);
        return;
      }

      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (!len) return;

      const ux = dx / len;
      const uy = dy / len;
      const baseAngle = Math.atan2(dy, dx) * 180 / Math.PI;

      const duration = info.duration || 1000;
      const t = ((now - info.startTime) % duration) / duration; // 0~1
      const dist = t * len;

      info.heads.forEach(head => {
        let px, py, angle;

        if (head.from === 'start') {
          px = x1 + ux * dist;
          py = y1 + uy * dist;
          angle = baseAngle;
        } else {
          px = x2 - ux * dist;
          py = y2 - uy * dist;
          angle = baseAngle + 180;
        }

        head.g.setAttribute('transform', `translate(${px},${py}) rotate(${angle})`);
      });
    });

    if (emitArrowMap.size > 0) {
      requestAnimationFrame(stepEmitAnim);
    } else {
      emitAnimRunning = false;
    }
  }

  // ---------------------------------------
  // 取得 line 目前座標（供 tween 起點用）
  // ---------------------------------------
  function getLineXY(line) {
    return {
      x1: parseFloat(line.getAttribute('x1') || '0'),
      y1: parseFloat(line.getAttribute('y1') || '0'),
      x2: parseFloat(line.getAttribute('x2') || '0'),
      y2: parseFloat(line.getAttribute('y2') || '0'),
    };
  }

  // ---------------------------------------
  // 畫箭頭（支援 tween）
  // opt.key 可自訂固定 key；不給會用 auto-序號
  // opt.tweenDuration 可自訂 tween ms（預設 300）
  // ---------------------------------------
  function drawArrow(startSpec, endSpec, opt = {}) {
    const vp = window.getViewport && window.getViewport();
    if (!vp || !window.resolvePos) return;

    const svg = vp.ownerSVGElement;
    if (!svg) return;

    const layer = ensureArrowLayer(vp);

    const p1 = window.resolvePos(startSpec);
    const p2 = window.resolvePos(endSpec);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;

    const ux = dx / len;
    const uy = dy / len;

    const color = opt.color || 'rgba(255, 58, 58, 0.7)';
    const width = Number.isNaN(parseFloat(opt.width)) ? 4 : parseFloat(opt.width);

    const headStart = opt.headStart || 'none';  // 'none' | 'arrow' | 'dot'
    const headEnd   = opt.headEnd   || 'arrow'; // 預設終點有箭頭
    const animate   = !!opt.animate;            // 發射箭頭頭效果
    const animColor = opt.animateColor || color;

    // tween 設定
    const tweenMs = (typeof opt.tweenDuration === 'number')
      ? Math.max(0, opt.tweenDuration | 0)
      : DEFAULT_TWEEN_MS;

    // arrow key（配對同一條箭頭用）
    const arrowKey = (opt.key != null)
      ? String(opt.key)
      : ('auto-' + (frameAutoKeyCounter++));

    // 如果 spec 是 outerframe 連接點，預設不縮短（margin=0）
    const startIsOuter = isOuterframeSpec(startSpec);
    const endIsOuter   = isOuterframeSpec(endSpec);

    // 判斷是否為「指向格子」且「錨點為中心」
    const isCell = (s) => (s && (s.index !== undefined || s.row !== undefined));
    const isCenter = (s) => (!s || !s.anchor || s.anchor === 'center');

    // 基本 margin：沒有頭的那端可以短一點，有頭的那端預設長一點
    let baseMarginStart;
    if (opt.marginStart != null) {
      baseMarginStart = Number(opt.marginStart);
    } else {
      if (startIsOuter) baseMarginStart = 0;
      else if (isCell(startSpec) && isCenter(startSpec)) baseMarginStart = 8 + width;
      else baseMarginStart = 0;
    }

    let baseMarginEnd;
    if (opt.marginEnd != null) {
      baseMarginEnd = Number(opt.marginEnd);
    } else {
      if (endIsOuter) baseMarginEnd = 0;
      else if (isCell(endSpec) && isCenter(endSpec)) baseMarginEnd = 8 + width;
      else baseMarginEnd = 0;
    }

    computeMarkerLen(svg, headStart, color);
    computeMarkerLen(svg, headEnd, color);

    const shrinkStart = (headStart === 'arrow' || headStart === 'dot')
      ? ARROW_HEAD_SHRINK + (width - 4) * 3
      : 0;
    const shrinkEnd = (headEnd === 'arrow' || headEnd === 'dot')
      ? ARROW_HEAD_SHRINK + (width - 4) * 3
      : 0;

    const marginStart = baseMarginStart + shrinkStart;
    const marginEnd   = baseMarginEnd   + shrinkEnd;

    const x1 = p1.x + ux * marginStart;
    const y1 = p1.y + uy * marginStart;
    const x2 = p2.x - ux * marginEnd;
    const y2 = p2.y - uy * marginEnd;

    // ====== 嘗試找到上一幀同 key 的 line（做 tween）======
    let line = layer.querySelector('line[data-arrow-key="' + CSS.escape(arrowKey) + '"]') || null;

    // 找 label
    let label = null;
    if (line) {
      const lineId = line.getAttribute('id');
      if (lineId) {
        label = layer.querySelector(
          'text[data-arrow-id="' + CSS.escape(lineId) + '"]'
        );
      }
    }

    // 沒有舊 line → 新建
    if (!line) {
      line = document.createElementNS(NS, 'line');
      const lineId = 'arrow-' + (arrowIdCounter++);
      line.setAttribute('id', lineId);
      line.setAttribute('data-arrow-key', arrowKey);

      // 初始先放在目標位置（或你想要也可以放在同點）
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);

      layer.appendChild(line);
    }

    // 這一幀有被畫到
    line.setAttribute('data-alive', '1');

    // 基本屬性（每幀刷新，避免上一幀殘留）
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', String(width));

    // 虛線：保留原本功能
    if (opt.dashArray) {
      line.setAttribute('stroke-dasharray', String(opt.dashArray));
    } else if (opt.dashed) {
      line.setAttribute('stroke-dasharray', '6,4');
    } else {
      line.removeAttribute('stroke-dasharray');
    }

    // marker-start / marker-end
    line.removeAttribute('marker-start');
    line.removeAttribute('marker-end');

    if (headStart === 'arrow') {
      const id = ensureArrowMarker(svg, color);
      line.setAttribute('marker-start', `url(#${id})`);
    } else if (headStart === 'dot') {
      const id = ensureDotMarker(svg, color);
      line.setAttribute('marker-start', `url(#${id})`);
    }

    if (headEnd === 'arrow') {
      const id = ensureArrowMarker(svg, color);
      line.setAttribute('marker-end', `url(#${id})`);
    } else if (headEnd === 'dot') {
      const id = ensureDotMarker(svg, color);
      line.setAttribute('marker-end', `url(#${id})`);
    }

    // 儲存 spec & margin，之後 updateArrows 可以重算
    line.setAttribute('data-bind', 'resolvePos');
    line.setAttribute('data-start-spec', JSON.stringify(startSpec));
    line.setAttribute('data-end-spec',   JSON.stringify(endSpec));
    line.setAttribute('data-margin-start', String(marginStart));
    line.setAttribute('data-margin-end',   String(marginEnd));

    // 如果上一幀已存在 → tween 到新座標
    const fromXY = getLineXY(line);
    const toXY = { x1, y1, x2, y2 };

    // 若上一幀座標不同才 tween（省資源）
    const needTween =
      (fromXY.x1 !== toXY.x1) || (fromXY.y1 !== toXY.y1) ||
      (fromXY.x2 !== toXY.x2) || (fromXY.y2 !== toXY.y2);

    if (needTween) {
      tweenLine(line, fromXY, toXY, tweenMs);
    } else {
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
    }

    // ====== 中間文字（label）======
    if (opt.text) {
      if (!label) {
        label = document.createElementNS(NS, 'text');
        label.setAttribute('data-arrow-id', line.getAttribute('id'));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'central');
        layer.appendChild(label);
      }
      label.setAttribute('data-alive', '1');
      label.setAttribute('fill', opt.text_color || 'black');
      label.setAttribute('font-size', String(opt.text_size || 20));
      label.setAttribute('font-weight', opt.text_weight || 'bold');
      label.textContent = String(opt.text);

      // 位置由 tweenLoop / updateArrows 會一起維護
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      label.setAttribute('x', mx);
      label.setAttribute('y', my - 1);
    } else {
      // 這一幀沒有 text → 若存在舊 label 就標記待移除
      if (label) label.setAttribute('data-alive', '0');
    }

    // ====== 發射箭頭頭動畫（保留原功能）======
    if (animate) {
      const duration =
        (typeof opt.animateDuration === 'number' && opt.animateDuration > 0)
          ? opt.animateDuration
          : 1000;

      const heads = [];

      function createHead(from) {
        const headOuter = document.createElementNS(NS, 'g');
        const headInner = document.createElementNS(NS, 'g');

        const tri = document.createElementNS(NS, 'path');
        tri.setAttribute('d', 'M -3 -2 L 3 0 L -3 2 Z');
        tri.setAttribute('fill', animColor);

        const scaleFactor = width * 0.70;
        headInner.setAttribute('transform', `scale(${scaleFactor})`);

        headInner.appendChild(tri);
        headOuter.appendChild(headInner);
        layer.appendChild(headOuter);

        heads.push({ g: headOuter, inner: headInner, from });
      }

      if (headEnd !== 'none') createHead('start');
      if (headStart !== 'none') createHead('end');

      if (heads.length > 0) {
        emitArrowMap.set(line, {
          heads,
          duration,
          startTime: performance.now()
        });

        if (!emitAnimRunning) {
          emitAnimRunning = true;
          requestAnimationFrame(stepEmitAnim);
        }
      }
    }
  }

  // ---------------------------------------
  // 幀開始：標記全部箭頭為「未使用」，並重置 auto-key 計數
  // 會由 canva.js 的 clearCanvas() 呼叫 clearArrows() 觸發
  // ---------------------------------------
  function clearArrows() {
    const vp = window.getViewport && window.getViewport();
    if (!vp) return;

    const layer = ensureArrowLayer(vp);

    // 1) 先把本幀 auto key 重新從 0 開始
    frameAutoKeyCounter = 0;

    // 2) 把所有現有箭頭先標記為未使用（這一幀如果又 drawArrow，會被改回 1）
    layer.querySelectorAll('line[data-arrow-key]').forEach(line => {
      line.setAttribute('data-alive', '0');
      // 取消可能殘留的淡出
      line.style.opacity = '';
      line.style.transition = '';
    });
    layer.querySelectorAll('text[data-arrow-id]').forEach(t => {
      t.setAttribute('data-alive', '0');
      t.style.opacity = '';
      t.style.transition = '';
    });

    // 3) 下一個事件迴圈：把仍然 alive=0 的移除（代表這一幀沒有畫到）
    //    這樣就不需要你改 renderFrame/CodeScript 加 end hook
    setTimeout(() => {
      const vp2 = window.getViewport && window.getViewport();
      if (!vp2) return;
      const layer2 = vp2.querySelector('#arrow-layer');
      if (!layer2) return;

      // 先做淡出，再刪除
      const fadeMs = 120;

      layer2.querySelectorAll('line[data-arrow-key][data-alive="0"]').forEach(line => {
        line.style.transition = `opacity ${fadeMs}ms linear`;
        line.style.opacity = '0';

        // label 一起淡出
        const lineId = line.getAttribute('id');
        if (lineId) {
          const label = layer2.querySelector(
            'text[data-arrow-id="' + CSS.escape(lineId) + '"]'
          );
          if (label && label.getAttribute('data-alive') === '0') {
            label.style.transition = `opacity ${fadeMs}ms linear`;
            label.style.opacity = '0';
          }
        }

        setTimeout(() => {
          // 刪 line
          if (line.parentNode) line.parentNode.removeChild(line);
          // 刪 label
          if (lineId) {
            const label2 = layer2.querySelector(
              'text[data-arrow-id="' + CSS.escape(lineId) + '"]'
            );
            if (label2 && label2.parentNode) label2.parentNode.removeChild(label2);
          }

          // 清掉 tween raf
          const k = line.getAttribute('data-arrow-key') || '';
          if (tweenRafMap.has(k)) {
            cancelAnimationFrame(tweenRafMap.get(k));
            tweenRafMap.delete(k);
          }
        }, fadeMs + 5);
      });

      // 清掉仍然掛著但找不到 line 的 emit heads
      emitArrowMap.forEach((info, ln) => {
        if (!ln.ownerSVGElement) emitArrowMap.delete(ln);
      });
    }, 0);
  }

  // ---------------------------------------
  // Export 全域函式
  // ---------------------------------------
  window.drawArrow    = drawArrow;
  window.updateArrows = updateArrows;
  window.clearArrows  = clearArrows;

})();
