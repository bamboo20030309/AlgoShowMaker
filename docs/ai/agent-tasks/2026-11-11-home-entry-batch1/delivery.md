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

## 追加：程式碼頁登入入口（2026-11-11，使用者指示）

使用者在 3104 預覽時指出「algorithm.html 沒有登入按鈕，這按鈕應該導向同一個頁面」。屬第二批 H4／H5 的一部分，依使用者要求提前加入本分支。

- 程式修正 commit：b3f84a6a57bb1e2a03e59b834714e7b819df19c0
- 調查：程式碼頁的舊登入視窗（`loginModal`、`loginTriggerBtn`）標記早已不在 `algorithm.html`，`front.js` 相關程式因找不到元素而不執行；「我的程式碼」、「儲存程式碼」按鈕也已不在頁面上。程式碼頁目前只有 `trace-editor.js` 會用 token 讀寫帳號的事件設定偏好。
- 修改：
  - `public/algorithm.html`：頂部列右側新增 `.top-account`（`#topLoginLink`、`#topAccountName`、`#topLogoutBtn`），載入新檔 `top-account.js?v=1`。
  - `public/top-account.js`（新）：未登入顯示「登入」，連到 `/?next=<目前路徑與查詢>`；已登入顯示名稱與「登出」；以 `/api/auth/me` 核對 token，401／403 時清除並改回訪客；登出清除 `algo_jwt_token`／`algo_username` 後重新載入，讓帳號相關設定以訪客狀態重來。
  - `public/home.js`：已登入且帶合法 `next` 時直接 `location.replace(next)`；`safeNextPath()` 加強，排除 `/\host`、控制字元與解析後不同 origin 的值（原本只擋 `//host`）。
  - `public/style.css`：帳號區樣式；嵌入模式隱藏；手機斷點隱藏名稱、≤420px 品牌只留圖示。
  - 版本：`home.js?v=workspace-tabs-2`、`style.css?v=mode-nav-2`；`entrypoints.test.js` 新增 `topLoginLink` 與 `top-account.js` 斷言。
- 驗證（隔離服務＋Edge，登入以攔截 `/api/auth/login`、`/api/auth/me` 模擬）：
  - 訪客開 `/algorithm.html?sample=demo`：顯示「登入」，連結 `/?next=%2Falgorithm.html%3Fsample%3Ddemo`。
  - 點「登入」到首頁登入框；送出後回到 `/algorithm.html?sample=demo`，顯示名稱與「登出」。
  - 已登入開 `/?next=%2Falgorithm.html`：直接回 `/algorithm.html`。
  - `/?next=%2F%5Cevil.com`：留在首頁。`safeNextPath` 另以 10 組值核對：站內路徑保留；`//evil.com`、`/\evil.com`、`https://evil.com`、含 tab、`javascript:` 皆回空字串。
  - 登出後顯示「登入」、token 已清除；`?asmEmbed=editor` 下帳號區 `display:none`；390px 無水平溢出，品牌圖示、兩種模式與「登入」皆可見。
  - 相關測試：`home-navigation`、`auth-center`、`sample-view-actions`、`library-folders` 4 項通過；`entrypoints.test.js` 中本次新增／修改的 18 條斷言單獨執行通過（整檔仍因既有的 `slides.js` runtime 版本與 `sample-trace-assets.js?v=1` 舊斷言失敗，兩者在基準即過期，與本次無關）。
- 未做：`front.js` 中已無作用的舊登入視窗程式仍保留，留待 H5 一併移除；未以真實帳號登入驗證。

## 追加：預覽回饋修正（2026-11-11，使用者指示）

使用者在 3104 預覽後提出四點，全部處理：

