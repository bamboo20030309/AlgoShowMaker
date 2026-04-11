/* animation.js - 負責影格間的過渡動畫 (Tweening) */
(function() {
  // r,g,b,a 線性補間
  function lerpColorWithAlpha(c1, c2, t) {
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t),
      a: (c1.a + (c2.a - c1.a) * t),
    };
  }

  // 將任何 CSS 顏色格式（含 "red" "blue"）轉成 {r,g,b,a}
  function parseColorWithAlpha(fill, alpha = 1) {
    if (!fill) return null;
    let s = fill.trim().toLowerCase();

    if (s.startsWith("rgba")) {
      const m = s.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/);
      if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) };
    }
    if (s.startsWith("rgb")) {
      const m = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
    }
    if (!s.startsWith("#")) {
      const ctx = parseColorWithAlpha._ctx || (parseColorWithAlpha._ctx = document.createElement("canvas").getContext("2d"));
      ctx.fillStyle = "#000"; ctx.fillStyle = s; s = ctx.fillStyle;
    }
    if (s.startsWith("#")) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
      if (hex.length === 6) return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16), a: alpha };
    }
    const m2 = s.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (m2) return { r: Number(m2[1]), g: Number(m2[2]), b: Number(m2[3]), a: alpha };
    return null;
  }

  // 統一的 rect key 產生器
  function getRectKey(rect) {
    return (
      rect.getAttribute('data-av-key') ||
      [
        rect.getAttribute('x') || '0',
        rect.getAttribute('y') || '0',
        rect.getAttribute('width') || '0',
        rect.getAttribute('height') || '0',
        rect.getAttribute('stroke') || '',
        rect.getAttribute('class') || ''
      ].join('|')
    );
  }

  // 讀出目前畫布上所有 .draggable-object 的狀態
  function snapshotDraggablePositions() {
    const vp = window.getViewport && window.getViewport();
    const map = {};
    if (!vp) return map;
    vp.querySelectorAll('.draggable-object').forEach(g => {
      const id = g.id;
      if (!id) return;
      const [baseX, baseY] = (g.getAttribute('data-base-offset') || '0,0').split(',').map(Number);
      const [dx, dy] = (g.getAttribute('data-translate') || '0,0').split(',').map(Number);
      const rects = Array.from(g.querySelectorAll('rect'));
      const rectState = {};
      rects.forEach(r => {
        const key = getRectKey(r);
        rectState[key] = {
          fill: (r.getAttribute('fill') || '').trim(),
          alpha: r.hasAttribute('fill-opacity') ? (parseFloat(r.getAttribute('fill-opacity')) || 1) : 1
        };
      });
      map[id] = { x: baseX + dx, y: baseY + dy, rectState };
    });
    return map;
  }

  // 做一次「帶過渡動畫」的步進
  window.stepWithTween = function(rawStepFn, duration = 300) {
    const vp = window.getViewport && window.getViewport();
    if (!vp || typeof rawStepFn !== 'function') {
      rawStepFn && rawStepFn();
      if (window.syncCurrentFrameFromCodeScript) window.syncCurrentFrameFromCodeScript();
      return;
    }

    const ease = t => 1 - Math.pow(1 - t, 3);
    const before = snapshotDraggablePositions();
    const beforeIds = new Set(Object.keys(before));
    const ghostMap = {};

    rawStepFn();
    if (window.syncCurrentFrameFromCodeScript) window.syncCurrentFrameFromCodeScript();

    const after = snapshotDraggablePositions();
    const afterIds = new Set(Object.keys(after));

    for (const id of beforeIds) {
      if (afterIds.has(id)) continue;
      const st = before[id];
      if (!st) continue;
      const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      ghost.setAttribute('id', '__ghost__' + id);
      ghost.setAttribute('data-ghost', '1');
      ghost.setAttribute('transform', `translate(${st.x},${st.y})`);
      ghost.setAttribute('opacity', '1');
      ghost.setAttribute('pointer-events', 'none');
      Object.entries(st.rectState || {}).forEach(([key, info]) => {
        const parts = key.split('|');
        if (parts.length < 4) return;
        const [rx, ry, rw, rh, rstroke] = parts;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', rx || '0'); rect.setAttribute('y', ry || '0');
        rect.setAttribute('width', rw || '0'); rect.setAttribute('height', rh || '0');
        if (rstroke) rect.setAttribute('stroke', rstroke);
        if (info.fill) rect.setAttribute('fill', info.fill);
        rect.setAttribute('fill-opacity', String(info.alpha != null ? info.alpha : 1));
        ghost.appendChild(rect);
      });
      vp.appendChild(ghost);
      ghostMap[id] = { ghost, startState: st };
    }

    const appearingIds = new Set();
    for (const id of afterIds) if (!beforeIds.has(id)) appearingIds.add(id);
    const ids = [...afterIds];
    if (ids.length === 0 && Object.keys(ghostMap).length === 0) return;

    const startTime = performance.now();
    function animate(now) {
      let t = (now - startTime) / duration;
      if (t > 1) t = 1; if (t < 0) t = 0;
      const et = ease(t);

      for (const id in ghostMap) {
        const { ghost, startState } = ghostMap[id];
        if (!ghost.parentNode) continue;
        ghost.setAttribute('opacity', String(1 - et));
        ghost.setAttribute('transform', `translate(${startState.x},${startState.y}) scale(${1 - et * 0.3})`);
      }

      ids.forEach(id => {
        const endState = after[id];
        const startState = before[id] || null;
        const isAppearing = appearingIds.has(id);
        const g = vp.querySelector('#' + CSS.escape(id));
        if (!g || !endState) return;

        if (isAppearing) {
          g.setAttribute('opacity', String(et));
          g.setAttribute('transform', `translate(${endState.x},${endState.y}) scale(${0.7 + et * 0.3})`);
          if (t >= 1) { g.setAttribute('opacity', '1'); g.setAttribute('transform', `translate(${endState.x},${endState.y})`); }
          return;
        }

        const fromState = startState || endState;
        const curX = fromState.x + (endState.x - fromState.x) * et;
        const curY = fromState.y + (endState.y - fromState.y) * et;
        const [baseX, baseY] = (g.getAttribute('data-base-offset') || '0,0').split(',').map(Number);
        g.setAttribute('data-translate', `${curX - baseX},${curY - baseY}`);
        g.setAttribute('transform', `translate(${curX},${curY})`);

        g.querySelectorAll('rect').forEach(rect => {
          const key = getRectKey(rect);
          const bInfo = (fromState.rectState||{})[key];
          const aInfo = (endState.rectState||{})[key];
          const dst = aInfo || bInfo;
          if (!dst) return;
          const bFill = bInfo ? bInfo.fill : dst.fill;
          const aFill = dst.fill;
          const bAlpha = bInfo ? bInfo.alpha : 1;
          const aAlpha = dst.alpha != null ? dst.alpha : 1;
          if (bFill === aFill && bAlpha === aAlpha) return;
          const c1 = parseColorWithAlpha(bFill, bAlpha);
          const c2 = parseColorWithAlpha(aFill, aAlpha);
          if (!c1 || !c2) {
            rect.setAttribute('fill', aFill || bFill);
            rect.setAttribute('fill-opacity', String(aAlpha));
          } else {
            const ci = lerpColorWithAlpha(c1, c2, et);
            rect.setAttribute('fill', `rgb(${ci.r},${ci.g},${ci.b})`);
            rect.setAttribute('fill-opacity', String(ci.a));
          }
        });
      });

      if (t < 1) requestAnimationFrame(animate);
      else {
        for (const id in ghostMap) if (ghostMap[id].ghost.parentNode) ghostMap[id].ghost.parentNode.removeChild(ghostMap[id].ghost);
        ids.forEach(id => {
          const end = after[id]; const g2 = vp.querySelector('#' + CSS.escape(id));
          if (!g2 || !end) return;
          g2.setAttribute('opacity', '1');
          const finalMap = end.rectState || {};
          g2.querySelectorAll('rect').forEach(r => {
            const key = getRectKey(r); const info = finalMap[key];
            if (!info) return; if (info.fill) r.setAttribute('fill', info.fill.trim());
            r.setAttribute('fill-opacity', String(info.alpha != null ? info.alpha : 1));
          });
        });
      }
    }
    requestAnimationFrame(animate);
  };
})();
