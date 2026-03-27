// hintWidgets.js
;(function() {
  const NS = "http://www.w3.org/2000/svg";

  /**
   * 畫紅色箭頭（point）
   */
  function drawArrow(g, x, y, color, id, offsetY = -20, ah = 12, aw = 8, nodeMap = null) {
    let arrow = nodeMap ? nodeMap.get(id) : (id ? g.querySelector(`#${CSS.escape(id)}`) : null);
    if (!arrow) {
      arrow = document.createElementNS(NS, 'path');
      if (id) arrow.setAttribute('id', id);
      g.appendChild(arrow);
    }

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
    arrow.setAttribute('data-alive', '1');
  }

  /**
   * 畫綠色勾勾（mark）
   */
  function drawMark(g, x, y, color, id, nodeMap = null) {
    let check = nodeMap ? nodeMap.get(id) : (id ? g.querySelector(`#${CSS.escape(id)}`) : null);
    if (!check) {
      check = document.createElementNS(NS, 'path');
      if (id) check.setAttribute('id', id);
      g.appendChild(check);
    }
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
    check.setAttribute('data-alive', '1');
  }

  /**
   * 畫外框高亮（例如紅框閃爍）
   */
  function drawHighlightBox(g, x, y, w, h, color = 'red', id, nodeMap = null) {
    let rect = nodeMap ? nodeMap.get(id) : (id ? g.querySelector(`#${CSS.escape(id)}`) : null);
    if (!rect) {
      rect = document.createElementNS(NS, 'rect');
      if (id) rect.setAttribute('id', id);
      g.appendChild(rect);
    }
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width',  w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '3');
    rect.classList.add('highlight-blink');
    rect.setAttribute('data-alive', '1');
  }

  // 統一掛在一個命名空間底下
  window.HintWidgets = {
    drawArrow,
    drawMark,
    drawHighlightBox,
  };
})();
