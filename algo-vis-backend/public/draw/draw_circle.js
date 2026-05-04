// draw_circle.js
;(function () {
  const NS = "http://www.w3.org/2000/svg";

  /**
   * 繪製一個圓形節點 (單立物件)
   * @param {string} id    - 物件唯一識別碼
   * @param {object} pos   - 座標規格 (resolvePos)
   * @param {any}    value - 圓圈內顯示的內容
   * @param {vector} style - 樣式清單 [{type: "background", color: "#..."}, {type: "highlight"}]
   */
  function drawCircle(id, pos, value, style = [], codeLine = -1) {
    const vp = window.getViewport ? window.getViewport() : document.querySelector('#viewport');
    if (!vp) return;

    // 解析座標
    const resolved = window.resolvePos ? window.resolvePos(pos) : { x: pos.x || 0, y: pos.y || 0 };
    const cx = resolved.x;
    const cy = resolved.y;

    // 取得或建立 <g>
    let g = vp.querySelector('#' + CSS.escape(id));
    if (!g) {
      g = document.createElementNS(NS, "g");
      g.setAttribute("id", id);
      g.classList.add("draggable-object");
      vp.appendChild(g);
    }
    g.setAttribute("transform", `translate(${cx}, ${cy})`);
    g.setAttribute("data-alive", "1");

    // 解析樣式
    let radius = 25;
    let bgColor = "#ffffff";
    let strokeColor = "#333";
    let strokeWidth = 1.2;
    let fontColor = "#000";
    let fontSize = 14;
    let isHighlight = false;
    let isPoint = false;

    if (Array.isArray(style)) {
      style.forEach(s => {
        const type = s.type || s.first; // 支援 pair 結構
        const val = s.color || s.second;
        if (type === "background") bgColor = val;
        if (type === "radius") radius = parseFloat(val);
        if (type === "stroke") strokeColor = val;
        if (type === "font_color") fontColor = val;
        if (type === "font_size") fontSize = parseFloat(val);
        if (type === "highlight") isHighlight = true;
        if (type === "point") isPoint = true;
      });
    }

    // 處理 Highlight 風格
    if (isHighlight) {
      strokeColor = "#F44336"; // 紅色高亮
      strokeWidth = 3;
    }

    // 取得或建立 <circle>
    let circle = g.querySelector("circle");
    if (!circle) {
      circle = document.createElementNS(NS, "circle");
      g.appendChild(circle);
    }
    circle.setAttribute("cx", 0); // 相對於 <g> 的中心
    circle.setAttribute("cy", 0);
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", bgColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);

    // 處理 Point 指標
    let pointer = g.querySelector(".cell-pointer");
    if (isPoint) {
      if (!pointer) {
        pointer = document.createElementNS(NS, "path");
        pointer.setAttribute("class", "cell-pointer");
        pointer.setAttribute("fill", "#F44336");
        pointer.setAttribute("d", "M-10,-40 L10,-40 L0,-25 Z"); // 上方三角形指向中點
        g.appendChild(pointer);
      }
    } else if (pointer) {
      pointer.remove();
    }

    // 取得或建立 <text>
    let text = g.querySelector("text");
    if (!text) {
      text = document.createElementNS(NS, "text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      g.appendChild(text);
    }
    text.setAttribute("x", 0);
    text.setAttribute("y", 0);
    text.setAttribute("fill", fontColor);
    text.setAttribute("font-size", fontSize);
    text.setAttribute("font-weight", "500");
    text.textContent = value;

    // 註冊到 BBox 計算 (雖然 fallback 會處理，但這裡明確顯示它是一個物件)
    g.setAttribute("data-layout", "circle");
  }

  window.drawCircle = drawCircle;
})();
