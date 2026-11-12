# 2026-11-13-login-entry-batch2 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：claude/2026-11-13-login-entry-batch2
- 共同基準 commit：e99e23e（交付時 intergration 已前進到 b0d99e0，尚未試合併）
- 程式修正 commit：683d612ba6465853ee4cd92cba8243f7a46358c1
- 驗證時的 HEAD 與未提交修改：683d612；工作目錄另有未追蹤的介面入口報告草稿（`2026-11-10-ui-entry-plan.md`）與 `.claude/`，不屬本次交付。原本未追蹤的 `2026-11-10-event-follow-audit.md` 草稿已由 intergration 的 `2824911` 提交（內容不同），本機草稿移到代理暫存區備份，未覆蓋。
- 驗證日期：2026-11-13

## 根因與修改
- 修改檔案及用途（`algo-vis-backend/` 下）：
  - `public/my-codes.js`（新）：「我的程式碼」側欄。
    - 開關：頂部 `#myCodesBtn`（可鍵盤操作、`aria-expanded`）；點外面或 Esc 關閉；打開時收起「演算法範例集」；對外提供 `window.ASMMyCodes = { open, close, isOpen }`。
    - 未登入：「登入後可儲存程式碼」＋「登入」（`/?next=目前路徑與查詢`），不呼叫 API。
    - 已登入：「儲存目前程式碼」展開表單（標題必填、說明選填、一併儲存輸入資料）；清單顯示標題、日期、說明；點項目載入到編輯器與輸入框並寫入本機草稿後關閉側欄；垃圾桶 hover 為紅色，點了在項目內確認「刪除『X』？刪除後無法復原。」。
    - 401／403：清除本機憑證，呼叫 `ASMSiteHeader.apply()` 讓頂部列也回到訪客，側欄改顯示登入提示。
    - 清單全部以 `textContent` 建立（舊版用 `innerHTML` 拼字串）。
  - `public/algorithm.html`：頂部加「我的程式碼」；新增 `<aside id="myCodesPanel">`；載入 `my-codes.js?v=1`（在 `front.js` 之後）。版本：`front.js?v=frame-endpoints-64`、`style.css?v=my-codes-1`、`mobile-ui.css?v=my-codes-1`、`mobile-ui.js?v=mobile-6`、`slides-embed.css?v=random-id-13`。
  - `public/front.js`：刪除舊登入視窗（登入／註冊／登出／忘記／重設）與舊「我的程式碼」整段（約 740 行，元素自 V4.4 起已不存在）；「演算法範例集」的互斥改呼叫 `ASMMyCodes.close()`。
  - `public/style.css`：`#myCodesPanel` 與 `#algoSidePanel` 共用外框；兩者 `top` 改為 `var(--header-height)`（共用頂部列 52px，原寫死 50px）；新增側欄內容樣式。
  - `public/mobile-ui.css`、`public/mobile-ui.js`：手機版側欄尺寸共用；「更多」加「我的程式碼」。`public/slides.html` 同步 `mobile-ui.js?v=mobile-6`。
  - `public/slides-embed.css`：嵌入模式隱藏 `#myCodesPanel`（取代已不存在的 `#myCodesSidebar`）。
  - `public/home.js`（`home.js?v=login-next-1`）：
    - 忘記密碼模式密碼欄不再 `required`（原本隱藏但必填，瀏覽器靜默擋下送出，**重設信永遠寄不出去**）。
    - 重設密碼模式隱藏 Email 且不必填（token 已識別帳號，原本要求填一個用不到的欄位）。
    - 忘記密碼送出時帶 `next`；重設成功後網址保留 `?next=`，登入後回原頁。
  - `server.js`：`/api/auth/forgot-password` 接受選填 `next`，經 `safeReturnPath()`（本站相對路徑、非 `//`／`/\`、無控制字元與反斜線、≤500 字）後附在重設連結 `&next=`。不合法一律丟棄。
- 資料相容：`/api/codes` 與 `CodeModel` 未變；已存程式碼直接可讀（3104 預覽以使用者帳號開側欄，5 筆既有程式碼正常列出，未修改任何資料）。
- 與 task.md 的差異：無。

## 驗收條件對照
- 舊登入死碼移除：`entrypoints` 斷言 `front.js` 不含 `loginTriggerBtn`；`my-codes` 測試確認頁面沒有 `#loginModal`／`#loginTriggerBtn`。
- 未登入提示與 `next`、不呼叫 API：`my-codes` 測試。
- 儲存（空標題不送出、送出內容含輸入）、HTML 標題以純文字顯示、載入、刪除取消／確認、登入過期回訪客：`my-codes` 測試。
- 從程式碼頁登入、註冊、忘記密碼帶 `next`、重設後登入回程式碼頁、未登入開 `?deck=` 登入後回投影片、四種不合法 `next` 被忽略：`login-next` 測試；`safeReturnPath` 另以 8 組值檢查。
- 手機「更多」：`mobile-ui` 測試改為檢查四個項目名稱。
- 截圖：未登入、清單（hover）、儲存表單、刪除確認、手機（390px），無主控台錯誤。

## 小驗證與重跑方式
### 相關測試（V1）
```
node --test tests/my-codes.browser.test.js tests/login-next.browser.test.js tests/auth-center.browser.test.js tests/auth.integration.test.js tests/home-navigation.browser.test.js tests/mobile-ui.test.js tests/slides-embed-tabs.browser.test.js tests/sample-view-actions.browser.test.js tests/library-folders.browser.test.js tests/guest-gallery-hints.browser.test.js
```
- 結果：13 通過、0 失敗、2 略過（`auth.integration` 需要資料庫的案例）。
- `entrypoints.test.js` 以逐條執行檢查：本次新增與修改的斷言（62–66、101 行一帶）全部通過；其餘失敗為基底既有的過期版本字串（slides runtime、trace、draw、slide-structures 等），與本次無關，行號因新增 4 行整體下移。

### 測試修改說明
- `mobile-ui.test.js`：「更多」原本斷言 3 個額外項目，現在是 4 個，改為檢查名稱（範例、我的程式碼、編輯動畫、事件設定）。
- `entrypoints.test.js`：更新 `style.css`、`home.js` 版本；新增 `my-codes.js` 載入順序與無舊登入程式的斷言。

## 剩餘事項與合併注意
- intergration 已前進到 `b0d99e0`，合併前請先試 cherry-pick（`git cherry-pick e99e23e..<本分支 HEAD>`）。`front.js`、`algorithm.html`、`style.css` 是常被其他代理修改的檔案，可能需要處理衝突。
- 未做：`style.css` 中舊登入視窗與舊清單的殘留樣式（`.modal-footer`、`.code-item`、`.btn-delete-code` 等）未清理，需另確認其他頁是否使用。
- 伺服器 `forgot-password` 查無帳號時回 404「找不到此帳號」，可被用來確認 Email 是否註冊（帳號列舉）；屬既有行為，本次未改。
- 未以真實帳號實際收發重設信驗證（需寄信設定與資料庫）；流程以模擬 API 驗證。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
