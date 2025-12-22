// draw_2Darray.js
;(function () {

  const NS = 'http://www.w3.org/2000/svg';
  const baseBoxSize = 40;   // 和其他 array 視覺一致

  let initedDefs   = false;

  function ensureDefs() {
    const svg = window.getViewport().ownerSVGElement;
    if (!svg) return;
    if (!svg.querySelector('#highlight-defs')) {
      const defs = document.createElementNS(NS, 'defs');
      defs.setAttribute('id', 'highlight-defs');
      const style = document.createElementNS(NS, 'style');
      style.textContent = `
        @keyframes blink-stroke {
          0%,100% { stroke-opacity:1; }
          50% { stroke-opacity:0; }
        }
        .highlight-blink { animation: blink-stroke 1s infinite; }
      `;
      defs.appendChild(style);
      svg.insertBefore(defs, svg.firstChild);
    }
  }

  function getMaxNumericIn2DArray(matrix) {
    let max = 0; // 這裡用 0 當預設，避免全是空/非數字時變 -Infinity
    if (!Array.isArray(matrix)) return max;

    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i];
      if (!Array.isArray(row)) continue;
      for (let j = 0; j < row.length; j++) {
        const v = Number(row[j]);
        if (!Number.isNaN(v) && Number.isFinite(v)) {
          if (v > max) max = v;
        }
      }
    }
    return max;
  }

  /**
   * 在畫布上畫一個 2D 陣列表格：
   *  - 最上面一列顯示欄索引（0,1,2,...）
   *  - 最左邊一欄顯示列索引（0,1,2,...）
   *  - 內部每格顯示 matrix[r][c] 的值
   *
   * @param {string}            groupID            - 這個 2D 陣列的群組名稱（也會是 <g> 的 id）
   * @param {number}            offsetX            - 在畫布上的 X 位置
   * @param {number}            offsetY            - 在畫布上的 Y 位置
   * @param {Array<Array<any>>} matrix             - 二維陣列，例如 [[1,2,3],[4,5,6]]
   * @param {Array<StyleItem>}  style              - 額外設定（可省略）
   * @param {Array<Array<int>>} range              - 要畫的範圍，例如 [[1,1],[9,9]]
   * @param {string}            draw_type          - normal = 畫數字, clear = 不畫數字
   * @param {number}            index              - 要不要索引    0 都不要, 1 留x索引, 2 留y索引, 3 留x,y索引
   */
  function draw2DArray(
    groupID,
    offsetX = 0,
    offsetY = 0,
    matrix,
    style = {},
    range = {},
    draw_type = 'normal',
    index = 3
  ) {
    const vp = window.getViewport();
    if (!vp) return;
    if (!initedDefs) { ensureDefs(); initedDefs = true; }

    if (!Array.isArray(matrix)) {
      matrix = [];
    }

    const rows = matrix.length;
    const cols = matrix.reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    );

    let startR = 0, startC = 0, endR = rows, endC = cols;
    if(range.length === 1) startR = range[0][0], startC = range[0][1];
    if(range.length === 2) startR = range[0][0], startC = range[0][1], endR = range[1][0]+1, endC = range[1][1]+1;

    if(draw_type === 'clear') index = 0;
    
    const isIndexX   = index%2;
    const isIndexY   = (Math.floor(index / 2)) % 2;

    const total_rows = endR - startR + isIndexY;
    const total_cols = endC - startC + isIndexX;

    const cellW = baseBoxSize;
    const cellH = baseBoxSize;

    const Max = getMaxNumericIn2DArray(matrix);

    let highlight      = style.filter(s => s.type === "highlight");
    let focus          = style.find(s => s.type === "focus")      ?.elements ?? [];
    let point          = style.filter(s => s.type === "point");
    let mark           = style.filter(s => s.type === "mark");
    let background     = style.filter(s => s.type === "background");
    let CDVS           = style.find(s => s.type === "CDVS")       ?.elements ?? [];
    let noneNumber     = style.find(s => s.type === "noneNumber") ?.elements ?? [];

    // 取得或建立 g
    let g = vp.querySelector('#' + groupID);
    if (!g) {
      g = document.createElementNS(NS, 'g');
      g.setAttribute('id', groupID);
      g.classList.add('draggable-object');
      g.setAttribute('data-translate', '0,0');
      vp.appendChild(g);
    }

    // 每幀重畫前清空內容（保留 data-translate）
    while (g.firstChild) g.removeChild(g.firstChild);

    window.draw_array_outerframe(g, groupID, total_rows * baseBoxSize, total_cols * baseBoxSize);  //畫外框

    // ========= 畫表頭 =========
    if (draw_type === 'normal') {
        if (isIndexX) {
            for (let r = startR; r < endR; r++) {
                const x = 0;
                const y = (r - startR + isIndexY) * cellH;
                window.draw_block(g, x, y, r, cellW, cellH, headerColor, `block-${groupID}-${r}-index`);
            }
        }
        if (isIndexY) {
            for (let c = startC; c < endC; c++) {
                const x = (c - startC + isIndexX) * cellW;
                const y = 0;
                window.draw_block(g, x, y, c, cellW, cellH, headerColor, `block-${groupID}-index-${c}`);
            }
        }
    }

    // ========= 畫每一列：左側列索引 + 內部資料 =========
    for (let r = startR; r < endR; r++) {
      for (let c = startC; c < Math.min(endC,matrix[r].length); c++) {
        const x = (c - startC + isIndexX) * cellW;
        const y = (r - startR + isIndexY) * cellH;
        const value = (draw_type === 'clear') ? '' : matrix[r][c];

        const haveFocus        =       focus.length  > 0 ?  focus.some(([a, b]) => a === r && b === c) : true;
        const haveBackground   =  background.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c));
        const background_color = (background.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c)) ?.color?.trim() || "") || "rgb(231, 144, 255)";

        let fillColor = haveFocus       ? '#fff' : '#ccc';
            fillColor = haveBackground  ? background_color : fillColor;

        if (CDVS.some(([a, b]) => a === r && b === c)) {
          const ratio = Math.min(value / Max, 1); // 限制在 0~1
          const r = Math.round(255 * (1 - ratio) + 40 * ratio);   // 255→40
          const g = Math.round(255 * (1 - ratio) + 183 * ratio);  // 255→183
          const b = Math.round(255 * (1 - ratio) + 255 * ratio);  // 255→255
          fillColor = `rgb(${r}, ${g}, ${b})`;
        }

        window.draw_block(g, x, y, value, cellW, cellH, fillColor, `block-${groupID}-${r}-${c}`);
      }
    }

    // ========= 提示小元件 =========
    for (let r = startR; r < endR; r++) {
      for (let c = startC; c < Math.min(endC,matrix[r].length); c++) {
        const x = (c - startC + isIndexX) * cellW;
        const y = (r - startR + isIndexY) * cellH;

        const haveHighlight    =   highlight.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c));
        const havePoint        =       point.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c));
        const haveMark         =        mark.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c));
  
        const highlight_color  =  (highlight.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c)) ?.color?.trim() || "") || "red";
        const point_color      =      (point.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c)) ?.color?.trim() || "") || "red";
        const mark_color       =       (mark.findLast(m => Array.isArray(m.elements) && m.elements.some(([a, b]) => a === r && b === c)) ?.color?.trim() || "") || "limegreen";

        // 畫各式各樣的提示元件
        if (window.HintWidgets){
          // 高光框框（highlight）
          if (haveHighlight)  HintWidgets.drawHighlightBox(g, x, y, baseBoxSize, baseBoxSize, highlight_color);
  
          // 紅色箭頭（point）
          if (havePoint)      HintWidgets.drawArrow(g, x + baseBoxSize / 2, y, point_color);
  
          // 綠色勾勾（mark）
          if (haveMark)       HintWidgets.drawMark(g, x + baseBoxSize - 10, y + baseBoxSize - 10, mark_color);
        }
      }
    }

    // ========= 設定拖曳與基準位移 =========
    // 讀出目前已存在的拖曳偏移（若有被使用者拖過）
    const [dx, dy] = (g.getAttribute('data-translate') || '0,0')
      .split(',')
      .map(Number);

    // 把這一幀的「邏輯位置」記在 data-base-offset
    g.setAttribute('data-base-offset', `${offsetX},${offsetY}`);

    // 合併 base + 拖曳偏移，更新真正的 transform
    g.setAttribute(
      'transform',
      `translate(${offsetX + dx},${offsetY + dy})`
    );
  }

  // 掛到全域
  window.draw2DArray   = draw2DArray;
  window.draw_2Darray  = draw2DArray;

})();
