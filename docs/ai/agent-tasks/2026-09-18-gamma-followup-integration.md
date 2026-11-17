# Gamma 後續任務整合驗證

## 分支整理與合併

- 日期：2026-09-18。
- 整合前 main：1ba0725；Alpha 2047597、Beta f66bf9f 已包含於 main，沒有新的待合併提交。
- Gamma 交付：81d6b42，共 14 個新提交、六項任務文件。
- 審查範圍：觀賞模式 TTS／側欄、範例資料夾與工作區導覽、檔案拖入、文字解析度、清單原生編輯、匯出名稱。
- 合併與受測程式 commit：b73f2613f7ba1e47feee5fbf4ab82892e46e1e16。
- 衝突：slides.html 與 entrypoints.test.js；統一 slides.js?v=parallel-merge-186 並保留 deck-file-drop.js 載入與精確斷言。
- slides.js 自動合併後已核實保留 Alpha 原地文字歷史及多物件補修、Beta 18px 預設與 fallback、所有 Gamma 新行為。

## 驗證分級與結果

V1，A／B／C 分類。未修改動畫引擎，未啟動完整 regression 或演算法大驗證。所有測試使用隔離服務與瀏覽器，沒有使用真實帳號、使用者分頁或私人投影片。

在 main 的 algo-vis-backend 執行：

```powershell
node --test --test-concurrency=1 tests/entrypoints.test.js tests/deck-file-drop.browser.test.js tests/export-filename.browser.test.js tests/list-backspace.browser.test.js tests/text-resolution.browser.test.js tests/slides-text-undo.browser.test.js tests/latex-refresh.browser.test.js tests/asmdeck.test.js
node test-results/integration-gamma-followup/folders.cjs
node test-results/integration-gamma-followup/viewer.cjs
node test-results/integration-gamma-followup/text-default.cjs
```

- 四個修改的 public JS、新增四個 browser test、文字 undo browser test 與 entrypoints 均執行 node --check 通過；git diff --check 通過。
- 八個相關測試檔：18 pass、0 fail、0 skip，exit 0。包含檔案拖入／跨頁保存、七組下載名称、清單 Backspace、文字 density 與重開、既有文字歷史與 LaTeX、asmdeck 契約。
- 解析度：DPR1 正常／200% 密度 1.099／1.084；DPR2 1.004／0.768。記憶體上限、非目前頁釋放、編輯座標、overview PNG 與重開均符合原斷言。
- 分類專項：八個預設展開資料夾、收合／分類跳轉、搜尋重設、工作區入口與返回、JWT 保留、390px 無橫向溢出，exit 0。
- 觀賞專項：側欄與首頁導航、TTS 展開／收合、語音替身接收正確旁白及語速音量、暫停／續播、手機版面、Present／Edit 元件還原、mock 登入登出，exit 0。
- 公開線性篩 14 頁載入且私人草稿 sentinel 保留；動畫 runtime 有實際 SVG，前後步進 0→1→0 並等待播放完成。僅局部核實，不宣稱全部演算法或所有幀正確。
- 字級回歸：新增 18、自訂 27、下一個新增仍 18，保存 [27,18]，exit 0。
- 瀏覽器頁面無 pageerror；LaTeX 等測試使用既有真實 CDN，無放寬或移除斷言。

## 證據與重跑注意

- 可提交證據：tests 下相關 browser fixture 與斷言。
- 本機專項腳本：test-results/integration-gamma-followup。由 Gamma 原 folder-gallery-check／viewer-sidebar-check 與 Beta 字級腳本複製；viewer 的舊九分類篩選斷言依新八資料夾導覽需求改成區塊存在、空分類與展開斷言，另加入 runtime 前後步進。不改產品與既有測試斷言。
- 暫存專項腳本、截圖不提交，清理後不保證留存；依交付文件及本摘要可重建操作。
- 真實裝置發聲、OS 原生檔案拖曳、中文 IME、真實帳號／Mongo、公開伺服器未驗證。

## 服務與交付狀態

- 核對 3000 埠 PID 23172 後重啟，新 PID 51280。
- 本機 docker compose restart backend nginx 成功，沒有重啟 Mongo 或操作遠端服務。
- 3000／80 埠 slides.html 有 parallel-merge-186 与 deck-file-drop.js；四個前端脚本 HTTP 200、SHA-256 與受測本機檔案完全一致。
- Alpha、Beta 與 Gamma 交付均已包含在本機 main；本次 V1 整合驗收通過。
- 沒有 push、發布 Release、公開部署或刪除任務分支／worktree。
