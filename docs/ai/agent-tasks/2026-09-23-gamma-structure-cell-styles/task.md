# 2026-09-23-gamma-structure-cell-styles：Structure 每格獨立樣式

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b90a56f3733d5ccfe26fb5cadfd47b5e25bf2755
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：點選 structure 的不同格子，分別選擇 style 並調整顏色。
- 目前行為：格子可以分別套用 style 類型，但同一類型共用整個 structure 的顏色。
- 使用者希望的結果：每個格子保存並調整自己的 style 與顏色，互不影響。
- 本次範圍與必要限制：一般陣列及其他 structure renderer 的格子 style；保留舊投影片相容性；不執行大規模驗證。

## 需求確認
- 已從使用者或上下文確認：style 應屬於各格子並可各自調整。
- 尚待使用者回答：無。
- 代理採用的合理假設：highlight、focus、point、mark、background、註標箭頭皆採每格顏色；既有全域顏色作為未設定格子的預設值。

## 重現與調查
- 最小操作步驟或 fixture：在四格陣列替第 0 格與第 2 格套用 highlight，分別選藍色與黃色。
- 重現狀態：已重現。
- 已確認事實：目前以 `*Indices` 保存格子套用狀態，但每種 style 只保存一個全域 `*Color`。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.js`、`public/slide-structures.js`、入口版本與 structure 局部瀏覽器測試。
- 共用檔案／介面與協調結果：新增選用的 `cellStyles` widget 欄位；舊 `*Indices` 與 `*Color` 欄位仍讀取並保留。
- 依賴任務：無。

## 驗收條件
- [x] 同一 structure 的不同格子可使用同類型但不同顏色的 style。
- [x] 調整某格顏色不改變其他格子的顏色。
- [x] 清除某格樣式只影響該格，儲存及重新載入後結果維持。
- [x] 沒有 `cellStyles` 的舊投影片仍依原有索引與全域顏色顯示。

## 驗證計畫
- 子代理小驗證：JavaScript 語法、入口測試、structure 樣式與註標瀏覽器測試，視需要補 segment tree 局部測試。
- 主代理整合驗收：在整合版本以兩個格子設定不同 highlight 顏色，重載後人工核對。
- 測試隔離方式：隨機埠、獨立無頭瀏覽器及測試 deck，不操作使用者投影片。

## 變更紀錄
- 2026-09-23：依使用者要求，將 style 顏色保存範圍調整為個別格子。
