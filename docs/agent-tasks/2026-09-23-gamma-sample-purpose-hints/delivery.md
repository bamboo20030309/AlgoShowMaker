# 2026-09-23-gamma-sample-purpose-hints 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：4bdf1af90ecaafb097f3d8788b33503c170c53ee
- 程式修正 commit：0e2f0d689f9026d32dca27cb81c2fccc561d00f3
- 驗證時的 HEAD 與未提交修改：0e2f0d689f9026d32dca27cb81c2fccc561d00f3；程式與測試無未提交修改，交付文件待提交。
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：公開範例 catalog 只有標題、分類與檔案路徑，卡片 renderer 只能顯示大分類。
- 修正方式與行為變化：catalog 新增可選 `hints` 陣列；卡片將中文分類與用途分別顯示成簡短標籤，搜尋同時比對標題、分類與用途。
- 修改檔案及用途：`guest-decks.json` 定義九個範例用途；`guest-gallery.js` 組合、渲染及搜尋標籤；`home.css` 提供標籤樣式與換行；`index.html` 更新資源版本；局部 browser test 驗證指定案例。
- README／版本紀錄／使用說明更新：不適用；catalog 欄位與行為已記錄於任務文件及測試 fixture。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 線篩顯示數學與質數篩 | Playwright mock catalog 並讀取 `.deck-hint` | 依序為「數學」「質數篩」 | 通過 |
| 線段樹顯示資料結構、區間修改與區間和 | Playwright mock catalog 並讀取 `.deck-hint` | 三個標籤依指定順序顯示 | 通過 |
| 所有公開範例有用途提示且可搜尋 | JSON 檢查與 Playwright 輸入「區間修改」 | 九個 catalog 項目均有 hints；搜尋只保留線段樹 fixture | 通過 |
| 舊 catalog 項目相容 | renderer 差異審查與既有無 hints fixture | `hints` 為可選，缺少時仍以分類標籤渲染 | 通過 |

## 小驗證與重跑方式
### 用途提示瀏覽器行為
- 目的與對應條件：驗證指定標籤順序、提示移除狀態與提示搜尋。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隨機埠與 headless Edge。
- 測試資料／fixture：mock 線篩及線段樹 catalog。
- 完整指令或操作步驟：`node --test tests/guest-gallery-hints.browser.test.js`。
- 預期結果：1 test pass。
- 實際結果與 exit code（適用時）：1 pass，0 fail，exit code 0，約 3.1 秒。
- 證據位置：`tests/guest-gallery-hints.browser.test.js`。

### 語法、JSON 與入口版本
- 目的與對應條件：確認資料及腳本有效，頁面引用新資源。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：`public/guest-decks.json`。
- 完整指令或操作步驟：`node --check public/guest-gallery.js`；以 `JSON.parse` 讀取 catalog；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部 exit code 0。
- 實際結果與 exit code（適用時）：語法與 JSON 通過；entrypoints 1 pass、0 fail；diff check 無空白錯誤，exit code 0。
- 證據位置：本紀錄摘要。

### gamma 預覽
- 目的與對應條件：確認 3104 已載入用途標籤資源與真實 catalog。
- 執行目錄與必要環境設定：`algo-vis-backend`，`PORT=3104`。
- 完整指令或操作步驟：重啟 `node server.js`；讀取 `/?examples=1` 與 `/guest-decks.json`。
- 實際結果與 exit code（適用時）：HTTP 200；頁面引用 `guest-gallery.js?v=5` 與 `home.css?v=brand-favicon-17`；線篩及線段樹 hints 與指定內容相符；PID 68132。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑大規模 regression；本次是首頁範例卡片的局部前端功能。
- 已知問題或風險：提示是簡短用途摘要，不代表演算法所有可用情境。
- 相依與衝突注意：整合時保留 `home.css?v=brand-favicon-17` 與 `guest-gallery.js?v=5`，或依整合版本遞增。
- 主代理需補驗證的情境：整合預覽檢視標籤配色、手機換行與真實九個範例。

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
