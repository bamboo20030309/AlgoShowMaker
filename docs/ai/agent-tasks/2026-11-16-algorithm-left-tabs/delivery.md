# 交付紀錄：2026-11-16-algorithm-left-tabs

## 任務資訊
- 分支：`claude/2026-11-16-algorithm-left-tabs`（從 intergration `faa26c6` 開出）
- 依據：同資料夾 `plan.md`；使用者 2026-11-16 的決定（標籤名、C++ 位置、RUN 與輸入不動、按鈕與寫回邏輯不變、所有調整記入歷史、不做事件時間線、刪除放大檢視、風格一致）。
- 同分支另有首頁小修 `4df9be7`（登入副標、範例說明、密碼顯示改為閉眼／開眼圖示），與本任務無關。

## 修改內容

### 版面（`algorithm.html`、`style.css`）
- 左側面板標頭：左邊是「原始碼／程式碼框／事件動畫」三個標籤（`role="tab"`，方向鍵、Home／End 可切換）；右邊依序是「C++」、RUN（原位置）、摺疊鈕。
- 三個標籤內容：`#codeBody`（Ace）、`#codeFramePanel`、`#eventAnimationPanel`。沒有動畫時，後兩個標籤顯示「按 RUN 產生動畫後…」。
- 記住上次的標籤（localStorage，讀寫包 try/catch）；RUN 不會切換標籤。
- 標籤樣式沿用右側分頁的圓角與藍色底線，配色跟著深色程式碼面板；設定內容沿用原 Studio 的深色樣式。
- 刪除頂部「編輯動畫」「事件設定」按鈕。「輸入」維持在右側。
- `#codePanel header` 的樣式改為 `#codePanel > header`（`style.css`、`mobile-ui.css`），避免套到事件設定表格的 `<header>`；修正後表格的「預設動畫」「列進事件程式碼」欄位與勾選框對齊。

### 設定標籤（`trace-studio.js` 1660 → 約 1090 行）
- 事件按鈕、程式碼片段、程式碼框外觀與寫回 `@asm-view` 的 40 個函式，以腳本從舊檔原樣搬入（只刪掉對縮圖列、事件時間線、右欄工具列的重畫呼叫）。
- 「程式碼框」標籤：這一幀的程式碼片段（含恢復自動篩選）；整份動畫的程式碼框外觀。
- 「事件動畫」標籤：這一幀的事件程式碼與自動固定；整份動畫的事件設定（原頂部浮窗，由 `trace-editor.js` 建立並掛入）。浮窗內的事件間隔仍在，原 Studio 重複的間隔滑桿移除。欄名「列入事件線」改為「列進事件程式碼」（它決定哪些事件出現在事件程式碼清單；事件時間線已不存在）。
- 標籤上方顯示「第 N 幀／共 M 幀」與 ↶ ↷。
- 「這一幀」跟著播放器目前幀（`asm:trace-frame`）；只有設定標籤顯示時才重畫，否則標記待更新，切換過去時再補。
- 復原歷史：
  - 程式碼框與事件動畫的每次調整都記錄並寫回程式碼（沿用原 `recordHistory`）。
  - 整份動畫的事件設定改動也記入歷史：`saveEventSettings` 的事件帶 `userEdit`；是否寫回程式碼仍依原本的 `persistDocument` 規則。
  - 還原時同步更新事件設定表格。
  - Ctrl＋Z／Ctrl＋Y 只在設定標籤顯示、焦點不在文字輸入、且不在手繪模式時作用；原始碼標籤中仍是 Ace 自己的復原。
- 點畫布上的程式碼框會切到「程式碼框」標籤（左側面板摺疊時不切換）。
- 刪除：切片縮圖列與縮圖快取、事件時間線、右欄寬度拖曳、多選幀、Studio 本地鏡頭與 Studio 模式（`asm-trace-studio-open`）、程式碼片段「放大檢視」按鈕。
- `window.ASMTraceStudio` 名稱保留：
  - 新增 `attach`、`detach`、`showTab`、`currentTab`、`undo`、`redo`；
  - `open` 改為切到設定標籤，`close` 只把設定寫回程式碼；
  - `refresh`、`flushSourceSettings` 不變。

### 其他模組
- `trace-editor.js`：
  - 載入動畫時直接 `attach`（取代延遲開啟 Studio），清除動畫時 `detach`；
  - 事件設定面板改為掛在「事件動畫」標籤；
  - 修正事件類型勾選框寫入舊設定物件的問題：載入帳號預設後 `eventSettings` 會換成新物件，畫面因內容相同而沒有重畫。原本浮窗也有這個潛在問題，改為點擊當下才取設定物件。
