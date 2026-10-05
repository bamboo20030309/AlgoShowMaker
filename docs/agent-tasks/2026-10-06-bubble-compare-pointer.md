# 冒泡排序比較指標抬升方向修正

## 重現與原因

- 使用者程式：相鄰比較、swap 後 `@frame arr[j,j+1]`、每輪 `@keep last`。
- 輸入：`10`；陣列：`1 8 7 5 6 2 3 9 10 12`。
- 第 2→3 幀的獨立預期：交換前比較 `8 > 7`，左側 j 應比右側 j+1 更高。
- 修改前實際 SVG：左側 y=-55.8758、右側 y=-61.5969，左右位置正確但垂直方向反轉；新測試確實先失敗。
- 原因：destination frame 已包含後續 swap 結果；replay 將邏輯索引映射到攜帶數值的實體 SVG。比較附屬指標卻先依實體 anchor 配對，因而跟隨另一個 operand 的大小縮放。

## 修正

- `trace-frame-tween.js` 的 comparedOperandForBinding 優先匹配比較當下的 logicalKey。
- 保留凍結快照的 snapshot-local anchor 配對，未改動交換路徑、指標書寫順序或放寬動畫容許值。
- 前端快取 build：trace-298。

## 驗證

- `bubble-compare-pointer.browser.test.js`：新 Trace 1x／4x、缺少 captureOrder 與 afterCapture 的舊 Trace 4x；讀取實際 SVG 文字位置並轉為共同 root 座標。固定答案 8>7 不由播放計畫提供。
- JSON 儲存重開後 j、j+1 分別維持索引 1、2。
- `retained-compare.browser.test.js`：凍結子節點比較、事件索引與指標同步。
- `truthy-compare.integration.test.js`：單值條件與一般雙值比較、線篩比較事件。
- 合計 4 個具名案例通過；瀏覽器無 pageerror，語法與 git diff --check 通過。
- 只執行相關局部驗證，完整 V3 尚未重新驗收；不合併 main 或發布。
