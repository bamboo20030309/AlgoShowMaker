// resolve_pos.js
; (function () {

  window.resolvePos = function (spec) {
    if (!spec) return { x: 0, y: 0 };

    // ==========================================
    // 1. 絕對位置 (Absolute)
    // ==========================================
    if (spec.type === 'abs' || ((spec.x !== undefined || spec.y !== undefined) && !spec.ref)) {
      return {
        x: Number(spec.x || 0),
        y: Number(spec.y || 0),
        anchor: (spec.anchor || '').toLowerCase()
      };
    }

    // ==========================================
    // 2. 相對位置 (Relative)
    // ==========================================
    if (spec.type === 'rel' || spec.ref) {
      const refId = spec.ref; // 對應 C++ 的 refId (或是舊版的 group)
      const vp = window.getViewport ? window.getViewport() : document;

      // 找到目標 DOM 元素 (通常是 <g>)
      let el = vp.querySelector('#' + CSS.escape(refId));

      // [核心修復] 如果因為同一影格執行導致 querySelector ID 索引還沒建好，直接遍歷
      if (!el) {
        const fullList = Array.from(vp.children);
        el = fullList.find(child => child.getAttribute('id') === refId);
      }

      if (!el) {
        console.warn(`[resolvePos] 找不到目標物件 ID: ${refId}`);
        return { x: 0, y: 0 };
      }

      // 準備計算結果
      let calculatedPos = { x: 0, y: 0 };
      const hasIndex = (spec.index !== undefined && spec.index !== null && spec.index !== -1);
      const hasRowCol = (spec.row !== undefined && spec.row !== -1);
      const hasOuterframe = !(hasIndex || hasRowCol); // 如果沒有 index/rowcol，就當作 outerframe 來處理
      const anchor = spec.anchor || "center";

      // 1. 嘗試查找全域 Layout 定義
      const layoutName = spec.layout || el.getAttribute('data-layout') || 'normal';
      const layouts = window.ArrayLayout || {};
      const layout = layouts[layoutName];

      // -----------------------------------------------------
      // 外框抓位置
      // -----------------------------------------------------
      if (hasOuterframe) {
        if (window.getOuterframePosition && typeof window.getOuterframePosition === 'function') {
          calculatedPos = window.getOuterframePosition(refId, anchor);
        }
      }

      // -----------------------------------------------------
      // 一維陣列抓位置
      // -----------------------------------------------------
      else if (hasIndex) {
        if (layout && typeof layout.getPosition === 'function') {
          calculatedPos = layout.getPosition(refId, spec.index, anchor);
        }
      }

      // -----------------------------------------------------
      // 二維陣列抓位置
      // -----------------------------------------------------
      else if (hasRowCol) {
        if (layout && typeof layout.getPosition === 'function') {
          calculatedPos = layout.getPosition(refId, spec.row, spec.col, anchor);
        }
      }

      // -----------------------------------------------------
      // 方法 D: 最通用的 BBox 計算 (整個物件)
      // -----------------------------------------------------
      else {
        console.log("Fallback to BBox position calculation for element:", el);
        calculatedPos = getFallbackBBoxPosition(el, anchor);
      }

      // 最後：加上使用者指定的額外偏移 (dx, dy)
      // C++ Pos 結構把偏移量存在 x/y 或 dx/dy
      const offX = Number(spec.dx !== undefined ? spec.dx : (spec.x || 0));
      const offY = Number(spec.dy !== undefined ? spec.dy : (spec.y || 0));

      return {
        x: calculatedPos.x + offX,
        y: calculatedPos.y + offY,
        anchor: (spec.anchor || '').toLowerCase()
      };
    }

    return { x: 0, y: 0 };
  };

  /**
   * (備用) 通用 BBox 計算邏輯
   * 當上述方法都失效時，計算整個物件的邊緣/中心
   */
  function getFallbackBBoxPosition(el, anchor) {
    let baseX = 0, baseY = 0;

    // 讀取 transform
    const transform = el.getAttribute('transform');
    if (transform) {
      const match = /translate\s*\(\s*([+\-]?[\d\.]+)\s*[,\s]\s*([+\-]?[\d\.]+)\s*\)/.exec(transform);
      if (match) {
        baseX = parseFloat(match[1]);
        baseY = parseFloat(match[2]);
      }
    } else {
      baseX = parseFloat(el.getAttribute('x')) || 0;
      baseY = parseFloat(el.getAttribute('y')) || 0;
    }

    // 讀取尺寸
    let w = 0, h = 0;
    try {
      if (el.getBBox) {
        const bbox = el.getBBox();
        baseX += bbox.x;
        baseY += bbox.y;
        w = bbox.width;
        h = bbox.height;
      } else {
        const r = el.getBoundingClientRect();
        w = r.width;
        h = r.height;
      }
    } catch (e) { }

    // 計算錨點
    const cx = baseX + w / 2;
    const cy = baseY + h / 2;
    const left = baseX;
    const right = baseX + w;
    const top = baseY;
    const bottom = baseY + h;

    const a = (anchor || '').toLowerCase();
    let x = cx, y = cy;

    if (a.includes('left')) x = left;
    if (a.includes('right')) x = right;
    if (a.includes('top')) y = top;
    if (a.includes('bottom')) y = bottom;

    return { x, y };
  }

  /**
   * 根據 anchor 與物件自身尺寸，計算「自偏移」
   * 物件預設從 (x, y) 往右下延伸，本函式將座標往回偏移使物件對齊參考點
   *
   * anchor 對應規則：
   *   left      → 往左補全部寬度, 往上補一半高度
   *   top       → 往上補全部高度, 往左補一半寬度
   *   right     → 往上補一半高度（不補寬度，因為原本就往右延伸）
   *   bottom    → 往左補一半寬度（不補高度，因為原本就往下延伸）
   *   left top  → 往左補全部寬度, 往上補全部高度
   *   center    → 往左補一半寬度, 往上補一半高度
   *   (空字串)  → 不做任何偏移
   */
  window.applySelfAnchorOffset = function (x, y, w, h, anchor) {
    if (!anchor) return { x, y };
    const a = anchor.toLowerCase();

    // 如果帶有 raw: 前綴，則不計算自補齊偏移（直接使用原始點作為左上角往右下延伸）
    if (a.includes('raw')) return { x, y };

    let ox = 0, oy = 0;
    const hasLeft = a.includes('left');
    const hasRight = a.includes('right');
    const hasTop = a.includes('top');
    const hasBottom = a.includes('bottom');
    const isCenter = a === 'center';

    if (isCenter) {
      ox = -w / 2;
      oy = -h / 2;
    } else {
      // 水平
      if (hasLeft) ox = -w;      // 物件在參考點左邊 → 全部往左
      else if (!hasRight) ox = -w / 2;  // 沒有指定左右 → 水平置中
      // hasRight 不偏移（物件自然往右延伸）

      // 垂直
      if (hasTop) oy = -h;      // 物件在參考點上方 → 全部往上
      else if (!hasBottom) oy = -h / 2;  // 沒有指定上下 → 垂直置中
      // hasBottom 不偏移（物件自然往下延伸）
    }

    return { x: x + ox, y: y + oy };
  };

})();