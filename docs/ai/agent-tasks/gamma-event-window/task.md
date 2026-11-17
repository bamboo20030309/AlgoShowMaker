# gamma-event-window：只追蹤第一幀至最後一幀之間的事件

## 任務資訊
- 負責：gamma；狀態：待交付。
- 基準：603de09130f6fb5f6d593023571e039f7d0fff50；分支 codex/2026-09-22-gamma。
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-22-gamma

## 問題與預期結果
- 使用者要求首次實際 frame 前及最後實際 frame 後的事件不追蹤。
- 第一幀直接載入狀態且不含前置事件；其餘每幀保留前一幀至本幀間的事件。
- 必須依動態執行順序而非原始碼行號。相同 @frame 在迴圈反覆執行仍保留中間事件。
- 無待確認問題。程式執行中不能預知最後一幀，因此尾端先暫存，只有下一幀才確認；結束時丟棄尾端分塊。
- 舊儲存 trace 不自動刪除其事件；本次變更作用於重新 RUN 的 runtime 輸出，保留 schema 相容性。

## 修改邊界
- ASMTrace.hpp：首幀前不編碼事件欄位、事件區間提交及尾端截斷，必要生命週期／遞迴上下文照常更新。
- 相關局部測試、說明及交付文件。不修改事件播放順序或動畫效果。runtime frame 增加可選 initialKeeps 初始場景資料，仍接受舊 schema 及缺少此欄位的檔案。

## 驗收條件
- [x] 無 frame／單 frame 的最終事件數皆為0；snapshot／程式輸出正確。
- [x] 多 frame 只保留中間事件，次序、before/after 與副作用正確。
- [x] 尾端跨塊或超限不污染前面有效幀；中間區間超限仍報錯。
- [x] 舊 trace 自訂值／false 經載入、使用、存檔重開仍保留。
- [x] 使用者棋盤範例 state／顏色保持，事件降為0；記錄檔案大小與時間。

## 驗證計畫
V2，C++ runtime 邊界測試及獨立服務瀏覽器的小案例，必要時相關單一 sorting ordered-events fixture；不跑完整 regression。隨機埠及獨立瀏覽器，完成後重啟自己的3103，commit及push gamma。

## 變更紀錄
- 2026-09-28：初始定義。

- 2026-09-28：調查確認首幀前 @keep 會影響場景，改保留為 initialKeeps，不納入動畫事件；正常結束時截斷尾端已寫出分塊。V2 小驗證通過。
