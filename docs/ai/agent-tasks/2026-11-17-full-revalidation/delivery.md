# 全部驗證重跑

使用者要求：全部驗證再跑一次。執行日期：2026-11-16 晚間至 2026-11-17 凌晨（台北時間）。產品基準：5c35338。全新測試週期：2026-11-16T14-30-16-877Z。

**結果未全部通過，不可作為發布驗收。** 本輪只重跑、保存結果及修正驗證入口的來源掃描，不修改產品行為或放寬標準答案。72 份測試檔失敗不等於已確認 72 個產品 bug；仍須區分規格過時、fixture/mock 不完整、真正行為不符及環境失敗。

## 範圍與結果

| 範圍 | 本輪結果 |
|---|---|
| 全部 Node 測試檔 | 383/383 已執行，311 份通過、72 份失敗、0 份待執行 |
| Node 測試項目 | 1,134 項：1,036 通過、97 失敗、1 跳過、0 取消 |
| 事件標準答案 | 71/71 通過，資料與實際畫面均通過；未沿用舊結果 |
| 精確時鐘 | 10/10 通過，包含 1x/2x 與抵達前後 1ms |
| 大型演算法動畫 | 20/20 最終通過；快速排序首次截圖逾時，使用原完整驗證環境單獨重試後，764 樣本與截圖均通過 |
| 動畫前置流程 | 投影片排序通過；cloud-storage-browser、deck-import-repair 失敗 |
| Linux 後端隔離 | 暫時容器內 6/6 通過，含 CE/TLE/OLE/MLE 與資源回收，無跳過 |
| 第三方授權 | 225 個元件與 lockfile 一致 |

Node 的 1 個跳過是 Windows 無法直接核實的 MLE；另以 Linux 容器實際通過該類驗證，並未把 Windows skip 改寫為 pass。

## 重跑方式與隔離

- 所有 383 個測試檔先建立 fresh 狀態，逐檔執行；沒有沿用過往通過結果。
- 事件入口使用 --all --fresh，重新編譯、觀測全部 71 個案例。
- 動畫以 2 個播放 worker、單一 runtime 環境執行 20 個案例與 3 個前置流程。這仍沿用各案例原先的測資與幀數限制，例如八皇后 N=4，陣列版前 12 幀、位元版前 16 幀；不是窮舉所有輸入。
- 測試服務使用隨機埠、獨立 JWT、測試資料與本機暫存執行／執行檔目錄；沒有操作使用者分頁、停止 3000 或更動私人投影片。
- Linux 驗證容器無對外埠、原始碼唯讀掛載，完成後移除；未重建部署容器。

## 驗證入口修正

初次完整入口在開始測試前，誤把 test-results/follow-ui-probe.js 的舊臨時腳本納入應用程式語法檢查，因此中止。保留原臨時檔，僅在 scripts/validation/regression.js 的來源掃描排除 test-results、tmp、artifact-cache-data 等產生目錄。

排除範圍不影響 tests/ 下的 383 個測試檔清單。修正後重新建立 fresh 狀態，383 份均實際執行。完整入口的正式來源語法檢查與 git diff --check 通過。

## 動畫失敗與限制

- cloud-storage-browser：實際雲端輸出沒有持久化 traceDocument，而測試仍深比對整份約 9 MiB Trace，並期待重開不重新執行；與目前 executable recipe／會話 Trace 規格衝突。保留失敗，不為此恢復永久 Trace。
- deck-import-repair：第一個失敗是 pending 預期 1、實際 0；後段還含舊的持久化 traceDocument 與重開零 RUN 假設。必須遷移契約後再檢查實際修復流程，不能直接改數量讓它通過。
- quick-recursion：首次實際 764 個動畫樣本的 verdict=true、無違規；保存 PNG 時超過 30 秒，驅動器仍將整項列為失敗。第一次獨立補驗另遇準備階段 HTTP 403，屬不同失敗點。最後改用原完整驗證環境、單一 worker 重試，764 樣本與截圖均通過。保留初次失敗紀錄，不將其刪除；最終 20 個演算法案例皆通過，兩個前置流程仍失敗。

## 已確認需更新的測試假設

以下是本輪可直接從測試程式與錯誤訊息核對的規格衝突；不是其餘 72 份失敗的統一解釋：

- algorithm-default-sieve：仍存取 manifest.preview/full 與 IndexedDB Trace 快取，現在預設動畫是 executable recipe。
- guest-gallery-contract、sample-progressive-load、fibonacci-teaching-deck、hanoi-teaching-deck 等：期待預先保存結果、重開時沒有編譯／執行請求，與新生命週期不同。
- arithmetic-assignment 的部分初始化斷言仍使用獨立入場時段，未配合語意事件保留、畫面初始化合併的規則；同檔其餘失敗不能因此一律判為過時。
- presentation-camera 的標題與斷言仍要求暫時偏移跨重新整理保留，使用者已要求重新整理丟棄偏移。
- 部分 style／名稱案例仍讀取被指令模式捨棄的手動 studio 欄位；須先遷移 fixture，再核對畫面。

