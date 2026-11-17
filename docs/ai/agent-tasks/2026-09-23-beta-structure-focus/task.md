# 2026-09-23-beta-structure-focus：統一結構 Focus 預設色

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：1640c5e901b8a14317acbdfb437e6240cc322d2a
- 分支：codex/2026-09-23-beta-structure-focus
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-23-beta-structure-focus

## 問題與預期結果
- 情境與操作：新增或匯入投影片的 structure 元件，使用 Focus 樣式。
- 目前行為：靜態 structure 預設 Focus 為 `#808080`，演算法動畫 Focus 預設為 `#ccc`。
- 使用者希望的結果：兩者視覺顏色相同；本輪 Heap deck 的所有 outerframe 使用編輯器預設色。
- 本次範圍與必要限制：編輯器預設值與本輪 Heap deck；不更動演算法動畫繪圖邏輯。

## 需求確認
- 已從使用者或上下文確認：Focus 預設需與投影片動畫相同；outerframe 使用預設色。
- 尚待使用者回答：無。
- 代理採用的合理假設：將動畫的 `#ccc` 寫成等價的 `#cccccc`，與現有 AV_grey 色值一致。

## 重現與調查
- 最小操作步驟或 fixture：新增 structure，讀取 Focus 色；對照 `draw_array_heap.js` 的動畫 Focus fallback。
- 重現狀態：已重現。
- 已確認事實：靜態 structure 預設 `#808080`；動畫 fallback `#ccc`；Heap deck 的 26 個 structure outerframe 被指定為 `#eef5f1`。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`slides.js`、`slide-structures.js`、`slides.html` 的結構 Focus 預設；本輪輸出 `.asmdeck` 檔另交付，不納入程式提交。
- 共用檔案／介面與協調結果：僅更動結構預設色，保留使用者手動指定的顏色。
- 依賴任務：無。

## 驗收條件
- [x] 新增 structure 時 Focus 色顯示為 `#cccccc`。
- [x] 匯入本輪 Heap deck 後，其所有 structure outerframe 與 Focus 設定符合預設值。
- [x] 原本有明確自訂 Focus 色的其他 deck 不被強制覆蓋。

## 驗證計畫
- 子代理小驗證：語法與差異檢查；隔離瀏覽器新增 structure 並檢查色值；匯入本輪 deck 檢查垂直分組與顏色。
- 主代理整合驗收：核對程式 diff 與局部瀏覽器結果；不啟動完整演算法驗證集。
- 測試隔離方式：使用獨立 Edge context 與本機 3100 預覽，不操作使用者分頁。

## 變更紀錄
- 2026-09-23：依使用者要求建立任務；同時製作獨立的逐一插入建堆章節與垂直分組投影片。
