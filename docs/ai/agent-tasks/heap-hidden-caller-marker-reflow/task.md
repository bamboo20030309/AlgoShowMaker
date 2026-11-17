# heap-hidden-caller-marker-reflow：避免未入場 caller 指標提前觸發讓位

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：c939917827bf110fa98654cc93fe683d96172844
- 分支：codex/2026-09-21-beta-BIT
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-21-beta

## 問題與預期結果
- 情境與操作：執行 bottom-up heapify 最小範例，停在第五幀後按下一步，callee 的 `now` 即將賦值並退場，caller 的 `i` 之後才恢復顯示。
- 目前行為：`i` 尚未入場就被納入同格指標排列，導致原本單獨位於 `heap[5]` 的 `now` 先向右讓位。
- 使用者希望的結果：`i` 實際入場前不得影響 `now` 的位置；事件仍依序播放，`now` 完成賦值與退場後才顯示 `i`。
- 本次範圍與必要限制：只修正跨函式返回時延遲入場指標與離場指標的排程；使用 beta 的 3102 預覽及最小案例驗證，不執行完整 regression。

## 需求確認
- 已從使用者或上下文確認：尚未入場的指標不參與讓位；本次應使用 beta 的 3102；修正完成後推送分支供主代理查看。
- 尚待使用者回答：無。
- 代理採用的合理假設：延遲入場的判定沿用事件時間線中同一格舊生命週期的賦值／位置／退場終點，避免另建與事件順序相衝突的時間來源。

## 重現與調查
- 最小操作步驟或 fixture：載入 `algo-vis-backend/tests/fixtures/heap-caller-marker-reentry.cpp`，輸入 `10` 與 `10 67 24 1 5 36 5 11 24 100`，RUN 後選第五幀並按下一步。
- 重現狀態：已重現。
- 已確認事實：修正前 3102 的第五幀 `now.x` 為 578.936；轉場約 211ms 時，尚未入場的 `i` 已參與目的格排列，使 `now.x` 變為 588.504。根因是離場 ghost 的 peer 掃描使用完整 current frame 元素，未排除仍在事件 barrier 後的 caller 指標。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/trace-frame-tween.js`、`tests/unresolved-markers.test.js`，並新增 heap 最小 fixture 與瀏覽器專項測試。
- 共用檔案／介面與協調結果：新增內部 helper `deferredMarkerEntranceBarriers`；不改 trace 文件格式或使用者指令。
- 依賴任務：無。

## 驗收條件
- [ ] 第五幀按下一步後，`i` 尚未入場期間，`now` 不因 `i` 而向右讓位。
- [ ] `now` 完成事件排程後，`i` 才在同格入場並位於單一指標的中央位置。
- [ ] 現有 unresolved marker 排程專項測試仍通過。

## 驗證計畫
- 子代理小驗證：JS 語法與 diff 檢查；`unresolved-markers.test.js`；3102 上的專項瀏覽器最小案例；人工逐毫秒座標抽樣。
- 主代理整合驗收：合併後以相同 heap fixture 重跑第五至第六幀，並留意其他跨函式返回的同格指標生命週期。
- 測試隔離方式：使用 beta worktree 與 3102；瀏覽器專項建立獨立 headless Edge context，不操作使用者分頁或投影片。

## 變更紀錄
- 2026-09-23：依使用者重新確認的根因建立最小案例；驗收基準改為尚未入場的 caller 指標完全不參與離場 marker 的排列。
