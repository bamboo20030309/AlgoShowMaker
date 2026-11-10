# 2026-11-11-home-entry-batch1：首頁入口第一批（H1＋H2＋H3）

## 任務資訊
- 負責代理：Claude（Claude Code 桌面版）
- 狀態：待交付
- 共同基準 commit：c811a496bafa99adff0c7b96d9031bdaaa097e2c（intergration：fix: align heap peer pointer entry and live arrow anchors）
- 分支：claude/2026-11-11-home-entry-batch1
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.claude\worktrees\project-overview-3e7a15

依據：介面入口修改報告（草稿，尚未提交，位於同一 worktree 的 `docs/ai/agent-tasks/2026-11-10-ui-entry-plan.md`）第 3.1 節與第 5.1 節的 H1～H3。

## 問題與預期結果
- 情境與操作：進入首頁、在投影片與程式碼之間切換、登入後瀏覽自己的投影片與範例。
- 目前行為：頂部三個入口（投影片、範例投影片、演算法動畫）；登入後開 `/?examples=1` 會變成訪客範例頁並隱藏帳號區；程式碼頁沒有回到投影片的模式入口。
- 使用者希望的結果：
  - H1：頂部只留「投影片 / 程式碼」兩種模式，首頁與程式碼頁共用同一份導覽。
  - H2：登入後一進來直接看到自己的所有投影片，不用大卡片；範例改成「我的投影片 / 範例」分頁；`/?examples=1` 照舊可用。
  - H3：未登入首頁維持現狀（左範例、右登入框），右上「登入」聚焦到登入框。
- 本次範圍與必要限制：不動登入流程本身（H4、H5 屬第二批）；不動投影片頁與動畫。

## 需求確認
- 已從使用者或上下文確認：D1～D3、Q2（作品列表分開）見修改報告第 1、4 節；使用者指示「開新分支，先做第一批」。
- 尚待使用者回答：無
- 代理採用的合理假設：
  1. **分頁不跨次造訪記憶**（修改報告原寫「記住上次選的分頁」）。使用者明確要求「一進去就直接看到我的所有投影片」，跨次記憶會讓上次停在範例的人下次直接進範例，與此衝突。改為：分頁寫入網址（`?examples=1`），重新整理停留同一分頁；新進入首頁一律是「我的投影片」。
  2. **側欄兩個項目改為分頁切換**，與標題列分頁同步；移除側欄的「演算法動畫」（已在頂部「程式碼」）。
  3. **窄螢幕保留兩種模式入口**（原本 ≤620px 隱藏頂部導覽），改收掉 GitHub 圖示，≤420px 只留品牌圖示。

## 重現與調查
- 重現狀態：功能調整不適用。
- 已確認事實：`home.js` 已有 `safeNextPath()`（H4 的一部分已存在）；`/?examples=1` 原本先於登入檢查直接走訪客範例頁。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/index.html`、`public/home.js`、`public/home.css`、`public/brand.css`、`public/algorithm.html`、`public/style.css`；測試 `tests/entrypoints.test.js`、`tests/home-navigation.browser.test.js`。
- 共用檔案／介面與協調結果：`brand.css` 由首頁與程式碼頁共用；`algorithm.html` 也是投影片 runtime／editor iframe，模式導覽在 `asm-embed-*` 下隱藏。
- 依賴任務：無

## 驗收條件
- [ ] 首頁與程式碼頁頂部只有「投影片 / 程式碼」，各自標示目前模式；嵌入投影片的 iframe 不顯示。
- [ ] 登入後首頁預設「我的投影片」；可切到「範例投影片」並看到範例列表；「新增投影片」只在我的投影片分頁出現。
- [ ] 登入者開 `/?examples=1` 直接進範例分頁，帳號區仍在；重新整理停在同一分頁。
- [ ] 訪客首頁版面不變；訪客 `/?examples=1` 維持範例全頁；右上「登入」聚焦登入框或回到登入框。
- [ ] 登出後回到訪客首頁，網址不殘留 `examples=1`。
- [ ] 手機（390／320px）不溢出，兩種模式與登入／登出都看得到。
- [ ] 舊有物件相容性：不適用（無持久化資料變動）。

## 驗證計畫
- 子代理小驗證：V1。語法、diff 檢查；隔離服務＋Edge 截圖與互動（登入狀態以攔截 `/api/auth/me`、`/api/slides` 模擬，不寫資料庫）；直接相關測試：`entrypoints`、`home-navigation`、`auth-center`、`library-folders`、`sample-view-actions`、`guest-gallery-contract`、`guest-card-cache`、`guest-gallery-hints`、`deck-file-drop`。
- 舊有物件相容性：不適用；舊網址 `/`、`/?examples=1`、`/algorithm.html` 照舊可用。
- 主代理整合驗收：非動畫，不需演算法驗證集。
- 測試隔離方式：隨機埠啟動本 worktree 的 `server.js`、暫存目錄；不連使用者分頁、不登入真實帳號。

## 變更紀錄
- 2026-11-11：初始定義。
