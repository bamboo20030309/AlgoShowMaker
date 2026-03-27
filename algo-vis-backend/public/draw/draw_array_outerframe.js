// draw_array_outerframe.js
;(function() {
  const NS = 'http://www.w3.org/2000/svg';
  const baseBoxSize = 40;
  const indexBoxH   = 12;
  const outerframe_padding = 8;

  /**
   * 繪製陣列或堆疊樹的外框。
   * @param {SVGGElement} g            - 容器 SVG 群組
   * @param {string}      groupID      - 群組識別符號，用於顯示標題
   * @param {number}      height       - 高(單位長度)
   * @param {number}      width        - 寬(單位長度)
   */
  function draw_array_outerframe(
    g,
    groupID,
    height,
    width
  ) {
    const pad = 8;
    const nameH = 24;

    const totalH = height;  
    const totalW = width; 
    const frameX = -pad; 
    const frameW = totalW + pad * 2;

    const left = frameX + outerframe_padding;
    const top = -pad + outerframe_padding;
    const right = frameX + frameW + outerframe_padding;
    const bottom = -pad + (height + pad * 2 + nameH) + outerframe_padding;

    // 背景大框
    let bg = g.querySelector(':scope > .outerframe-bg');
    if (!bg) {
      bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('class', 'outerframe-bg');
      g.appendChild(bg);
    }
    bg.setAttribute('x', frameX + outerframe_padding);
    bg.setAttribute('y', -pad + outerframe_padding);
    bg.setAttribute('width', frameW);
    bg.setAttribute('height', height + pad * 2 + nameH);
    bg.setAttribute('fill', 'rgba(209,230,172,0.5)');
    bg.setAttribute('stroke', '#333');
    bg.setAttribute('stroke-width', '2');
    bg.setAttribute('data-alive', '1');

    // 底部名稱區
    let nb = g.querySelector(':scope > .outerframe-nb');
    if (!nb) {
      nb = document.createElementNS(NS, 'rect');
      nb.setAttribute('class', 'outerframe-nb');
      g.appendChild(nb);
    }
    nb.setAttribute('x', frameX + outerframe_padding);
    nb.setAttribute('y', height + pad + outerframe_padding);
    nb.setAttribute('width', frameW);
    nb.setAttribute('height', nameH);
    nb.setAttribute('fill', 'none');
    nb.setAttribute('data-alive', '1');

    // 群組名稱文字
    let label = g.querySelector(':scope > .outerframe-label');
    if (!label) {
      label = document.createElementNS(NS, 'text');
      label.setAttribute('class', 'outerframe-label');
      g.appendChild(label);
    }
    label.setAttribute('x', frameX + frameW / 2 + outerframe_padding);
    label.setAttribute('y', height + pad + nameH / 2 + outerframe_padding);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-size', fitSvgText(g, groupID, frameW, nameH));
    label.setAttribute('fill', '#333');
    label.textContent = groupID;
    label.setAttribute('data-alive', '1');

    writeOuterframeBBox(g, left, top, right, bottom);
    return;
  }

  function writeOuterframeBBox(g, left, top, right, bottom) {
    g.setAttribute('data-outerframe-left',   String(left));
    g.setAttribute('data-outerframe-top',    String(top));
    g.setAttribute('data-outerframe-right',  String(right));
    g.setAttribute('data-outerframe-bottom', String(bottom));
  }


  function getOuterframePosition(groupID, anchor = "center") {
    const vp = window.getViewport && window.getViewport();
    if (!vp) return { x: 0, y: 0 };

    const g = vp.querySelector('#' + CSS.escape(groupID));
    if (!g) return { x: 0, y: 0 };

    const [baseX, baseY] = (g.getAttribute('data-base-offset') || '0,0')
      .split(',').map(Number);
    const [dx, dy] = (g.getAttribute('data-translate') || '0,0')
      .split(',').map(Number);

    const left   = parseFloat(g.getAttribute('data-outerframe-left')   || '0');
    const top    = parseFloat(g.getAttribute('data-outerframe-top')    || '0');
    const right  = parseFloat(g.getAttribute('data-outerframe-right')  || '0');
    const bottom = parseFloat(g.getAttribute('data-outerframe-bottom') || '0');

    const cxLocal = (left + right) / 2;
    const cyLocal = (top + bottom) / 2;

    const a = (anchor || 'center').toLowerCase();

    let xLocal = cxLocal;
    let yLocal = cyLocal;

    if (a.includes('left'))   xLocal = left;
    if (a.includes('right'))  xLocal = right;
    if (a.includes('top'))    yLocal = top;
    if (a.includes('bottom')) yLocal = bottom;

    return { x: baseX + dx + xLocal, y: baseY + dy + yLocal };
  }

  window.draw_array_outerframe = draw_array_outerframe;
  window.getOuterframePosition = getOuterframePosition;
})();
