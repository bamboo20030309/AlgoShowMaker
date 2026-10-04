# Layout Composition 與批次箭頭語法提案

## 目標

這項修改不是只替 Merge Sort 連接兩排葉節點，而是建立三個可組合的通用能力：

1. layout 可以包含其他 layout 與一般畫面物件。
2. layout 可以公開根、葉、指定層與上下左右邊界等「節點集合」。
3. `@arrow for` 可以直接迭代節點集合，將它映射到另一個 layout 集合或同長度陣列。

既有 `@frame`、`@keep`、`@layout recursion` 與範圍式 `@arrow for k in [L:R]` 必須保持相容。

---

## 一、外層 compose layout

### 宣告

```cpp
// @layout compose as merge_scene at canvas.center
// @layout merge_scene direction top-down
// @layout merge_scene gap 64
// @layout merge_scene align center

// @layout recursion as split_tree in merge_scene
// @layout recursion as merge_tree in merge_scene
// @layout merge_tree direction bottom-up
```

`compose` 將每個直接子 layout 的完整 bounding box 視為一個排版項目。上例先完成兩棵樹各自的內部排版，再由 `merge_scene` 將兩棵樹由上往下排列。

### 一般物件也能加入 compose layout

```cpp
// @frame answer as answer_column with columns(1) in tree_and_answer
```

對 `compose` 而言：

- `@layout ... in parent` 加入子 layout。
- `@frame ... as object_id in parent` 加入目前的 live 物件。
- `@keep ... as object_id in parent` 加入保留快照。
- compose 只處理子項目的外框，不改變陣列、樹或其他 renderer 的內部畫法。

### compose 設定

| 設定 | 值 | 意義 |
| --- | --- | --- |
| `direction` | `top-down`、`bottom-up`、`left-right`、`right-left` | 子項目排列方向 |
| `gap` | 正數像素 | 相鄰子項目外框間距 |
| `align` | `start`、`center`、`end` | 垂直於排列方向的對齊方式 |
| `items` | 逗號分隔 ID | 選擇性固定子項目順序；未列出的項目接在後方 |
| `background` | 顏色 | compose 整體底板顏色；空值代表不畫底板 |
| `arrow-style` | arrow 樣式修飾詞 | compose 所有自動／layout-owned 箭頭的預設樣式 |

例如把一棵樹與垂直陣列左右排列：

```cpp
// @layout compose as tree_and_answer at canvas.center
// @layout tree_and_answer direction left-right
// @layout tree_and_answer gap 96
// @layout tree_and_answer align center
// @layout tree_and_answer items source_tree,answer_column

// @layout recursion as source_tree in tree_and_answer
```

### 巢狀規則

- 一個 layout 最多只能有一個父 layout。
- `in parent` 與 `at target` 互斥；巢狀 layout 的位置由父 layout 決定。
- layout 可以多層巢狀，但不能形成循環。
- 內層 layout 先完成量測與排版，外層 compose 再排列其 bounding box。
- 外層移動時，所有後代物件與綁定箭頭同步移動。
- `.box`、`.current`、`.root`、`.nodes`、`.leaves`、`.level(...)` 與 `.side(...)` 是 layout 專用選取器；解析器看到這些成員時，前方名稱必須是已宣告的 layout ID。

---

## 二、layout 端點與節點集合

### 單一端點

```cpp
tree.root
tree.current
tree.root.bottom
tree.box.right
scene.box.bottom-left
```

- `tree.root`：唯一根節點；第一版 recursion layout 只允許一個根。
- `tree.current`：指定樹目前正在處理的節點。這是給遞迴程式內普通 `@arrow` 使用的簡寫。
- `tree.box.right`：整個 layout bounding box 的右側錨點，不是某個節點。
- 最後的 `.top`、`.right`、`.bottom`、`.left`、`.center` 等沿用目前 `@arrow` 的 anchor 語意。
- layout 節點端點一律綁定節點 outerframe。

### 節點集合

```cpp
tree.nodes
tree.leaves
tree.level(depth)
tree.side(top)
tree.side(right)
tree.side(bottom)
tree.side(left)
```

集合可用 `[k]` 取出單一節點：

