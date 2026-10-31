# gamma-trace-chunks：追蹤去重與分塊壓縮

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：3dd2bfb662bfb7da288fc4a97bf9f73120b6c542（沿用目前開發分支，未切換整合基準）
- 分支：codex/2026-09-22-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-22-gamma

## 問題與預期結果
- 情境：1000 元素陣列、100×100 棋盤矩陣，初始化後 @frame。
- 目前行為：96,013 個事件產生 47,443,024 bytes 原始 trace，超過 20 MiB，畫布無結果。
- 預期：共用指令／activation 資訊，分塊寫讀、gzip 壓縮，保留所有事件並量測大小。
- 限制：不刪除初始化事件，不執行大規模 regression；不操作使用者分頁或投影片。

## 需求確認
- 已確認：使用者授權上述修改及尺寸量測，既有 gamma push 授權持續適用。
- 尚待使用者回答：無。
- 合理假設：外部 traceDocument 保留 1.0 介面，舊投影片毋須遷移。

## 重現與調查
- 已重現：原始 trace 超過 20 MiB，錯誤原先只留在 debug。
- 主要重複：signature、指令行、函式／activation 欄位。
- 實作邊界：runtime 有界分塊、後端獨立 gzip 分塊索引與串流 JSON 回應；現有事件模型仍會保留完整事件，前端懶載入不是本次已完成能力。

## 修改邊界與依賴
- lib/ASMTrace.hpp、server.js、新增 trace-chunk-store.js；trace-events.js 線性保存鍵、trace-frame-tween.js 的 probe 範圍 marker 索引、trace-rules.js 矩陣 all selector、前端版本號；局部測試及文件。
- 公開 trace schema 保持相容；runtime 中間檔新增 2.0。
- 依賴任務：無。

## 驗收條件
- [x] 棋盤案例編譯成功且顯示 11,000 格與正確紅綠值。
- [x] 新格式解碼與舊 trace 的幀、事件內容、ID、順序完全一致。
- [x] 報告原始、去重、gzip 分塊、索引的實際 bytes。
- [x] 舊 1.0 格式、明確 false 設定、JSON 儲存重開保持相同內容。
- [x] 損毀、參照錯誤及超限不默默略過，HTTP 顯示錯誤。

## 驗證計畫
- V2：格式往返、分塊邊界、損毀、限額；隔離服務執行棋盤 fixture 與最小多幀事件 fixture。
- 主代理：整合時核實相依事件及 keep/loop 類型；不由 gamma 執行完整 regression。
- 隔離：隨機埠、獨立瀏覽器 context，test-results 留本機不提交。

## 變更紀錄
- 2026-09-28：建立定義。
- 2026-09-28：實測新資料進入前端後，applyEnabledStates 對每個事件重新計算 occurrence key，出現 O(n²)；加上線性計數修正，保持保存鍵不變。

- 2026-09-28：第二處大量事件阻塞為 availability 每個事件遍歷全部格子尋找 marker，改用單次 probe 專用索引，不跨場景快取。
- 2026-09-28：實際畫布顏色斷言失敗，原有矩陣 all selector 以整列當 value；修正為逐格套用，未移除或放寬顏色斷言。
