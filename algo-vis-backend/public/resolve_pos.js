// resolve_pos.js
;(function() {

  window.resolvePos = function(spec) {
    if (!spec) return { x: 0, y: 0 };

    // ========= 絕對座標 =========
    if ("x" in spec && "y" in spec) {
      return { x: spec.x, y: spec.y };
    }

    const vp = window.getViewport && window.getViewport();
    if (!vp) return { x: 0, y: 0 };

    const g = vp.querySelector('#' + CSS.escape(spec.group));
    if (!g) return { x: 0, y: 0 };

    const [baseX, baseY] = (g.getAttribute('data-base-offset') || '0,0')
      .split(',').map(Number);
    const [dx, dy] = (g.getAttribute('data-translate') || '0,0')
      .split(',').map(Number);

    // ========= outerframe：上下左右中間（direction）=========
    // 例如：{ group:"num", direction:"down" }
    if ("direction" in spec && typeof spec.direction === "string") {
      if (typeof window.getOuterframePosition === "function") {
        return window.getOuterframePosition(spec.group, spec.direction);
      }

      // fallback：若沒載入 getOuterframePosition，就用 g 上存的 outerframe bbox 算
      const left   = parseFloat(g.getAttribute('data-outerframe-left')   || '0');
      const top    = parseFloat(g.getAttribute('data-outerframe-top')    || '0');
      const right  = parseFloat(g.getAttribute('data-outerframe-right')  || '0');
      const bottom = parseFloat(g.getAttribute('data-outerframe-bottom') || '0');
      const cxLocal = (left + right) / 2;
      const cyLocal = (top + bottom) / 2;

      const dir = spec.direction.toLowerCase();
      const abs = (xLocal, yLocal) => ({ x: baseX + dx + xLocal, y: baseY + dy + yLocal });

      if (dir === "up" || dir === "top")       return abs(cxLocal, top);
      if (dir === "down" || dir === "bottom")  return abs(cxLocal, bottom);
      if (dir === "left")                      return abs(left,   cyLocal);
      if (dir === "right")                     return abs(right,  cyLocal);
      return abs(cxLocal, cyLocal); // center / middle
    }

    // ========= 一維陣列：normal / BIT / heap / segment_tree =========
    if ("index" in spec) {
      const idx = spec.index;

      // 先看 spec 有沒有指定 layout，沒有就看 g 的 data-layout，最後預設 normal
      const layoutName =
        spec.layout ||
        g.getAttribute('data-layout') ||
        'normal';

      const layouts = window.ArrayLayout || {};
      const layout  = layouts[layoutName];

      // 如果該 layout 有提供 getPosition，就交給它算
      if (layout && typeof layout.getPosition === 'function') {
        return layout.getPosition(spec.group, idx);
      }

      // ★ 沒有註冊 layout 的 fallback：用最原始的橫排算法
      const box = parseInt(g.getAttribute("data-box-size") || "40", 10);
      const perRow = parseInt(g.getAttribute("data-items-per-row") || "9999", 10);

      const row = Math.floor(idx / perRow);
      const col = idx % perRow;

      return {
        x: baseX + dx + col * box + box / 2,
        y: baseY + dy + row * box + box / 2
      };
    }

    // ========= 二維陣列 =========
    if ("row" in spec && "col" in spec) {
      const r = spec.row;
      const c = spec.col;
      const box = parseInt(g.getAttribute("data-box-size") || "40", 10);
      return {
        x: baseX + dx + (c + 1) * box + box / 2,
        y: baseY + dy + (r + 1) * box + box / 2
      };
    }

    return { x: 0, y: 0 };
  };

})();
