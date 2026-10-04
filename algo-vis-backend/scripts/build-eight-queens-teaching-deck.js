const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const provenance = require('../public/trace-provenance.js');

const root = path.resolve(__dirname, '..');
const uid = randomUUID;
const colors = {
  ink: '#1f282d', accent: '#1d8f83', muted: '#637577', bg: '#fbfcfa',
  border: '#344247', soft: '#eef5f2', red: '#ef9a9a', green: '#a5d6a7', gold: '#f3d68a'
};

function textbox(value, x, y, w, size = 24, color = colors.ink, bold = false) {
  return {
    type: 'textbox', left: x, top: y, width: w, text: value, fontFamily: 'Arial',
    fontSize: size, fontWeight: bold ? 'bold' : 'normal', fill: color, lineHeight: 1.3,
    splitByGrapheme: true, styles: {}, layerIndex: 1100, ttsObjectId: uid()
  };
}

function slide(title, subtitle = '') {
  return {
    id: uid(), canvas: { version: '5.3.0', objects: [
      { type: 'rect', left: 0, top: 0, width: 1280, height: 720, fill: colors.bg,
        strokeWidth: 0, layerIndex: 1000, ttsObjectId: uid() },
      textbox(title, 64, 54, 1152, 38, colors.ink, true),
      textbox(subtitle, 66, 122, 1148, 20, colors.muted)
    ] }, widgets: [], ttsScript: '', ttsOrder: []
  };
}

function addText(target, value, x, y, w, size = 25, color = colors.ink, bold = false) {
  target.canvas.objects.push(textbox(value, x, y, w, size, color, bold));
}

function widgetBase(type, content, x, y, w, h, fontSize = 20) {
  return {
    id: uid(), type, x, y, w, h, content, language: 'cpp', fontSize, focusLines: '',
    showLineNumbers: type === 'code', scale: 1, manualSize: true, layerIndex: 2100,
    ttsScript: '', ttsScriptMode: 'auto', ttsCarrier: false, ttsMuted: false,
    ttsMutedOrderIndex: null, transitionId: '', fragmentEnabled: false,
    fragmentStyle: '', fragmentIndex: 0
  };
}

function structure(target, mode, content, x, y, w, h, options = {}) {
  const item = {
    ...widgetBase('structure', content, x, y, w, h, 20),
    structureMode: mode, structureName: options.name || '', indexMode: options.indexMode ?? 0,
    indexBase: options.indexBase ?? 0, itemsPerRow: options.itemsPerRow ?? 0,
    gap: options.gap ?? 4, cellSize: options.cellSize ?? 58,
    baseFill: '#f8fbfa', borderColor: colors.border, textColor: colors.ink,
    lineColor: colors.muted, highlightColor: colors.red, focusColor: '#d8e2df',
    pointColor: colors.gold, markColor: colors.green, backgroundColor: colors.green,
    frameBackgroundEnabled: false, frameBackgroundColor: 'rgba(209, 230, 172, 0.5)',
    treeLayout: options.treeLayout || 'compact', treeHorizontal: options.treeHorizontal === true,
    treeArrowColor: colors.border, treeRendererVersion: 3, structureFrameVersion: 4,
    annotationIndices: '', annotationColor: '#ffffff', annotationText: '', annotationLabels: {},
    cellStyles: options.cellStyles || {}, highlightIndices: options.highlightIndices || '',
    focusIndices: options.focusIndices || '', pointIndices: options.pointIndices || '',
    markIndices: options.markIndices || '', backgroundIndices: options.backgroundIndices || ''
  };
  if (options.tableData) item.tableData = options.tableData;
  if (options.treeData) item.treeData = options.treeData;
  target.widgets.push(item);
  return item;
}

function code(target, source, x = 64, y = 205, w = 1152, h = 430, fontSize = 21) {
  target.widgets.push(widgetBase('code', source, x, y, w, h, fontSize));
}

