// draw_block.js
;(function () {

  const NS = "http://www.w3.org/2000/svg";

  /**
   * 在指定座標畫出一個方格（含內文字），不畫 index 列。
   *
   * @param {SVGGElement} g     - SVG <g> 群組
   * @param {number}      x     - 左上角 x 座標
   * @param {number}      y     - 左上角 y 座標
   * @param {number|string} i   - 此格要顯示的文字（原本的 v）
   * @param {number}      w     - 方塊寬度
   * @param {number}      h     - 方塊高度
   * @param {string}      color - 填色
   * @param {string}      id    - (可選) 固定 ID，用來更新同一格（例如 "cell-LCS-3-4"）
   */
  function draw_block(g, x, y, i, w, h, color, id) {

    // 如果有 id，就「更新」同一格
    if (id != null && id !== "") {
      // 取得/建立 cell group
      let cellG = g.querySelector(`#${CSS.escape(String(id))}`);
      if (!cellG) {
        cellG = document.createElementNS(NS, "g");
        cellG.setAttribute("id", String(id));
        g.appendChild(cellG);
      }

      // 取得/建立 rect
      let rect = cellG.querySelector(":scope > rect");
      if (!rect) {
        rect = document.createElementNS(NS, "rect");
        cellG.appendChild(rect);
      }

      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width",  w);
      rect.setAttribute("height", h);
      rect.setAttribute("fill",   color);
      rect.setAttribute("stroke", "#333");
      rect.setAttribute("stroke-width", "1");

      // 取得/建立 text
      let txt = cellG.querySelector(":scope > text");
      if (!txt) {
        txt = document.createElementNS(NS, "text");
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("dominant-baseline", "middle");
        cellG.appendChild(txt);
      }

      txt.setAttribute("x", x + w / 2);
      txt.setAttribute("y", y + h / 2);

      // 這裡維持你原本 fitSvgText 的用法
      // 注意：fitSvgText 你原本是用 g 當第一參數，這裡改成 cellG 也可以
      // 如果你 fitSvgText 依賴 g 的某些屬性，改回 g 也行
      txt.setAttribute("font-size", fitSvgText(g, String(i), w, h));
      txt.textContent = i;

      return;
    }

    // 沒有 id
    // ===== 主方格 =====
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width",  w);
    rect.setAttribute("height", h);
    rect.setAttribute("fill",   color);
    rect.setAttribute("stroke", "#333");
    rect.setAttribute("stroke-width", "1");
    g.appendChild(rect);

    // ===== 中間文字（顯示 i） =====
    const txt = document.createElementNS(NS, "text");
    txt.setAttribute("x", x + w / 2);
    txt.setAttribute("y", y + h / 2);
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("dominant-baseline", "middle");
    txt.setAttribute("font-size", fitSvgText(g, String(i), w, h));
    txt.textContent = i;
    g.appendChild(txt);
  }

  window.draw_block = draw_block;

})();