```cpp
tree.leaves[k].bottom
tree.side(right)[k].right
```

### 集合定義與順序

| 集合 | 內容 | 順序 |
| --- | --- | --- |
| `nodes` | 所有可見節點 | layout 的穩定邏輯順序；recursion 預設為 preorder |
| `leaves` | 沒有子節點的節點 | 依穩定 sibling path 排序，不因 `direction` 翻轉而改變 |
| `level(d)` | recursion depth 等於 `d` | 該層視覺順序 |
| `side(left/right)` | 每個視覺水平帶中最靠該側的節點 | 由上到下 |
| `side(top/bottom)` | 每個視覺垂直帶中最靠該側的節點 | 由左到右 |

「視覺帶」依節點中心座標分組，容許 0.5px 誤差；同一帶若有兩個節點同樣靠近邊界，使用穩定節點 key 決定順序。這可讓 `side(right)` 在一般 top-down tree 中得到每一層最右側的節點。

`leaves` 使用邏輯 sibling path，而 `side(...)` 使用最終幾何位置。前者適合跨兩棵相同 recursion tree 配對，後者適合將畫面邊界映射到旁邊的物件。

---

## 三、沿用 `@arrow for` 的 layout 批次箭頭

### 文法

既有範圍寫法維持不變：

```cpp
// @arrow for k in [0:n-1] from a[k] to b[k]
```

新增「集合批次」：

```cpp
// @arrow for k in COLLECTION
//     from ENDPOINT
//     to ENDPOINT
//     [in OWNER_LAYOUT]
//     [as "ID"]
//     [color COLOR]
//     [width NUMBER]
//     [head start|end|both|none]
//     [line straight|curve]
//     [dash PATTERN]
//     [when CONDITION]
```

批次變數 `k` 仍然是從 `0` 開始的整數，與現有 `@arrow for` 相同；它不會變成特殊 node 物件。因此陣列索引仍可直接寫成 `answer[k]`。

### 根對根

不需要批次：

```cpp
// @arrow from left_tree.root.right
//     to right_tree.root.left
//     in forest_scene
//     as root_link
//     color AV_blue! width 3 line curve
```

### 葉對葉：Merge Sort 上下兩棵樹

Merge Sort 不必一次掃描整批葉節點。它和河內塔的搬運紀錄相同：程式每次執行到 base case 時建立一支箭頭，再由該節點的 keep snapshot 保留。

```cpp
if (L == R) {
    // @frame current in merge_tree
    // @arrow from split_tree.current.bottom
    //     to merge_tree.current.top
    //     as "leaf_link" color AV_green! width 2
    // @keep last as "merge" in merge_tree
    return;
}
```

同一行 `@arrow` 會隨每個 base case 各執行一次。程式走到哪個葉節點，兩個 `.current` 就連接那一組上下節點，不需要額外的配對指令。

### 樹的右側邊界對垂直陣列

```cpp
// @layout compose as tree_and_answer at canvas.center
// @layout tree_and_answer direction left-right
// @layout tree_and_answer gap 96
// @layout tree_and_answer align center
// @layout recursion as source_tree in tree_and_answer

// @frame answer as answer_column with columns(1) in tree_and_answer

// @arrow for k in source_tree.side(right)
//     from source_tree.side(right)[k].right
//     to answer[k].left
//     in tree_and_answer
//     as right_frontier_to_answer
//     color AV_orange! width 2 line curve
```

這會取得每個水平層最右側的節點，由上到下對應 `answer[0]`、`answer[1]`……。`columns(1)` 沿用既有陣列 renderer，layout 系統不需要再發明垂直陣列。

### 多棵樹合併

```cpp
// @layout compose as forest_scene at canvas.center
// @layout forest_scene direction left-right
// @layout forest_scene gap 80
// @layout recursion as tree_a in forest_scene
// @layout recursion as tree_b in forest_scene
// @layout recursion as tree_c in forest_scene

// @arrow from tree_a.root.right to tree_b.root.left
//     in forest_scene as a_to_b
// @arrow from tree_b.root.right to tree_c.root.left
//     in forest_scene as b_to_c
```