- 程式修正 commit：d230938f32ed27fd456cfc513a1bb5470eefdf17
- 修改：
  1. **點目前所在的模式不重新載入**：`home.js` 攔截「投影片」點擊——工作區時就地切回「我的投影片」分頁；訪客首頁不動；訪客範例全頁仍回首頁登入框（屬不同畫面）。`top-account.js` 在程式碼頁攔截「程式碼」，避免丟失編輯中的程式。Ctrl／Shift／中鍵開新分頁不攔截。
  2. **訪客首頁捲軸位置與樣式**：寬螢幕（≥901px）時 `.guest-view` 固定為視窗高度、範例欄位自己捲動，捲軸落在登入框左側；首頁捲軸改為細的深色樣式（`scrollbar-color`＋WebKit 偽元素）。黏性分類列在捲動容器內以 `top: -40px` 抵銷欄位上內距，保持貼齊欄位頂端。窄螢幕維持整頁捲動。
  3. **移除左側工作區側欄**：只保留上方分頁；工作區內容改為置中、最大寬度 1440px；刪除側欄的 CSS（`.workspace-sidebar`、`.sidebar-*`、`.storage-note`、`.status-dot`），`setWorkspaceTab()` 的側欄分支一併移除。原側欄底部的「已啟用雲端儲存」提示也隨之移除。
  4. **新增資料夾改為圖示按鈕**：資料夾線條、右上角加號（SVG），`aria-label`／`title` 為「新增資料夾」；手機上靠右不拉滿。
  - 版本：`home.css?v=workspace-tabs-2`、`home.js?v=workspace-tabs-3`、`top-account.js?v=2`。
- 驗證：
  - 探針：寬螢幕訪客首頁整頁不捲動、範例欄位 `overflow-y: auto`、欄位右緣 972 ≤ 登入框左緣 986；點「回溯」分類後區段標題在分類列下方（分類列貼齊欄位頂端）；900px 與 390px 維持整頁捲動且無水平溢出；工作區無側欄，資料夾按鈕 40×40。
  - 3104 預覽（使用者已登入的真實帳號，僅檢視、未操作資料）：工作區無側欄、分頁在上方、資料夾圖示正常顯示。無頭瀏覽器不繪製捲軸，捲軸外觀以樣式設定核對，未能截圖確認。
  - 測試：`home-navigation`（新增：點目前模式不重新載入、範例欄位為捲動容器且在登入框左側、無側欄、資料夾按鈕無可見文字但有名稱、程式碼頁點「程式碼」不重新載入）、`auth-center`、`library-folders`、`sample-view-actions`、`guest-gallery-contract`、`guest-card-cache`、`guest-gallery-hints`、`deck-file-drop` 共 8 項通過；`entrypoints.test.js` 本次相關 19 條斷言單獨執行通過（整檔仍因基準既有的過期斷言失敗）。
  - `auth-center` 測試修改：原本以 `minHeight: 5000px` 撐高範例欄位並捲動視窗；新設計中範例欄位是捲動容器，改為在欄位內加入 5000px 內容並捲動欄位，並新增「欄位確實捲動」的檢查。登入框位置（top 52、bottom 1000、置中）的判準不變。

## 追加：首頁與程式碼頁共用同一條頂部列（2026-11-11，使用者指示）

使用者要求「最上面那欄每個頁面使用同一個，才不會跳來跳去」，並要求新增資料夾按鈕不要外框。

