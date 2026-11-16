# 交付紀錄：2026-11-16-slide-animation-editing

## 任務資訊
- 分支：`claude/2026-11-16-slide-animation-editing`（從 intergration `75445de` 開出）
- 依據：同資料夾 `plan.md`（四輪規劃與第 8 節決定），以及使用者實測後的修正要求：
  - 輸入框與程式碼的捲軸改成符合目前風格；
  - 輸入旁的 RUN 和編輯動畫的 RUN 一樣，並且同步；
  - 返回後畫布要縮回原本尺寸；
  - 過場要像組裝：左側從左邊展開、畫布同時移到目前位置、右側分頁從上面落下。

## 修改內容

### 投影片上的動畫只剩畫布
- `slides-embed.css`：runtime 隱藏 `#subTabs` 與輸入、輸出、除錯記錄、語法樹四個分頁；畫布固定顯示。
- `slides-embed.js`：刪除畫布播放列上的 RUN 與畫布上方的錯誤列。放映與編輯畫面的播放列完全相同。

### 投影片編輯欄的動畫區塊（`slides.html`、`slides.css`、`slides.js`）
- 「編輯動畫」按鈕，下面是「輸入」框與 RUN，再下面是狀態文字。
- RUN 與程式碼頁（編輯動畫）的 RUN 相同：綠底白字「▶ RUN」，執行中變深綠並轉圈。
- 輸入框：
  - 等寬字，撐滿編輯欄剩下的高度；
  - 深色細捲軸。
- 改了輸入：
  - 寫回投影片、畫布紅點亮起；
  - 停止輸入 1.5 秒或離開輸入框後自動重新執行；
  - 離開輸入框時記一筆復原歷史。
- 只改輸入時，伺服器重用快取的執行檔，只重新執行（實測 `cache.executable: HIT`，編譯 5.3 ms）。
- 執行中又改輸入：完成後以最新內容再跑一次；`rebuildSlideAnimation` 不會用舊結果覆寫較新的修改。
- 失敗：
  - 保留原動畫；
  - RUN 下方紅框「執行失敗，請到『編輯動畫』查看錯誤」，附錯誤第一行與「開啟編輯動畫」；
  - 「編輯動畫」按鈕出現紅點。
- RUN 同步（雙向）：
  - 編輯動畫的 RUN 開始或結束時，iframe 回報（`asm-embed-run-state`），編輯欄的狀態與紅點跟著更新；
  - 編輯欄 RUN 執行中時，父頁送 `asm-runtime-run-state`，編輯動畫的 RUN 也顯示執行中。
- 輸入同步：
  - 編輯欄 → 編輯動畫：`asm-runtime-set-input`；
  - 編輯動畫 → 編輯欄：`asm-embed-input-changed`。
- 能否 RUN 的判斷：依「只保存執行檔」政策，投影片沒有動畫結果時 `mode` 會正規化成 `legacy`。因此改為「有程式碼、且不是帶 `scriptContent` 的舊版腳本動畫」。
- 依序重建期間顯示執行中；每張完成後重新整理編輯欄。

### 編輯動畫：同一個畫布展開成完整頁面
- 刪除浮動視窗 `#algorithmEditorModal` 與第二個 iframe（`asmEmbed=editor`）、`saveAlgorithmEditor`。
- 新增 `#algorithmEditorPage`：
  - 標題列有「← 返回投影片」、投影片編號與狀態；
  - 背景與標題列由父頁淡入、滑入。
- 打開：
  - 投影片上的 runtime iframe 以 `Element.moveBefore()` 搬進頁面，不重新載入，頁內狀態保留；
  - 父頁送 `asm-embed-set-mode`（editor），iframe 切換 `asm-embed-runtime`／`asm-embed-editor`；
  - 編輯模式隱藏網站頂部列、我的程式碼、範例側欄與手繪工具列，並接上左側設定標籤。
- 組裝式過場（`slides-embed.js` `playAssembly`），分兩段依序播放：
  - 打開：畫布先從投影片上的位置移到右側定位（420 ms），右側分頁從上方落下（300 ms），在畫布就定位時剛好展開完畢；之後左側編輯區從左邊展開（300 ms）。返回時順序相反：左側先收，畫布開始移回時分頁同時收起。
  - 過場中 iframe 頁面背景透明。
  - 畫布的框與內容分開處理：框以 transform＋clip-path 連續變形；內容由 `canva.js` 新增的 `setViewportTransformOverride` 逐幀改寫畫面上的平移縮放（不改鏡頭狀態），世界中心固定在框的中心，縮放倍率以等比連續插值。
  - 起點／終點是投影片上實際的取景：父頁搬動 iframe 前送 `asm-embed-capture-runtime`，iframe 記下 runtime 鏡頭並先隱藏，避免搬動後以 runtime 版面在全頁大小閃一下。
  - 播放列在過場中一直顯示在框的上緣：以同寬同高的佔位元素保留版面（視窗較窄時播放列的最小寬度會撐寬畫布，只保留高度會讓 svg 變窄、鏡頭重新取景而跳動），播放列改為絕對定位，寬度跟著框重新排版，高度與按鈕大小從投影片上的大小連續變成編輯頁的大小。
  - 量測不受過場縮放影響：`trace-code-presenter.js` 的 `safeInsetLeft`（自動取景替程式碼框留的左側空間）與字級用的畫布大小改用版面尺寸；之前過場的 transform 讓它們變動，鏡頭在過場中與結束後重新取景而瞬移。
  - 返回到位時畫布裡的東西也要和投影片完全一致：
    - 程式碼框（HTML，不在鏡頭裡）在打開前記下投影片上的位置與大小，過場中和內容一樣連續移動與縮放；
    - 過場中 `#canvasWrapper`／`#arraySvg` 不裁切（外框仍由 clip-path 裁切），播放列縮成投影片高度後，上方空隙由格線與程式碼框補滿；
    - `trace-structure-lod.js` 在過場中不重新判斷細節：它用 `getScreenCTM` 量格子大小，會把過場縮放算進去而把數字收掉；
    - 回到投影片後，等格子裡的數字補完（`data-asm-lod-pending` 消失，最多 10 幀）才回報 `asm-animation-geometry-ready`，父頁收到後才顯示，不會看到一幀空格子；代價是回到投影片時動畫位置多空白約一兩幀。
  - 返回的目標位置用打開時 iframe 與容器的相對位置換算（`algorithmFrameHomeRect`），不再用容器本身的框。