function latex(target, source, x = 80, y = 220, w = 1120, h = 90, fontSize = 31) {
  const item = widgetBase('latex', source, x, y, w, h, fontSize);
  item.showLineNumbers = false;
  target.widgets.push(item);
}

function animationSlide() {
  const codeSource = fs.readFileSync(path.join(root,
    'algorithm_sample/Backtracking/8queen_recursion.cpp'), 'utf8');
  return {
    id: uid(), kind: 'algorithm-animation', canvas: { objects: [] }, widgets: [],
    ttsScript: '', ttsOrder: [], animation: {
      mode: 'trace', code: codeSource, input: '4\n', sliceMode: 'manual', watches: [],
      rebuild: {
        view: { version: 1, rules: [], skins: {}, studio: {
          eventSettings: { autoFixedEnabled: false, autoLoopBoundaryEnabled: false }
        } },
        globals: { eventSettings: {
          gapMs: 250, autoFixedEnabled: false, autoLoopBoundaryEnabled: false
        } }
      }
    }
  };
}

function group(...slides) { return { id: uid(), slides }; }
const groups = [];

let s = slide('八皇后問題', '從棋盤限制、回溯搜尋到位元遮罩');
addText(s, '在 8 × 8 棋盤放置 8 個皇后，\n讓任意兩個皇后都不能互相攻擊。', 68, 215, 700, 36, colors.accent, true);
structure(s, 'matrix', '♕,,,,,,,;,,,,♕,,,;,,,,,,,♕;,,,,,♕,,;,,♕,,,,,;,,,,,,♕,;,♕,,,,,,;,,,♕,,,,',
  820, 192, 385, 405, { name: '一組合法配置', cellSize: 42, backgroundIndices: '0,12,23,29,34,46,49,59' });
addText(s, '向下閱讀同一主題，向右切換下一個主題。', 70, 610, 1120, 21, colors.muted);

let history = slide('問題的由來', '經典西洋棋排列問題');
addText(history, '1848 年由 Max Bezzel 提出；1850 年 Franz Nauck 列出 92 組解。', 68, 215, 1140, 28);
structure(history, 'table', '', 150, 315, 980, 230, { name: '八皇后的解數', tableData: [
  ['計算方式', '解數'], ['所有不同位置', '92'], ['旋轉與鏡射視為相同', '12']
] });
addText(history, '八皇后是 N 皇后問題在 N = 8 時的特例。', 68, 590, 1135, 25, colors.accent, true);

let rules = slide('皇后的攻擊方向', '同列、同欄、兩條對角線都不能重複');
structure(rules, 'matrix', ',,,↖,,,↗,;,,,,↖,↗,,;,,,,♕,,,;,,,↙,↓,↘,,;,,↙,,↓,,↘,;,↙,,,↓,,,↘;↙,,,,↓,,,',
  92, 180, 600, 455, { name: '皇后的攻擊範圍', cellSize: 48, highlightIndices: '18', pointIndices: '3,6,12,13,27,28,29,34,36,39,41,47,52,55' });
addText(rules, '逐列放置時，「同列」自然不會重複。\n搜尋只需追蹤：\n• 已使用欄位\n• 左斜線\n• 右斜線', 760, 230, 430, 29);

let representation = slide('用陣列表示一個解', 'pos[row] = column');
structure(representation, 'normal', '0,4,7,5,2,6,1,3', 120, 220, 1040, 180,
  { name: 'pos', indexMode: 1, cellSize: 70, markIndices: '0-7' });
latex(representation, String.raw`pos[i] \ne pos[j] \quad\text{且}\quad |pos[i]-pos[j]| \ne |i-j|`, 155, 450, 970, 95, 34);
addText(representation, '第一式排除同欄；第二式排除同一條對角線。', 205, 575, 880, 25, colors.muted);
groups.push(group(s, history, rules, representation));