- 程式修正 commit：f49ce2deff1e4225d74f53052e007ba63fdafd2e
- 修改前量測（1440px）：首頁頂部列 52px、內距 20px、有底線；程式碼頁 50px、內距 12px、無底線、陰影不同；「投影片」在首頁 x=223、程式碼頁 x=201；登入按鈕字級、底色、圓角皆不同。700／390px 時程式碼頁 44px 高且模式導覽被推到右側（x=480／170），首頁則緊貼品牌。
- 修改：
  - `public/brand.css`：新增 `.site-header` 統一整條頂部列（52px、內距 20px、底線、陰影、sticky），以及 `.site-github-link`、`.site-account`、`.site-account-signed-in`、`.site-account-btn`、`.site-account-name`，與一組共用窄螢幕斷點（≤760px 或觸控 ≤900px：內距 12px、模式導覽緊貼品牌、收起 GitHub 與名稱、帳號靠右；≤420px 品牌只留圖示）。
  - `public/index.html`、`public/algorithm.html`：兩頁頂部列套用 `.site-header` 與相同的子元件 class；首頁登入按鈕與已登入群組放進同一個 `.site-account`。
  - `public/home.css`：移除首頁專屬的 `.app-header`、`.header-github-link`、`.account-area`、`.account-name`、`.header-login-btn` 與對應窄螢幕規則。
  - `public/style.css`：`--header-height` 改為 52px；`#top-bar` 只保留 `user-select`；移除 `.menu-brand` 間距、`.top-account*`、`.top-github-link` 規則。
  - `public/mobile-ui.css`：程式碼頁的頂部列不再覆寫內距與品牌間距，非嵌入時 `--asm-mobile-header-h` 設為 52px。
  - 新增資料夾按鈕移除 `quiet-btn`，只有圖示、無外框，滑過時淡色底。
  - 版本：`brand.css`、`style.css`、`home.css`、`mobile-ui.css`（程式碼頁）皆為 `?v=site-header-1`。
- 驗證：
  - 量測：1440、700、390px 下兩頁頂部列高度、內距、底線、陰影、品牌位置與字級、兩個模式連結位置、登入按鈕位置與外觀完全相同；首頁捲動後頂部列仍在 0；程式碼頁主區塊從 52px 起剛好填滿視窗；`?asmEmbed=editor` 下模式導覽與帳號區隱藏。
  - 截圖確認兩頁桌面與手機頂部列一致、程式碼頁功能選單接在分隔線後、資料夾按鈕無外框。
  - 測試：`home-navigation`、`auth-center`、`library-folders`、`sample-view-actions`、`guest-gallery-contract`、`guest-card-cache`、`guest-gallery-hints`、`deck-file-drop`、`mobile-ui`、`algorithm-editor-history` 共 13 項通過；`entrypoints.test.js` 新增兩頁共用 `.site-header` 的斷點，本次相關 21 條斷言單獨執行通過。
- 注意：投影片編輯頁（`slides.html`）有自己的編輯器工具列，未套用這條頂部列；投影片的動畫編輯視窗內嵌 `algorithm.html?asmEmbed=editor`，其頂部列高度由 50px 變為 52px（模式導覽與帳號區在嵌入時隱藏）。

## 追加：投影片卡片重整與換頁時頂部列不重新載入（2026-11-11，使用者指示）

