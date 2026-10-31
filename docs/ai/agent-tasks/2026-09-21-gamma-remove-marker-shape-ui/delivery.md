# 2026-09-21-gamma-remove-marker-shape-ui 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-21-gamma
- 共同基準 commit：2cb0409d1fd430d1fabea1feb5885e908da02236
- 程式修正 commit：0378af9436f457d6e0fbb8e3fb5b1e62cba36166
- 驗證時的 HEAD 與未提交修改：0378af9436f457d6e0fbb8e3fb5b1e62cba36166；程式驗證時無未提交修改
- 驗證日期：2026-09-21

## 根因與修改
- 已確認根因與證據：Trace Studio 物件面板仍動態建立「註標形狀」區塊，並維護只供該區塊使用的狀態、切換函式與 104 行 CSS。
- 修正方式與行為變化：移除整個控制區塊、專用狀態、render/set 函式與樣式；右欄不再顯示「原始陣列／箭頭註標」選項。
- 修改檔案及用途：`trace-studio.js` 移除 UI；`trace-studio.css` 移除專用樣式；`algorithm.html` 更新快取版本；`entrypoints.test.js` 驗證新版本且舊 UI 不回歸。
- README／版本紀錄／使用說明更新：不適用；任務與候選舊介面盤點記錄於 task.md。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 不再建立「註標形狀」區塊 | 入口測試檢查 UI 建構來源 | 區塊不存在 | 通過 |
| 專用程式碼與 CSS 移除 | `rg` 與入口測試 | 專用符號及 selector 均不存在 | 通過 |
| 保留舊 markerShape 相容性 | 差異審查與相容性測試 | 載入、同步及 renderer 所需欄位仍存在；整合測試受 API 限流未完整跑完 | 未驗證 |
| 提供其他候選舊介面清單 | task.md 盤點 | 已列出 6 項用途與移除影響 | 通過 |

## 小驗證與重跑方式
### 語法與入口測試
- 目的與對應條件：確認 Trace Studio 語法有效、入口載入新資源，且舊控制介面不再建立。
- 執行目錄與必要環境設定：`algo-vis-backend`；Node.js。
- 測試資料／fixture：既有 entrypoints fixture。
- 完整指令或操作步驟：`node --check public/trace-studio.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：1 entrypoint test passed；語法與 diff 檢查通過，exit code 0。
- 證據位置：終端摘要與已提交測試。

### Marker 相容性聚焦測試
- 目的與對應條件：確認移除控制介面後 marker assignment 與舊資料行為不受影響。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試透過本機編譯 API 建立 trace。
- 測試資料／fixture：`heap-marker-assignment.integration.test.js`。
- 完整指令或操作步驟：`node --test tests/heap-marker-assignment.integration.test.js`
- 預期結果：19 項全部通過。
- 實際結果與 exit code（適用時）：前 10 項通過；後 9 項收到 `請求過於頻繁，請稍後再試`，測試程序 exit code 1。
- 證據位置：終端摘要；未將限流項目標記為通過。

### Gamma 預覽服務
- 目的與對應條件：提供新分支版本供主代理及使用者檢查。
- 執行目錄與必要環境設定：新 gamma worktree，PORT 3103；依 lockfile 安裝本 worktree 依賴，使用未寫入檔案的本機 JWT_SECRET。
- 測試資料／fixture：無。
- 完整指令或操作步驟：啟動 3103；請求 `/algorithm.html`；核對 CSS/JS 版本。
- 預期結果：HTTP 200，載入 `trace-studio.css?v=trace-52` 與 `trace-studio.js?v=trace-122`。
- 實際結果與 exit code（適用時）：HTTP 200，兩項版本皆存在；監聽 PID 42656。
- 證據位置：http://localhost:3103/algorithm.html

## 剩餘事項與合併注意
- 未驗證項目及原因：舊 deck 實際 `markerShape: arrow` 載入未完成自動整合驗證，因本機編譯 API 限流；需由主代理補驗證。
- 已知問題或風險：使用者之後無法從此舊介面切換 markerShape；既有資料仍照原值呈現。
- 相依與衝突注意：`algorithm.html`、`trace-studio.js/css` 與入口測試為共用檔案，整合時保留較新快取版本及其他代理新增功能。
- 主代理需補驗證的情境：載入含箭頭 markerShape 的舊 deck 確認呈現；選取位置綁定物件確認「註標形狀」區塊消失。

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
