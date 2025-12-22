// draw_utils.js
;(function() {
  const NS = 'http://www.w3.org/2000/svg';

  /**
   * 根據格子尺寸自動求出文字最大字體（使用二分搜尋）
   */
  window.fitSvgText = function(g, textContent, maxWidth, maxHeight, opts = {}) {
    const {
      maxFont = 16,
      minFont = 7,
      family = 'inherit',
      fontWeight = 'normal',
      padding = 4
    } = opts;

    const dummy = document.createElementNS(NS, 'text');
    dummy.textContent = textContent;
    dummy.setAttribute('x', -9999);
    dummy.setAttribute('y', -9999);
    dummy.setAttribute('visibility', 'hidden');
    dummy.setAttribute('font-family', family);
    dummy.setAttribute('font-weight', fontWeight);
    g.appendChild(dummy);

    const targetW = Math.max(1, maxWidth  - padding * 2);
    const targetH = Math.max(1, maxHeight - padding * 2);

    let lo = minFont, hi = maxFont, best = minFont;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      dummy.setAttribute('font-size', String(mid));
      const w = dummy.getComputedTextLength();
      const h = mid;
      if (w <= targetW && h <= targetH) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    g.removeChild(dummy);
    return best;
  };

  window.drawRichText = function(g, {
    x, y, parts,
    fontSize = 16,
    family = "inherit",
    padding = 2,
    radius = 0,
    align = "middle",
  }) {
    // 建立 <text>
    const txt = document.createElementNS(NS, "text");
    txt.setAttribute("x", x);
    txt.setAttribute("y", y);
    txt.setAttribute("dominant-baseline", "middle");
    txt.setAttribute("text-anchor", align);
    txt.setAttribute("font-size", String(fontSize));
    txt.setAttribute("font-family", family);

    // 預先加入所有 <tspan> 以量測
    parts.forEach(seg => {
      const t = document.createElementNS(NS, "tspan");
      if (seg.color)  t.setAttribute("fill", seg.color);
      if (seg.weight) t.setAttribute("font-weight", seg.weight);
      if (seg.italic) t.setAttribute("font-style", "italic");
      t.textContent = seg.text ?? "";
      txt.appendChild(t);
    });

    g.appendChild(txt);

    // 背景層 group（讓底色矩形和文字一起移動）
    const wrapper = document.createElementNS(NS, "g");
    g.appendChild(wrapper);

    // 建立背景矩形群
    const tspans = txt.querySelectorAll("tspan");
    let xCursor = 0;
    tspans.forEach((tspan, i) => {
      const seg = parts[i];
      const bbox = tspan.getBBox();
      if (seg.bg) {
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", bbox.x - padding);
        rect.setAttribute("y", bbox.y - padding);
        rect.setAttribute("width", bbox.width + padding * 2);
        rect.setAttribute("height", bbox.height + padding * 2);
        rect.setAttribute("fill", seg.bg);
        rect.setAttribute("rx", radius);
        wrapper.appendChild(rect);
      }
    });

    // 把文字放到背景矩形上層
    wrapper.appendChild(txt);

    return wrapper;
  };

})();