s = slide('逐列建立答案', '每一層遞迴只決定一列');
structure(s, 'stack', 'row 0: col 1,row 1: col 3,row 2: 嘗試中', 105, 215, 470, 360,
  { name: '遞迴呼叫堆疊', cellSize: 62, highlightIndices: '2' });
structure(s, 'matrix', ',♕,,;,,,♕;?,?,?,?;,,,,', 660, 205, 420, 390,
  { name: '目前棋盤', cellSize: 64, highlightIndices: '8-11', backgroundIndices: '1,7' });
addText(s, '前 row 列都合法，才進入 dfs(row)。\n目前列沒有位置可放，就回到上一層。', 90, 610, 1100, 25, colors.accent);

let conflict = slide('三組結構記錄衝突', '欄、左斜線與右斜線分開維護');
structure(conflict, 'normal', '0,1,0,1,0,0,0,0', 85, 205, 1110, 112,
  { name: '欄 occupied', cellSize: 58, backgroundIndices: '1,3' });
structure(conflict, 'normal', '0,0,1,0,1,0,0,0', 85, 345, 1110, 112,
  { name: '左斜線 diagLeft', cellSize: 58, pointIndices: '2,4' });
structure(conflict, 'normal', '1,0,0,0,1,0,0,0', 85, 485, 1110, 112,
  { name: '右斜線 diagRight', cellSize: 58, highlightIndices: '0,4' });

let choose = slide('選擇、遞迴、撤銷', '回溯的三個固定步驟');
structure(choose, 'table', '', 125, 205, 1030, 360, { name: '回溯框架', tableData: [
  ['步驟', '動作', '目的'],
  ['1 選擇', '放置皇后並標記三種衝突', '建立下一個狀態'],
  ['2 遞迴', '搜尋下一列', '繼續完成解'],
  ['3 撤銷', '移除皇后並恢復標記', '嘗試同層其他欄位']
] });
addText(choose, '只有仍可能完成答案的前綴會繼續展開。', 245, 600, 800, 28, colors.accent, true);

let prune = slide('剪枝發生在答案完成以前', '一旦衝突，整個子樹都不必搜尋');
const pruneTree = {
  rootId: 'r', nodes: [
    { id: 'r', value: 'row 0' }, { id: 'a', value: 'c0' }, { id: 'b', value: 'c1' },
    { id: 'a1', value: '衝突' }, { id: 'a2', value: '衝突' },
    { id: 'b1', value: 'c3' }, { id: 'b2', value: 'c4' },
    { id: 'ok', value: '解' }, { id: 'dead', value: '衝突' }
  ], edges: [
    { from: 'r', to: 'a' }, { from: 'r', to: 'b' },
    { from: 'a', to: 'a1' }, { from: 'a', to: 'a2' },
    { from: 'b', to: 'b1' }, { from: 'b', to: 'b2' },
    { from: 'b1', to: 'ok' }, { from: 'b2', to: 'dead' }
  ]
};
structure(prune, 'binary_tree', 'row 0,c0,c1,衝突,衝突,c3,c4,解,衝突', 90, 190, 1100, 430,
  { name: '搜尋樹', treeData: pruneTree, treeLayout: 'compact', highlightIndices: '3,4,8', markIndices: '7' });
groups.push(group(s, conflict, choose, prune));

s = slide('標準回溯寫法', '用布林陣列判斷欄與對角線');
code(s, `void dfs(int row) {
    if (row == N) { ans++; return; }
    for (int col = 0; col < N; col++) {
        int left = row - col + N - 1;
        int right = row + col;
        if (usedCol[col] || usedLeft[left] || usedRight[right]) continue;
        usedCol[col] = usedLeft[left] = usedRight[right] = true;
        pos[row] = col;
        dfs(row + 1);
        usedCol[col] = usedLeft[left] = usedRight[right] = false;
    }
}`, 70, 185, 1140, 460, 20);

