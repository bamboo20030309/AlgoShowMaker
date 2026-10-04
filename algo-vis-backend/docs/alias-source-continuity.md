# 跨資料來源的 as 視覺延續

同一遞迴呼叫、同一 layout 內，可將不同來源绑定到同一個視覺別名：

```cpp
// @frame merged as merge_result in merge_tree
// 複製回 num 後：
// @frame num as merge_result with range(L,R) in merge_tree
```

外框和資料格沿用畫面身分；裁切後的格子依顯示順序配對，
`merged[0]` 接續 `num[L]`。索引仍為 num 的原始索引，供選取、style
及 pointer 使用。不同遞迴呼叫的同名別名不配對。

自動的來源隱藏／作用域離開不應複製已交接物件的退場殘影；
明確的 manualVisualExit 仍保留。沒有 as 的舊 trace 維持原先規則。
不新增儲存欄位，視覺身分於載入 trace 後由既有 source metadata 推導。

外框名稱也顯示 `as` 別名，未指定別名時維持 C++ 變數名稱。
只改 renderer 的 displayName，不改 variables 的原始名稱或資料來源；
`keep last` 的凍結幀使用相同顯示邏輯。

最小驗證：alias-source-continuity.browser.test.js（指定十筆輸入的九次
跨來源交接、外框與格子不淡出、沒有舊物件 ghost、呼叫身分獨立）；
pointer-children.browser.test.js（子樹指標、越界隱藏、舊 binding 儲存重開）；
entrypoints.test.js（前端模組版本）。

2026-10-05 別名名稱修正：V2／H、G，獨立 31992 服務與 headless Edge。
alias-display-name.browser.test.js、alias-source-continuity.browser.test.js、
entrypoints.test.js 共 3 案例通過，0 skip；JS 語法及差異檢查通過。
名稱案例涵蓋序列、空序列、matrix、scalar、keep、缺少別名欄位的舊 trace
載入及 JSON 儲存重開，自訂樣式和 autoFixedEnabled=false 保留。
跨來源九次切換不淡出且不混淆遞迴身分。未執行完整 regression，
本次只改名稱，不改事件排程；不需要 V3。
