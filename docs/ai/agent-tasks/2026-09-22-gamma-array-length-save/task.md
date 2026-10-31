# 2026-09-22-gamma-array-length-save：直接輸入陣列長度後儲存

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：102a6ef9a5dd5f770e43d2df5e76a4b0d75bec0a
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：投影片編輯器選取陣列，在左側長度欄直接輸入數字，未按 Enter、未離開欄位。
- 目前行為：欄位只監聽 `change`；輸入後陣列內容與草稿仍維持舊長度。
- 使用者希望的結果：直接修改數字後，陣列長度自動更新並保存；重開投影片保留新長度。
- 本次範圍與必要限制：非動畫投影片編輯行為；依 V1 進行局部驗證，不跑大規模驗證。

## 需求確認
- 已從使用者或上下文確認：直接修改長度數字後應儲存；修正後推送供主代理核實。
- 尚待使用者回答：無
- 代理採用的合理假設：輸入後短暫停頓自動提交，Enter 或離開欄位仍立即提交；輸入過程的暫時空值不改動陣列。

## 重現與調查
- 最小操作步驟或 fixture：使用 `structure-length-zero.browser.test.js` 的本地三格陣列；在長度欄填入 5，不按 Enter，觀察陣列和草稿。
- 重現狀態：已重現（既有事件處理只有 `change`，未提交時不更新）。
- 已確認事實：`updateSelectedStructureLength` 會變更內容並呼叫 `saveDeck`；但僅在 `change` 時執行。既有測試只涵蓋 Enter。
- 尚待調查：無

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/slides.js`、`slides.html`、相關局部測試及本任務文件。
- 共用檔案／介面與協調結果：未變更資料格式或其他共用介面。
- 依賴任務：無

## 驗收條件
- [ ] 直接輸入陣列長度且不按 Enter，陣列更新，草稿及重載後的長度一致。
- [ ] 逐位輸入兩位數可得到完整數值，Enter 提交與既有補零／截短行為仍正常。

## 驗證計畫
- 子代理小驗證：JS 語法、差異檢查、專項 Structure 長度瀏覽器測試及入口版本測試。
- 主代理整合驗收：核實直接輸入長度後的陣列與儲存狀態；本修正不涉及動畫。
- 測試隔離方式：專項測試用隨機埠與獨立 browser page，內建 deck fixture；不操作使用者資料。

## 變更紀錄
- 2026-09-22：依使用者回報定義長度欄輸入後自動儲存的行為。