- 程式修正 commit：f80c4a1a0d245e06499d475feca08373fee8167d
- 使用者需求與對應修改：
  1. **頂部列的登入狀態與 GitHub 圖示換頁時看起來重新載入**：兩頁本來就是獨立頁面。
     - 新檔 `public/site-header.js`：緊接在頂部列之後同步載入，第一次繪製前就依 localStorage 的登入狀態顯示「登入」或「名稱＋登出」，不再先空白再出現。
     - `brand.css`：首頁與程式碼頁之間啟用跨文件 View Transition，`.site-header` 設 `view-transition-name`，換頁時頂部列原地接續，只有下方內容淡入淡出（160ms）。偏好減少動態效果時不啟用。前往其他頁（例如投影片編輯頁，未啟用過場）時在 `pageswap` 略過過場並吞掉瀏覽器的 rejected promise，避免主控台錯誤。
     - 限制：仍是兩個獨立頁面（不是單頁應用），不支援 View Transition 的瀏覽器照常整頁換頁。
  2. **新增投影片改成「＋」圖示、放在新增資料夾旁、無外框**：`#createDeckBtn` 移到工具列，與資料夾圖示並排。
  3. **刪除「選擇分類」，改為唯一分類**：
     - `library-layout.js`：`move()` 把投影片從所有其他容器移除後再放入目的地；`reconcile()` 對同一份投影片出現在多個資料夾的舊資料只保留第一個資料夾。伺服器的 GET／PUT 也使用 `reconcile()`，因此舊資料在下一次儲存時寫回為單一分類。移除 `assign()`。
     - `library-organizer.js`：移除分類對話框程式；`index.html` 移除 `#categoryDialog`。
     - **資料相容性**：這是有意的資料變更。舊的「一份投影片放多個資料夾」會變成只在第一個資料夾，其他資料夾的這筆會在下次儲存時移除。投影片本身與其他設定不受影響。已以 `slide-library.test.js`（純函式與 API）和 `library-folders` 瀏覽器測試（載入→使用→儲存→重開）驗證。
  4. **上下箭頭改左右箭頭**：「往前／往後」改為 ← → 圖示按鈕。
  5. **最左邊新增刪除按鈕（沿用垃圾桶圖示）**：與資料夾的刪除圖示共用同一組 SVG，點擊開啟既有的刪除確認對話框。
  6. **雙擊標題直接在卡片上改名，離開後自動儲存**：標題改為可聚焦的文字（單擊不做事）；雙擊或 F2／Enter 進入編輯；離開輸入框或 Enter 儲存，Esc 放棄；空白或未改動不送出；失敗時恢復原名並顯示訊息。原「投影片設定」對話框（`#deckDialog`）移除。
  7. **移除右邊「投影片設定」與左下角六個點**：`.deck-settings` 與 `.library-drag-handle` 移除。
  8. **拖曳整張卡片**：指標拖曳時建立整張卡片的浮動複本跟著指標（含縮圖與底列），原位置透明度 0.35 作為殘影；放開後移除複本。移除原生 HTML5 卡片拖曳（只保留指標拖曳）。卡片上的按鈕與改名輸入框不會啟動拖曳。
  9. **把投影片檔拖到頁面任何地方就新增**：`ASMDeckFileDrop.bind` 的目標由兩個按鈕改為整個 `#dashboardView`（只在「我的投影片」分頁），拖入時顯示全頁「放開以新增投影片」提示。
  - 版本：`brand.css?v=site-header-2`、`home.css?v=cards-1`、`home.js?v=cards-1`、`library-layout.js?v=3`、`library-organizer.js?v=9`、`site-header.js?v=2`。
- 驗證：
  - 互動探針（所有 API 以 route 模擬）：舊資料中同時在兩個資料夾的投影片只顯示在第一個；卡片底列為「刪除｜←→」且無把手、分類按鈕、設定按鈕；雙擊改名後點別處即儲存、Esc 保留原名；→ 排序；整張卡片拖進資料夾後儲存的版面為單一分類，拖曳中有完整複本且原卡片為殘影，放開後複本移除；垃圾桶開啟確認後刪除；把 JSON 投影片檔拖到資料夾區域顯示全頁提示，放開後導向新投影片。無 page error。
  - 測試：`home-navigation`（新增：全頁拖入提示、第一次繪製即正確登入狀態、頂部列 `view-transition-name`）、`library-folders`（依新規格重寫）、`home-delete-dialog`（改用垃圾桶）、`slide-library`（單一分類與舊資料）、`home-thumbnail-api`、`deck-file-drop`、`auth-center`、`sample-view-actions`、`guest-gallery-contract`、`guest-card-cache`、`guest-gallery-hints`、`mobile-ui`、`algorithm-editor-history`，共 19 項通過；`entrypoints.test.js` 本次相關 23 條斷言單獨執行通過。
  - 未驗證：未以真實帳號與資料庫驗證；View Transition 的視覺效果無法在無頭瀏覽器截圖確認（以 computed style 核對設定）。

## 追加：捲軸只在頂部列下方（2026-11-11，使用者指示）

使用者指出「投影片右邊的滾輪應該在上方欄下面的空間，不應該跑到上方欄」。原因是整個頁面（html）在捲動，捲軸從視窗最上方開始、經過頂部列。

