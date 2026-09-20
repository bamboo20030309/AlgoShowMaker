(function () {
  'use strict';

  const container = document.getElementById('editor');
  const editor = container?.env?.editor;
  if (!editor) return;

  const commands = [
    { id: 'defaults', label: '@defaults', effect: '全域呈現預設：每幀自動套用；當幀指令與 preset 可覆寫', code: '// @defaults\n// @camera auto\n// @enddefaults', examples: [
      '// @defaults\n// @camera focus arr offset(0,20) zoom(2.0)\n// @enddefaults',
      '// @defaults\n// @camera auto\n// @enddefaults'
    ] },
    { id: 'enddefaults', label: '@enddefaults', effect: '結束全域呈現預設區塊', code: '// @enddefaults', examples: ['// @defaults\n// @camera auto\n// @enddefaults'] },
    { id: 'frame', label: '@frame', effect: '擷取此刻的動畫幀並選擇要顯示的變數', code: '// @frame arr', examples: [
      '// @frame arr',
      '// @frame arr[i,j],key\n// @style arr[i] highlight',
      '// @frame arr[i,j],key render heap with range(1,n) at canvas.top offset(0,80)\n// @style arr[i] highlight AV_red\n// @text "正在檢查第 ${i} 格" at arr.bottom',
      '// @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)'
    ] },
    { id: 'preset', label: '@preset', effect: '定義可重用的物件、位置與樣式；每次 @frame use 時重新計算變數', code: '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @endpreset', examples: [
      '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @endpreset\n// @frame use sieve_view',
      '// @preset sieve_view\n// @object isprime with range(1,n), columns(10), labels(index)\n// @object prime with labels(value)\n// @place prime.top-left at isprime.bottom-left offset(0,60)\n// @endpreset\n// @frame use sieve_view',
      '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @style isprime[i] highlight\n// @endpreset\n// @frame use sieve_view when i <= n\n// @style isprime[i] point',
      '// @preset sieve_view\n// @object isprime with columns(10), labels(index)\n// @endpreset\n// @preset sieve_colors\n// @style isprime[i] highlight AV_green\n// @endpreset\n// @frame use sieve_view, sieve_colors'
    ] },
    { id: 'object', label: '@object', effect: '在同一個 @frame 加入另一個獨立設定的物件', code: '// @object prime', examples: [
      '// @frame\n// @object prime',
      '// @frame when i%v==0\n// @object isprime with columns(10), labels(index)\n// @object prime with labels(value)',
      '// @frame\n// @object isprime with range(1,n), columns(10), labels(index)\n// @object prime with columns(10), labels(value)\n// @place prime.top-left at isprime.bottom-left offset(0,60)'
    ] },
    { id: 'keep', label: '@keep', effect: '保存上一幀或指定物件的快照，供後續畫面使用', code: '// @keep last', examples: [
      '// @keep last',
      '// @keep arr as "original"',
      '// @keep last as "round" in quick_tree when i > 0\n// @text "本輪完成" at round.bottom'
    ] },
    { id: 'layout', label: '@layout', effect: '建立或設定具名的遞迴排版', code: '// @layout recursion as "quick_tree" at canvas.top offset(0,80)', examples: [
      '// @layout recursion as "quick_tree"',
      '// @layout recursion as "quick_tree" at canvas.top offset(0,80)\n// @frame arr in quick_tree',
      '// @layout recursion as "quick_tree" at canvas.top offset(0,80)\n// @layout quick_tree direction top-down\n// @frame arr in quick_tree\n// @keep arr as "partition" in quick_tree'
    ] },
    { id: 'style', label: '@style', effect: '為陣列格子設定背景、強調、焦點或指標', code: '// @style arr[i] highlight', examples: [
      '// @style arr[i] highlight',
      '// @style arr[i] highlight,point',
      '// @style arr[i] highlight,point AV_green when value>0',
      '// @style arr[0:i] background AV_green when value < key',
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
      '// @segment tree[*][full] from lazy color rgba(231,144,255,0.65) as pending_modify when value != 0',
      '// @frame arr[i]\n// @segment arr[low:high]\n// @text "處理目前區間" at arr.bottom'
    ] },
    { id: 'place', label: '@place', effect: '把同幀物件的外框錨點綁到另一物件', code: '// @place pivot at arr.right offset(16,0)', examples: [
      '// @place pivot at arr.right',
      '// @place pivot at arr.right offset(16,0)',
      '// @frame arr,pivot\n// @place pivot at arr.right offset(16,0)\n// @text "基準值" at pivot.bottom'
    ] },
    { id: 'events', label: '@events', effect: '控制本幀事件動畫；資料與事件記錄仍保留', code: '// @events animate off', examples: [
      '// @frame arr\n// @events animate off',
      '// @frame arr\n// @events compare,read animate off when i > 7'
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
      '// @arrow from isprime[1] to isprime[12]',
      '// @frame arr[i,j]\n// @arrow from arr[i].bottom to arr[j].top\n// @text "從左到右" at arr.bottom'
    ] },
    { id: 'exit', label: '@exit', effect: '提早讓指定變數或指標退場', code: '// @exit i', examples: [
      '// @exit i',
      '// @exit min_idx,i\n// @keep last',
      '// @frame arr[min_idx]\n// @exit min_idx,i\n// @keep last as "round"'
    ] }
  ];
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
    segment: [
      ['from', 'from', '依指定欄位的每個索引產生完整 heap 格子區段', ' from lazy'],
      ['when', 'when', '只在條件成立時標示區間', ' when low <= high']
    ],
    place: [['offset', 'offset', '在錨點上加入位移', ' offset(16,0)'], ['when', 'when', '條件成立才放置', ' when i >= 0']],
    arrow: [['as', 'as', '為箭頭命名', ' as "relation"'], ['when', 'when', '條件成立才顯示箭頭', ' when i >= 0']],
    layout: [
      ['layout-direction', 'direction', '在下一行明確指定排版 ID 與生長方向', '\n// @layout quick_tree direction top-down'],
      ['layout-order', 'order', '在下一行明確指定排版 ID 與 preorder／inorder／postorder', '\n// @layout quick_tree order preorder']
    ]
  };
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
    ['labels-index', '只顯示索引標籤', 'labels(index)'],
    ['labels-value', '顯示資料值標籤', 'labels(value)']
  ];

  const popup = document.createElement('div');
  popup.id = 'asmDirectiveAssist';
  popup.className = 'asm-directive-assist';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', '視覺化指令提示');
  popup.hidden = true;
  document.body.appendChild(popup);
  let mode = null;
  let options = [];
  let selected = 0;
  let exampleCommand = null;
  let exampleTier = 0;
  let exampleRow = 0;

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

  function currentDirective() {
    const pos = editor.getCursorPosition();
    const line = editor.session.getLine(pos.row);
    const match = line.match(/^\s*\/\/\s*@([\w-]*)/);
    return { pos, line, id: match?.[1] || null, prefix: match ? line.slice(0, pos.column) : '' };
  }

  function currentLayoutId(line) {
    return (line.match(/\bas\s+["']?([\w-]+)/) || [])[1]
      || (line.match(/@layout\s+(?!recursion\b)([\w-]+)/) || [])[1]
      || 'quick_tree';
  }

  function makeChild(rule) {
    return { id: rule[0], label: rule[1], effect: rule[2], code: rule[3] };
  }

  function childOptions(id, line) {
    if (!childRules[id]) return [];
    const rules = childRules[id].filter(rule => {
      if (rule[0] === 'more-preset') return /^\s*\/\/\s*@frame\s+use\s+/.test(line) && !/\bwhen\b/.test(line);
      if (id === 'layout' && rule[0] === 'layout-direction') return !/\bdirection\b/.test(line);
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
    if (/\bwith\s+\w+\(/.test(line)) {
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

  function makeButton(option, index, onChoose) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'asm-directive-choice';
    button.dataset.index = String(index);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(index === selected));
    const label = document.createElement('strong');
    label.textContent = option.label;
    const effect = document.createElement('span');
    effect.textContent = option.effect;
    button.append(label, effect);
    button.addEventListener('mouseenter', () => { selected = index; updateSelection(); });
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => onChoose(option));
    return button;
  }

  function updateSelection() {
    for (const button of popup.querySelectorAll('.asm-directive-choice')) {
      button.setAttribute('aria-selected', String(Number(button.dataset.index) === selected));
    }
    const option = options[selected];
    const preview = popup.querySelector('.asm-directive-preview code');
    if (preview) {
      const layoutId = currentLayoutId(currentDirective().line);
      preview.textContent = option?.id?.startsWith('layout-')
        ? option.code.replace('quick_tree', layoutId).trimStart()
        : option?.code || `${option?.label || ''} …`;
    }
  }

  function renderSuggestions() {
    popup.replaceChildren();
    const title = document.createElement('div');
    title.className = 'asm-directive-title';
    title.textContent = '視覺化指令 · Tab 插入 · ↑↓ 選擇 · Esc 關閉';
    const list = document.createElement('div');
    list.className = 'asm-directive-list';
    list.setAttribute('role', 'listbox');
    options.forEach((option, index) => list.appendChild(makeButton(option, index, applyChoice)));
    const preview = document.createElement('div');
    preview.className = 'asm-directive-preview';
    preview.append('將插入：', document.createElement('code'));
    popup.append(title, list, preview);
    updateSelection();
  }

  function openSuggestions() {
    options = choices();
    if (!options.length) { close(); return; }
    selected = 0;
    mode = 'suggestions';
    popup.dataset.mode = mode;
    renderSuggestions();
    popup.hidden = false;
    const { x, y } = cursorPosition();
    place(x, y);
  }

  function applyChoice(option) {
    if (!option) return;
    const { pos, line, id } = currentDirective();
    const Range = window.ace.Range;
    if (byId[option.id] && (!id || !byId[id])) {
      const start = line.indexOf('//');
      editor.session.replace(new Range(pos.row, start, pos.row, pos.column), option.code);
      editor.moveCursorTo(pos.row, start + option.code.length);
    } else if (option.id === 'render' || option.id === 'with') {
      editor.session.insert(pos, ` ${option.id} `);
      editor.moveCursorTo(pos.row, pos.column + option.id.length + 2);
    } else if (option.id === 'render-type') {
      // The parent "render " is already on this line.
      const text = option.code.trim().replace(/^render\s+/, '');
      editor.session.insert(pos, text);
      editor.moveCursorTo(pos.row, pos.column + text.length);
    } else if (option.id === 'with-type' || option.id === 'with-next') {
      editor.session.insert(pos, option.code);
      editor.moveCursorTo(pos.row, pos.column + option.code.length);
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
      editor.session.insert(pos, option.code);
      editor.moveCursorTo(pos.row, pos.column + option.code.length);
    }
    editor.focus();
    openSuggestions();
  }

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
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      const { line } = currentDirective();
      if (/^\s*\/\/\s*@/.test(line)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openSuggestions();
      }
      return;
    }
    if (popup.hidden || mode !== 'suggestions') return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopImmediatePropagation();
      selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      updateSelection();
    } else if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault(); event.stopImmediatePropagation(); applyChoice(options[selected]);
    }
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
      const { prefix, line } = currentDirective();
      if (/^\s*\/\/\s*@$/.test(prefix)) openSuggestions();
      else if (mode === 'suggestions') {
        if (/^\s*\/\/\s*@/.test(line)) openSuggestions();
        else close();
      }
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
    if (mode === 'suggestions' && !popup.hidden) {
      const { line } = currentDirective();
      if (!/^\s*\/\/\s*@/.test(line)) close();
    }
  });

  window.ASMDirectiveAssist = { commands, openSuggestions, close };
})();