- `compile.js`：RUN 前改為 `flushSourceSettings()`（原本是關閉 Studio）。
- `trace-player.js`、`canva.js`、`trace-debug-recorder.js`：移除 Studio 模式的分支與 `setLocalCameraStudio`。
- `mobile-ui.js`／`.css`：移除手機版 Studio 的「幀」「屬性」抽屜與「編輯動畫」「事件設定」項目。
- `slides-embed.css`：runtime 隱藏規則刪除三個 Studio 選擇器（`#codePanel` 原本就整個隱藏）。
- CSS：`trace-studio.css`、`trace.css` 刪除已無使用的選擇器 95 個；新增左側設定標籤的版面。
  - 片段清單的垂直滾輪交給整個標籤捲動（原本 `overscroll-behavior: contain` 讓框內無法捲動）；
  - 程式碼行按鈕左右貼齊外框。
- 版本：
  - `algorithm.html`：`style.css?v=side-tabs-2`、`slides-embed.css?v=side-tabs-1`、`trace.css?v=trace-41`、`trace-studio.css?v=trace-67`、`mobile-ui.css?v=side-tabs-2`、`canva.js?v=trace-24`、`trace-player.js?v=trace-34`、`trace-debug-recorder.js?v=debug-10`、`trace-editor.js?v=trace-44`、`compile.js?v=syntax-14`、`trace-studio.js?v=trace-144`、`mobile-ui.js?v=mobile-7`；
  - `slides.html`：`slides.js?v=slides-373`（iframe `trace-runtime-128`）、`mobile-ui.css?v=viewer-sidebar-7`、`mobile-ui.js?v=mobile-7`。

### 文件
- `docs/reference/algorithm-visualization-directives.md`：
  - 適用介面、「事件動畫與左側設定標籤」章節、呼叫函式與事件程式碼的說明、程式碼框字體的入口；
  - 刪除過時的「在 Trace Studio 調整文字大小」；
  - 更新紀錄新增 2026/11/16。

## 驗證
- 實機（隔離瀏覽器）：
  - 三個標籤切換與外觀；
  - 事件按鈕關閉後 `@asm-view` 出現 `false`，Ctrl＋Z 還原、Ctrl＋Y 重做；
  - 整份動畫「呼叫函式」勾選後可單獨復原；
  - 點畫布程式碼框切到程式碼框標籤；
  - 摺疊時標籤隱藏；
  - 片段框滾輪捲動 194px、按鈕貼齊；
  - 事件設定表格欄位置中對齊（427／510px）；
  - `asmEmbed=editor` 顯示新面板，`asmEmbed=runtime` 隱藏且不接上設定；
  - 無頁面錯誤。
- 測試更新：
  - `event-code-tree`（preflight 改看 `attach`／`setSideTab`）；
  - `studio-event-availability`（改測通知合併與標籤可見性，刪除縮圖測試）；
  - `mobile-ui`、`directive-only-studio.browser`（三標籤、C++ 位置、拖曳只平移視角不改物件座標）；
  - `trace-code-snippet.browser`（事件間隔位置、刪除寬度拖曳與放大檢視斷言）；
  - `studio-availability-preflight.browser`（選擇器限定在事件動畫標籤）；
  - `scene-load-performance.browser`（切到設定標籤不重畫場景）；
  - `event-gap.browser`、`read-highlight-defaults.browser`（改用 `showTab`）；
  - `canvas-mouse-shortcuts.browser`（刪除 Studio 模式斷言）。
  - 刪除 `studio-virtual-rail.browser.test.js`（縮圖列已移除）。
- 結果：
  - 單元：`event-code-tree` 6／6、`studio-event-availability` 5／5、`mobile-ui` 4／4、`directive-only-studio` 7／7、`view-source-compaction` 10／10、`trace-code-snippet` 4／4、`slide-animation-parity` 16／17（既有失敗）。
  - 瀏覽器：`directive-only-studio`、`trace-code-snippet`、`studio-availability-preflight`、`scene-load-performance`、`event-gap`、`canvas-mouse-shortcuts`、`code-panel-settings`、`keep-camera-focus`、`linear-keep-frozen`、`source-newlines`、`slide-canvas-toolbar`、`presentation-mode-selection` 通過。
- 既有失敗（與改版前 `4df9be7` 的暫時 worktree 比對，失敗項目相同）：
  - `algorithm-default-sieve`、`auto-fixed-playback`、`automark`、`event-settings-source`、`events-batch-arrows`、`events-fixed-state`、`heap-caller-marker-reentry`、`presentation-camera`、`text-arrays`、`trace-chunks`；
  - `read-highlight-defaults` 第 2 項、`eight-queens-or-sample`、`playback-parity` 5 項。
  - `entrypoints` 在第 30 行（寫死的 runtime 版本號）就失敗，後面與 Studio 有關的舊斷言也已過時，未修。
- 未執行完整 regression 與動畫驗證集（依規範由主代理執行）。

## 剩餘事項與合併注意
- `entrypoints.test.js` 需整體更新寫死的版本號與 Studio 舊斷言（既有問題）。
- 展開式編輯器示意圖（介面改版階段 4）的屬性欄要改成本次的左側三標籤。
- 合併：在 intergration worktree 執行 `git cherry-pick faa26c6..claude/2026-11-16-algorithm-left-tabs`（含規劃、首頁小修與本次改版）。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
