# 2026-09-19-gamma-structure-length-zero 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：29054a9636cd76df9780cc1976fbdc712f5b44bd
- 程式修正 commit：fabb4bab153b6c3b80548abbdea9e59f04322481
- 驗證時的 HEAD 與未提交修改：fabb4bab153b6c3b80548abbdea9e59f04322481；程式驗證時無未提交修改
- 驗證日期：2026-09-19

## 根因與修改
- 已確認根因與證據：heap、segment tree、BIT 的 SVG 格子索引已為零起算；編輯事件仍額外減 1，因此 heap 索引 2 寫入索引 1。
- 修正方式與行為變化：移除多餘索引位移；線性 structure 左側新增長度欄位，擴長補 0、縮短截尾；所有 structure 新建內容及新增格子／節點改以 0 初始化。
- 修改檔案及用途：`public/slides.js` 實作行為、`public/slides.html` 加入欄位及更新資源版本、`tests/structure-length-zero.browser.test.js` 驗證行為、`tests/entrypoints.test.js` 更新入口版本斷言。
- README／版本紀錄／使用說明更新：不適用；介面欄位自帶「長度」標示，無新增操作流程。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| heap 只更新被點擊格子 | 雙擊 heap 索引 2，輸入 99 並讀回 deck | `10, 20, 30, 40` 變為 `10, 20, 99, 40` | 通過 |
| 線性 structure 可調長度 | 將 Array 長度由 3 改 5，再改 2 | 先為 `5, 6, 7, 0, 0`，再為 `5, 6` | 通過 |
| 新 structure 內容為 0 | 從 Structure 選單新建 Array | 七個元素皆為 0 | 通過 |
| 既有 structure 與入口正常 | 重跑 structure annotations 與 entrypoints | 兩者通過 | 通過 |

## 小驗證與重跑方式
### Structure 編輯與長度聚焦瀏覽器測試
- 目的與對應條件：驗證 heap 命中格、長度增減及新建零值。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行使用隨機埠與 Chromium/Edge。
- 測試資料／fixture：測試內建 heap 與 Array deck。
- 完整指令或操作步驟：`node --test tests/structure-length-zero.browser.test.js`
- 預期結果：1 個測試通過。
- 實際結果與 exit code（適用時）：1 passed，exit code 0。
- 證據位置：終端測試摘要；測試檔已提交。

### 既有 structure 註標與入口檢查
- 目的與對應條件：確認共用 structure 編輯路徑與資源入口未退化。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：既有測試 fixture。
- 完整指令或操作步驟：`node --test tests/structure-annotations.browser.test.js`；`node --test tests/entrypoints.test.js`；`node --check public/slides.js`；`git diff --check`。
- 預期結果：測試與檢查全部通過。
- 實際結果與 exit code（適用時）：全部通過，exit code 0。入口檢查首次因資源版本字串仍是舊值而失敗，更新精確斷言後重跑通過。
- 證據位置：終端測試摘要。

### Gamma 預覽服務
- 目的與對應條件：提供主代理檢視本次前端修正。
- 執行目錄與必要環境設定：gamma worktree，PORT 3103。
- 測試資料／fixture：無。
- 完整指令或操作步驟：核對 3103 的 PID 與完整 worktree 路徑後，只重啟該服務；請求 `/slides.html`。
- 預期結果：HTTP 200 且載入 `slides.js?v=structure-length-zero-193`。
- 實際結果與 exit code（適用時）：HTTP 200、版本字串存在；PID 49348。
- 證據位置：http://localhost:3103/slides.html

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression 或大規模演算法驗證，依使用者明確要求及驗證分級規則。
- 已知問題或風險：長度欄位僅適用線性 structure；Matrix 與 Tree 依其列欄／節點操作管理大小。
- 相依與衝突注意：`public/slides.js`、`slides.html` 與 `tests/entrypoints.test.js` 是常見共用檔案，整合時需保留其他代理較新的資源版本字串與功能。
- 主代理需補驗證的情境：整合版本實際操作 heap 非首格編輯、Array 長度增減、新建 Array／Matrix／Tree 初始值。

## 主代理核實與整合（由主代理填寫）
- 狀態：已核實並整合至 `intergration`
- 核實的程式 commit 與 diff 範圍：Gamma `fabb4ba`／`65b8ba5` 的結構索引、長度與零值預設
- 差異審查與必要重跑結果：整合版結構長度／索引與既有 Structure 註標專項均通過
- 合併 commit：`21a244d`
- 完整 regression：未執行；V1 非動畫修改
- 演算法投影片實際驗證：未執行
- 未完成或環境阻塞：無
- 本機服務重啟：3100 於整合提交後重啟核實
- Push／公開部署狀態：推送 `origin/intergration`；未合併 main、未部署
