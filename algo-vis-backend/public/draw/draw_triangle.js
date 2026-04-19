// draw_triangle.js
;(function () {
  const NS = "http://www.w3.org/2000/svg";

  /**
   * 繪製一個三角形 (專門用來代表子樹 subtree)
   * @param {string} id - 唯一識別碼
   * @param {object} p1, p2, p3 - 座標規格 (resolvePos)
   * @param {any} value - 三角形中間顯示的文字
   * @param {object} style - 樣式物件
   */
  function drawTriangle(id, p1, p2, p3, value, style = {}) {
    const vp = window.getViewport ? window.getViewport() : document.querySelector('#viewport');
    if (!vp) return;

    // 解析座標
    const r1 = window.resolvePos ? window.resolvePos(p1) : { x: p1.x || 0, y: p1.y || 0 };
    const r2 = window.resolvePos ? window.resolvePos(p2) : { x: p2.x || 0, y: p2.y || 0 };
    const r3 = window.resolvePos ? window.resolvePos(p3) : { x: p3.x || 0, y: p3.y || 0 };

    // 使用傳入的 ID
    const triangleId = id;

    // 取得或建立 <g> 群組
    let g = vp.querySelector('#' + CSS.escape(triangleId));
    if (!g) {
      g = document.createElementNS(NS, "g");
      g.setAttribute("id", triangleId);
      g.classList.add("draggable-object"); 
      vp.appendChild(g);
    }
    g.setAttribute("data-alive", "1");
    g.setAttribute("data-layout", "triangle"); 

    // 取得或建立 <polygon>
    let poly = g.querySelector("polygon");
    if (!poly) {
      poly = document.createElementNS(NS, "polygon");
      g.appendChild(poly);
    }
    
    // 設定頂點
    poly.setAttribute("points", `${r1.x},${r1.y} ${r2.x},${r2.y} ${r3.x},${r3.y}`);

    // --- 新增外框 (用來支援選取時的反白效果) ---
    let frame = g.querySelector(".interaction-frame");
    if (!frame) {
      frame = document.createElementNS(NS, "rect");
      frame.setAttribute("class", "interaction-frame");
      frame.setAttribute("fill", "none");
      frame.setAttribute("pointer-events", "none"); 
      g.appendChild(frame);
    }
    const minX = Math.min(r1.x, r2.x, r3.x);
    const maxX = Math.max(r1.x, r2.x, r3.x);
    const minY = Math.min(r1.y, r2.y, r3.y);
    const maxY = Math.max(r1.y, r2.y, r3.y);
    const padding = 5;
    frame.setAttribute("x", minX - padding);
    frame.setAttribute("y", minY - padding);
    frame.setAttribute("width", (maxX - minX) + padding * 2);
    frame.setAttribute("height", (maxY - minY) + padding * 2);

    // 解析樣式
    let bgColor = "rgba(165, 214, 167, 0.7)"; 
    let strokeColor = "#333";
    let strokeWidth = 1.5;
    let fontWeight = "normal";
    let fontSize = 14;
    let fontColor = "#000";

    if (Array.isArray(style)) {
      style.forEach(s => {
        const key = s.type || s.first || s.key;
        const val = s.color || s.second || s.value;
        if (key === "background" || key === "color") bgColor = val;
        if (key === "stroke") strokeColor = val;
        if (key === "width") strokeWidth = parseFloat(val);
        if (key === "font_size") fontSize = parseFloat(val);
        if (key === "font_color") fontColor = val;
      });
    } else if (typeof style === 'object') {
      for (const key in style) {
        if (key === "background" || key === "color") bgColor = style[key];
        if (key === "stroke") strokeColor = style[key];
        if (key === "width") strokeWidth = parseFloat(style[key]);
        if (key === "font_size") fontSize = parseFloat(style[key]);
        if (key === "font_color") fontColor = style[key];
      }
    }

    poly.setAttribute("fill", bgColor);
    poly.setAttribute("stroke", strokeColor);
    poly.setAttribute("stroke-width", strokeWidth);
    poly.setAttribute("stroke-linejoin", "round");

    // --- 繪製文字 ---
    let text = g.querySelector("text");
    if (!text) {
      text = document.createElementNS(NS, "text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      g.appendChild(text);
    }
    // 計算幾何中心 (Centroid)
    const tx = (r1.x + r2.x + r3.x) / 3;
    const ty = (r1.y + r2.y + r3.y) / 3;
    
    text.setAttribute("x", tx);
    text.setAttribute("y", ty);
    text.setAttribute("fill", fontColor);
    text.setAttribute("font-size", fontSize);
    text.setAttribute("font-weight", fontWeight);
    text.textContent = (value !== undefined && value !== null) ? value : "";
  }

  window.drawTriangle = drawTriangle;
})();
