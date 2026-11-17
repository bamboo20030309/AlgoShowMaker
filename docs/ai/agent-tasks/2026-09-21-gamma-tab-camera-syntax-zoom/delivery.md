# 2026-09-21-gamma-tab-camera-syntax-zoom 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-21-gamma
- 共同基準 commit：4145c160aa268ea20988da088efa4e1f1b6e0567
- 程式修正 commit：f8efbb16e40d2c5888363e21f9cefb34851a853f
- 驗證時的 HEAD 與未提交修改：f8efbb16e40d2c5888363e21f9cefb34851a853f；程式驗證時無未提交修改
- 驗證日期：2026-09-21

## 根因與修改
- 已確認根因與證據：`front.js` 在每次回到畫布時呼叫 `setAutoCamera(1.0, false)`，依當前物件邊界重新置中並覆蓋原鏡頭。`syntax-tree.js` 將 viewBox 寬度硬限制在 base width 與 base width 3.5%／節點寬度之間。
- 修正方式與行為變化：離開畫布時保存 `getCameraViewport()` 的中心與倍率，返回後於下一個 animation frame 以 `setCamera()` 恢復；語法樹改為依滾輪倍率持續縮放，只拒絕非有限或非正數 viewBox。
- 修改檔案及用途：`front.js` 保存／恢復鏡頭；`syntax-tree.js` 移除縮放限制；`algorithm.html` 更新快取版本；入口及瀏覽器測試驗證行為。
- README／版本紀錄／使用說明更新：不適用；既有操作不變。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 輸入分頁往返保留鏡頭 | 獨立瀏覽器比較中心與倍率 | 誤差小於 0.001 | 通過 |
| 輸出分頁往返保留鏡頭 | 獨立瀏覽器比較中心與倍率 | 誤差小於 0.001 | 通過 |
| 除錯紀錄往返保留鏡頭 | 獨立瀏覽器比較中心與倍率 | 誤差小於 0.001 | 通過 |
| 語法樹往返保留鏡頭 | 獨立瀏覽器比較中心與倍率 | 誤差小於 0.001 | 通過 |
| 語法樹無產品縮放上下限 | fixture 滾輪縮放 viewBox | 可超出 fitted width，亦可小於舊 3.5% 下限 | 通過 |

## 小驗證與重跑方式
### 分頁鏡頭與語法樹縮放瀏覽器測試
- 目的與對應條件：驗證四個分頁往返的鏡頭狀態，以及語法樹解除上下限。
- 執行目錄與必要環境設定：`algo-vis-backend`；隨機本機埠、獨立 headless Edge、測試用 JWT secret。
- 測試資料／fixture：攔截 `/syntax-tree` 回傳三節點 AST；畫布鏡頭設為中心 `(321.25, -147.5)`、倍率 `1.73`。
- 完整指令或操作步驟：`node --test tests/tab-camera-syntax-tree.browser.test.js`
- 預期結果：1 項通過。
- 實際結果與 exit code（適用時）：1 test passed，exit code 0。
- 證據位置：終端摘要與已提交測試。

### 語法、入口與差異檢查
- 目的與對應條件：確認腳本語法、入口快取版本與修改格式。
- 執行目錄與必要環境設定：`algo-vis-backend` 及 worktree 根目錄。
- 測試資料／fixture：既有 entrypoints fixture。
- 完整指令或操作步驟：`node --check public/front.js`；`node --check public/syntax-tree.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：語法通過；1 entrypoint test passed；diff check 無錯誤，exit code 0。
- 證據位置：終端摘要。

### Gamma 預覽服務
- 目的與對應條件：提供修正版本供主代理與使用者檢查。
- 執行目錄與必要環境設定：gamma worktree，PORT 3103。
- 測試資料／fixture：無。
- 完整指令或操作步驟：核對舊 PID 42656 後重啟；請求 `/algorithm.html` 並核對版本。
- 預期結果：HTTP 200，載入 `syntax-tree.js?v=syntax-3` 與 `front.js?v=random-id-35`。
- 實際結果與 exit code（適用時）：HTTP 200，兩個版本皆存在；新 PID 28180。
- 證據位置：http://localhost:3103/algorithm.html

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression 或大規模動畫驗證，依使用者要求及子代理驗證分級。
- 已知問題或風險：極端滾輪縮放仍受 JavaScript 浮點數可表示範圍限制；遇到非有限值時保持上一個有效 viewBox。
- 相依與衝突注意：`front.js`、`algorithm.html` 與入口測試為共用檔案，整合時保留較新的版本字串及其他代理變更。
- 主代理需補驗證的情境：在實際動畫畫布以滑鼠平移／縮放後逐一切換四個分頁；大型 AST 連續縮放及拖曳。

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
