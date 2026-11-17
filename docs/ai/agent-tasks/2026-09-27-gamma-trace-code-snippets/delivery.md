# 2026-09-27-gamma-trace-code-snippets 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：e558f27fd6e7463af2a458daedf42a301d1046e0
- 程式修正 commit：509ec89b068a3f663626c5fee5280bd3240dd31b、3dafe08456cff560e755475ab6ed6c596c6bebff
- 驗證時的 HEAD 與未提交修改：3dafe08456cff560e755475ab6ed6c596c6bebff；程式碼驗證時只剩本交付紀錄的更新
- 驗證日期：2026-09-27

## 根因與修改
- 已確認根因與證據：原本 `ASMTraceCodeModel.planFrame` 只輸出自動挑選的展示片段，Trace Studio 沒有逐幀的程式碼收錄介面，也沒有保存逐行選擇的位置。
- 修正方式與行為變化：新增「程式碼」頁籤，固定顯示完整原始碼並讓每行成為獨立按鈕；目前幀自動片段預設為綠色，其他行透明。事件來源範圍以螢光黃色標示，相鄰範圍合併成連續色塊；含事件行排除前會再次確認。自訂選擇存入 `studio.codeSnippetOverrides` 並立即更新 code presenter。
- 修改檔案及用途：`trace-code-model.js` 建立完整原始碼列與覆寫模型；`trace-studio.js`、`trace-studio.css` 建立互動介面；`trace-view-source.js` 保存及還原逐幀設定；`algorithm.html` 更新資源版本；專項測試覆蓋模型、保存及瀏覽器操作。
- README／版本紀錄／使用說明更新：本次屬 Trace Studio 介面功能，已新增 task 與 delivery 紀錄；README 不需調整。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 完整程式碼以一行一按鈕顯示 | model 專項與 headless Edge 檢查 `#include`、`return 0`、列數及按鈕 | 完整原始碼列持續顯示 | 通過 |
| 只勾選目前幀自動片段 | model 比對 automatic plan；瀏覽器檢查透明未收錄列 | 自動片段綠色，其餘列透明且仍可見 | 通過 |
| 事件 expression 為連續黃色標記 | headless Edge 檢查色彩與相鄰 `mark` | 顏色為 `rgb(255, 244, 92)`，無相鄰分裂標記 | 通過 |
| 一般行切換及事件行確認 | headless Edge 實際點擊 | 一般行直接切換；事件行先顯示確認 | 通過 |
| 新舊設定與重載相容 | model 與 view-source 專項 | 缺少新欄位維持自動結果；自訂值可保存重載 | 通過 |
| 復原、重做與恢復自動篩選 | 瀏覽器專項與既有歷史機制接線檢查 | 恢復自動篩選後事件行重新開啟 | 通過 |
| 事件間隔時間只位於事件頁籤 | headless Edge 檢查父層、排列順序與切換頁籤後的可見性 | 位於事件程式碼上方；切換到程式碼頁籤後隱藏 | 通過 |

## 小驗證與重跑方式
### 程式碼片段模型與儲存
- 目的與對應條件：確認完整原始碼列、當前幀勾選、舊 Trace 相容及設定保存。
- 執行目錄與必要環境設定：`algo-vis-backend`；既有 Node.js 環境。
- 測試資料／fixture：測試內建 C++ source、單一 write 事件與逐幀設定。
- 完整指令或操作步驟：`node --test tests/trace-code-snippet.test.js tests/view-source-compaction.test.js tests/event-code-tree.test.js tests/entrypoints.test.js`
- 預期結果：全部專項通過。
- 實際結果與 exit code（適用時）：15 項通過，exit code 0。
- 證據位置：測試檔隨 commit 提交；命令輸出僅保留於本次任務紀錄。

### Trace Studio 瀏覽器操作
- 目的與對應條件：確認完整程式碼顯示、綠色／透明狀態、黃色連續標記、逐行切換、事件行確認及恢復自動篩選。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行使用隔離隨機埠及 headless Edge。
- 測試資料／fixture：測試內建 compare、swap 程式及分析結果。
- 完整指令或操作步驟：`node --test tests/trace-code-snippet.browser.test.js`
- 預期結果：瀏覽器專項通過。
- 實際結果與 exit code（適用時）：1 項通過，exit code 0。
- 證據位置：`tests/trace-code-snippet.browser.test.js`；未保留暫存瀏覽器產物。

### 語法、差異與本機服務
- 目的與對應條件：確認前端語法、差異格式及 3103 載入本次資源。
- 執行目錄與必要環境設定：專案 worktree。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/trace-code-model.js`、`node --check public/trace-studio.js`、`git diff --check`；重啟 3103 後要求 `algorithm.html`。
- 預期結果：語法與差異檢查通過；HTTP 200 且載入 `trace-123`、`code-26`。
- 實際結果與 exit code（適用時）：全部通過；3103 PID 72976，HTTP 200。
- 證據位置：本機服務即時狀態；未提交 server log。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression 或大規模演算法驗證，依使用者指示與 V2 分級不執行。
- 已知問題或風險：無。
- 相依與衝突注意：`trace-code-model.js`、`trace-studio.js`、`trace-studio.css`、`trace-view-source.js` 若整合分支已有變更，需保留本次新增的 `codeSnippetOverrides` 與資源版本順序。
- 主代理需補驗證的情境：整合後以多幀 compare／swap 實際播放，確認跨幀切換及 code presenter 更新。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