- 程式修正 commit：d7ee749480834e910bb681a41ee6cd942f9d5fc7
- 修改：
  - `public/home.css`：`html`、`body` 固定為視窗高度且不捲動；`body` 改為上下排列，頂部列在上、`<main>` 佔滿其餘高度並成為唯一的捲動區（沿用細的深色捲軸）。`main` 內的黏性元素（範例分類列、資料夾導覽、登入框）改以 `main` 頂端為基準（`top: 0`），區段捲動定位改為 140px／170px。寬螢幕訪客首頁的範例欄仍是自己的捲動區，維持原規則。
  - `public/library-organizer.js`：拖曳卡片接近上下邊緣時的自動捲動改為捲動 `main`（以 `main` 的可見範圍判斷邊緣），不再捲動視窗。
  - 版本：`home.css?v=cards-2`、`library-organizer.js?v=10`。
- 驗證：
  - 量測（隔離服務）：登入工作區、工作區範例分頁、訪客範例全頁、寬螢幕訪客首頁、手機訪客與手機工作區，皆為整頁不捲動、`main` 從 52px（頂部列下緣）開始並可捲動、頂部列維持在 0；捲動後黏性分類列／資料夾導覽停在 52px。
  - 3104 預覽（使用者已登入的帳號，僅捲動檢視後還原）：`main` 捲軸寬 10px、從 52px 開始，整頁不捲動。
  - 測試：`home-navigation`（新增：只有頂部列以下的區域捲動）、`auth-center`、`library-folders`、`home-delete-dialog`、`deck-file-drop`、`sample-view-actions`、`guest-gallery-contract`、`guest-card-cache`、`guest-gallery-hints`、`mobile-ui` 共 13 項通過；`entrypoints.test.js` 相關 23 條斷言單獨執行通過。
  - 注意：手機瀏覽器改為內層捲動後，網址列不會隨捲動自動收起。

## 追加：切換頁面時登入／登出按鈕偶爾閃一下（2026-11-11，使用者回報）

- 程式修正 commit：f439f69e2c2277442787a3bc915e26278d20c31b
- 根因：`site-header.js` 放在頂部列之後，是外部檔案且伺服器回應 `Cache-Control: public, max-age=0`，每次換頁都要向伺服器確認。等待期間瀏覽器可以先繪製已解析的頂部列，此時帳號區仍為隱藏；腳本執行後才出現，造成閃一下。等待時間不固定，所以「有時候」才看得到。
- 重現（隔離服務，逐幀取樣 `requestAnimationFrame`，已登入狀態）：程式碼頁在無延遲時有 1 幀、`site-header.js` 延遲 400ms 時連續 8 幀出現「有頂部列但沒有登入／登出」；首頁未出現。
- 修改：`site-header.js` 改為在 `<head>` 同步載入（head 內腳本未完成前不會繪製），只提供 `ASMSiteHeader.apply()` 與換頁過場的 `pageswap` 處理；兩頁在頂部列結束標籤後以內嵌 `<script>ASMSiteHeader.apply()</script>` 套用登入狀態（不需網路）。版本 `site-header.js?v=3`。
- 驗證：同一探針在無延遲與 400ms 延遲下，兩頁第一個含頂部列的畫面都已顯示「登出」，空白帳號區的幀數為 0。`home-navigation` 的檢查改為延遲 `site-header.js` 400ms 並逐幀取樣，第一幀必須已顯示登入狀態；`entrypoints.test.js` 改為檢查 head 載入與頂部列後的內嵌呼叫（相關 24 條斷言單獨執行通過）。相關瀏覽器測試 11 項通過。
- 未處理：靜態檔案的 `max-age=0` 快取策略屬於伺服器設定，本次未變更。

## 追加：分類就地編輯與單一工具列（2026-11-12，使用者指示）

