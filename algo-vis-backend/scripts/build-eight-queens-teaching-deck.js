const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const provenance = require('../public/trace-provenance.js');

const root = path.resolve(__dirname, '..');
const benchmark = JSON.parse(fs.readFileSync(path.join(root,
  'docs/benchmarks/eight-queens-5s.json'), 'utf8'));
const uid = randomUUID;
const layout = require('../docs/design/hanoi-slide-layout.json');
const draftFile = path.join(root, 'drafts/eight-queens-teaching.asmdeck');
const previousBody = fs.existsSync(draftFile)
  ? JSON.parse(gunzipSync(fs.readFileSync(draftFile).subarray(9))).body : null;
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

function animationSlide(file) {
  const codeSource = fs.readFileSync(path.join(root,
    'algorithm_sample/Backtracking', file), 'utf8');
  const authoredView = codeSource.match(/\/\*\s*@asm-view\s*([\s\S]*?)\s*@asm-view\s*\*\//);
  const view = authoredView ? JSON.parse(authoredView[1]) : { version: 1, rules: [], skins: {} };
  const eventSettings = { gapMs: 250, autoFixedEnabled: false,
    autoLoopBoundaryEnabled: false, ...view.studio?.eventSettings };
  return {
    id: uid(), kind: 'algorithm-animation', canvas: { objects: [] }, widgets: [],
    ttsScript: '', ttsOrder: [], animation: {
      mode: 'trace', code: codeSource, input: '4\n', sliceMode: 'manual', watches: [],
      rebuild: {
        view: { ...view, studio: { ...view.studio, eventSettings } },
        globals: { eventSettings }
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

s = slide('方法一：一般迴圈枚舉', '把每一列的欄位位置視為 N 進位計數器');
structure(s, 'normal', '0,0,0,0', 150, 220, 980, 150,
  { name: 'pos[row]：每列皇后的欄位', indexMode: 1, cellSize: 82, highlightIndices: '3' });
latex(s, String.raw`\underbrace{N\times N\times\cdots\times N}_{N\text{ 列}} = N^N`, 260, 425, 760, 90, 38);
addText(s, '從 pos = [0,0,…,0] 開始，最後一列先加一；溢位就向前一列進位。',
  125, 565, 1030, 27, colors.accent);

let loopFlow = slide('每一組完整配置都要檢查', '枚舉完成後，才判斷同欄與對角線衝突');
structure(loopFlow, 'table', '', 110, 195, 1060, 330, { name: '迴圈流程', tableData: [
  ['步驟', '內容'], ['1 產生配置', 'pos 決定每一列的皇后欄位'],
  ['2 檢查衝突', '比較所有皇后是否同欄或同斜線'],
  ['3 記錄答案', '合法就把 ans 加一'], ['4 進位', '修改 pos，產生下一組配置']
] });
addText(loopFlow, '即使第一、二列已經衝突，後面的列仍會被枚舉。',
  175, 575, 930, 28, colors.red, true);

let loopExample = slide('一般迴圈枚舉的例子', 'N = 4 時，pos 就是四位的四進位計數器');
structure(loopExample, 'normal', '0,1,2,3', 155, 205, 970, 145,
  { name: 'pos = [0,1,2,3]', indexMode: 1, cellSize: 80, highlightIndices: '0-3' });
structure(loopExample, 'matrix', '♕,,,;,♕,,;,,♕,;,,,♕', 405, 395, 470, 245,
  { name: '同一條對角線：不合法', cellSize: 50, highlightIndices: '0,5,10,15' });

let loopCode = slide('一般迴圈的核心程式', '完整配置檢查完，再把 pos 向下一組進位');
code(loopCode, `while (more) {
    bool valid = true;
    for (int row = 0; row < N && valid; row++)
        for (int prev = 0; prev < row; prev++)
            if (pos[prev] == pos[row] ||
                abs(pos[prev] - pos[row]) == row - prev)
                valid = false;
    if (valid) ans++;

    int row = N - 1;
    while (row >= 0 && ++pos[row] == N) {
        pos[row] = 0;
        row--;
    }
    more = row >= 0;
}`, 95, 180, 1090, 460, 21);
groups.push(group(s, loopFlow, loopExample, loopCode,
  animationSlide('8queen-loop-teaching.cpp')));

s = slide('方法二：由上而下遞迴', '只從仍然合法的前綴繼續放下一列');
structure(s, 'matrix', ',♕,,;,,,♕;?,?,?,?;,,,,', 135, 205, 510, 390,
  { name: '前兩列合法，準備放第 2 列', cellSize: 66, backgroundIndices: '1,7', focusIndices: '8-11' });
addText(s, 'dfs(row) 代表前 row 列已經放好。\n目前列只嘗試沒有受到攻擊的欄位；\n若沒有位置可放，就回到上一列。',
  710, 245, 455, 29);
addText(s, '衝突一出現就停止展開後續列，因此比 Nᴺ 枚舉有效率。',
  170, 620, 940, 26, colors.accent, true);

let recursionTree = slide('剪枝讓整個不可能的子樹消失', '合法才往下一列遞迴');
structure(recursionTree, 'binary_tree', 'row 0,c0,c1,c2,c3,衝突,衝突,c3,解,衝突',
  85, 185, 1110, 440, { name: '搜尋樹', treeData: {
    rootId: 'r', nodes: [
      {id:'r',value:'row 0'},{id:'a',value:'c0'},{id:'b',value:'c1'},
      {id:'c',value:'c2'},{id:'d',value:'c3'},{id:'x1',value:'衝突'},
      {id:'x2',value:'衝突'},{id:'b1',value:'c3'},{id:'ok',value:'解'},
      {id:'x3',value:'衝突'}
    ], edges: [
      {from:'r',to:'a'},{from:'r',to:'b'},{from:'r',to:'c'},{from:'r',to:'d'},
      {from:'a',to:'x1'},{from:'a',to:'x2'},{from:'b',to:'b1'},
      {from:'b1',to:'ok'},{from:'d',to:'x3'}
    ]
  }, highlightIndices: '5,6,9', markIndices: '8' });

let numericState = slide('仍使用一般數字陣列記住目前狀態', 'L、M、R 的每一格都是普通整數 0 或 1');
structure(numericState, 'normal', '0,0,1,0,1,0,0,0', 105, 190, 1070, 110,
  { name: 'L：左斜線攻擊', cellSize: 61, pointIndices: '2,4' });
structure(numericState, 'normal', '0,1,0,1,0,0,0,0', 105, 330, 1070, 110,
  { name: 'M：同欄攻擊', cellSize: 61, backgroundIndices: '1,3' });
structure(numericState, 'normal', '1,0,0,0,1,0,0,0', 105, 470, 1070, 110,
  { name: 'R：右斜線攻擊', cellSize: 61, highlightIndices: '0,4' });
addText(numericState, 'L[col]、M[col]、R[col] 都是 0 時，該欄才能放皇后。',
  185, 620, 920, 25, colors.accent);

let arrayShift = slide('一般陣列要逐格產生下一列狀態', '斜線往旁邊移一欄，需要掃描整個陣列');
structure(arrayShift, 'table', '', 125, 205, 1030, 280, { name: '下一列狀態', tableData: [
  ['狀態', '更新方式', '單次成本'],
  ['nextL', '逐格讀取 L[j+1]', 'O(N)'],
  ['nextM', '複製 M，再設定皇后欄位', 'O(N)'],
  ['nextR', '逐格讀取 R[j-1]', 'O(N)']
] });
latex(arrayShift, String.raw`\text{每個遞迴節點的狀態搬移成本： } O(N)`, 205, 530, 870, 80, 31);

let recursionCode = slide('一般陣列遞迴的核心程式', '選擇一欄後，建立下一列的 L、M、R');
code(recursionCode, `void dfs(int row, vector<int> L,
         vector<int> M, vector<int> R) {
    if (row == N) { ans++; return; }
    for (int col = 0; col < N; col++) {
        if (L[col] || M[col] || R[col]) continue;
        vector<int> nextL(N), nextM = M, nextR(N);
        nextM[col] = 1;
        for (int j = 0; j < N; j++) {
            if (j + 1 < N) nextL[j] = L[j + 1] || j + 1 == col;
            if (j > 0) nextR[j] = R[j - 1] || j - 1 == col;
        }
        dfs(row + 1, nextL, nextM, nextR);
    }
}`, 80, 175, 1120, 475, 20);
groups.push(group(s, recursionTree, numericState, arrayShift, recursionCode,
  animationSlide('8queen-array-teaching.cpp')));

s = slide('方法三：位元狀態壓縮', '把第二種方法的 L、M、R 數字陣列各壓進一個整數');
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

let shift = slide('原本的線性搬移變成一次位元位移', '搜尋樹相同，狀態更新成本降低');
structure(shift, 'table', '', 110, 190, 1060, 335, { name: '狀態更新比較', tableData: [
  ['狀態', '一般數字陣列', '狀態壓縮'],
  ['左斜線', '逐格搬移 O(N)', '(L | p) << 1，O(1)'],
  ['同欄', '複製整列 O(N)', 'M | p，O(1)'],
  ['右斜線', '逐格搬移 O(N)', '(R | p) >> 1，O(1)']
] });
addText(shift, '這裡的 O(1) 假設 N 能放進一個機器整數；超過字長後仍需多字運算。',
  145, 585, 990, 23, colors.muted);

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
groups.push(group(s, candidates, lowbit, shift, bitCode,
  animationSlide('8queen_recursion.cpp')));

const result = method => benchmark.summaries.find(item => item.method === method);
const range = n => Array.from({ length: n }, (_, index) => index + 1).join(',');

s = slide('5 秒速度比較', '同一台電腦、同一編譯器、單執行緒計算全部解');
structure(s, 'table', '', 110, 195, 1060, 320, { name: '測試條件', tableData: [
  ['項目', '設定'], ['時間上限', '5 秒'], ['編譯', benchmark.compiler],
  ['參數', benchmark.flags], ['對稱剪枝', '不使用'], ['計時範圍', '只計算，不含編譯／動畫／I/O']
] });
addText(s, '每種方法找到最大可完成 N 後重跑三次，投影片顯示中位數。',
  160, 575, 960, 25, colors.accent);

function resultSlide(method, title, explanation, color) {
  const item = result(method);
  const target = slide(title, '5 秒內可以完整算完的最大 N');
  addText(target, `N = ${item.n}`, 85, 195, 380, 72, color, true);
  structure(target, 'normal', range(item.n), 85, 330, 1110, 155,
    { name: `完成 N=${item.n}`, cellSize: 48, markIndices: `0-${item.n - 1}` });
  addText(target, `中位數 ${item.seconds.toFixed(3)} 秒，解數 ${Number(item.solutions).toLocaleString('en-US')}。`,
    90, 535, 1100, 29, colors.ink, true);
  addText(target, `N = ${item.nextN} 在 5 秒內無法完成。${explanation}`,
    90, 600, 1100, 23, colors.muted);
  return target;
}

const loopSpeed = resultSlide('loop', '一般迴圈枚舉',
  '大量時間花在產生與檢查已知衝突的完整配置。', '#c56a55');
const arraySpeed = resultSlide('array', '由上而下遞迴',
  '剪枝大幅減少搜尋節點，但每個節點仍要搬移陣列。', '#3f7f78');
const bitsSpeed = resultSlide('bits', '位元狀態壓縮',
  '搜尋邏輯相同，整列狀態改為常數次位元更新。', '#1d8f83');

let comparison = slide('三種方法的實測結果', '最大可在 5 秒內完整計算的 N');
structure(comparison, 'table', '', 110, 195, 1060, 330, { name: '5 秒比較', tableData: [
  ['方法', '最大 N', '該 N 耗時', '下一個 N'],
  ['一般迴圈枚舉', String(result('loop').n), `${result('loop').seconds.toFixed(3)} 秒`, `${result('loop').nextN}：超時`],
  ['一般陣列遞迴', String(result('array').n), `${result('array').seconds.toFixed(3)} 秒`, `${result('array').nextN}：超時`],
  ['位元狀態壓縮', String(result('bits').n), `${result('bits').seconds.toFixed(3)} 秒`, `${result('bits').nextN}：超時`]
] });
addText(comparison, `${benchmark.cpu}，${benchmark.logicalCores} logical cores；${benchmark.protocol}`,
  105, 575, 1070, 20, colors.muted);
groups.push(group(s, loopSpeed, arraySpeed, bitsSpeed, comparison));

const deck = { ttsSettings: {}, groups };
// Use the supplied Hanoi deck's actual header/footer objects. Keep the user's
// vertical method chapters while fitting their contents into its body region.
const chapters = ['PROBLEM & RULES', 'LOOP ENUMERATION', 'ARRAY BACKTRACKING',
  'BITMASK OPTIMIZATION', 'PERFORMANCE COMPARISON'];
let page = 0;
for (const [chapter, section] of groups.entries()) {
  for (const target of section.slides) {
    page++;
    if (target.animation) {
      const saved = previousBody?.deck.groups.flatMap(g => g.slides)
        .find(old => old.animation?.code === target.animation.code && old.animation?.prebuilt);
      if (saved) target.animation = structuredClone(saved.animation);
      continue;
    }
    const [, title, subtitle, ...contents] = target.canvas.objects;
    const chrome = structuredClone(layout.objects).map(object => ({
      ...object, ttsObjectId: uid()
    }));
    chrome[2].text = `${String(chapter + 1).padStart(2, '0')} / ${chapters[chapter]}`;
    chrome[3].text = title.text;
    chrome[4].text = subtitle.text;
    chrome[6].text = 'N QUEENS  ·  BACKTRACKING VISUALIZATION';
    chrome[7].text = String(page).padStart(2, '0');
    for (const object of contents) {
      object.top = 222 + (object.top - 180) * 0.87;
      object.fontSize = Math.min(object.fontSize, 28);
      object.lineHeight = 1.28;
    }
    for (const item of target.widgets) {
      item.y = 222 + (item.y - 180) * 0.87;
      item.h *= 0.87;
    }
    target.canvas.objects = [...chrome, ...contents];
  }
}

// Hanoi's opening slide combines a short headline, three rounded topic cards
// and an illustration. Use an editable chessboard Structure as the illustration.
const cover = groups[0].slides[0];
cover.canvas.objects = cover.canvas.objects.slice(0, 8);
cover.canvas.objects[3].text = 'N Queens｜八皇后問題';
addText(cover, '讓八個皇后互不攻擊，\n從完整枚舉走向回溯與位元壓縮。', 66, 244, 710, 32, colors.ink, true);
addText(cover, '問題與規則 → 一般迴圈 → 陣列遞迴 → 位元優化', 68, 342, 730, 22, colors.muted);
for (const [index, label] of ['每列一個皇后', '衝突立即回溯', '位元壓縮狀態'].entries()) {
  const x = 68 + index * 232;
  cover.canvas.objects.push({ type: 'rect', left: x, top: 412, width: 212,
    height: 70, rx: 14, ry: 14, fill: index === 1 ? '#fae9e3' : '#dff4ef',
    strokeWidth: 0, layerIndex: 1000, ttsObjectId: uid() });
  addText(cover, label, x + 18, 434, 178, 20, colors.accent, true);
}
addText(cover, '向下閱讀同一方法的推導與動畫；向右切換下一個主題。',
  68, 570, 1100, 18, colors.muted);
Object.assign(cover.widgets[0], { x: 820, y: 235, w: 385, h: 340, cellSize: 36 });

// Match Hanoi's code-and-explanation split instead of a full-width code block.
for (const [target, reading] of [
  [loopCode, 'pos：每列皇后的欄位\nvalid：完整配置是否合法\n\n檢查所有皇后後，再將最後一列加一；溢位時往前進位。'],
  [recursionCode, 'row：目前要放的列\nL / M / R：普通數字陣列\n\n只嘗試安全的欄位，將下一列的狀態交給 dfs。'],
  [bitCode, 'P：目前列的候選位置\np：取出的最低有效位元\n\n搜尋仍然逐列遞迴；差別是狀態改用整數保存與更新。']
]) {
  Object.assign(target.widgets[0], { x: 64, y: 222, w: 704, h: 400, fontSize: 19 });
  target.canvas.objects.push({ type: 'rect', left: 808, top: 222, width: 408,
    height: 400, rx: 14, ry: 14, fill: '#eef5f2', strokeWidth: 0,
    layerIndex: 1000, ttsObjectId: uid() });
  addText(target, '讀法', 832, 244, 360, 24, colors.ink, true);
  addText(target, reading, 832, 298, 360, 19);
}
const body = { deck, assets: {}, ...(previousBody?.prebuiltTraces
  ? { prebuiltTraces: previousBody.prebuiltTraces } : {}) };
const payload = {
  manifest: {
    format: 'AlgoShowMaker.asmdeck', packageVersion: 1,
    engineVersion: `${provenance.ENGINE_VERSION}/${provenance.FORMAT_VERSION}`,
    exportedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'), assetHashes: [],
    prebuiltTraceHashes: Object.keys(body.prebuiltTraces || {}).sort()
  }, body
};
const output = path.join(root, 'drafts/eight-queens-teaching.asmdeck');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([Buffer.from('ASMDECK1\n'), gzipSync(JSON.stringify(payload))]));
console.log(`${output}: ${groups.length} groups, ${groups.flatMap(item => item.slides).length} slides, ${fs.statSync(output).size} bytes`);
