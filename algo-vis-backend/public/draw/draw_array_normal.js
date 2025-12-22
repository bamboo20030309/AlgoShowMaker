// draw_array_normal.js
;(function() {
  const NS = 'http://www.w3.org/2000/svg';
  const baseBoxSize = 40;
  const indexBoxH   = 12;

  /**
   * 在 SVG 群組 g 上，繪製 normal 模式的矩陣陣列。
   * @param {SVGGElement}      g
   * @param {String}           groupID              - 陣列名稱
   * @param {Array}            array                - 經過 range 過濾後的資料陣列
   * @param {Array<StyleItem>} style                - 要繪製的輔助元素
   * @param {Array[2]}         index_range          - 實際顯示的索引起點（通常等於 range[0]）固定兩格 左邊界及右邊界
   * @param {number}           itemsPerRow          - 每列格數
   * @param {number}           index                - 是否顯示每格下方的索引區
   */

  function draw_array_normal(
    g,
    groupID,
    array,
    style,
    index_range = [],
    itemsPerRow = Infinity,
    index = 0
  ) {
    const ranged_array = array.filter((v, i) => i >= index_range[0] && i <= index_range[1]);

    //正規化各個陣列的索引值
    function normalizeIndex(input){
      return input = input
               .map(i => i - index_range[0])
               .filter(i => Number.isInteger(i) && i >= 0 && i <= index_range[1]-index_range[0]);
    }    

    //正規化各個陣列的索引值
    function normalize(styleList) {
      if (!Array.isArray(styleList)) return [];

      return styleList.map(item => {
        if (typeof item !== "object" || item === null) return item;

        const newItem = { ...item }; // 複製物件
        if (Array.isArray(item.elements)) {
          newItem.elements = item.elements
             .map(i => i - index_range[0])
             .filter(i => Number.isInteger(i) && i >= 0 && i <= index_range[1]-index_range[0]);
        }
        return newItem;
      });
    }

    // 根據 style.type 分組
    let highlight      = style.filter(s => s.type === "highlight");
    let focus          = style.find(s => s.type === "focus")      ?.elements ?? [];
    let point          = style.filter(s => s.type === "point");
    let mark           = style.filter(s => s.type === "mark");
    let background     = style.filter(s => s.type === "background");
    let CDVS           = style.find(s => s.type === "CDVS")       ?.elements ?? [];
    
    highlight  = normalize(highlight);
    focus      = normalizeIndex(focus);
    point      = normalize(point);
    mark       = normalize(mark);
    background = normalize(background);
    CDVS       = normalizeIndex(CDVS);
    
    const rowH = baseBoxSize + (index == 1 || index == 3 || index == 4? indexBoxH : 0); //索引高度 有就是12 沒有就是0
    if (!isFinite(itemsPerRow) || itemsPerRow < 1) itemsPerRow = ranged_array.length;
    let cols = Math.min(ranged_array.length, itemsPerRow);                              //列寬
    let rows = Math.ceil(ranged_array.length / itemsPerRow);                            //行高
    cols = (cols > 0 ? cols : 1);
    rows = (rows > 0 ? rows : 1);

    //把排版資訊記到 g 上，讓 getPosition 可以讀
    g.setAttribute('data-items-per-row', String(itemsPerRow));
    g.setAttribute('data-layout', 'normal');

    window.draw_array_outerframe(g, groupID, rows * rowH, cols * baseBoxSize);  //畫外框

    let index_cnt = index_range[0];
    // 1. 繪製所有節點
    ranged_array.forEach((v, i) => {
      const r = Math.floor(i / itemsPerRow),
            c = i % itemsPerRow;
      const x = c * baseBoxSize,
            y = r * rowH;
      
      const haveFocus        =       focus.length  > 0 ?  focus.includes(i) : true;
      const haveBackground   =  background.findLast(m => Array.isArray(m.elements) && m.elements.includes(i));
      const background_color = (background.findLast(m => Array.isArray(m.elements) && m.elements.includes(i)) ?.color?.trim() || "") || "rgb(231, 144, 255)";

      let fillColor = haveFocus       ? '#fff' : '#ccc';
          fillColor = haveBackground  ? background_color : fillColor;

      if (CDVS.includes(i)) {
        const ratio = Math.min(v / Max, 1); // 限制在 0~1
        const r = Math.round(255 * (1 - ratio) + 40 * ratio);   // 255→40
        const g = Math.round(255 * (1 - ratio) + 183 * ratio);  // 255→183
        const b = Math.round(255 * (1 - ratio) + 255 * ratio);  // 255→255
        fillColor = `rgb(${r}, ${g}, ${b})`;
      }

      const array_content = (index == 2 ? index_cnt : v);
      // 畫 array 方格
      draw_block(g, x, y, array_content, baseBoxSize, baseBoxSize, fillColor, `cell-${groupID}-${i}`);

      // 畫 index
      if (index==1 || index>=3) {
        const lbl = index>=3 ? (index_range[0] + i).toString(2).padStart(
              index>=4 ? (index_range[0] + ranged_array.length - 1).toString(2).length : 0,
              '0'
            ) : (index_range[0] + i).toString();
        
        draw_block(g, x, y + baseBoxSize, lbl, baseBoxSize, indexBoxH, fillColor, `cell-${groupID}-${i}-index`);
      }
      index_cnt++;
    });

    // 2. 繪製所有提示元件
    ranged_array.forEach((v, i) => {
      const r = Math.floor(i / itemsPerRow),
            c = i % itemsPerRow;
      const x = c * baseBoxSize,
            y = r * rowH;

      const haveHighlight    =   highlight.findLast(m => Array.isArray(m.elements) && m.elements.includes(i));
      const havePoint        =       point.findLast(m => Array.isArray(m.elements) && m.elements.includes(i));
      const haveMark         =        mark.findLast(m => Array.isArray(m.elements) && m.elements.includes(i));

      const highlight_color  =  (highlight.findLast(m => Array.isArray(m.elements) && m.elements.includes(i)) ?.color?.trim() || "") || "red";
      const point_color      =      (point.findLast(m => Array.isArray(m.elements) && m.elements.includes(i)) ?.color?.trim() || "") || "red";
      const mark_color       =       (mark.findLast(m => Array.isArray(m.elements) && m.elements.includes(i)) ?.color?.trim() || "") || "limegreen";

      // 畫各式各樣的提示元件
      if (window.HintWidgets){
        const indexH = (index==1 || index>=3 ? indexBoxH : 0);
        // 高光框框（highlight）
        if (haveHighlight)  HintWidgets.drawHighlightBox(g, x, y, baseBoxSize, baseBoxSize + indexH, highlight_color);

        // 紅色箭頭（point）
        if (havePoint)      HintWidgets.drawArrow(g, x + baseBoxSize / 2, y, point_color);

        // 綠色勾勾（mark）
        if (haveMark)       HintWidgets.drawMark(g, x + baseBoxSize - 10, y + baseBoxSize - 10, mark_color);
      }
    });
  }
  
  function getNormalPosition(groupID, index) {
    const vp = window.getViewport && window.getViewport();
    if (!vp) return { x: 0, y: 0 };

    const g = vp.querySelector('#' + CSS.escape(groupID));
    if (!g) return { x: 0, y: 0 };

    const itemsPerRow = parseInt(g.getAttribute('data-items-per-row') || '1', 10);

    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;

    const [baseX, baseY] = (g.getAttribute('data-base-offset') || '0,0')
      .split(',').map(Number);
    const [dx, dy] = (g.getAttribute('data-translate') || '0,0')
      .split(',').map(Number);

    const x = baseX + dx + col * baseBoxSize + baseBoxSize / 2;
    const y = baseY + dy + row * baseBoxSize + baseBoxSize / 2;

    return { x, y };
  }

  // 註冊到一個全域 layout 表
  window.ArrayLayout = window.ArrayLayout || {};
  window.ArrayLayout.normal = {
    getPosition: getNormalPosition
  };
  window.draw_array_normal = draw_array_normal;
})();