let indices = slide('兩種對角線索引', '把斜線轉成不會為負的陣列索引');
latex(indices, String.raw`left = row-col+(N-1) \qquad right = row+col`, 140, 210, 1000, 90, 34);
structure(indices, 'table', '', 130, 345, 1020, 220, { name: '位置 (row=3, col=1)', tableData: [
  ['狀態', '索引', '範圍'], ['欄', 'col = 1', '0 ... N-1'],
  ['左斜線', '3-1+(N-1)', '0 ... 2N-2'], ['右斜線', '3+1', '0 ... 2N-2']
] });

let tree = slide('回溯真正省下的是搜尋分支', '不是加快一次判斷，而是避免展開不可能的後續');
structure(tree, 'binary_tree', '空棋盤,c0,c1,c2,c3,×,×,c3,×,解,×', 80, 180, 1120, 440,
  { name: 'N=4 搜尋片段', treeData: {
    rootId: 'r', nodes: ['空棋盤','c0','c1','c2','c3','×','×','c3','×','解','×'].map((value, i) => ({ id: `n${i}`, value })),
    edges: [
      {from:'n0',to:'n1'},{from:'n0',to:'n2'},{from:'n0',to:'n3'},{from:'n0',to:'n4'},
      {from:'n1',to:'n5'},{from:'n1',to:'n6'},{from:'n2',to:'n7'},{from:'n3',to:'n8'},
      {from:'n7',to:'n9'},{from:'n4',to:'n10'}
    ]
  }, highlightIndices: '5,6,8,10', markIndices: '9' });

let complexity = slide('複雜度怎麼理解？', '精確節點數會隨剪枝而變化');
latex(complexity, String.raw`\text{粗略上界： } O(N!) \qquad \text{額外空間： } O(N)`, 170, 220, 940, 100, 36);
structure(complexity, 'table', '', 170, 365, 940, 205, { name: '成本來源', tableData: [
  ['項目', '成本'], ['每層候選欄', '最多 N 個'], ['遞迴深度', 'N 層'], ['衝突判斷', '布林陣列 O(1)']
] });
groups.push(group(s, indices, tree, complexity));

s = slide('把一整列壓進一個整數', 'L、M、R 的每個 bit 對應一個欄位');
structure(s, 'normal', '0,0,1,0,1,0,0,0', 110, 205, 1060, 110,
  { name: 'L 左斜線遮罩', cellSize: 62, pointIndices: '2,4' });
structure(s, 'normal', '0,1,0,1,0,0,0,0', 110, 345, 1060, 110,
  { name: 'M 欄遮罩', cellSize: 62, backgroundIndices: '1,3' });
structure(s, 'normal', '1,0,0,0,1,0,0,0', 110, 485, 1060, 110,
  { name: 'R 右斜線遮罩', cellSize: 62, highlightIndices: '0,4' });

let candidates = slide('一次算出目前列可放的位置', '先合併受攻擊位置，再取反');
structure(candidates, 'normal', '0,1,1,1,1,0,0,0', 120, 205, 1040, 115,
  { name: 'blocked = L | M | R', cellSize: 64, highlightIndices: '1-4' });
structure(candidates, 'normal', '1,0,0,0,0,1,1,1', 120, 400, 1040, 115,
  { name: 'P = all & ~blocked', cellSize: 64, markIndices: '0,5-7' });
latex(candidates, String.raw`P = ((1 \ll N)-1)\ \&\ \sim(L\mid M\mid R)`, 205, 560, 870, 75, 30);

let lowbit = slide('lowbit 一次取出一個候選', 'p = P & -P');
structure(lowbit, 'normal', '1,0,0,1,0,0,0,0', 120, 205, 1040, 115,
  { name: 'P 可選位置', cellSize: 64, markIndices: '0,3' });
structure(lowbit, 'normal', '0,0,0,1,0,0,0,0', 120, 395, 1040, 115,
  { name: 'p = P & -P', cellSize: 64, highlightIndices: '3' });
