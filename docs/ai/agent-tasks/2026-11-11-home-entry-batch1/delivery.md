# 2026-11-11-home-entry-batch1 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：claude/2026-11-11-home-entry-batch1
- 共同基準 commit：c811a496bafa99adff0c7b96d9031bdaaa097e2c
- 程式修正 commit：5a44289f9eed6d9e7e9aa2fd461f05a79869c631
- 驗證時的 HEAD 與未提交修改：5a44289；工作目錄另有兩份未追蹤的草稿報告（`2026-11-10-event-follow-audit.md`、`2026-11-10-ui-entry-plan.md`），依使用者指示尚未提交，不屬本次交付。`node_modules` 為指向 main 相依的被忽略 junction。
- 驗證日期：2026-11-11

## 根因與修改
- 設計依據：介面入口修改報告 H1～H3（使用者 2026-11-10～11 確認）。
- 修改檔案及用途（`algo-vis-backend/` 下）：
  - `public/brand.css`：新增共用 `.mode-nav`／`.nav-link`（首頁與程式碼頁同一份）；`body[class*="asm-embed-"]` 下隱藏。
  - `public/index.html`：頂部改為 `<nav class="mode-nav">` 兩個連結（投影片、程式碼）；新增 `#headerLoginBtn`；工作區側欄改為兩個分頁按鈕並移除「演算法動畫」；標題列改為 `role="tablist"` 的「我的投影片 / 範例投影片」，內容分成 `#workspaceMinePanel`、`#workspaceExamplesPanel`；移除 `examples-workspace-entry`。
  - `public/home.js`：
    - `setWorkspaceTab()`：切換面板、`aria-selected`／`aria-current`、「新增投影片」只在我的投影片顯示，並以 `history.replaceState` 寫入／移除 `examples=1`。
    - 分頁左右鍵、Home／End 切換；側欄按鈕同步。
    - `placeGallery()`：登入後把訪客視圖的 `.guest-gallery` 移入範例分頁，登出時移回登入框左側（同一元件，不重複載入）。
    - `initialize()`：先判斷登入；登入者 `/?examples=1` 進工作區範例分頁，訪客維持 `examples-view` 全頁。
    - 登出時移除 `examples=1` 並回到一般訪客首頁。
    - 移除只服務舊頂部「範例投影片」的 `syncHomeNavigation()`／`setNavigationActive()`。
  - `public/home.css`：分頁、範例分頁內收起訪客標題區、`.visually-hidden`；窄螢幕保留模式入口（≤620px 收 GitHub 圖示、登入／帳號靠右；≤420px 只留品牌圖示）；移除已不存在元素的樣式。
  - `public/algorithm.html`、`public/style.css`：程式碼頁頂部加入同一份模式導覽與分隔線；分隔線在嵌入與手機斷點隱藏。
  - 版本參數：`home.css?v=workspace-tabs-1`、`home.js?v=workspace-tabs-1`、`brand.css?v=mode-nav-1`、`style.css?v=mode-nav-1`。
  - 合計 8 檔（含 2 個測試），+373／−98。
- README／版本紀錄／使用說明更新：未更新；入口調整完成第二批後建議一起更新 README「主要介面」表與版本紀錄。
- 與 task.md 的差異：無（合理假設 1～3 已列於 task.md）。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 兩種模式導覽、目前模式標示、嵌入隱藏 | 互動探針；`home-navigation` 測試 | 首頁 `投影片*`、程式碼頁 `程式碼*`；`?asmEmbed=editor` 下 `.mode-nav` 與分隔線皆 `display:none` | 通過 |
| 登入後預設我的投影片、切換範例、新增按鈕只在我的投影片 | 互動探針；`home-navigation` 測試 | 預設 `我的投影片:true`；切換後範例分頁含 30 張範例卡、`createDeckBtn` 隱藏 | 通過 |
| 登入者 `/?examples=1`、重新整理 | 同上 | 直接進範例分頁、帳號區顯示；reload 後仍在範例分頁 | 通過 |
| 訪客首頁不變、訪客範例全頁、登入按鈕 | 互動探針＋截圖；`auth-center` 測試 | 版面與修改前截圖一致；範例全頁按「登入」回 `/`；760px 寬捲動後按「登入」焦點在 `emailInput` | 通過 |
| 登出回訪客首頁、網址不殘留 | 互動探針 | 從範例分頁登出後網址 `/`、範例列表移回登入框左側 | 通過 |
| 手機 390／320px 不溢出 | 探針量測 `scrollWidth`、截圖 | 首頁與工作區皆無水平溢出；兩種模式與登入／登出可見；程式碼頁 390px 無溢出 | 通過 |
| 舊有物件相容性 | — | 不適用 | 不適用 |