- 程式修正 commit：32f9b55049504a120ef91e10592267ebfa7ec49d
- 使用者需求與對應修改：
  1. **新增資料夾不彈視窗**：按資料夾圖示後，清單最底部出現一列已聚焦的名稱輸入框；Enter 或離開輸入框即建立，Esc 或留空取消，儲存失敗時保留已輸入的名稱。移除 `#folderDialog` 標記與 `library-organizer.js` 的對話框程式。
  2. **點分類名稱直接改名，移除重新命名按鈕**：點名稱（或聚焦後 Enter／F2）變成輸入框；Enter／離開儲存，Esc 取消；點名稱不會收合分類；儲存失敗時名稱維持原樣並顯示訊息。「未分類」不可改名。
  3. **分類垃圾桶 hover 為紅色**：改用與卡片相同的 `library-card-icon library-delete-button` 樣式與圖示（`library-folder-delete`）。
  4. **括號數字改成名稱右邊的「共 N 份」**：`.library-folder-name` 加 `.library-folder-count`，樣式比照工具列的份數。
  5. **搜尋列與分類列合併**：`#workspaceMinePanel` 只剩一列 sticky 工具列。
  6. **搜尋改成放大鏡圖示**：放在新增資料夾左邊，點開後輸入框在圖示左側向左展開到 180px（原欄寬 360px 的一半；手機 150px），圖示位置不動；輸入即篩選；Esc 清除並收起；留空離開時收起；有文字時維持展開。減少動態效果時不做動畫。
  7. **分類捷徑全部放到工具列並靠左**：`#libraryFolderNav` 移入工具列最左側，右側依序為份數、搜尋、新增資料夾、新增投影片；手機上分類捷徑獨占第一行。
  - 另外：沒有訊息時兩個訊息列不再佔空間，工具列下方直接接第一個分類。
  - 版本：`home.css?v=cards-3`、`home.js?v=cards-2`、`library-organizer.js?v=11`。
- 驗證：
  - 互動探針（API 以 route 模擬）：工具列順序與位置（分類捷徑 x=68 靠左，份數、搜尋、資料夾、新增在右）；分類標題為名稱＋「共 1 份」且只有「移除資料夾」按鈕；搜尋收起寬 0、展開 180px 且取得焦點、圖示位置不變、輸入後篩選為 1 張、Esc 後清空收起並恢復 3 張；新增資料夾列在最底並聚焦、無對話框、Enter 建立、Esc 取消；點名稱改名時分類維持展開、Enter 儲存；分類與卡片垃圾桶 hover 顏色同為 rgb(227, 93, 106)；390px 無水平溢出。無 page error。
  - 測試：`library-folders`（更新：就地新增資料夾的取消／空白／失敗保留文字、分類標題內容、就地改名含 Esc 與失敗、垃圾桶 hover 顏色、放大鏡搜尋向左展開與 Esc、手機新增列）通過；`home-navigation`、`auth-center`、`home-delete-dialog`、`deck-file-drop`、`sample-view-actions`、`guest-gallery-contract`、`guest-card-cache`、`guest-gallery-hints`、`mobile-ui`、`slide-library` 共 15 項通過；`entrypoints.test.js` 相關 24 條斷言單獨執行通過。

## 追加：分類名稱雙擊改名、移除「已儲存」提示列（2026-11-12，使用者指示）

- 程式修正 commit：57095357aa2452b4b8ed80c7cc99d614c6b4f3b8
- 修改：
  1. **分類名稱改為雙擊才進入編輯**（與卡片標題一致）：單擊名稱不改名、也不收合分類（避免雙擊時連續開關兩次）；鍵盤 Enter／F2 不變。
  2. **移除「資料夾與排序已儲存」提示與整列**：刪除 `#libraryLayoutMessage`；`library-organizer.js` 的 `status()` 不再顯示進度與成功訊息（正在儲存、已儲存、正在讀取資料夾）。失敗訊息（儲存失敗並恢復原排序、無法讀取資料夾、資料夾上限）改顯示在既有的投影片訊息列 `#libraryMessage`，下一次成功儲存時清除。`home.js` 的 `renderDecks()` 改為只清除自己寫入的「找不到符合名稱的投影片」「正在讀取投影片...」，不會把資料夾錯誤一起清掉。
  - 版本：`home.js?v=cards-3`、`library-organizer.js?v=12`。
