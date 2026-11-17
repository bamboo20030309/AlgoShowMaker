# Merge Sort 排版語法比較

前三個範例使用相同的遞迴 Merge Sort 流程，差別只在視覺化排版方式；第四個範例使用 bottom-up 寫法。

| 範例 | 狀態 | 重點 |
|---|---|---|
| `01-existing-layout.cpp` | 現有語法 | 合併迴圈必須留在 `merge_sort()`，才能寫回目前的 recursion activation。|
| `02-node-layout-proposal.cpp` | 語法提案 | 新增 `node current`／`node caller`，讓獨立 `merge()` 將畫面存入指定 activation。|
| `03-split-merge-layout-proposal.cpp` | 語法提案 | 單一 `split-merge` layout 管理分裂區、合併區與兩層葉節點之間的橋接箭頭。|
| `04-bottom-up-existing-directives.cpp` | 現有語法 | 不畫遞迴樹，改用每輪寬度與上下兩列陣列解釋合併過程。|

## 現有語法的限制

- `@frame ... in layout` 與 `@keep ... in layout` 只能自動使用目前函式 activation。
- `@keep ... as "name"` 的 `as` 是顯示名稱，不是 layout node ID。
- 現有 recursion 預設為 `compact`、`sibling-gap 40`、`level-gap 100`、`branch-previews on`；範例直接採用預設，因此不重複寫出。
- 合併樹按照 postorder 建立。父節點尚未出現時，已顯示的葉節點可能重新排版。
- 現有 `@arrow` 無法以 layout ID 與 activation 選取另一個 layout 的 snapshot，因此第一版雖能畫兩份葉節點，不能通用地連接它們。

### 保留現有寫法的通用解法

不加入只能處理 Merge Sort 的 `leaf-links-from`。葉節點連線沿用河內塔的做法：同一條普通 `@arrow` 在每個 base case 各執行一次，只新增 layout 端點的 `current` 選取器：

```cpp
// @arrow from split_tree.current.bottom
//     to merge_tree.current.top
//     as "leaf_link" color AV_green! width 2
```

`current` 就是目前上下兩棵樹正在處理的節點。完整的巢狀 layout、節點集合、批次箭頭、樣式繼承與錯誤處理規格見 [`layout-composition-proposal.md`](../layout-composition-proposal.md)。

- 同一個 `merge_sort(L,R)` 呼叫在 `split_tree` 與 `merge_tree` 各有一個節點。
- `split_tree.current` 與 `merge_tree.current` 會選到上下對應的節點。
- 系統自動替每次建立的箭頭分配穩定 ID。
- 同一對節點後續只是更新位置，不重新建立箭頭，因此不會因 layout 重排而閃爍。

這套語法目前是設計提案，尚未由解析器與 renderer 實作。

## Bottom-up 版本的教學取捨

使用者提供的程式邏輯正確，而且同時算出逆序對數量；但原寫法較適合已熟悉 merge sort 的競賽讀者：

- `i`、`j`、`p`、`q`、`lp`、`lq`、`t` 很短，不容易直接看出哪個是區間寬度、左右指標與邊界。
- 逗號運算子把「寫入、移動指標、累加逆序對」壓在同一行，不利於逐步動畫。
- `num` 是 `long long`，但 `temp` 是 `int`，輸入超過 `int` 範圍時會被截斷。
- `sum` 是逆序對功能，不是 merge sort 排序本身必需；教學時應明確分開說明。

第四版保留 `num`、`temp`、`sum`、`mergesort()` 與 bottom-up 主流程，只把變數改成 `width`、`L`、`mid`、`R`、`left`、`right`，並拆開逗號運算。畫面先標出藍色與黃色的兩個有序區間，再逐項放入下方 `temp`；每輪結束保留一列 `num`，自然形成長度 `1 → 2 → 4 → 8` 的層次。

## `node` 提案

```cpp
// @frame value in tree node current
// @frame value in tree node caller
// @keep last in tree node caller
// @arrow from split_tree.node(current).bottom to merge_tree.node(current).top
```

- `current`：目前函式 activation。
- `caller`：上一層呼叫者 activation。
- layout 應從完整 trace 預先建立 activation topology，讓葉節點第一次出現時就在最終位置。

## `split-merge` 提案

```cpp
// @layout split-merge as "merge_flow" at canvas.top offset(0,60)
```

`split-merge` 模式預設使用 `sibling-gap 0`、`level-gap 64`、`phase-gap 36`，並開啟結構邊與流程箭頭，所以範例不重複列出這些設定。

節點分成兩個 phase，而葉節點會在兩個 phase 各畫一次：

- `phase split`：分裂樹，由根往下。
- `phase split` 的葉節點：分裂樹終點。
- `phase merge` 的葉節點：合併樹起點，同一個元素會再畫一次。
- layout 自動由上方 split 葉節點畫箭頭到下方 merge 葉節點。
- `phase merge` 的非葉節點由葉層往下產生，完整結果位於最底部。

`split-merge` 仍可使用 `node caller`，讓獨立的 `merge()` 更新呼叫它的 `merge_sort()` 節點。