## 小驗證與重跑方式
### 互動與截圖探針
- 執行目錄與必要環境設定：需 `algo-vis-backend/node_modules`（本 worktree 以 junction 指向 main）與 Windows Edge。
- 測試資料／fixture：登入狀態以 Playwright 攔截 `/api/auth/me`、`/api/slides` 回傳固定假資料，不寫資料庫；範例使用公開 `guest-decks.json`。
- 步驟：隨機埠啟動 `server.js`（`ASM_REGRESSION=1`、暫存目錄），依序檢查訪客、訪客範例、登入後兩個分頁、網址參數、重新整理、側欄與方向鍵、登出、手機 390／320／900px、程式碼頁與 `?asmEmbed=editor`。
- 實際結果：全部符合；無 pageerror／console error（假資料未攔截的資料夾 API 會顯示「無法讀取資料夾」，修改前同樣出現，屬探針假資料範圍）。
- 證據位置：腳本與截圖在 Claude 暫存目錄（未提交）。

### 相關測試
- 在 `algo-vis-backend`：
  - `node --test tests/home-navigation.browser.test.js` → 1 項通過（依新規格改寫）。
  - 以隨機埠服務設定 `ASM_TEST_BASE_URL` 後執行 `auth-center`、`deck-file-drop`、`guest-card-cache`、`guest-gallery-contract`、`guest-gallery-hints`、`library-folders`、`sample-view-actions` → 7 項全部通過。
  - `tests/entrypoints.test.js`：**整檔仍失敗**，失敗點在第 30 行 `slides.js` 的 runtime iframe 版本（測試期待 45／47，實際 92）。此失敗在 intergration `68d18c7` 原樣存在，與本次無關；因它在本次修改的斷言之前中止，另以腳本單獨執行本次新增／修改的 16 條斷言，全部通過。

### 測試修改說明
- `entrypoints.test.js`：資產版本改為新版本；舊的 `headerSlidesLink`／`headerExamplesLink`／`workspaceExamplesNav href` 斷言改為新規格（兩種模式導覽、範例不在頂部、分頁與側欄的 data 屬性）。
- `home-navigation.browser.test.js`：整個案例依新規格改寫——訪客兩種模式與登入框、訪客範例全頁與登入按鈕、登入後預設分頁、範例分頁、網址同步、重新整理、側欄與方向鍵。登入以攔截 API 模擬。
- 兩者都是規格變更後的對應更新，未放寬原有標準。

## 剩餘事項與合併注意
- 未驗證項目及原因：未以真實帳號與資料庫登入；未測 Safari／Firefox；未逐一檢查 900～1280px 之間所有寬度。
- 已知問題或風險：
  - 修改報告草稿寫「記住上次選的分頁」，本次改為不跨次記憶（理由見 task.md 假設 1）。若使用者想要跨次記憶，只需在 `setWorkspaceTab` 寫入 localStorage 並在 `initialize` 讀回。
  - `entrypoints.test.js` 的既有失敗需主代理另行處理（更新期待的 runtime 版本），否則該檔無法作為回歸依據。
- 相依與衝突注意：intergration 在本次期間前進到 `68d18c7`，只改了 `algorithm.html` 的 `trace-frame-tween.js` 版本參數一行，與本次修改的頂部列區塊不重疊。
- 主代理需補驗證的情境：以真實帳號登入後切換分頁、開啟範例投影片再返回；投影片頁內 runtime／editor iframe 的頂部列確認未出現模式導覽。
- 本機服務：未重啟任何服務；3100 屬主代理。測試用隨機埠服務已結束。
- 未 push。

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