- 返回（按鈕或 Esc）：
  - 先存回投影片；
  - 反向組裝（`asm-embed-disassemble`）；
  - 搬回投影片後才切回 runtime，讓畫布在投影片的實際大小重新取景。修正了返回後畫布被放大的問題：之前是在全螢幕大小時就切回 runtime。
  - 程式或輸入改過、但編輯頁裡沒 RUN 成最新的，回到投影片後在背景重新執行。
- 不支援 `moveBefore` 時退回重新載入，再送入動畫（沒有連續過場）。系統設定「減少動態效果」時直接切換。
- `trace-editor.js`：`embedMode` 改為每次從 body class 判斷（同一個 iframe 會切換模式）。

### 手動平移縮放同步
- 編輯動畫頁與投影片編輯畫面共用同一份手動平移縮放（`slides.js` `algorithmCameraSurface` 一律用 `slide-editor`；`slides-embed.js` 的鏡頭範圍不再分 runtime／editor）。放映仍是另一份。
- 在投影片上拖動，打開編輯動畫看到相同偏移；在編輯頁拖動或縮放，回到投影片保留。
- `presentation-camera.browser` 的編輯動畫段落改為驗證雙向同步；此測試在前段 `ASMTraceStudio.open()`（Trace Studio 已改為左側標籤）就既有失敗，尚未跑到這一段。

### 程式碼的捲軸
- `style.css`：程式碼編輯器（Ace）的捲軸改為深色細捲軸，程式碼頁與編輯動畫共用。

### 版本
- `slides.js?v=slides-390`（runtime iframe `trace-runtime-142`）、`slides.css?v=animation-sidebar-3`；
- `algorithm.html`：`style.css?v=side-tabs-4`、`slides-embed.css?v=canvas-only-4`、`canva.js?v=trace-26`、`trace-code-presenter.js?v=code-40`、`slides-embed.js?v=trace-28`、`trace-structure-lod.js?v=7`、`trace-editor.js?v=trace-45`。

## 驗證
- 實機（隔離瀏覽器，公開範例 quick-sort）：
  - 展示模式只有畫布；
  - 編輯欄改輸入後紅點亮、自動重跑成新陣列並轉為「已是最新」；
  - 模擬失敗時出現紅框與紅點；
  - 打開與返回各取 3 個時間點截圖，確認組裝順序；
  - 返回後陣列格子高度與打開前相同（68px），畫布沒有放大；
  - 編輯頁改輸入並 RUN 後，返回時編輯欄是新的輸入、狀態「已是最新」；
  - 沒有頁面錯誤。
- 測試：
  - `slide-canvas-toolbar.browser` 改寫（畫布只剩播放列、編輯欄 RUN 成功與失敗、開啟編輯動畫為同一個 iframe 且返回後搬回），1／1 通過。
  - `slide-animation-parity` 的假環境補上 class 切換與輸入框事件，16／17，第 16 項為既有失敗。
- 與改版前（`22fe03f`）逐一比對的 18 個相關測試，以下結果相同：`algorithm-draft-storage`、`event-gap`、`range-selection`、`trace-editor-refresh`、`slide-video-widget`、`slide-edge-snap` 通過。以下改版前就失敗，原因多為 `67bf65a` 改了載入方式：`algorithm-editor-history`、`binary-addition-slide`、`cloud-trace-repair`、`entrypoints`、`presentation-camera`、`read-highlight-defaults`、`sample-local-edit`、`slide-trace-lazy`、`trace-entry-recovery` 第 2 項。`presentation-mode-selection` 從失敗變為通過。
- 未執行完整 regression 與動畫驗證集（依規範由主代理執行）。

## 已知限制與剩餘事項
- 返回過場的終點：投影片打開前的基準鏡頭（依編輯頁裡換幀、重新取景的變化調整）加上現在共用的手動偏移。換幀後兩種版面的自動取景比例不完全相同，可能還有小差異；實測同一幀、在投影片或編輯頁拖動後，1000×720、1200×800、1440×900 三種視窗打開與返回都沒有跳動。
- 打開時，搬動 iframe 到開始過場之間約 3 幀（約 50 ms）畫布是隱藏的。
- 手機版的動畫區塊尚未調整。
- `docs/reference` 的指令文件尚未提到新的編輯欄與編輯頁操作。
