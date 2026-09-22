# marker-entrance-reflow-sync：指標入場與同格讓位同步

## 任務資訊
- 負責代理：主代理 beta
- 狀態：待交付
- 共同基準 commit：0074069
- 分支：intergration
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\intergration

## 問題與預期結果
- 情境與操作：播放 bottom-up heapify 範例第 5 到第 6 幀，新的 `i` 指標準備進入 `heap[5]`。
- 目前行為：`i` 尚未開始入場，既有的 `now` 已先向右讓位。
- 使用者希望的結果：`now` 在 `i` 入場前維持原位；`i` 開始入場時兩者才同步重排。
- 本次範圍與必要限制：保留既有 8px 同格間距、由上方淡入及指標重排時間；不改一般跨格賦值 D04 規則。

## 需求確認
- 已從使用者或上下文確認：使用者要求先依上述方法修正；只處理尚未入場指標造成的提前讓位。
- 尚待使用者回答：無。
- 代理採用的合理假設：無。

## 重現與調查
- 最小操作步驟或 fixture：使用使用者提供的 bottom-up max heapify 程式與輸入，觀察第 5 到第 6 幀。
- 重現狀態：已從排程與既有專項測試確認。
- 已確認事實：`createPlaybackPlan` 原本將 marker group reflow 排在新 marker 入場前 80ms；這個 lead 直接造成 `now` 提前偏移。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/trace-frame-tween.js`、`algo-vis-backend/tests/unresolved-markers.test.js`。
- 共用檔案／介面與協調結果：調整共用播放排程；不更改 trace 資料格式。
- 依賴任務：無。

## 驗收條件
- [x] 新 marker 入場開始前，同格既有 marker 保持原位。
- [x] 新 marker 入場與同格 marker 讓位在同一時間開始。
- [x] 兩段動畫完成後才開始後續 trace 事件。

## 驗證計畫
- 子代理小驗證：不適用，本次由主代理直接修正；執行 JavaScript 語法檢查與 `unresolved-markers.test.js` 的同格入場排程專項案例。
- 主代理整合驗收：核對排程 phase 起點與總時間；不執行完整 regression。
- 測試隔離方式：只執行不操作使用者分頁的 Node 專項測試。

## 變更紀錄
- 2026-09-23：初始定義；將同格讓位與 marker 入場改為同步開始。