同一個 compose layout 可以擁有任意數量的子 layout 與箭頭映射，不限制只能兩棵樹。

---

## 四、對應順序、長度與生命週期

### 對應順序

- 來源集合第 `k` 個端點連到目標第 `k` 個端點。
- 適用於 `side(right)` 對陣列，或兩個本來就採相同視覺順序的集合。
- 第一版不提供 `match` 修飾詞；需要連接目前兩棵遞迴樹對應節點時，使用普通箭頭與 `tree.current`。

### 長度規則

- 集合批次預設採 `exact`，兩側可列舉集合必須同長度。
- 若目標是 `answer[k]`，每一個 `k` 都必須解析到可見格子；完成後若陣列還有未配對格子，也回報長度不一致。
- progressive recursion 尚未建立的未來節點先標為 pending，不立即報錯。
- 完整 trace topology 已知，或來源根 activation 已結束後，再執行最終長度驗證。
- 不靜默截斷、不循環重用端點。

第一版不提供自動截斷模式，避免長度錯誤被隱藏。

### 箭頭擁有者 `in`

```cpp
// @arrow ... in merge_scene
```

- 箭頭屬於指定 layout，而不是只屬於前一個 frame。
- 不要求前面必須有 `@frame`；純 layout-to-layout 箭頭可放在全域 layout 宣告旁。
- 若端點包含 C++ 變數，例如 `answer[k]`，指令仍必須位於該變數可見作用域，instrumenter 會捕捉其 variable ID。
- 箭頭在兩端都可見時出現；其中一端尚未建立時保持 pending。
- owner layout 離場時，整組箭頭一併離場。

未寫 `in` 的 `@arrow` 完全沿用目前「附著到上一個 frame」的行為。

---

## 五、箭頭 ID、動畫與樣式

### 穩定 ID

集合批次的每一支箭頭不使用單純的畫面索引當永久身分。建議 ID：

```text
<authored-arrow-id>@<owner-layout-id>:<source-stable-key>→<target-stable-key>
```

recursion node 的 stable key 使用 `layout ID + activation ID`；一般物件格子使用 `object key + logical index`。

因此：

- layout 重排只更新 SVG path，不重播入場動畫。
- 集合順序改變時，同一對端點仍保有同一 ID。
- 新節點只讓新增的箭頭播放入場；既有箭頭不閃爍。
- 節點暫時由 live frame 換成同 activation 的 keep snapshot 時，沿用相同 layout node key。

### 樣式沿用一般 `@arrow`

```cpp
// @arrow for k in tree.leaves
//     from tree.leaves[k].right
//     to answer[k].left
//     in scene as answers
//     color AV_green! width 3 head end line curve dash 8,4
```

這些修飾詞直接套用整批箭頭，不另外設計一套 batch style。

layout 亦可提供預設值：

```cpp
// @layout scene arrow-style color AV_green! width 2 head end line curve
```

優先順序：

1. `@arrow` 本身明確指定的修飾詞。
2. owner layout 的 `arrow-style`。
3. 系統一般箭頭預設。

父子 edge 與 DFS flow arrow 若要個別覆寫，可保留：

```cpp
// @layout tree edge-style color black width 2
// @layout tree flow-arrow-style color AV_grey width 1 line curve
```

---

## 六、建議文法摘要

```text
layout-declaration
  := @layout recursion as ID [in ID | at ENDPOINT] [offset(X,Y)]
   | @layout compose   as ID [in ID | at ENDPOINT] [offset(X,Y)]

layout-setting
  := @layout ID direction DIRECTION
   | @layout ID gap NUMBER
   | @layout ID align ALIGN
   | @layout ID items ID[,ID...]
   | @layout ID arrow-style ARROW_STYLE
   | existing recursion settings

layout-target
  := ID.box.ANCHOR
   | ID.current.ANCHOR
   | ID.root.ANCHOR
   | ID.COLLECTION[INDEX].ANCHOR

layout-collection
  := ID.nodes
   | ID.leaves
   | ID.level(EXPR)
   | ID.side(top|right|bottom|left)

layout-arrow
  := @arrow [for NAME in LAYOUT_COLLECTION]
       from ENDPOINT to ENDPOINT
       [in OWNER_LAYOUT]
       [existing arrow modifiers]
```

