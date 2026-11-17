# 小測試未通過原因（2026-11-18）

64 檔：49 檔先卡測試前置、資料或規格遷移；2 檔抓到同一個產品版本缺口；13 檔待查。**前置修好仍須驗後段，不能直接算通過。**

以下每檔只列主要原因與處理方向；診斷副本通過不改變正式未通過紀錄。舊檔自訂值仍須驗證相容或遷移。

| 測試檔 | 原因／處理 |
| --- | --- |
| `algorithm-editor-history.browser.test.js` | 仍找舊編輯器 iframe；更新定位。 |
| `alias-display-name.browser.test.js` | 使用已移除的手動樣式欄位；遷移測資。 |
| `arithmetic-assignment.browser.test.js` | 初始化時長、提示與符號答案過時；更新規格。 |
| `arrow-index-label.browser.test.js` | 等待已退休的 stored 狀態；改等 ready。 |
| `binary-addition-slide.browser.test.js` | 把新執行結果當舊 Trace；另建舊格式測資。 |
| `char-view.browser.test.js` | 等待 stored；改等 ready 後第一例通過。 |
| `cloud-trace-repair.browser.test.js` | iframe API 尚未就緒；修正等待。 |
| `compile-pipeline-warnings.browser.test.js` | 等待 stored，尚未驗到警告；改等 ready。 |
| `constant-assignment-drop.browser.test.js` | 舊答案未含複合符號；同步現行規格。 |
| `deck-file-drop.browser.test.js` | 首頁缺 recipe 模組卻用來生成測資；改準備流程。 |
| `declaration-cell-copy.browser.test.js` | 自訂色寫入退休欄位；遷移樣式測資。 |
| `directive-follow.browser.test.js` | 自訂字級寫入退休欄位；遷移樣式測資。 |
| `eight-queens-loop-playback.browser.test.js` | raw Trace 缺 defaultEnabled；先正規化。 |
| `eight-queens-or-sample.integration.test.js` | 待查：實際播放看不到 OR 動作。 |
| `eight-queens-teaching-deck.browser.test.js` | 待查：匯入節點 2／9，核對完成訊號。 |
| `entrypoints.test.js` | 硬編舊 runtime 版本；改驗目前模組依賴。 |
| `event-settings-source.browser.test.js` | 點擊已移除的設定按鈕；改用事件頁籤。 |
| `events-batch-arrows.browser.test.js` | CRLF／LF 比較失敗；正規化來源。 |
| `fibonacci-teaching-deck.browser.test.js` | 仍要求零執行；改驗配方與執行檔重用。 |
| `first-frame-name.browser.test.js` | 等待 stored；改等 ready 再驗名稱。 |
| `force-recompile.browser.test.js` | 等待 stored；改等 ready 再驗快取。 |
| `formatted-assignment.browser.test.js` | 舊答案未含運算符號；保留格式同行驗證。 |
| `guest-gallery-contract.browser.test.js` | 仍要求教材零執行；同步配方載入流程。 |
| `hanoi-hidden-sequence.browser.test.js` | 待查：提示時間與磁碟交接時序。 |
| `hanoi-recursion-sample.browser.test.js` | 待查：移動後找不到磁碟色塊。 |
| `hanoi-teaching-deck.browser.test.js` | 仍要求零執行；同步配方載入流程。 |
| `heap-caller-marker-reentry.browser.test.js` | CRLF／LF 比較失敗；正規化來源。 |
| `heap-composite-segments.browser.test.js` | 待查：隱藏欄位被算入文字，另有幾何問題。 |
| `initializer-visibility.browser.test.js` | 仍期待選值與初始化合併；更新事件答案。 |
| `lcs-sample.browser.test.js` | 符號與選幀答案過時；分開驗普通／複合賦值。 |
| `local-camera.test.js` | 仍讀永久 Trace 引用；改驗鏡頭不寫入配方。 |
| `matrix-label-events.browser.test.js` | 自訂標籤色寫入退休欄位；遷移測資。 |
| `merge-declaration.browser.test.js` | 700ms 含 200ms 提示；分開核對 500ms 間隔。 |
| `merge-push-handoff.browser.test.js` | 待查：搬移副本與正式格的交接空隙。 |
| `missing-slide-trace.browser.test.js` | iframe API 尚未就緒；修正等待。 |
| `mixed-object-paste.browser.test.js` | 先修 fixture 等待；再排除吸附對位移量測的影響。 |
| `name-fit.browser.test.js` | 字級寫入退休樣式欄位；遷移測資。 |
| `no-drawing-transition.browser.test.js` | 等待 stored；改等 ready。 |
| `pointer-anchor-paint.browser.test.js` | 產品版本不一致：DOM 291、模組 292；統一宣告。 |
| `pointer-children.browser.test.js` | 產品版本不一致：DOM 291、模組 292；統一宣告。 |
| `pointer-model.browser.test.js` | 仍要求 pointer-4；改驗目前版本與事件來源。 |
| `pointer-multitarget-entrance.browser.test.js` | 等待 stored；改等 ready。 |
| `pointer-opacity.browser.test.js` | 透明度寫入退休樣式欄位；遷移測資。 |
| `prefix-sum-2d.browser.test.js` | 仍期待沒有指標；改驗新增 r／c 的位置。 |
| `prefix-sum-multi-source.browser.test.js` | 普通賦值來源保留原值，舊答案額外加符號。 |
| `presentation-camera.browser.test.js` | 誤把 Studio 頁籤當新畫布，並期待重整保留偏移。 |
| `read-highlight-defaults.browser.test.js` | 新 store 沒有執行結果；改驗配方重開執行。 |
| `restored-comparison.browser.test.js` | 自訂色寫入退休樣式欄位；遷移測資。 |
| `sample-latex-load.browser.test.js` | 待查：載入後 editorChrome 可見性。 |
| `sample-local-edit.browser.test.js` | 仍找舊編輯器 iframe；更新定位。 |
| `scaled-text-edit.browser.test.js` | 無邊框卻用邊框色判錯；改量可見外觀。 |
| `sequence-layout-timing.browser.test.js` | 待查：約 0.5px 插值差異，不能放寬容許值。 |
| `slide-animation-parity.test.js` | mock 只支援舊 RUN 協定；更新測試替身。 |
| `slides-embed-tabs.browser.test.js` | 仍期待 runtime 有結果頁籤；同步介面分工。 |
| `standard-segment-tree.browser.test.js` | 待查：RUN 來源等待、隱藏欄位與幾何量測。 |
| `structure-length-zero.browser.test.js` | 待查：格子右鍵未出現插入選單。 |
| `style-replay.browser.test.js` | CRLF／LF 比較失敗；正規化後原斷言通過。 |
| `table-widget.browser.test.js` | 待查：右鍵未出現新增列選單。 |
| `text-arrays.browser.test.js` | CRLF／LF 比較失敗；正規化來源。 |
| `trace-cache-refresh.browser.test.js` | 仍驗永久 Trace 快取；遷移成配方與重試流程。 |
| `trace-chunks.browser.test.js` | 待查：分塊載入超過 180 秒。 |
| `trace-entry-recovery.browser.test.js` | 仍要求未觀看動畫零執行；改驗依序執行。 |
| `trace-source-coordinates.browser.test.js` | 舊 ID 修復與零編譯假設；保留來源座標驗證。 |
| `unresolved-markers.test.js` | 待查：舊 helper 假設與指標幾何混在一起。 |

先修共用等待、來源正規化及版本宣告，再遷移舊資料與答案，最後定位13檔待查問題。只跑相關小測試，保留行為斷言，不放寬答案。

本機證據：`algo-vis-backend/test-results/small-failure-audit-2026-11-18/`（不提交）。
