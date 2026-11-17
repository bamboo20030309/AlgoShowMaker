# 三代理分支整合與核實

日期：2026-09-18。主代理依使用者要求將三個分支合併至本機 main；沒有 push 或公開部署。

## 分支與共同基準

- 共同基準：a524dd83b00f6ce137cf651fc7511219c2f0b772。
- Alpha：codex/2026-09-18-alpha，整合前 60f888b；含 alpha-text-undo 子分支的多物件補修。主代理另提交既有驗證分級規範 2047597，避免未提交規範在切換分支時遺失。
- Beta：codex/2026-09-18-beta，f66bf9f；新增文字預設 18px。
- Gamma：codex/2026-09-18-gamma，22785ac；訪客公開投影片入口與線性篩案例。
- Alpha merge：b8399cb；Beta merge：4c3ebe2；Gamma merge：d554b98。
- 最終受測程式 commit：d554b9856941e02d8db8ee1cc0919195cf8ca9b7。
- 三個分支均以 git merge-base --is-ancestor 核對已包含於 main。

## 衝突處理與範圍

- slides.js 自動合併後審查：保留文字歷史與編輯焦點修正、18px 預設及 fallback、公開 sample 載入。
- slides.html 與 entrypoints.test.js 的快取版本衝突統一為 parallel-merge-181，保留精確版本斷言。
- 首頁 home.css 保留 Gamma v6，工具列初始字級保留 Beta 18。
- 本次為 V1 前端／投影片邏輯整合，沒有修改動畫引擎、解析器、runtime 或排程。不執行全套 regression、大規模演算法或广泛排序測試。

## 驗證與重跑

執行目錄：main worktree 的 algo-vis-backend。Node、Playwright、Edge，測試各自使用獨立服務與瀏覽器，未操作使用者分頁或私人投影片。

```powershell
node --check public/slides.js
node --check public/guest-gallery.js
node --check tests/slides-text-undo.browser.test.js
git diff --check
node --test --test-concurrency=1 tests/entrypoints.test.js tests/slides-text-undo.browser.test.js tests/latex-refresh.browser.test.js
node test-results/integration-2026-09-18/beta-check.cjs
node test-results/integration-2026-09-18/gamma-check.cjs
```

- 語法與差異檢查通過。
- 三項測試：3 pass、0 fail、0 skip，exit 0。
- 初次 sandbox 執行 LaTeX 因既有 CDN ERR_NETWORK_ACCESS_DENIED 失敗；允許網路後原測試與斷言全數通過，沒有修改或降低斷言。
- Beta 重跑原交付腳本：新增字級 18、工具列 18；自訂 27 後再次新增仍為 18；IndexedDB 儲存字級 [27,18]；無 pageerror，exit 0。
- Gamma 重跑原交付腳本：九個分類按鈕、真實縮圖、分類與搜尋空狀態、390px 無橫向溢出、免登入 14 頁觀賞、原私人草稿 sentinel 保留；mock 登入與登出切換、無 pageerror，exit 0。
- Gamma 補驗：最後動畫頁有實際 SVG，runtime 前後步進 0→1→0 並等待播放完成；exit 0。僅單次局部互動核實，不代表完整線性篩正確性或所有幀動畫驗證。

Beta／Gamma 腳本由原代理本機暫存腳本複製到 main 的 test-results/integration-2026-09-18，Gamma 另加入上述 runtime 斷言。可提交證據包含既有 browser test fixture；暫存專項腳本與截圖僅本機留存，不提交，移除後需依原 delivery 操作重建。

## 服务與限制

- 核對 3000 埠 Node 程序 PID 59272 後重啟，新 PID 23172。
- 核對本專案 Compose public bind mount 後，docker compose restart backend nginx 成功；沒有重啟 Mongo 或操作遠端 Docker。
- 3000／80 埠的 slides.html 使用 parallel-merge-181，slides.js HTTP 200 且 SHA-256 與受測本機檔案完全一致；guest-decks.json HTTP 200。
- 真實帳號／資料庫、公開伺服器、OS IME、macOS Meta、全部動畫與全部小測試未驗證。登入切換使用 mock API。
- 狀態：三分支已合併，本次 V1 整合驗收通過；未 push、未發布 Release、未公開部署。
- 原有未追蹤 .worktrees/ 保留，不納入提交，不刪除任務分支或工作目錄。
