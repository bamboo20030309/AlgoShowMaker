# alpha-auto-fixed：切幀自動固定標記消失

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：2eaf50c13424834622727d03d75b256e96edc499
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows

## 問題與預期結果
- 情境與操作：一般播放切幀，自動固定標記偶爾消失；通常按編輯動畫後恢復。
- 目前行為：隔離重現確認動畫切幀固定標記全部消失，開Studio即恢復。
- 使用者希望的結果：已完成格子的固定標記在一般播放與Studio一致；提出指定陣列的來源指令設計。
- 本次範圍與必要限制：修正固定狀態呈現，不改最後存取判定或C++演算法；指令先提出設計，尚未要求採用特定語法。

## 需求確認
- 已確認：使用者要求調查並修正；程式修正小驗證後push供主代理查看。
- 尚待使用者回答：無；若隔離案例無法對應現象，再索取必要素材。
- 代理採用的合理假設：以有條件style的最小陣列案例核對切幀與開Studio差異，回看時依目的幀累積狀態。

## 重現與調查
- 最小操作步驟或fixture：tests/fixtures/auto-fixed-playback.cpp，RUN後切換幀並開Studio比較SVG綠色固定標記。
- 重現狀態：已重現。
- 已確認事實：renderer初次繪圖合併固定事件與style；tween重新求style時只有Rules.evaluate結果，可能覆蓋固定標記。
- 尚待調查：無；主代理整合驗收仍待核實。
- 修正事實：renderer與tween共用evaluateFrameHighlights，包含累積fixedMark；固定mark沿用既有SVG節點，避免style刷新隱藏或提早重建當幀待揭露標記。
- 指令設計提案（尚未實作）：`@autofix isprime` 指定本幀可呈現固定標記的陣列，逗號多陣列、`@autofix none` 禁用本幀；preset/defaults可共用。沒有指令時沿用既有全域設定；按runtime identity處理別名，僅過濾呈現、不改最後存取分析。與手動`@style ... mark`及runtime事件animate開關分開。

## 修改邊界與依賴
- 預計修改檔案或模組：trace-renderer.js、trace-frame-tween.js、入口cache與專項測試／文件。
- 共用檔案／介面與協調結果：沿用alpha隔離worktree，不改main；若新增共用highlights helper，同步renderer與tween呼叫。
- 依賴任務：現有alpha文字／箭頭修改已在本分支，主代理按分支整體差異核實。

## 驗收條件
- [x] 一般前進、後退與JSON重載切幀的固定標記與同幀靜態重繪相同。
- [x] 開啟編輯動畫前後的固定標記相同；當幀新固定標記仍等轉場完成後揭露。
- [x] 關閉自動固定與手動mark／focus的原有行为保留。

## 驗證計畫
- 子代理小驗證：V2 H/J，JS語法與差異、專項實際SVG切幀／Studio／重載，按需選event-defaults與直接相關style案例。
- 主代理整合驗收：核實修正與使用者線篩／演算法投影片的相同幀切換，按影響範圍决定驗證。
- 測試隔離方式：本worktree隨機埠服務與獨立headless Edge，不操作使用者分頁或deck。

## 變更紀錄
- 2026-09-18：初始定義，指定陣列指令先調查既有機制並提出設計。
- 2026-09-18：隔離SVG確實重現轉場後所有固定標記消失、Studio重繪恢复；修正共享highlights與固定節點保留。10個相關案例、3個JS語法及差異檢查通過，未跑完整regression，主代理核實待填。