addText(lowbit, 'P ^= p 移除剛選過的位置，while 迴圈繼續嘗試下一個 1。', 185, 575, 930, 27, colors.accent, true);

let shift = slide('進入下一列時更新三個遮罩', '斜線會向左右各移動一格');
structure(shift, 'table', '', 120, 205, 1040, 330, { name: '下一列狀態', tableData: [
  ['遮罩', '更新式', '意義'],
  ['nextL', '(L | p) << 1', '左斜線攻擊往左移'],
  ['nextM', 'M | p', '同欄持續被封鎖'],
  ['nextR', '(R | p) >> 1', '右斜線攻擊往右移']
] });
latex(shift, String.raw`dfs(row+1,\ nextL,\ nextM,\ nextR)`, 250, 570, 780, 70, 31);

let bitCode = slide('位元版核心程式', '搜尋結構相同，狀態更新改成整列位元運算');
code(bitCode, `void dfs(int row, int L, int M, int R) {
    if (row == N) { ans++; return; }
    int P = ((1 << N) - 1) & ~(L | M | R);
    while (P > 0) {
        int p = P & -P;
        P ^= p;
        dfs(row + 1,
            (L | p) << 1,
             M | p,
            (R | p) >> 1);
    }
}`, 115, 190, 1050, 440, 23);
groups.push(group(s, candidates, lowbit, shift, bitCode, animationSlide()));

s = slide('一般陣列與位元遮罩的差異', '兩者都是回溯，差在狀態表示');
structure(s, 'table', '', 95, 190, 1090, 390, { name: '實作比較', tableData: [
  ['面向', '布林陣列', '位元遮罩'],
  ['可讀性', '直觀，適合先理解', '需要熟悉位元運算'],
  ['一次狀態更新', '多個陣列位置', '固定次數位元運算'],
  ['候選列舉', '掃描所有欄', '只取 P 中的 1'],
  ['適用範圍', 'N 不受機器字長限制', 'N 受整數位數限制']
] });

let workflow = slide('解題時的選擇順序', '先寫對，再依限制決定是否壓縮');
structure(workflow, 'queue', '1 逐列回溯,2 布林陣列判斷,3 驗證撤銷,4 改成 bitmask,5 加對稱剪枝',
  100, 245, 1080, 250, { name: '建議流程', cellSize: 64, highlightIndices: '0', markIndices: '4' });
addText(workflow, '若 N 很小且重視可讀性，布林陣列通常已足夠。', 230, 555, 820, 27, colors.accent);

let summary = slide('八皇后的核心觀念', '結構化狀態讓剪枝與動畫都更清楚');
structure(summary, 'table', '', 125, 205, 1030, 345, { name: '重點整理', tableData: [
  ['觀念', '作用'],
  ['逐列放置', '把 N² 個位置選擇縮成 N 層搜尋'],
  ['衝突結構', '欄與兩種對角線可 O(1) 判斷'],
  ['回溯', '選擇、遞迴、撤銷'],
  ['位元遮罩', '一次處理整列候選與攻擊範圍']
] });
addText(summary, '先看懂搜尋樹，再看位元優化；兩者使用的是同一個回溯架構。', 145, 600, 990, 27, colors.accent, true);
groups.push(group(s, workflow, summary));

const deck = { ttsSettings: {}, groups };
const body = { deck, assets: {} };
const payload = {
  manifest: {
    format: 'AlgoShowMaker.asmdeck', packageVersion: 1,
    engineVersion: `${provenance.ENGINE_VERSION}/${provenance.FORMAT_VERSION}`,
    exportedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'), assetHashes: []
  }, body
};
const output = path.join(root, 'public/guest-decks/eight-queens-teaching.asmdeck');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([Buffer.from('ASMDECK1\n'), gzipSync(JSON.stringify(payload))]));
console.log(`${output}: ${groups.length} groups, ${groups.flatMap(item => item.slides).length} slides, ${fs.statSync(output).size} bytes`);
