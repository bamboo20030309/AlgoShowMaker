# Alpha：新版 Fibonacci 遞迴動畫範例

## 目標

- 將舊版 `AV.hpp`／`TreeLayout` Fibonacci 範例轉成目前的 trace directive。
- 以 runtime recursion activation 建立父子節點與左右呼叫順序。
- 先提供可播放的新版基準，讓使用者檢視後再決定遞迴動畫邏輯需要補強之處。

## 範圍

- 更新 `algorithm_sample/Backtracking/fibonacci.cpp`。
- 新增直接相關的小型編譯／trace 測試。
- 不修改遞迴 renderer、排程器或一般播放邏輯。

## 驗證分級

- 層級：V2。
- 分類：E（layout／frame）、F（runtime 遞迴資料）、G（生命週期／遞迴 activation）。
- 僅執行 Fibonacci 專項測試與必要的靜態檢查；不執行完整 regression 或廣泛動畫集。
