# 2026-09-22-gamma-algorithm-brand-home 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：23a2f6e933fb561757e764d1c97929c49a00dfcb
- 程式修正 commit：db3f7f76a4d35f46ec38fbd2c5b958ec437fa767
- 驗證時的 HEAD 與未提交修改：HEAD `db3f7f76a4d35f46ec38fbd2c5b958ec437fa767`；驗證完成時只有本交付文件與 task 狀態更新尚未提交。
- 驗證日期：2026-09-22

## 根因與修改
- 已確認根因與證據：`algorithm.html` 原本只使用不可點擊的 `.menu-brand` 文字，未包含首頁既有的 `favicon.svg` 品牌圖示與首頁連結。
- 修正方式與行為變化：將品牌區改為單一 `<a href="/">`，內含首頁相同的 28px `favicon.svg` 與 `AlgoShowMaker` 文字；Logo 與文字都可點擊返回首頁，並沿用首頁的間距、字級與字重。
- 修改檔案及用途：`public/algorithm.html` 建立品牌連結並更新 CSS 快取版本；`public/style.css` 套用品牌排列與圖示尺寸；`tests/entrypoints.test.js` 核對入口結構；`tests/algorithm-brand.browser.test.js` 實際核對顯示與返回首頁操作。
- README／版本紀錄／使用說明更新：不適用；既有操作入口的外觀與連結修正，不增加需說明的新流程。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 左上角顯示與首頁相同的 Logo 與文字組合 | 獨立瀏覽器讀取圖示、尺寸、文字與計算樣式 | `favicon.svg` 已載入，圖示為 28×28，間距 9px，文字為 17px/700 | 通過 |
| 點擊品牌連結會導向首頁 | Playwright 點擊 `AlgoShowMaker 首頁` 連結並等待 URL | URL 變為測試服務的 `/`，首頁品牌文字可讀取 | 通過 |
| 不破壞既有頂端選單排列 | 隔離瀏覽器在 1440×900 視窗讀取頂端品牌配置 | 品牌以 flex 方式排列，圖示與文字均完整顯示 | 通過 |

## 小驗證與重跑方式
### 入口與瀏覽器專項驗證
- 目的與對應條件：確認靜態入口版本、品牌 DOM、實際圖示樣式與返回首頁操作。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行使用隨機本機埠、臨時 JWT secret 與獨立 Edge context。
- 測試資料／fixture：無；僅使用公開靜態頁面。
- 完整指令或操作步驟：`node --test tests/entrypoints.test.js tests/algorithm-brand.browser.test.js`
- 預期結果：兩個專項測試通過。
- 實際結果與 exit code：2 tests passed，0 failed，exit code 0。
- 證據位置：測試終端輸出；未產生或提交 `test-results`。

### 差異與開發預覽確認
- 目的與對應條件：確認無空白錯誤，且開發服務提供新版本入口。
- 執行目錄與必要環境設定：worktree 根目錄；gamma 預覽使用 3104，避免操作來源未確認的 3103 程序。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`git diff --check`；重新啟動本 worktree 的 Node 服務後請求 `http://127.0.0.1:3104/algorithm.html`。
- 預期結果：差異檢查成功；HTTP 200 且 HTML 含 `brand-home-5` 與首頁品牌連結。
- 實際結果與 exit code：差異檢查 exit code 0；HTTP 200，兩項版本／連結檢查均為 True；服務 PID 41848。
- 證據位置：終端摘要；服務 log 位於系統 Temp，不提交。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression，符合純前端 V0 修改及使用者不需大規模驗證的指示。
- 已知問題或風險：無。
- 相依與衝突注意：`algorithm.html` 的 `style.css` 查詢版本由 `freshness-4` 更新為 `brand-home-5`；若整合分支同時修改此版本，需保留新的快取破壞值。
- 主代理需補驗證的情境：整合後在 `algorithm.html` 點擊左上角 Logo 與文字，確認皆返回首頁。

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