---

## 七、解析器、模型與 renderer 修改位置

### `trace-instrumenter.js`

1. `findLayoutDirectives()`：
   - 新增 `compose` declaration。
   - declaration modifier 新增 `in`。
   - 新增 `gap`、`items`、`arrow-style`、`edge-style`、`flow-arrow-style`。
   - 建立 layout parent graph，檢查不存在的 parent、重複 parent 與循環。
2. `parseArrowTarget()`／`parseAtBinding()`：
   - 辨識 `ID.box`、`ID.current`、`ID.root` 與 collection target。
   - 區分 layout box、單一 node 與 node collection item。
3. `findArrowDirectives()`：
   - 擴充 `for k in ID.collection`。
   - modifier 新增 `in`。
   - layout-owned arrow 不再要求前方存在 frame。
4. `attachArrowDirectives()`：
   - 一般箭頭維持 frame attachment。
   - 有 `in` 的箭頭寫入 document-level `layoutArrows`。
   - C++ 變數端點仍依原作用域解析並加入 capture-only watches。

### Trace document/model

建議新增：

```js
layout = {
  id,
  type: 'recursion' | 'compose',
  parentLayoutId,
  childOrder,
  direction,
  gap,
  align,
  arrowStyle
}

layoutArrow = {
  id,
  ownerLayoutId,
  batch: {
    kind: 'layout-collection',
    variable: 'k',
    collection
  },
  from,
  to,
  style
}
```

model 層建立每幀的 layout node registry：

```text
layout ID → stable node key → object key / activation ID / parent / depth / box
```

collection selector 與配對應在 model 層完成，不應讓 renderer 各自猜測節點順序。

### `trace-renderer.js`

建議執行順序：

1. 畫出一般物件與 keep snapshot。
2. 由內到外排 recursion／compose layouts。
3. 寫回所有 object placements 與 layout bounding boxes。
4. 解析 layout node collections。
5. 展開 layout-owned batch arrows。
6. 使用既有 `renderArrowModels()` 畫線。
7. 最後定位文字、鏡頭與其他依賴最終 geometry 的內容。

跨 layout 箭頭應使用獨立 class，例如 `.asm-trace-layout-map-arrow`，但仍走共用 arrow model、marker 與 path 更新邏輯。

---

## 八、錯誤訊息與相容性

必須明確報錯的情況：

- `in` 指向不存在或尚未宣告的 layout。
- layout parent graph 有循環。
- 同一 layout 同時使用 `in` 與 `at`。
- `.root` 實際對應零個或多個根。
- collection index 越界。
- 完整 topology 中兩個 exact collection 長度不同。
- layout-owned arrow 的 owner 不是兩端 layout 的共同祖先。
- 同一幀展開後產生重複 arrow ID。

相容性原則：

- 沒有 `compose`、layout endpoint、collection batch 或 `in` modifier 的舊程式，trace JSON 與行為不變。
- 舊 `@arrow for k in [L:R]` 使用原 batch model，不經 layout collection resolver。
- 舊投影片缺少 `parentLayoutId`、`layoutArrows`、`arrowStyle` 時，一律正規化為無父 layout、無 layout-owned arrow、現行預設樣式。
- 明確的 `edges off`、`flow-arrows off` 與既有自訂位置不得被新預設覆蓋。

---

## 九、最小實作順序

1. layout endpoint：先支援 `id.root`、`id.current`、`id.leaves[k]` 與 `id.box`。
2. collection batch：支援 `.leaves`、`.side(...)` 與依順序映射。
3. layout-owned arrow：加入 `in owner`、穩定 ID 與 progressive pending。
4. compose layout：支援 layout-in-layout 與普通物件子項。
5. style inheritance：加入 `arrow-style` 與個別 edge/flow override。
6. 補上舊物件 normalize、匯出重匯入與實際瀏覽器動畫驗證。

這個順序可先解決 Merge Sort 葉節點相連，再逐步開放多樹與樹對陣列，而不需要先一次改完所有排版模式。
