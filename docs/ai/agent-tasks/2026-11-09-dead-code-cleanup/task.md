# 2026-11-09-dead-code-cleanup：移除確定未使用的程式與檔案

## 任務資訊
- 負責代理：Claude（Claude Code 桌面版）
- 狀態：待交付
- 共同基準 commit：b54de290125185c7609513514945f0b985f164a9（intergration）
- 分支：claude/2026-11-09-dead-code-cleanup
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.claude\worktrees\project-overview-3e7a15

分支名稱用 `claude/` 而非 `codex/`，因為執行代理是 Claude，以便區分兩個 AI 的工作。

## 問題與預期結果
- 情境與操作：使用者要整理專案，要求清掉盤點出的第一批廢 code（盤點見 `claude/project-overview-3e7a15` 分支的 `docs/ai/agent-tasks/code-audit-2026-11-09.md` 與交接文件任務 A）。
- 目前行為：多個函式與表單變數沒有任何呼叫或賦值，三個檔案沒有被引用。
- 使用者希望的結果：移除這些內容，不改變任何可見行為。
- 本次範圍與必要限制：只刪除確定未使用的內容；舊版 `AV.hpp`／CodeScript 流程仍有 19 個範例使用，不動。Trace 資產、重複函式、可能的 bug 不在本次範圍。

## 需求確認
- 已從使用者或上下文確認：使用者說「開始清理第一批檔案」，即交接文件的任務 A。
- 尚待使用者回答：無
- 代理採用的合理假設：刪除後連帶失去用途的內容一併移除——`suppressAutoSave` 旗標（只在已刪的空操作前後切換）、`treeNodes`（只被已刪的 `treePositions` 使用）。

## 重現與調查
- 最小操作步驟或 fixture：不適用（刪除未使用程式）。
- 重現狀態：功能新增／修正不適用。
- 已確認事實：在基準上以 `git grep -w` 全 repo 搜尋（含 tests、`.hpp`、HTML），各函式名稱只出現在自己的定義；14 個 `let` 在 `trace-studio.js` 中沒有任何賦值；`pch` 只出現在 `pch.hpp` 自身與歷史紀錄；`load-barcodes-deck.html` 無引用，`barcodes_dp_deck.json` 只被它引用。
- 尚待調查：無

## 修改邊界與依賴
- 預計修改檔案或模組：`public/trace-studio.js`、`front.js`、`slides.js`、`draw/draw_text.js`、`slide-structures.js`、`trace-directive-assist.js`、`trace-frame-tween.js`；刪除 `public/load-barcodes-deck.html`、`public/barcodes_dp_deck.json`、`lib/pch.hpp`。
- 共用檔案／介面與協調結果：未改任何對外 API（`window.ASMTraceStudio` 等）；刪除的都是模組內部或全域但無引用的函式。
- 依賴任務：無

## 驗收條件
- [ ] 所有修改的 JS 通過語法檢查，`git diff --check` 無問題。
- [ ] 刪除後重掃，不出現新的無呼叫者函式。
- [ ] 首頁、演算法頁、投影片頁載入無新的 page error／console error。
- [ ] Trace Studio 可開啟、目標變數選單有內容、點擊畫布物件與關閉正常。
- [ ] 公開範例投影片（含樹狀結構的線段樹教材）可載入與點選。
- [ ] 舊有物件相容性：不適用，見下方說明。

## 驗證計畫
- 子代理小驗證：V1。語法與差異檢查、重掃、隔離服務下以 Edge 無頭瀏覽器對修改前後各跑一次同一冒煙腳本並比對。
- 舊有物件相容性：不適用。沒有新增或改變任何持久化欄位；刪除的 Studio 表單從未賦值，不會讀寫已儲存資料。
- 主代理整合驗收：非動畫刪除，不需演算法驗證集；合併後依規則決定是否補跑相關小測試。
- 測試隔離方式：隨機埠啟動各自 worktree 的 `server.js`，暫存目錄另建；不連使用者分頁、不登入、不寫雲端。

## 變更紀錄
- 2026-11-09：初始定義。