其他幾何、貼上、樣式、時序、缺失 DOM、逾時等項目都仍列為待追查；不因大型動畫或 71 個契約通過就忽略局部失敗。先前 unresolved-markers 的 8 個失敗本輪仍存在。

## 原始證據（不提交 Git）

以下相對於 algo-vis-backend：

- test-results/full-revalidation-2026-11-16/summary.json：每檔結果、97 個失敗案例與錯誤摘要。
- test-results/regression.tap：383 份完整 Node TAP。
- test-results/regression-state.json：311 份通過、72 份失敗、0 份待執行及依賴指紋；下次續跑仍需核對依賴是否改變。
- test-results/full-revalidation-2026-11-16/progress.json、tests-progress.json：各階段起訖與退出碼。
- test-results/event-contracts/summary.json、records.json：本輪 71 個標準答案核對。
- test-results/animation/2026-11-16T14-31-55-706Z-29669285/：主動畫逐幀資料、失敗視窗、截圖與 summary。
- test-results/animation/2026-11-16T16-00-45-077Z-ad2a9663/：快速排序最終補驗通過的採樣與截圖。
- test-results/full-revalidation-2026-11-16/linux.log、licenses.log：Linux 與授權結果。

未 merge main、未發布 release。後續只續跑失敗或依賴改變的案例；本輪不改標準答案讓它過。

## 72 份失敗測試檔

下表列每份檔案的第一個失敗案例，完整 97 項及後續斷言見本機 summary.json／regression.tap。

