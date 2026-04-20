// draw_triangle.js
;(function () {
  const NS = "http://www.w3.org/2000/svg";

  /**
   * 繪製一個三角形 (專門用來代表子樹 subtree)
   * @param {string} id - 唯一識別碼
   * @param {object} pos - 頂點座標規格 (resolvePos)
   * @param {number} height - 高度
   * @param {number} width - 寬度
   * @param {object} style - 樣式物件
   */
  function drawTriangle(id, pos, height, width, style = {}) {
    const vp = window.getViewport ? window.getViewport() : document.querySelector('#viewport');
    if (!vp) return;

    // 解析頂點座標 (這是群組的基準點)
    const resolved = window.resolvePos ? window.resolvePos(pos) : { x: pos.x || 0, y: pos.y || 0 };
    const cx = resolved.x;
    const cy = resolved.y;

    // 取得或建立 <g> 群組
    let g = vp.querySelector('#' + CSS.escape(id));
    if (!g) {
      g = document.createElementNS(NS, "g");
      g.setAttribute("id", id);
      g.classList.add("draggable-object"); 
      g.setAttribute("data-layout", "triangle");
      g.setAttribute("data-translate", "0,0");
      vp.appendChild(g);
    }
    g.setAttribute("data-alive", "1");

    // 讀取拖曳偏移並設定 Transform
    const [dx, dy] = (g.getAttribute("data-translate") || "0,0").split(",").map(Number);
    g.setAttribute("data-base-offset", `${cx},${cy}`);
    g.setAttribute("transform", `translate(${cx + dx}, ${cy + dy})`);

    // 取得或建立 <polygon>
    let poly = g.querySelector("polygon");
    if (!poly) {
      poly = document.createElementNS(NS, "polygon");
      g.appendChild(poly);
    }
    
    // 設定相對頂點 (頂點在 0,0)
    const p1 = { x: 0, y: 0 };
    const p2 = { x: -width / 2, y: height };
    const p3 = { x: width / 2, y: height };
    poly.setAttribute("points", `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`);

    // --- 新增外框 (相對座標) ---
    let frame = g.querySelector(".interaction-frame");
    if (!frame) {
      frame = document.createElementNS(NS, "rect");
      frame.setAttribute("class", "interaction-frame");
      frame.setAttribute("fill", "none");
      frame.setAttribute("pointer-events", "none"); 
      g.appendChild(frame);
    }
    const padding = 5;
    frame.setAttribute("x", -width / 2 - padding);
    frame.setAttribute("y", -padding);
    frame.setAttribute("width", width + padding * 2);
    frame.setAttribute("height", height + padding * 2);

    // 解析樣式
    let bgColor = "rgba(165, 214, 167, 0.7)"; 
    let strokeColor = "#333";
    let strokeWidth = 1.5;
    let fontWeight = "normal";
    let fontSize = 14;
    let fontColor = "#000";
    let value = ""; // 從 style 提取文字

    if (Array.isArray(style)) {
      style.forEach(s => {
        const key = s.type || s.first || s.key;
        const val = s.color || s.second || s.value;
        if (key === "background" || key === "color") bgColor = val;
        if (key === "stroke") strokeColor = val;
        if (key === "width") strokeWidth = parseFloat(val);
        if (key === "font_size") fontSize = parseFloat(val);
        if (key === "font_color") fontColor = val;
        if (key === "text") value = val;
      });
    } else if (typeof style === 'object') {
      for (const key in style) {
        if (key === "background" || key === "color") bgColor = style[key];
        if (key === "stroke") strokeColor = style[key];
        if (key === "width") strokeWidth = parseFloat(style[key]);
        if (key === "font_size") fontSize = parseFloat(style[key]);
        if (key === "font_color") fontColor = style[key];
        if (key === "text") value = style[key];
      }
    }

    poly.setAttribute("fill", bgColor);
    poly.setAttribute("stroke", strokeColor);
    poly.setAttribute("stroke-width", strokeWidth);
    poly.setAttribute("stroke-linejoin", "round");

    // --- 繪製文字 (相對座標) ---
    let textNode = g.querySelector("text");
    if (!textNode) {
      textNode = document.createElementNS(NS, "text");
      textNode.setAttribute("text-anchor", "middle");
      textNode.setAttribute("dominant-baseline", "middle");
      g.appendChild(textNode);
    }
    
    textNode.setAttribute("x", 0);
    textNode.setAttribute("y", height * 0.66); // 大約重心位置
    textNode.setAttribute("fill", fontColor);
    textNode.setAttribute("font-size", fontSize);
    textNode.setAttribute("font-weight", fontWeight);
    textNode.textContent = (value !== undefined && value !== null) ? value : "";

    // 儲存原始頂點資訊 (相對)
    g.setAttribute('data-points', `0,0 ${-width/2},${height} ${width/2},${height}`);
  }

  window.drawTriangle = drawTriangle;

})();
