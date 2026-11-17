# 2026-09-23-gamma-array-value-scale：陣列內容編輯保留比例

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：07726ba99209aab557879f0fd1776ed77cec73a7
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：先調整一般陣列 structure 的顯示比例，再直接編輯任一格內容。
- 目前行為：完成內容編輯後，陣列尺寸及格子比例回到自然預設值。
- 使用者希望的結果：內容更新後維持編輯前的陣列比例。
- 本次範圍與必要限制：一般線性 structure 的格子內容儲存；不執行大規模驗證。

## 需求確認
- 已從使用者或上下文確認：陣列內容編輯不得重設既有比例。
- 尚待使用者回答：無。
- 代理採用的合理假設：雙擊直接編輯與右鍵選單儲存共用 `item-save`，應維持一致行為。

## 重現與調查
- 最小操作步驟或 fixture：載入已保存自訂尺寸的三格陣列，雙擊第一格將 `5` 改成 `55`。
- 重現狀態：已重現。
- 已確認事實：`item-save` 是唯一刻意停用 `preserveScale` 的線性 structure 更新路徑，會將 284×172 重算為 142×86。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.js`、入口資源版本及 `tests/structure-length-zero.browser.test.js`。
- 共用檔案／介面與協調結果：沿用既有 `updateSelectedStructure(..., { preserveScale: true })`，不新增資料格式。
- 依賴任務：無。

## 驗收條件
- [x] 編輯自訂比例陣列的格子內容後，儲存的寬高及畫面格子比例維持不變。
- [x] 新值正確保存，後續增減長度仍維持相同比例。

## 驗證計畫
- 子代理小驗證：JavaScript 語法、入口測試及單一 structure 瀏覽器測試。
- 主代理整合驗收：整合後人工調整陣列比例並編輯格子值，確認比例及儲存。
- 測試隔離方式：隨機埠、獨立無頭瀏覽器與本機 fixture，不操作使用者投影片。

## 變更紀錄
- 2026-09-23：依使用者回報建立任務並完成最小重現。
