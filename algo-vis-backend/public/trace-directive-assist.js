/**
 * 模組：Trace 指令提示
 *
 * 責任：根據游標所在的 @ 指令與已輸入參數，提供相依選項、範例及安全的文字插入。
 * 資料流：編輯器 selection 先解析目前行與父指令，再由規則表產生 choices；使用者選取後只替換對應 token 並重開下一層提示。
 * 重要不變條件：提示狀態必須跟著游標與編輯器內容更新；插入範例不可破壞既有縮排或其他行。
 * 相容性：未知與舊指令不會被改寫，僅在規則表能辨識時提供建議。
 */
(function () {
  'use strict';

  const container = document.getElementById('editor');
  const editor = container?.env?.editor;
  if (!editor) return;

  const commands = [
    { id: 'pointer', label: '@pointer', effect: '獨立指標：綁定陣列、矩陣.row/.column或layout節點（root、current、nodes、leaves、children、level、side），可加color指定顏色；省略索引時使用指標變數值，越界時隱藏', code: '// @pointer i at arr', examples: [
      '// @pointer i at arr color AV_blue',
      '// @pointer i at dp.row\n// @pointer j at dp.column color AV_red',
      '// @pointer i at merge_tree.children[0]\n// @pointer j at merge_tree.children[1]',
      '// @pointer i at arr[i]',
      '// @pointer i at merge_tree.root\n// @pointer j at merge_tree.leaves[1]',
      '// @pointer i at merge_tree.children[0][i-L]\n// @pointer j at merge_tree.children[1][j-mid-1]'
    ] },
    { id: 'default', label: '@default', effect: '全域呈現預設：每幀自動套用；當幀指令與 preset 可覆寫', code: '// @default\n// @camera auto\n// @enddefault', examples: [
      '// @default\n// @camera focus arr offset(0,20) zoom(2.0)\n// @enddefault',
      '// @default\n// @camera auto\n// @enddefault'
    ] },
    { id: 'enddefault', label: '@enddefault', effect: '結束全域呈現預設區塊', code: '// @enddefault', examples: ['// @default\n// @camera auto\n// @enddefault'] },
    { id: 'frame', label: '@frame', effect: '擷取此刻的動畫幀並選擇要顯示的變數', code: '// @frame arr', examples: [
      '// @frame arr',
      '// @frame arr[i,j],key\n// @style arr[i] highlight',
      '// @frame char(s)[i,j]\n// @style s[i] highlight',
      '// @frame bits(mask, 8) with labels(none), symbols("", "♕")',
      '// @frame arr[i,j],key render heap with range(1,n) at canvas.top offset(0,80)\n// @style arr[i] highlight AV_red\n// @text "正在檢查第 ${i} 格" at arr.bottom',
      '// @frame tree render heap with range(1,Tsize-1), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)',
      '// @frame tree render segment_tree with range(1,n)',
      '// @frame value with display("F(${call})")\n// @let call = n',
      '// @frame arr with display("${index}: ${value}")'
    ] },
    { id: 'preset', label: '@preset', effect: '定義可重用的物件、位置與樣式；每次 @frame use 時重新計算變數', code: '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @endpreset', examples: [
      '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @endpreset\n// @frame use sieve_view',
      '// @preset sieve_view\n// @object isprime with range(1,n), columns(10), labels(index)\n// @object prime with labels(value)\n// @place prime.top-left at isprime.bottom-left offset(0,60)\n// @endpreset\n// @frame use sieve_view',
      '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @style isprime[i] highlight\n// @endpreset\n// @frame use sieve_view when i <= n\n// @style isprime[i] point',
      '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @endpreset\n// @preset sieve_colors\n// @style isprime[i] highlight AV_green\n// @endpreset\n// @frame use sieve_view, sieve_colors'
    ] },
    { id: 'endpreset', label: '@endpreset', effect: '結束目前的可重用視圖預設區塊', code: '// @endpreset', examples: ['// @preset sieve_view\n// @object isprime\n// @endpreset'] },
    { id: 'object', label: '@object', effect: '在同一個 @frame 加入另一個獨立設定的物件', code: '// @object prime', examples: [
      '// @frame\n// @object prime',
      '// @frame\n// @object char(s) with labels(value,index)',
      '// @frame when i%v==0\n// @object isprime with columns(10), labels(index)\n// @object prime with labels(value)',
      '// @frame\n// @object isprime with range(1,n), columns(10), labels(index)\n// @object prime with columns(10), labels(value)\n// @place prime.top-left at isprime.bottom-left offset(0,60)',
      '// @frame\n// @object bits(board, N) render matrix with labels(none), symbols("", "♕")'
    ] },
    { id: 'let', label: '@let', effect: '建立本幀唯讀的繪圖運算別名，不產生 C++ 變數或事件', code: '// @let lb = i & -i', examples: [
      '// @let lb = i & -i',
      '// @let left = i - lb + 1\n// @style num[left:i] background AV_blue',
      '// @preset bit_view\n// @object BIT[i]\n// @let lb = i & -i\n// @text "區間 ${i-lb+1}~${i}" at BIT.bottom\n// @endpreset'
    ] },
    { id: 'keep', label: '@keep', effect: '保存上一幀或指定物件的快照，供後續畫面使用', code: '// @keep last', examples: [
      '// @keep last',
      '// @keep arr as "original"',
      '// @keep board as "Q" in queen_tree use board_view, board_colors',
      '// @keep last as "round" in quick_tree when i > 0\n// @text "本輪完成" at round.bottom'
    ] },
    { id: 'layout', label: '@layout', effect: '建立、設定或組合具名排版', code: '// @layout recursion as "quick_tree" at canvas.top offset(0,80)', examples: [
      '// @layout recursion as "quick_tree"',
      '// @layout recursion as "quick_tree" at canvas.top offset(0,80)\n// @frame arr in quick_tree',
      '// @layout recursion as "quick_tree" at canvas.top offset(0,80)\n// @layout quick_tree direction top-down\n// @frame arr in quick_tree\n// @keep arr as "partition" in quick_tree',
      '// @layout linear as merge_passes at canvas.center\n// @layout merge_passes direction top-down\n// @layout merge_passes align center\n// @layout merge_passes gap 70\n// @keep num as "merge pass" in merge_passes\n// @frame num in merge_passes',
      '// @layout linear as scene\n// @layout scene gap 64\n// @layout recursion as split_tree in scene\n// @layout recursion as merge_tree in scene'
    ] },
    { id: 'branch', label: '@branch', effect: '在遞迴排版中建立具名的邏輯分支', code: '// @branch as "Move" in hanoi_tree', examples: [
      '// @branch as "Move" in hanoi_tree\n// @frame value in hanoi_tree\n// @endbranch'
    ] },
    { id: 'endbranch', label: '@endbranch', effect: '結束目前的具名遞迴分支', code: '// @endbranch', examples: ['// @branch as "Move" in hanoi_tree\n// @endbranch'] },
    { id: 'style', label: '@style', effect: '為陣列格子設定背景、強調、焦點或指標', code: '// @style arr[i] highlight', examples: [
      '// @style arr[i] highlight',
      '// @style arr[i] highlight,point',
      '// @style arr[i] highlight,point AV_green when value>0',
      '// @style arr[0:i] background AV_green when value < key',
      '// @style grid[0:r][0:c] background AV_blue',
      '// @style arr[i].index-label background AV_yellow\n// @style grid.row-label[r] background AV_blue\n// @style grid.column-label[c] background AV_orange\n// @style grid[r][c].inner-label background AV_green',
      '// @style arr[i,i*2:i*2+1] highlight AV_red\n// @style arr[1:n] focus when n < Size',
      '// @style prime[0:iteration.last(j)] focus when i * value <= n'
    ] },
    { id: 'text', label: '@text', effect: '加入說明文字並可綁定物件位置和條件', code: '// @text "正在檢查" at arr.bottom', examples: [
      '// @text "開始排序" at arr.bottom',
      '// @text "第 ${i} 格" at arr.bottom when i >= 0',
      '// @text "目前檢查第 ${i} 格" at arr.bottom offset(0,20) when i >= 0'
    ] },
    { id: 'segment', label: '@segment', effect: '標示一般陣列區間或 heap 格子內部區段', code: '// @segment arr[low:high]', examples: [
      '// @segment arr[low:high]',
      '// @segment arr[low:high] when low <= high',
      '// @segment tree[now][L:R] color AV_green as active_range when L <= R',
      '// @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now)',
      '// @frame arr[i]\n// @segment arr[low:high]\n// @text "處理目前區間" at arr.bottom'
    ] },
    { id: 'place', label: '@place', effect: '把同幀物件的外框錨點綁到另一物件', code: '// @place pivot at arr.right offset(16,0)', examples: [
      '// @place pivot at arr.right',
      '// @place pivot at arr.right offset(16,0)',
      '// @frame arr,pivot\n// @place pivot at arr.right offset(16,0)\n// @text "基準值" at pivot.bottom'
    ] },
    { id: 'camera', label: '@camera', effect: '設定目前幀或預設區塊的自動取景與聚焦目標', code: '// @camera auto', examples: [
      '// @camera auto',
      '// @camera focus arr offset(0,20) zoom(1.4)'
    ] },
    { id: 'events', label: '@events', effect: '控制本幀事件動畫；資料與事件記錄仍保留', code: '// @events animate off', examples: [
      '// @frame arr\n// @events animate off',
      '// @frame arr\n// @events compare,assignment animate off when i > 7'
    ] },
    { id: 'automark', label: '@automark', effect: '選擇本幀顯示自動固定標記的陣列；none 隱藏全部', code: '// @automark arr', examples: [
      '// @frame isprime,prime\n// @automark isprime',
      '// @automark isprime,prime',
      '// @automark none'
    ] },
    { id: 'for', label: '@for', effect: '讓 style、arrow、text 共用繪圖索引；以 @endfor 結束', code: '// @for j', examples: [
      '// @for j\n// @style arr[j] highlight\n// @endfor',
      '// @for j in "sieve_loop"\n// @style prime[j] highlight\n// @arrow from prime[j] to isprime[i*prime[j]]\n// @endfor',
      '// @for k in [0:n-1] step 2\n// @text "${k}" at arr[k].top\n// @endfor'
    ] },
    { id: 'endfor', label: '@endfor', effect: '結束目前的繪圖迴圈區塊', code: '// @endfor', examples: ['// @endfor'] },
    { id: 'loop', label: '@loop', effect: '替緊接的 for、while 或 do 迴圈命名', code: '// @loop as "sieve_loop"', examples: [
      '// @loop as "sieve_loop"\nfor(int j=0;j<n;j++){ }',
      '// @loop as "scan"\nwhile(j<n){j++;}'
    ] },
    { id: 'arrow', label: '@arrow', effect: '連接物件或格子；for 可按範圍或實際迴圈值展開多支箭頭', code: '// @arrow from arr[0] to arr[1]', examples: [
      '// @arrow for k in [0:n-1] step 2 from arr[0].bottom to arr[k].top as "links"',
      '// @arrow for j from arr[0] to arr[j]',
      '// @arrow for j in "sieve_loop" from prime[j] to isprime[i*prime[j]]',
      '// @arrow from arr[0] to arr[1]',
      '// @arrow from grid[x][y] to grid[x-1][y] color AV_green until return',
      '// @arrow from isprime[1] to isprime[12]',
      '// @frame arr[i,j]\n// @arrow from arr[i].bottom to arr[j].top\n// @text "從左到右" at arr.bottom'
    ] },
    { id: 'exit', label: '@exit', effect: '提早讓指定變數或指標退場', code: '// @exit i', examples: [
      '// @exit i',
      '// @exit min_idx,i\n// @keep last',
      '// @frame arr[min_idx]\n// @exit min_idx,i\n// @keep last as "round"'
    ] },
    { id: 'code', label: '@code', effect: '控制程式碼片段呈現；hide 仍會執行程式但不顯示在動畫程式碼中', code: '// @code hide', examples: ['// @code hide\ninternal_state++;\n// @endcode'] },
    { id: 'endcode', label: '@endcode', effect: '結束目前的程式碼呈現控制區塊', code: '// @endcode', examples: ['// @code hide\ninternal_state++;\n// @endcode'] }
  ];
  const priority = ['frame', 'object', 'pointer', 'style', 'text', 'camera', 'place', 'arrow', 'keep', 'layout'];
  commands.sort((a, b) => (priority.includes(a.id) ? priority.indexOf(a.id) : 100)
    - (priority.includes(b.id) ? priority.indexOf(b.id) : 100));
  const byId = Object.fromEntries(commands.map(command => [command.id, command]));
  const childRules = {
    frame: [
      ['use', 'use', '展開具名視圖預設', ' use sieve_view'],
      ['more-preset', '增加預設', '用逗號再套用一個預設；後者覆寫相同設定', ', sieve_colors'],
      ['render', 'render', '切換陣列或資料結構畫法', null],
      ['with', 'with', '限制範圍、折行或標籤顯示', null],
      ['as', 'as', '替這一類幀命名', ' as "view"'],
      ['at', 'at', '綁定畫布或物件錨點', ' at canvas.top offset(0,80)'],
      ['when', 'when', '只在條件成立時產生幀', ' when i >= 0'],
      ['in', 'in', '把畫面加入具名遞迴排版', ' in quick_tree'],
      ['object', '@object', '在這一幀加入另一個獨立設定的物件', '\n// @object prime'],
      ['let', '@let', '建立本幀唯讀的繪圖運算別名', '\n// @let lb = i & -i'],
      ['style', '@style', '為格子加上視覺樣式', '\n// @style arr[i] highlight'],
      ['automark', '@automark', '選擇顯示自動固定的陣列', '\n// @automark arr'],
      ['text', '@text', '加入說明文字', '\n// @text "正在檢查" at arr.bottom'],
      ['segment', '@segment', '標示陣列區間', '\n// @segment arr[low:high]'],
      ['arrow', '@arrow', '連接畫面上的兩個目標', '\n// @arrow from arr[0] to arr[1]'],
      ['place', '@place', '放置同幀物件', '\n// @place pivot at arr.right offset(16,0)']
    ],
    object: [
      ['render', 'render', '切換這個物件的畫法', null],
      ['with', 'with', '單獨設定範圍、折行與標籤', null],
      ['as', 'as', '指定物件畫布 ID', ' as "prime_view"'],
      ['at', 'at', '設定物件位置', ' at canvas.top offset(0,80)']
    ],
    preset: [
      ['object', '@object', '加入預設顯示物件', '\n// @object isprime with columns(10), labels(index)'],
      ['let', '@let', '加入預設繪圖運算別名', '\n// @let lb = i & -i'],
      ['place', '@place', '加入預設物件位置', '\n// @place prime.top-left at isprime.bottom-left offset(0,60)'],
      ['style', '@style', '加入預設樣式', '\n// @style isprime[i] highlight'],
      ['automark', '@automark', '選擇預設自動固定陣列', '\n// @automark isprime']
    ],
    keep: [
      ['as', 'as', '指定保留物件 ID', ' as "round"'],
      ['at', 'at', '設定保存的位置', ' at canvas.top offset(0,80)'],
      ['when', 'when', '條件成立才保存', ' when i > 0'],
      ['in', 'in', '加入具名遞迴排版', ' in quick_tree'],
      ['without-style', 'without style', '只保留資料，不凍結當下樣式', ' without style']
    ],
    style: [
      ['background', 'background', '設定格子背景', ' background AV_green'],
      ['highlight', 'highlight', '強調格子；不寫顏色使用預設色', ' highlight'],
      ['focus', 'focus', '凸顯指定片段並淡化其餘格子', ' focus'],
      ['mark', 'mark', '為格子加上標記', ' mark'],
      ['point', 'point', '顯示指向格子的指標', ' point'],
      ['when', 'when', '設定此樣式的成立條件', ' when value == key']
    ],
    text: [
      ['at', 'at', '綁定文字錨點', ' at arr.bottom'],
      ['offset', 'offset', '在錨點上加入位移', ' offset(0,20)'],
      ['when', 'when', '條件成立才顯示文字', ' when i >= 0']
    ],
    segment: [['when', 'when', '只在條件成立時標示區間', ' when low <= high']],
    place: [['offset', 'offset', '在錨點上加入位移', ' offset(16,0)'], ['when', 'when', '條件成立才放置', ' when i >= 0']],
    arrow: [['as', 'as', '為箭頭命名', ' as "relation"'], ['in', 'in', '把跨排版箭頭放入 linear', ' in scene'], ['when', 'when', '條件成立才顯示箭頭', ' when i >= 0']],
    layout: [
      ['layout-direction', 'direction', '在下一行明確指定排版 ID 與生長方向', '\n// @layout quick_tree direction top-down'],
      ['layout-gap', 'gap', '設定 linear 內各排版的間距', '\n// @layout scene gap 64'],
      ['layout-order', 'order', '在下一行明確指定排版 ID 與 preorder／inorder／postorder', '\n// @layout quick_tree order preorder'],
      ['layout-flow-arrows', 'flow-arrows', '顯示 DFS 進入與返回的彎曲輔助箭頭', '\n// @layout quick_tree flow-arrows on'],
      ['layout-branch-previews', 'branch-previews', '控制是否在執行前預先顯示同層遞迴分支', '\n// @layout quick_tree branch-previews off'],
      ['layout-grow-from', 'grow-from', '從根端或葉端擴張，預設 root；leaves 不跨層拉長父子間距', '\n// @layout quick_tree grow-from leaves'],
      ['layout-reserve', 'reserve', '預留完整樹的位置但不新增預覽節點，預設 off', '\n// @layout quick_tree reserve on']
    ]
  };
  Object.assign(childRules, {
    pointer: [['at', 'at', '指定陣列、矩陣列／欄或排版端點', ' at arr'], ['color', 'color', '指標顏色', ' color AV_blue']],
    camera: [['auto', 'auto', '自動取景', ' auto'], ['focus', 'focus', '聚焦物件', ' focus arr'], ['zoom', 'zoom', '倍率', ' zoom(1.6)'], ['offset', 'offset', '正式鏡頭位移', ' offset(0,20)']],
    code: [['hide', 'hide', '隱藏輔助程式片段', ' hide']],
    events: [['animate', 'animate', '本幀事件動畫開關', ' animate off']],
    for: [['in', 'in', '繪圖範圍或具名迴圈', ' in [0:n-1]'], ['step', 'step', '繪圖步長', ' step 2']],
    loop: [['as', 'as', '替下一個 C++ 迴圈命名', ' as "scan"']]
  });
  childRules.layout = childRules.layout.map(rule => [rule[0], rule[1], rule[2],
    rule[3].replace(/^\n\/\/ @layout (?:quick_tree|scene)/, '')]);
  childRules.arrow.push(['color', 'color', '箭頭顏色', ' color AV_red'], ['width', 'width', '線寬', ' width 2'],
    ['head', 'head', '箭頭端', ' head end'], ['line', 'line', '直線或曲線', ' line curve'],
    ['dash', 'dash', '虛線節奏', ' dash 6,4'], ['until', 'until', '保留至遞迴返回', ' until return']);
  const renderTypes = [
    ['normal', '一般陣列', ' render normal'], ['heap', 'Heap 樹形', ' render heap'],
    ['stack', 'Stack 堆疊', ' render stack'], ['queue', 'Queue 佇列', ' render queue'],
    ['bit', 'Fenwick Tree／BIT', ' render bit'], ['disk', 'Disk 風格', ' render disk'],
    ['segment-tree', '線段樹', ' render segment-tree'], ['matrix', '二維陣列', ' render matrix'],
    ['cell', '單一數值格子', ' render cell']
  ];
  const withTypes = [
    ['range', '指定顯示索引範圍', 'range(0,n)'],
    ['columns', '長陣列每列格數', 'columns(10)'],
    ['gap', '設定水平與垂直間距', 'gap(10,24)'],
    ['labels-index', '只顯示索引標籤', 'labels(index)'],
    ['labels-value', '顯示資料值標籤', 'labels(value)'],
    ['labels-both', '顯示值與索引', 'labels(value,index)'],
    ['display', '自訂格子文字', 'display("${value}")'],
    ['row-labels', '矩陣列標籤', 'row-labels("",S)'],
    ['column-labels', '矩陣欄標籤', 'column-labels("",T)'],
    ['fields', '同一節點合併多個陣列', 'fields(tree,lazy)'],
    ['hide', '隱藏指定欄位值', 'hide(lazy=0)'],
    ['format', '欄位格式', 'format(lazy=signed)'],
    ['separator', '欄位分隔文字', 'separator(" | ")'],
    ['gridlines', '格線寬度', 'gridlines(1)'],
    ['outerframe', '物件外框開關', 'outerframe(false)'],
    ['marker-layout', '矩陣指標位置', 'marker-layout(axis)'],
    ['labels-none', '隱藏資料值與索引標籤', 'labels(none)'],
    ['symbols', '指定 bits 的 0／1 顯示字串', 'symbols("", "♕")']
  ];

  const popup = document.createElement('div');
  popup.id = 'asmDirectiveAssist';
  popup.className = 'asm-directive-assist';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', '視覺化指令提示');
  popup.hidden = true;
  document.body.appendChild(popup);
  let mode = null;
  let exampleCommand = null;
  let exampleTier = 0;
  let exampleRow = 0;

  // ---------------------------------------------------------------------------
  // 區段：提示面板狀態
  // ---------------------------------------------------------------------------
  function close() {
    popup.hidden = true;
    popup.replaceChildren();
    mode = null;
    delete popup.dataset.mode;
  }

  function place(x, y) {
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    const preferredY = y + height + 8 <= window.innerHeight ? y : y - height - 24;
    popup.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    popup.style.top = `${Math.max(8, Math.min(preferredY, window.innerHeight - height - 8))}px`;
  }

  function cursorPosition() {
    const cursor = editor.getCursorPosition();
    const screen = editor.renderer.textToScreenCoordinates(cursor.row, cursor.column);
    return { x: screen.pageX - window.scrollX, y: screen.pageY - window.scrollY + 22 };
  }

  // ---------------------------------------------------------------------------
  // 區段：游標與指令解析
  // ---------------------------------------------------------------------------
  function currentDirective() {
    const pos = editor.getCursorPosition();
    const line = editor.session.getLine(pos.row);
    const match = line.slice(0, pos.column).match(/^\s*(?:\/\/\s*)?@([\w-]*)/);
    return { pos, line, id: match?.[1] || null, prefix: match ? line.slice(0, pos.column) : '' };
  }

  function currentLayoutId(line) {
    return (line.match(/\bas\s+["']?([\w-]+)/) || [])[1]
      || (line.match(/@layout\s+(?!(?:recursion|linear|line|group)\b)([\w-]+)/) || [])[1]
      || 'quick_tree';
  }

  function makeChild(rule) {
    return { id: rule[0], label: rule[1], effect: rule[2], code: rule[3] };
  }

  function childOptions(id, line) {
    if (!childRules[id]) return [];
    const rules = childRules[id].filter(rule => {
      if (rule[3]?.startsWith('\n')) return false;
      if (rule[0] === 'more-preset') return /^\s*\/\/\s*@frame\s+use\s+/.test(line) && !/\bwhen\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-direction') return !/\bdirection\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-flow-arrows') return !/\bflow-arrows\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-branch-previews') return !/\bbranch-previews\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-grow-from') return !/\bgrow-from\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-reserve') return !/\breserve\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-order') return !/\b(?:order|mode)\b/.test(line);
      if (rule[3]?.startsWith('\n')) return true;
      if (rule[0] === 'render' || rule[0] === 'with') return !new RegExp(`\\b${rule[0]}\\b`).test(line);
      if (id === 'style' && ['background', 'highlight', 'focus', 'mark', 'point'].includes(rule[0])) {
        return !/\b(?:background|highlight|focus|mark|point)\b/.test(line);
      }
      const word = rule[0] === 'without-style' ? 'without\\s+style' : rule[0];
      return !new RegExp(`\\b${word}\\b`).test(line);
    });
    return rules.map(makeChild);
  }

  // ---------------------------------------------------------------------------
  // 區段：相依選項生成
  // ---------------------------------------------------------------------------
  function choices() {
    const { id, line, prefix } = currentDirective();
    if (!id || !byId[id]) {
      const search = (prefix.match(/@([\w-]*)$/) || [])[1]?.toLowerCase() || '';
      return commands.filter(command => command.id.startsWith(search));
    }
    if (/\brender\s*$/.test(prefix)) return renderTypes.map(([label, effect, code]) => ({ id: 'render-type', label, effect, code }));
    if (/\bwith\s*$/.test(prefix)) return withTypes.map(([label, effect, code]) => ({
      id: 'with-type', label: label.startsWith('labels-') ? code : label, effect, code
    }));
    if (/\bwith\s+[\w-]+\(/.test(prefix)) {
      const additional = withTypes.filter(([label]) => {
        if (label.startsWith('labels-')) return !/\blabels\(/.test(line);
        return !new RegExp(`\\b${label}\\(`).test(line);
      }).map(([label, effect, code]) => ({
        id: 'with-next', label: label.startsWith('labels-') ? code : label, effect, code: `, ${code}`
      }));
      return [...additional, ...childOptions(id, line)];
    }
    return childOptions(id, line);
  }

  const languageTools = window.ace.require('ace/ext/language_tools');
  const Autocomplete = window.ace.require('ace/autocomplete').Autocomplete;
  const completion = Autocomplete.for(editor);
  completion.autoInsert = false;
  completion.autoSelect = true;

  function isDirective() { return Boolean(currentDirective().prefix); }
  function completionOptions() {
    const { id, prefix } = currentDirective();
    if (!prefix) return [];
    if (/@[\w-]*$/.test(prefix)) {
      const token = prefix.match(/@([\w-]*)$/)[1];
      return commands.filter(command => command.id.startsWith(token)).map(command => ({ ...command, root: true }));
    }
    if (!byId[id]) return [];
    // Text being entered inside quotes is content, not a modifier keyword.
    let quote = null, escaped = false;
    for (const character of prefix) {
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (quote) { if (character === quote) quote = null; }
      else if (character === '"' || character === "'") quote = character;
    }
    if (quote || /\bwhen\s/.test(prefix)) return [];
    // A suffix belongs to its own directive and never inserts another @ line.
    const partial = prefix.match(/\s([a-zA-Z][\w-]*)$/)?.[1] || '';
    let result = ['frame', 'object'].includes(id) && /\bwith\s+[\w-]*$/.test(prefix) ? withTypes.map(([label, effect, code]) => ({
      id: 'with-type', label: label.startsWith('labels-') ? code : label, effect, code
    })) : choices();
    if (partial) {
      // choices() uses the full prefix; remove a partially typed keyword only for filtering.
      result = result.filter(option => option.label.startsWith(partial));
    }
    return result.filter(option => !option.code?.startsWith('\n'));
  }
  const directiveCompleter = {
    id: 'asm-directives', identifierRegexps: [/[a-zA-Z0-9_@-]/],
    getCompletions(_editor, _session, _position, _prefix, callback) {
      callback(null, completionOptions().map((option, index) => ({
        caption: option.label, value: option.label, meta: option.root ? '繪圖指令' : '參數',
        score: 10000 - index, docText: `${option.effect}\n\n範例：\n${option.code || option.label}`,
        option, completer: directiveCompleter
      })));
    },
    insertMatch(_editor, item) {
      completion.detach();
      applyChoice(item.option);
    }
  };
  editor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: false });
  editor.completers = [directiveCompleter, ...[languageTools.keyWordCompleter, languageTools.textCompleter]
    .filter(Boolean).map(source => ({ getCompletions(ed, session, position, prefix, callback) {
      if (isDirective()) callback(null, []);
      else source.getCompletions(ed, session, position, prefix, callback);
    } }))];

  function openSuggestions() {
    close();
    if (!completionOptions().length) { completion.detach(); return; }
    completion.showPopup(editor);
  }

  // ---------------------------------------------------------------------------
  // 區段：文字替換
  // ---------------------------------------------------------------------------
  function applyChoice(option) {
    if (!option) return;
    let { pos, line, id } = currentDirective();
    if (!option.root) {
      const partial = line.slice(0, pos.column).match(/\s([a-zA-Z][\w-]*)$/)?.[1];
      if (partial && option.label.startsWith(partial)) {
        editor.session.remove(new window.ace.Range(pos.row, pos.column - partial.length, pos.row, pos.column));
        pos = editor.getCursorPosition();
      }
    }
    const Range = window.ace.Range;
    if (option.root) {
      const at = line.indexOf('@');
      const plain = !/^\s*\/\//.test(line);
      const start = plain ? line.search(/\S/) : at;
      const text = `${plain ? '// ' : ''}@${option.id} `;
      editor.session.replace(new Range(pos.row, start, pos.row, pos.column), text);
      editor.moveCursorTo(pos.row, start + text.length);
    } else if (option.id === 'render' || option.id === 'with') {
      const text = `${/\s$/.test(editor.session.getLine(pos.row).slice(0, pos.column)) ? '' : ' '}${option.id} `;
      editor.session.insert(pos, text);
      editor.moveCursorTo(pos.row, pos.column + text.length);
    } else if (option.id === 'render-type') {
      // The parent "render " is already on this line.
      const text = option.code.trim().replace(/^render\s+/, '');
      editor.session.insert(pos, text);
      editor.moveCursorTo(pos.row, pos.column + text.length);
    } else if (option.id === 'with-type' || option.id === 'with-next') {
      const text = /\s$/.test(editor.session.getLine(pos.row).slice(0, pos.column)) ? option.code.trimStart() : option.code;
      editor.session.insert(pos, text);
      editor.moveCursorTo(pos.row, pos.column + text.length);
    } else if (option.code?.startsWith('\n')) {
      const indent = line.match(/^\s*/)?.[0] || '';
      const end = { row: pos.row, column: line.length };
      let text = option.code;
      if (option.id.startsWith('layout-')) {
        const layoutId = currentLayoutId(line);
        text = text.replace('quick_tree', layoutId);
      }
      text = text.replace(/\n\/\//g, `\n${indent}//`);
      editor.session.insert(end, text);
      editor.moveCursorTo(pos.row + 1, text.slice(text.lastIndexOf('\n') + 1).length);
    } else if (option.code) {
      const text = /\s$/.test(editor.session.getLine(pos.row).slice(0, pos.column)) ? option.code.trimStart() : option.code;
      editor.session.insert(pos, text);
      editor.moveCursorTo(pos.row, pos.column + text.length);
    }
    editor.focus();
    openSuggestions();
  }

  // ---------------------------------------------------------------------------
  // 區段：範例瀏覽與插入
  // ---------------------------------------------------------------------------
  function renderExamples() {
    popup.replaceChildren();
    const title = document.createElement('div');
    title.className = 'asm-directive-title';
    title.textContent = `${exampleCommand.label} · 範例與常用寫法`;
    const tabs = document.createElement('div');
    tabs.className = 'asm-directive-tiers';
    ['最小', '常用', '完整'].forEach((name, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.setAttribute('aria-pressed', String(index === exampleTier));
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => { exampleTier = index; renderExamples(); });
      tabs.appendChild(button);
    });
    const effect = document.createElement('p');
    effect.textContent = exampleCommand.effect;
    const preview = document.createElement('pre');
    preview.textContent = exampleCommand.examples[exampleTier];
    const insert = document.createElement('button');
    insert.type = 'button';
    insert.className = 'asm-directive-insert';
    insert.textContent = '插入這個範例';
    insert.addEventListener('mousedown', event => event.preventDefault());
    insert.addEventListener('click', insertExample);
    popup.append(title, tabs, effect, preview, insert);
  }

  function insertExample() {
    const line = editor.session.getLine(exampleRow);
    const indent = line.match(/^\s*/)?.[0] || '';
    const code = exampleCommand.examples[exampleTier].split('\n').map((part, index) => index ? indent + part : part).join('\n');
    editor.session.replace(new window.ace.Range(exampleRow, indent.length, exampleRow, line.length), code);
    editor.moveCursorTo(exampleRow + code.split('\n').length - 1, (code.split('\n').at(-1) || '').length);
    close();
    editor.focus();
  }

  function openExamples(command, row, x, y) {
    exampleCommand = command;
    exampleRow = row;
    exampleTier = 0;
    mode = 'examples';
    popup.dataset.mode = mode;
    renderExamples();
    popup.hidden = false;
    place(x, y);
  }

  container.addEventListener('keydown', event => {
    if (((event.ctrlKey || event.metaKey) && event.code === 'Space')
      || (event.key === 'Tab' && !event.shiftKey && !completion.activated && isDirective())) {
      if (!isDirective()) return;
      event.preventDefault(); event.stopImmediatePropagation(); openSuggestions();
    }
    // Ace owns ↑↓, Tab/Enter insertion, Escape and scrolling in the native popup.
  }, true);

  document.addEventListener('keydown', event => {
    if (mode === 'examples' && !popup.hidden && event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }, true);

  editor.on('change', () => {
    queueMicrotask(() => {
      if (document.activeElement !== editor.textInput.getElement()) return;
      if (isDirective()) openSuggestions();
      else completion.detach();
    });
  });

  container.addEventListener('contextmenu', event => {
    // Touch long-press and ordinary C++ lines keep their native selection menu.
    if (event.button !== 2 || window.matchMedia?.('(pointer: coarse)')?.matches) return;
    const position = editor.renderer.screenToTextCoordinates(event.clientX, event.clientY);
    const line = editor.session.getLine(position.row);
    const id = (line.match(/^\s*\/\/\s*@([\w-]+)/) || [])[1];
    if (!byId[id]) return;
    event.preventDefault();
    event.stopPropagation();
    openExamples(byId[id], position.row, event.clientX, event.clientY);
  });

  document.addEventListener('pointerdown', event => {
    if (!popup.hidden && !popup.contains(event.target) && !container.contains(event.target)) close();
  });
  editor.on('changeSelection', () => {
    // Let Ace finish its cursor-change listeners before closing their completion base.
    queueMicrotask(() => { if (!isDirective()) completion.detach(); });
  });

  window.ASMDirectiveAssist = { commands, childRules, renderTypes, withTypes, choices: completionOptions, openSuggestions, close: () => { close(); completion.detach(); } };
})();
