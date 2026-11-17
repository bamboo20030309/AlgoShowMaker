# Merge Sort 與多 layout 組合

## 目標

- 實作可巢狀線性組合多個既有 layout 的 `@layout linear`（舊 `line`、`group` 保留為相容別名）。
- 提供簡短的 layout 端點：`current`、`root`、`nodes[k]`、`leaves[k]`、`level(d)[k]`、`side(direction)[k]`、`box`。
- 讓普通與批次 `@arrow` 可以連接不同 layout，並在 `@keep` 後維持穩定身分。
- 新增遞迴與非遞迴 Merge Sort 範例。
- 檢查既有使用 layout 的正式範例是否需要遷移。

## 驗收重點

- 舊的單一 `@layout recursion` 不改語意與預設值。
- linear 可以包含 recursion layout，也可以再放入另一個 linear。
- leaf/current 箭頭保留後不重播、不改綁到其他遞迴呼叫。
- 兩個 Merge Sort 範例都能編譯、執行並產生 trace。
- manual frame 只顯示部分物件時，既有物件的顯示／隱藏變化要產生可在 Trace Studio 檢視的 `visual-enter`／`visual-exit` 事件，不得偽裝成 C++ 宣告或作用域結束。
