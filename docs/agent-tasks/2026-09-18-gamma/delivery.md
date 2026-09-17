# 2026-09-18-gamma 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：a524dd83b00f6ce137cf651fc7511219c2f0b772
- 程式修正 commit：af83585a2aa3e787bf6cdcf532e89a6fa0088760；測試版本同步 commit：899a81132325659f6d68d778569c77b373ee190c
- 驗證時的 HEAD 與未提交修改：899a81132325659f6d68d778569c77b373ee190c；程式與測試無未提交修改，只有本文件待提交。
- 驗證日期：2026-09-18

## 根因與修改
- 設計依據：訪客首頁原本只有裝飾預覽與登入表單，缺少可開啟的公開案例入口。
- 修改方式與行為變化：首頁訪客區顯示八個舊版分類及全部按鈕、搜尋、真實投影片首張縮圖；清單先收錄使用者提供的線性篩，分類 Math。訪客透過 sample 參數，以既有觀賞模式載入 ASMDeck 並重建動畫。使用獨立草稿鍵，保留既有私人草稿。
- 修改檔案及用途：index.html/home.css（入口與響應式版面）；guest-gallery.js（篩選與縮圖）；guest-decks.json/guest-decks/linear-sieve.asmdeck（公開案例）；slides.js/slides.html（載入公開檔案與快取版本）；tests/entrypoints.test.js（同步新快取版本，保留精確版本斷言）。
- README／版本紀錄／使用說明更新：catalog.md 說明案例新增步驟、資料欄位、公開存取與既有編譯依賴。
- 與 task.md 的差異：無。使用者後續確認首頁直接顯示並先新增線性篩，已更新任務定義。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 未登入可看到入口與舊版分類 | 隔離 Edge 實際首頁 | 九個按鈕，八個分類與 algorithm_sample 目錄鍵一致 | 通過 |
| 縮圖點選直接观賞指定投影片 | ASMDeck 解碼、真實首張縮圖、點擊連結 | 載入 14 張，觀賞模式，無 JWT，原本 localStorage 草稿 sentinel 保留 | 通過 |
| 分類與空狀態 | 排序→數學，搜尋不存在→線性篩 | 卡片數 0→1，搜尋 0→1，空狀態提示 | 通過 |
| 登入與個人工作區仍可使用 | 隔離 mock login/slides API | 登入切到個人工作區，登出恢復訪客入口 | 通過（前端）；真實帳號與遠端資料庫未驗證 |

## 小驗證與重跑方式
### 訪客前端隔離驗證
- 目的與對應條件：上述四項、390px 手機不產生橫向溢出、頁面無 JavaScript 錯誤。
- 執行目錄：本 worktree 的 algo-vis-backend；Node、既有 node_modules、Playwright、Edge。node_modules 以本機 junction 指向原工作區依賴，未提交。
- 測試資料：公開 linear-sieve.asmdeck；mock 登入資料，沒有操作真實帳號或私人 deck。
- 完整指令：node test-results/guest-gallery-check.cjs
- 預期結果：所有 assert 通過、列印兩個 PASS、exit code 0。
- 實際結果：exit code 0，篩選、搜尋、縮圖、免登入 14 張載入、草稿保留、手機寬度、登入登出前端切換通過。
- 證據位置：本 worktree 的 algo-vis-backend/test-results/guest-gallery-check.cjs、guest-gallery-home-desktop.png、guest-gallery-home-mobile.png、guest-gallery-viewer.png。僅本機保存，不提交，移除 worktree 後不保證留存。
- 環境限制：既有 Reveal KaTeX 插件從 CDN 載入；sandbox 阻擋時報 Event，允許既有依賴網路存取後原斷言全部通過。無降低斷言。

### 專案要求完整 regression
- 指令：在本 worktree 的 algo-vis-backend 執行 npm run regression。
- 第一輪：371/373 通過；失敗為 entrypoints 舊快取版本斷言與既有 KaTeX CDN 被 sandbox 阻擋。同步新版本並允許既有 CDN 後重跑。第二輪 372/373 通過，剩餘 home.css 舊版本斷言；同步為 v6，單項 entrypoints 測試通過後再跑完整 regression。
- 最終結果：373/373 單元／整合測試通過，fail 0。既有瀏覽器檢查 cloud-storage-browser、slide-order-toggle、deck-import-repair 及 arrow-identity 三個模式、quick-style-swap-algorithm 通過；使用者明確要求不需大規模驗證後，中止後續動畫回歸（SIGINT，exit code 1），完整 regression 未跑完，不宣稱完整通過。
- 證據：本機 test-results/regression.tap、test-results/animation/*/summary.json；不提交。

## 剩餘事項與合併注意
- 未驗證項目：使用者沒有要求新增線性篩內容與範例驗證，本次沒有新增。真實登入、公開 Docker、遠端資料庫未驗證。
- 已知問題或風險：ASMDeck 動畫沿用既有重建流程，可能需要編譯服务；觀賞頁沿用既有 KaTeX 網路依賴。
- 相依與衝突注意：修改 index.html、home.css、slides.js、slides.html，合併其他代理投影片修改時需保留双方行为與同步版本斷言。
- 主代理需核實的情境：首頁與私人工作區切換、公開投影片入口。使用者後續明確指示不需大規模驗證，優先於先前專案大回歸規則；本次不要求補跑完整回歸。主要開發服務合併後重啟由主代理處理。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：未執行；gamma 依協作設定不重啟主要開發服務。
- Push／公開部署狀態：未 push、未部署。

- 2026-09-18 使用者指示：不需要跑大規模驗證。gamma 已中止正在執行的完整動畫回歸；以小驗證通過、待主代理核實交付。
