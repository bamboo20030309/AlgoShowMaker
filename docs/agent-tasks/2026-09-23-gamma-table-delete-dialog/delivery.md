# 2026-09-23-gamma-table-delete-dialog 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：dc62fb1fe6be8234dc387d3d6b421c474082c698
- 程式修正 commit：c79662e00d7530c65ab73ce4c942c4e7bb6c01ec、859178fb1b5fb863cb91e266393426aca1780737
- 驗證時的 HEAD 與未提交修改：859178fb1b5fb863cb91e266393426aca1780737；程式與測試無未提交修改，交付文件待另行提交。
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：第一版將 Table 放在 Structure 選單並以 `type: structure, structureMode: table` 保存，與使用者要求的獨立物件不符；投影片總覽刪除原先直接啟動既有刪除流程，沒有網站自有確認介面。
- 修正方式與行為變化：Table 改用主工具列獨立入口、獨立左側面板與 `type: table` 儲存型別；二維 `tableData`、專用 SVG renderer、直接編輯、列欄、表頭、共用／逐格樣式及索引重映射保持可用。舊 `structureMode: table` 載入時會自動轉換。刪除流程改成先開啟自有 modal，確認後才執行原有過場及刪除。
- 修改檔案及用途：`slides.html` 新增入口、控制項與 dialog；`slides.css` 新增控制區與 dialog 樣式；`slides.js` 負責資料、操作、歷史與 modal；`slide-structures.js` 負責表格 SVG；兩個 browser test 覆蓋主要行為；`entrypoints.test.js` 對齊靜態資源版本。
- README／版本紀錄／使用說明更新：不適用；Table 可直接由主工具列入口與獨立左側面板辨識，任務文件記錄第一版限制與舊資料遷移。
- 與 task.md 的差異：初版交付後，依使用者修正將 Table 從 Structure 模式拆成獨立物件；task.md 已同步更新。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 從獨立入口新增可拖曳縮放的 3×3 表格與表頭 | Playwright 確認 Structure 不含 Table，從主工具列新增並查驗 9 格、獨立型別與面板 | 顯示 3×3、首列粗體淡綠表頭，DOM 與保存資料均為 `type: table` | 通過 |
| 舊 Structure 表格相容 | Playwright 載入 `type: structure, structureMode: table` fixture，操作後讀回保存資料 | 正常顯示於獨立 Table 面板，並轉存為 `type: table` | 通過 |
| 編輯、逗號、列欄、表頭與顏色控制 | Playwright 直接編輯含逗號內容、改成 4×4、切換首欄表頭 | 值與維度正確；逗號未被解析成新格 | 通過 |
| 列欄操作、樣式索引、復原重做與保存 | Playwright 右鍵新增列、復原、重做、重新載入 | 4×4 ↔ 5×4 正確切換，reload 後仍保留資料 | 通過 |
| 刪除 dialog 的取消、Escape、確認與復原 | Playwright 對兩張投影片依序操作 | 取消及 Escape 保留兩張；確認後剩一張；Ctrl+Z 回到兩張 | 通過 |
| 至少保留一張 | 程式差異審查與既有 `removableIds` 條件 | modal 接在可刪除集合之後，沒有可刪項目時不開啟 | 通過 |

## 小驗證與重跑方式
### 表格瀏覽器行為
- 目的與對應條件：驗證新增、直接編輯、列欄、表頭、context menu、undo/redo 與保存。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隨機埠服務與 headless Edge。
- 測試資料／fixture：localStorage 測試 deck；新增預設 Table。
- 完整指令或操作步驟：`node --test tests/table-widget.browser.test.js`
- 預期結果：1 test pass。
- 實際結果與 exit code（適用時）：2 pass，0 fail，exit code 0，約 5.1 秒；涵蓋新物件與舊資料遷移。
- 證據位置：`tests/table-widget.browser.test.js`；視覺檢查截圖僅留在本機忽略目錄 `algo-vis-backend/tmp/table-visual-probe.png`。

### 投影片刪除 dialog
- 目的與對應條件：驗證 dialog 阻擋刪除、取消、Escape、確認與復原。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隨機埠服務與 headless Edge。
- 測試資料／fixture：含兩張空白投影片的 localStorage deck。
- 完整指令或操作步驟：`node --test tests/slide-delete-dialog.browser.test.js`
- 預期結果：1 test pass。
- 實際結果與 exit code（適用時）：1 pass，0 fail，exit code 0，約 3.2 秒。
- 證據位置：`tests/slide-delete-dialog.browser.test.js`；視覺檢查截圖僅留在本機忽略目錄 `algo-vis-backend/tmp/delete-dialog-visual-probe.png`。

### 語法、入口版本與差異品質
- 目的與對應條件：排除 JavaScript 語法錯誤、舊資源版本與空白錯誤。
- 執行目錄與必要環境設定：`algo-vis-backend` 或 repo root。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/slides.js`；`node --check public/slide-structures.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部 exit code 0。
- 實際結果與 exit code（適用時）：語法檢查通過；entrypoints 1 pass；diff check 無空白錯誤，僅 Git CRLF 提示；exit code 0。
- 證據位置：本交付紀錄摘要。

### gamma 預覽
- 目的與對應條件：讓主代理可直接查看本分支的獨立 Table 入口與編輯面板。
- 執行目錄與必要環境設定：`algo-vis-backend`，`PORT=3104`。
- 完整指令或操作步驟：背景啟動 `node server.js`，讀取 `http://127.0.0.1:3104/slides.html`。
- 實際結果與 exit code（適用時）：HTTP 200；頁面載入 `slides.js?v=inline-scripts-217` 並包含獨立 `data-tool="table"` 入口；啟動程序 PID 77356。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑完整 regression 與演算法動畫驗證，依使用者與專案規範，本次屬非動畫前端功能，只跑相關局部測試。未另做 PDF／圖片匯出像素比較，表格沿用既有 widget 匯出管線。
- 已知問題或風險：第一版沒有合併儲存格、公式、跨格貼上、儲存格內換行、每格富文字與專用表格動畫。單格最多保存 500 字；畫面顯示超過 80 個 Unicode code point 時以省略號截斷。列欄限制為 20×12，避免投影片上產生不可讀的超大表格。
- 相依與衝突注意：`slides.html`、`slides.js`、`slides.css`、`slide-structures.js` 是高共用檔案；整合時需保留資源版本 `slides.css?v=inline-scripts-111`、`slide-structures.js?v=18`、`slides.js?v=inline-scripts-217` 或依整合後版本再遞增。
- 主代理需補驗證的情境：合併後在 3100 實際新增／編輯表格、刪除投影片，並確認匯出圖像仍含表格；不需啟動完整演算法 regression。

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
