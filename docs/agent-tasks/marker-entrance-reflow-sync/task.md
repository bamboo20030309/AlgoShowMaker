# marker-entrance-reflow-sync：指標入場與同格讓位同步

## 任務資訊
- 負責代理：主代理 beta
- 狀態：開發中
- 共同基準 commit：0074069
- 分支：intergration
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\intergration

## 問題與預期結果
- 情境與操作：播放 bottom-up heapify 範例第 5 到第 6 幀，新的 `i` 指標準備進入 `heap[5]`。
- 目前行為：呼叫端 `i` 在被呼叫函式的 `now` 尚未完成移動與退場前，已先參與 `heap[5]` 的排列，造成 `now` 無故向右偏移。
- 使用者希望的結果：先依事件順序完成 `now` 的賦值移動與退場，再讓呼叫端 `i` 進入 `heap[5]`；未入場的指標不得參與讓位。
- 本次範圍與必要限制：保留既有 8px 同格間距、由上方淡入及指標重排時間；不改一般跨格賦值 D04 規則。

## 需求確認
- 已從使用者或上下文確認：使用者要求先依上述方法修正；只處理尚未入場指標造成的提前讓位。
- 尚待使用者回答：無。
- 代理採用的合理假設：無。

## 重現與調查
- 最小操作步驟或 fixture：使用使用者提供的 bottom-up max heapify 程式與輸入，觀察第 5 到第 6 幀。
- 重現狀態：已從排程與既有專項測試確認。
- 已確認事實：移除 80ms lead 只能讓一般同格入場同步；跨函式返回時，播放器仍在 trace 事件前建立呼叫端 `i`，使它在 `now` 退場前參與同格排列。該幀事件順序是 `now = largest`、函式退場、`now` scope exit，之後才應顯示呼叫端 `i`。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/trace-frame-tween.js`、`algo-vis-backend/tests/unresolved-markers.test.js`。
- 共用檔案／介面與協調結果：調整共用播放排程；不更改 trace 資料格式。
- 依賴任務：無。

## 驗收條件
- [ ] `now` 的賦值移動與退場完成前，呼叫端 `i` 不入場且不參與 `heap[5]` 的讓位。
- [ ] `now` 退場完成後，`i` 才由穩定位置進入 `heap[5]`。
- [ ] 一般同格新增指標仍維持入場與讓位同步開始。

## 驗證計畫
- 子代理小驗證：不適用，本次由主代理直接修正；執行 JavaScript 語法檢查與 `unresolved-markers.test.js` 的同格入場排程專項案例。
- 主代理整合驗收：核對事件 barrier、延後入場 phase 與總時間，並在 3100 重播使用者的 bottom-up heapify 範例；不執行完整 regression。
- 測試隔離方式：只執行不操作使用者分頁的 Node 專項測試。

## 變更紀錄
- 2026-09-23：初始定義；將同格讓位與 marker 入場改為同步開始。
- 2026-09-23：使用者回報原案例仍發生；改為依實際事件順序，將會取代同格退場指標的呼叫端指標延後到退場 barrier 後入場。
