// hintWidgets.js
;(function() {
  const NS = "http://www.w3.org/2000/svg";

  /**
   * 畫紅色箭頭（point）
   */
  function drawArrow(g, x, y, color, offsetY = -20, ah = 12, aw = 8) {
    const arrow = document.createElementNS(NS, 'path');

    const ax = x;
    const ay = y + offsetY;

    arrow.setAttribute('d', `
      M ${ax - aw/2} ${ay}
      L ${ax - aw/2} ${ay + ah}
      L ${ax - aw}   ${ay + ah}
      L ${ax}        ${ay + ah + aw}
      L ${ax + aw}   ${ay + ah}
      L ${ax + aw/2} ${ay + ah}
      L ${ax + aw/2} ${ay}
      Z
    `);

    arrow.setAttribute('fill', color);
    arrow.classList.add('arrow-bounce');
    g.appendChild(arrow);
  }

  /**
   * 畫綠色勾勾（mark）
   */
  function drawMark(g, x, y, color) {
    const check = document.createElementNS(NS, 'path');
    const cx = x;
    const cy = y;

    check.setAttribute('d', `
      M ${cx - 4} ${cy}
      l 3 3
      l 6 -6
    `);

    check.setAttribute('stroke', color);
    check.setAttribute('stroke-width', '3');
    check.setAttribute('fill', 'none');
    check.setAttribute('stroke-linecap', 'round');
    g.appendChild(check);
  }

  /**
   * 畫外框高亮（例如紅框閃爍）
   */
  function drawHighlightBox(g, x, y, w, h, color = 'red') {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width',  w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '3');
    rect.classList.add('highlight-blink');
    g.appendChild(rect);
  }

  // 統一掛在一個命名空間底下
  window.HintWidgets = {
    drawArrow,
    drawMark,
    drawHighlightBox,
  };
})();
