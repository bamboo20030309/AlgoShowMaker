# 2026-09-28-gamma-shared-code-snippets：同指令程式碼片段與寬版編輯

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b89c10a49b56941c86a52d08af86c622072d2a1e
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：在 Trace Studio 編輯某條 `@frame` 指令產生之幀的程式碼片段，或閱讀較長的程式碼行。
- 目前行為：手動收錄狀態以 frame ID 個別保存；同一條指令反覆執行產生的後續幀不會同步。右側欄只有固定 300px，程式碼會大量自動換行。
- 使用者希望的結果：自動篩選始終產生每幀明確的 true／false；手動調整後套用到同一條來源指令的所有幀。程式碼維持一行一列，可水平捲動，狀態與行號固定，右欄可調寬並保存，另可切換專注檢視。
- 本次範圍與必要限制：Trace Studio 程式碼片段模型、來源設定保存及右側介面；不改事件排程、演算法執行或畫布動畫。

## 需求確認
- 已從使用者或上下文確認：同一來源指令產生的幀共用手動片段選擇；沒有手動設定時由自動篩選直接決定 true／false；採用不換行、水平捲動、固定 gutter、可調寬及專注檢視。
- 尚待使用者回答：無。
- 代理採用的合理假設：同一來源指令以既有 `sourceSelector`／`sourceMatches` 判定，行號移動時使用 stable directive key；舊逐幀設定繼續載入，新來源層級設定優先。

## 重現與調查
- 最小操作步驟或 fixture：在迴圈中的同一 `@frame` 所產生第一幀排除一行，再切換到下一個相同來源幀；目前下一幀不受影響。將長行放入片段編輯器，目前 CSS `white-space: pre-wrap` 會折行。
- 重現狀態：已重現。
- 已確認事實：現況儲存在 `trace.studio.codeSnippetOverrides[frame.id]`；既有 view-source 已能以穩定來源 selector 對應同一指令；右欄 grid 固定為 300px。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`trace-code-model.js`、`trace-studio.js`、`trace-studio.css`、`algorithm.html`、相關模型／保存／瀏覽器測試及入口快取檢查。
- 共用檔案／介面與協調結果：新增 `studio.codeSnippetSourceOverrides`，每筆含 source selector 與以來源文字身分為 key 的明確 boolean。
- 依賴任務：沿用 `ASMTraceViewSource.sourceSelector`／`sourceMatches`、`@asm-view` 編解碼與現有逐幀設定相容層。

## 驗收條件
- [x] 沒有手動設定時，每一幀仍由自動篩選得到明確收錄／不收錄狀態。
- [x] 手動切換一行後，同一 `@frame` 指令產生的所有幀同步；其他指令不受影響。
- [x] 來源層級設定經 `@asm-view` 保存、重新 RUN 及來源行位移後仍可還原。
- [x] 舊逐幀 `codeSnippetOverrides` 可繼續載入。
- [x] 長程式碼不換行，程式碼區可水平捲動，狀態與行號在捲動時固定。
- [x] 右側欄可拖曳與鍵盤調寬，寬度於瀏覽器保存；專注檢視可進入、退出並維持目前幀。
- [x] 程式碼從左側固定欄後開始並保留原始縮排；純註解列與空白列不出現在片段編輯器。
- [x] 關閉含事件動畫的程式碼列時立即關閉，不顯示二次確認。
- [x] 兩個已顯示程式碼行之間若只有空白或註解，不插入省略符號；存在未顯示的 C++ 程式碼時才插入。

## 驗證計畫
- 子代理小驗證：修改檔案語法；程式碼片段模型、view-source 往返、Trace Studio 專項 headless Edge、入口快取及 diff 檢查。
- 主代理整合驗收：以 LCS 建表同一 `@frame` 的多個幀實際調整片段，重新 RUN 後確認；檢查長行、拖曳寬度與專注檢視。
- 測試隔離方式：瀏覽器專項使用隨機埠與測試 fixture，不操作使用者分頁或既有資料。

## 變更紀錄
- 2026-09-28：依使用者確認實作來源指令共用片段選擇與寬版編輯介面。
- 2026-09-28：依實際畫面回報修正列靠右與固定欄捲動偏移，並排除純註解列與空白列。
- 2026-09-28：依 LCS 案例移除事件列關閉警告，省略符號改以實際未收錄程式碼判定。