| 測試檔（tests/） | 第一個失敗案例 |
|---|---|
| `algorithm-default-sieve.browser.test.js` | older default traces with missing optional settings load, play, cache and reopen without overriding explicit values |
| `algorithm-editor-history.browser.test.js` | animation source loads and dialog reopen preserve independent Ace undo histories |
| `alias-display-name.browser.test.js` | as labels name live, empty, matrix and retained objects without changing source metadata |
| `arithmetic-assignment.browser.test.js` | visible-source initialization has a blank declaration followed by an independent whole-cell assignment |
| `arrow-index-label.browser.test.js` | KMP index-label arrows reach actual index rectangles and survive saved traces |
| `auto-fixed-playback.browser.test.js` | automatic fixed marks survive styled frame tween and match the Studio redraw |
| `automark.browser.test.js` | automark limits each frame SVG and keeps manual marks through tween, Studio and reload |
| `binary-addition-slide.browser.test.js` | an outdated segment tree slide rebuilds and animates its first parent sum |
| `bit-shift.integration.test.js` | shift metadata evaluates RHS once and retains native bit identities |
| `char-view.browser.test.js` | char string cells, pointers, events, styles and saved snapshots keep source identity |
| `cloud-trace-repair.browser.test.js` | cloud save repairs an unseen animation and manual RUN updates cloud/export IDs together |
| `compile-pipeline-warnings.browser.test.js` | RUN reports syntax, analysis, trace and drawing failures without hiding them behind successful output |
| `compound-bitwise-replay.integration.test.js` | compound bit rows retain committed intermediate values instead of exposing frame-final bits |
| `constant-assignment-drop.browser.test.js` | constant and invisible sources fall from above for assignment and compound assignment |
| `deck-file-drop.browser.test.js` | external deck files drop onto import and add controls, workspace creates and persists a new deck |
| `declaration-cell-copy.browser.test.js` | insertion key initializer copies the visible cell, preserves its source and supports saved traces |
| `directive-follow.browser.test.js` | text, arrow and variable-index style follow their own events, including disabled events and pause |
| `eight-queens-loop-playback.browser.test.js` | loop sample covers all 256 configurations without event-heavy skipped intervals |
| `eight-queens-or-sample.integration.test.js` | queen sample exposes both OR operands and animates L, M and R results |
| `eight-queens-teaching-deck.browser.test.js` | published queens deck retains three methods, lazy Trace IDs and editable structures through import/export |
| `entrypoints.test.js` | all algorithm surfaces load the same shared modules in dependency order |
| `event-settings-source.browser.test.js` | automatic event toggles persist in asm-view and survive RUN |
| `events-batch-arrows.browser.test.js` | user-written compact sieve frames render batch SVG arrows without detail event animation |
| `events-fixed-state.browser.test.js` | post-loop compact sieve preserves automatic marks while skipping runtime animations |
| `fibonacci-teaching-deck.browser.test.js` | Fibonacci teaching deck compares recursion and array DP and rebuilds its animation |
| `first-frame-name.browser.test.js` | KMP first-frame names stay centered after RUN from hidden canvas tabs |
| `force-recompile.browser.test.js` | normal RUN caches binaries, force remains API-only and removed shortcuts submit nothing |
| `formatted-assignment.browser.test.js` | all field formats travel with their value rather than appearing as stationary prefixes |
| `guest-gallery-contract.browser.test.js` | official gallery thumbnails and saved Merge Sort/Queens decks open without compiler requests |
| `hanoi-hidden-sequence.browser.test.js` | hidden Hanoi ans uses visual-only expansion then complete cell entry |
| `hanoi-recursion-sample.browser.test.js` | Hanoi sample draws three disk pegs left of the completed recursion tree |
| `hanoi-teaching-deck.browser.test.js` | Tower of Hanoi teaching deck explains the lesson and rebuilds its final animation |
| `heap-caller-marker-reentry.browser.test.js` | an invisible caller marker never shifts the outgoing heap parameter label |
| `heap-composite-segments.browser.test.js` | heap fields and local segments render at root and child coordinates |
| `initializer-visibility.browser.test.js` | initializer visibility controls joined entry; pointer assignment moves continuously |
| `lcs-sample.browser.test.js` | LCS matching labels stay green while +1 replaces the old target value |
| `local-camera.test.js` | cloud projection strips old temporary cameras for both inline results and ID-only animations |
| `matrix-label-events.browser.test.js` | matrix row and column label cells preserve their variable/index provenance across event playback and old saves |
| `merge-declaration.browser.test.js` | saved Merge Sort frame 26 joins each initialized declaration and preserves exact gaps |
| `merge-push-handoff.browser.test.js` | Merge Sort first push hands off its cell immediately and retains its source pointer |
| `missing-slide-trace.browser.test.js` | workshop prefix animation with a missing ID rebuilds once, renders and survives reload |
| `mixed-object-paste.browser.test.js` | mixed selection pastes and transforms (structure and code) |
| `name-fit.browser.test.js` | outerframe names fit narrow and growing frames, keep, and stored font limits |
| `no-drawing-transition.browser.test.js` | plain RUN releases old animation, then edited KMP source creates its own trace without reload |
| `pointer-anchor-paint.browser.test.js` | part(38) pointer anchors stay unpainted across frames 8 to 9 and the following merge |
| `pointer-children.browser.test.js` | recursive merge pointers address the retained direct children, survive reload, and hide past the end |
| `pointer-model.browser.test.js` | browser renderer uses canonical pointer states without a silent legacy fallback |
| `pointer-multitarget-entrance.browser.test.js` | new KMP j pointer enters at p while the existing s pointer moves independently |
| `pointer-opacity.browser.test.js` | legacy, independent and matrix pointers default to opaque labels without overwriting stored colors |
| `prefix-sum-2d.browser.test.js` | two-dimensional prefix sum renders four colored build steps |
| `prefix-sum-multi-source.browser.test.js` | prefix sum frame 48 animates all four matrix sources together |
| `presentation-camera.browser.test.js` | temporary camera gestures stay local, survive reload, and isolate each interface |
| `read-highlight-defaults.browser.test.js` | read emphasis defaults off, uses pure red when enabled, and preserves saved choices |
| `restored-comparison.browser.test.js` | original comparison visuals run on the current scheduler at 1x and 2x |
| `sample-latex-load.browser.test.js` | sample loading never paints editor chrome and renders math on first insertion without CDN |
| `sample-local-edit.browser.test.js` | sample copies edit temporarily, export edits and reset on reload without remote writes |
| `sample-progressive-load.browser.test.js` | prebuilt sample deck opens with playable animations without analyze or compile requests |
| `scaled-text-edit.browser.test.js` | editing scaled old text preserves its transforms and styles |
| `sequence-layout-timing.browser.test.js` | recursive frame 30 to 31 retains old layout position until the cell insertion |
| `slide-animation-parity.test.js` | the slide editor recompiles an outdated saved trace and migrates its Studio settings |
| `slide-trace-lazy.browser.test.js` | slides fetch Trace only upon visiting its page, save IDs and play after reopen/export |
| `slides-embed-tabs.browser.test.js` | algorithm slide embeds expose and switch the original result tabs |
| `standard-segment-tree.browser.test.js` | standard n=10 segment tree uses proportional intervals at natural recursion depths |
| `structure-length-zero.browser.test.js` | heap editing targets the clicked cell and linear structures resize with zeroes |
| `style-replay.browser.test.js` | sieve frame styles follow forward, backward and repeated playback |
| `table-widget.browser.test.js` | table widget edits cells, dimensions, headers and persisted data |
| `text-arrays.browser.test.js` | array text interpolation renders in SVG, TTS, Studio and after snapshot replay |
| `trace-cache-refresh.browser.test.js` | published sample and default animation load without compile jobs; warm default uses local cache |
| `trace-chunks.browser.test.js` | chunked checkerboard trace reaches canvas; legacy documents reopen; marker availability is unchanged |
| `trace-entry-recovery.browser.test.js` | export repairs an unseen stale animation and names the failing page when repair fails |
| `trace-source-coordinates.browser.test.js` | CRLF archive recovery turns red, preserves LF coordinates and saves the repaired ID |
| `unresolved-markers.test.js` | a newly declared marker starts in the unresolved group before assignment motion |

3100 已重啟，HTTP 200，前端 trace-367。未停止 main 的 3000。