- 驗證：
  - `library-folders`：改為以成功的版面儲存次數判斷完成（不再依賴提示文字），且每次成功後確認訊息列為空，包含「先失敗再成功」時錯誤訊息被清除；新增檢查 `#libraryLayoutMessage` 不存在、單擊分類名稱不進入編輯且分類維持展開、雙擊進入編輯；失敗情境改在 `#libraryMessage` 檢查。通過。
  - `home-navigation`、`auth-center`、`home-delete-dialog`、`deck-file-drop`、`sample-view-actions`、`mobile-ui`、`slide-library` 共 12 項通過；`entrypoints.test.js` 相關 24 條斷言單獨執行通過。

## 追加：範例投影片與我的投影片同一套排版、分類伸縮動畫（2026-11-12，使用者指示）

- 程式修正 commit：704d4142de773ad3e4f4befd5fc9dbcbc5dd45f0
- 修改：
  1. **範例清單改用同一條工具列**：`index.html` 的範例清單改為 `.library-toolbar`（左側分類捷徑、份數、放大鏡搜尋向左展開），只是沒有新增資料夾／新增投影片按鈕。因為範例清單是同一個元件，訪客首頁的範例欄也一起改成這條工具列（保留訪客標題與說明）。舊的分類列與搜尋列整列刪除；`#galleryMessage` 沒有訊息時不佔空間。
  2. **範例分類標題與我的投影片相同**：名稱＋右側「共 N 份」；範例的分類名稱與卡片標題都不可編輯（沒有雙擊改名、沒有 `.is-editable` 樣式）。
  3. **分類展開／收合伸縮動畫**：新增 `library-ui.js`，兩邊清單共用 `bindExpandingSearch`（放大鏡搜尋）與 `bindFolderAnimation`（`<details>` 高度動畫 220ms；動畫中再點一次會反向；偏好減少動態效果時直接切換）。`home.js` 改用共用搜尋。
  4. CSS：工具列規則由 `#workspaceMinePanel` 擴大到 `.guest-gallery`，用兩個獨立選擇器（不用 `:is(#id, …)`，避免 ID 權重蓋掉訪客寬螢幕黏性工具列的 `top: -40px`）。
  - 版本：`home.css?v=cards-4`、`home.js?v=cards-4`、`library-organizer.js?v=13`、`guest-gallery.js?v=7`、新增 `library-ui.js?v=1`（在 `guest-gallery.js` 之前載入）。
- 驗證：
  - 截圖探針（隔離伺服器、模擬登入）：範例分頁與我的投影片工具列同高同排；訪客寬螢幕捲動後工具列貼齊頂部列下緣；手機版分類換行、份數與搜尋在下一列；搜尋展開正常；範例分類名稱可編輯數為 0。分類動畫：收合中途高度介於展開與收合之間，結束後 `open=false`、`overflow` 復原；展開中途再點一次會回到收合。
  - 測試修改：`guest-gallery-hints` 先點 `#gallerySearchToggleBtn` 再輸入；`library-folders` 的 `.library-search` 限定在 `#workspaceMinePanel`（頁面上現在有兩個）；`entrypoints` 更新版本並檢查 `library-ui.js` 在 `guest-gallery.js` 之前。
  - `guest-gallery-hints`、`guest-gallery-contract`、`guest-card-cache`、`auth-center`、`home-navigation`、`library-folders`、`sample-view-actions`、`mobile-ui`、`deck-file-drop`、`home-delete-dialog`、`slide-library` 共 16 項通過。`entrypoints.test.js` 以逐條執行檢查：本分支相關斷言（91–97 行）全部通過；其餘失敗為基底既有的過期版本字串（slides runtime、trace、draw 等），與本次無關。

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
