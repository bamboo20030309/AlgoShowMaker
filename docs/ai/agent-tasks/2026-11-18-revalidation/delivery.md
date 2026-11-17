# 全量重驗與失敗項補驗（2026-11-18）

## 結論

**尚未全部通過，不可視為發布驗收。** 產品基準 intergration 1264de8；完整一輪於 2026-11-17 執行，11-18 完成失敗項補驗。這輪沒有修改產品行為；只修正文字貼上測試的等待防護，避免測試專用變數尚未建立時就拋錯。

| 範圍 | 完整一輪 | 失敗項補驗後 |
| --- | --- | --- |
| 小測試檔 | 317/382 通過、65 未通過 | **318/382 通過、64 未通過**；沒有待執行檔 |
| 小測試內的檢查 | 1132 項：1045 通過、85 失敗、1 略過、1 逾時取消 | 原始統計保留；補驗結果另列，不把部分重跑冒充全量 |
| 大型 runtime 動畫 | 16/20 通過；4 例截圖逾時 | **20/20 通過**，包含逐步採樣與截圖 |
| 大型動畫前置 | slide-order-toggle 通過；雲端儲存與匯入修復失敗 | **1/3 通過**，兩項仍失敗 |
| 手寫事件標準答案 | **71/71 通過**，資料與畫面皆通過 | 本輪全新資料，沒有沿用 |
| 精確事件時鐘 | **10/10 通過**（包含在事件契約中） | 不與71項重複相加 |
| Linux CE/TLE/OLE/MLE 隔離 | **6/6 通過，無略過** | 使用暫時容器；沒有更動部署 |
| 第三方授權 | **225 個元件與 lockfile 一致** | 通過 |

Windows 的記憶體限制驗證有 1 項平台略過；Linux 已補驗。trace-chunks 的 1 項因 180 秒上限取消，仍視為未通過，不能當作載入正常。

## 本次兩個修復的覆核

- 倒退 mark：auto-fixed-playback（1／2倍速）、automark、events-fixed-state 全部通過。目的幀不再多留離開幀的完成標記。
- 巢狀位移：bit-shift、nested-compound-operations、nested-expressions、postfix-presentation 全部通過；十種複合賦值、前後置遞增、下標與位元語意都保留原答案。
- 相較上一輪，6 個原失敗檔現已通過：algorithm-default-sieve、auto-fixed-playback、automark、bit-shift、compound-bitwise-replay、events-fixed-state。其中 default-sieve 包含已退休情境的清理，compound-bitwise-replay 包含正式來源正規化，不能都說成產品修復。另有兩份退休測試檔已移除，不能把刪除算作通過。

## 只重跑失敗部分

1. quick-recursion、merge-bottom-up、lcs-matrix、queens-bits 的原逐步判定均通過，但 PNG 截圖逾時；沒有更改判定答案。只將動畫 worker 設為1重跑這4例，全部含截圖通過（分別753、810、731、307個樣本）。其餘16例沿用本輪有效結果。
2. slides-rich-text-paste 原本在等待 fixtureCanvas 時 ReferenceError。改用 window.fixtureCanvas 的安全等待，避免未宣告識別字先拋錯；原本的新物件／既有物件、字元樣式、emoji游標、繼續打字及儲存重開斷言皆保留，1/1 通過。
3. arithmetic-assignment 的混合不可見來源案例，原檔單獨重跑通過，另以 runtime embed 排除預設動畫的診斷也通過；C12 正式事件契約亦通過。未因此將該整檔標記通過，其初始化180ms與舊符號答案仍失敗。
4. 雲端儲存與匯入修復前置重跑仍失敗，結果與退休的永久 Trace 保存假設有關；在正式遷移並重新驗證前，持續列為未通過。

## 剩餘64檔的首要阻擋點

依前一份逐案調查與本輪錯誤比對：23檔是測試前置／舊介面、29檔是規格或量測過時，9檔行為尚待深入、3檔混合原因。這只是第一個阻擋點分類，前置修好後仍要執行後段斷言；不能推論52檔都沒有產品問題。

優先處理仍待定位的八皇后OR播放、河內塔、push交接、幾何時序、格子右鍵選單與Trace分塊載入；其餘按共同前置、樣式fixture、快取規格、來源座標與量測方式分批遷移。不要放寬答案讓錯誤通過。

| 未通過測試檔 | 分類 | 下一步 |
| --- | --- | --- |
| `algorithm-editor-history.browser.test.js` | 測試前置／舊介面 | 更新編輯器定位與生命週期，保留 undo、本機修改及重開斷言。 |
| `alias-display-name.browser.test.js` | 測試規格／量測過時 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `arithmetic-assignment.browser.test.js` | 測試規格／量測過時 | 按合併初始化、200ms提示及完整複合符號更新；API播放用embed避免預設動畫。 |
| `arrow-index-label.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `binary-addition-slide.browser.test.js` | 測試前置／舊介面 | 另外建立明確的舊格式fixture，不能用現行執行結果冒充舊快照。 |
| `char-view.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `cloud-trace-repair.browser.test.js` | 測試前置／舊介面 | 先等正確的 runtime frame 和 API 就緒，再檢查修復／儲存。 |
| `compile-pipeline-warnings.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `constant-assignment-drop.browser.test.js` | 測試規格／量測過時 | 保留下落與格式同行斷言；同步純常數符號規格。 |
| `deck-file-drop.browser.test.js` | 測試前置／舊介面 | 改用Node或投影片頁生成archive，再測首頁真正的readCover→編輯器匯入；另外核對首頁是否需提供完整封裝API。 |
| `declaration-cell-copy.browser.test.js` | 測試規格／量測過時 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `directive-follow.browser.test.js` | 測試規格／量測過時 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `eight-queens-loop-playback.browser.test.js` | 測試前置／舊介面 | 先走正式正規化；保留256種配置與2解的獨立答案。 |
| `eight-queens-or-sample.integration.test.js` | 行為不符待深入 | 查目前選值／巢狀事件排程及範例事件開關，不改成只驗可建effect。 |
| `eight-queens-teaching-deck.browser.test.js` | 測試規格／量測過時 | 等待本次匯入完成而非先前ready，再核對實際教材結構及三種解法。 |
| `entrypoints.test.js` | 測試前置／舊介面 | 驗模組依賴與實際版本一致，不固定歷史版本號。 |
| `event-settings-source.browser.test.js` | 測試前置／舊介面 | 使用目前事件頁籤；同步核對新增輸入、取大／取小分類。 |
| `events-batch-arrows.browser.test.js` | 測試前置／舊介面 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `fibonacci-teaching-deck.browser.test.js` | 測試規格／量測過時 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `first-frame-name.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `force-recompile.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `formatted-assignment.browser.test.js` | 測試規格／量測過時 | 保留下落與格式同行斷言；同步純常數符號規格。 |
| `guest-gallery-contract.browser.test.js` | 測試規格／量測過時 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `hanoi-hidden-sequence.browser.test.js` | 行為不符待深入 | 先校準prompt與visual時間，再逐時驗外框先長、格子入場及磁碟連續性。 |
| `hanoi-recursion-sample.browser.test.js` | 行為不符待深入 | 查移動後owner／continuity key及測試選取器，確認磁碟真消失還是找錯節點。 |
| `hanoi-teaching-deck.browser.test.js` | 測試規格／量測過時 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `heap-caller-marker-reentry.browser.test.js` | 測試前置／舊介面 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `heap-composite-segments.browser.test.js` | 混合原因／需後續定位 | 讀可見tspan及其顯示狀態，再依語意定位事件；其餘幾何與RUN需另外核實。 |
| `initializer-visibility.browser.test.js` | 測試規格／量測過時 | 依語意事件拆分核對選值→初始化，不能改回舊綁定。 |
| `lcs-sample.browser.test.js` | 測試規格／量測過時 | 普通=和複合賦值分開；按目前LCS的語意事件選幀，保留常數+1覆蓋關係。 |
| `local-camera.test.js` | 測試規格／量測過時 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `matrix-label-events.browser.test.js` | 測試規格／量測過時 | 改用矩陣標籤可用的指令樣式；保留原地放大縮小與來源身分斷言。 |
| `merge-declaration.browser.test.js` | 測試規格／量測過時 | 分開promptStart與visualStart，保留真正500ms間隔。 |
| `merge-push-handoff.browser.test.js` | 行為不符待深入 | 先以實際push事件及提交點選範圍，再查副本→正式格接手是否真的留空。 |
| `missing-slide-trace.browser.test.js` | 測試前置／舊介面 | 先等正確的 runtime frame 和 API 就緒，再檢查修復／儲存。 |
| `mixed-object-paste.browser.test.js` | 測試規格／量測過時 | 幾何測試以Alt停用吸附，另設吸附案例。 |
| `name-fit.browser.test.js` | 測試規格／量測過時 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `no-drawing-transition.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `pointer-anchor-paint.browser.test.js` | 測試前置／舊介面 | 用共用 builds helper 核對版本後繼續原畫面斷言。 |
| `pointer-children.browser.test.js` | 測試前置／舊介面 | 用共用 builds helper 核對版本後繼續原畫面斷言。 |
| `pointer-model.browser.test.js` | 測試前置／舊介面 | 由模組宣告與事件來源選幀；再重驗指標行為。 |
| `pointer-multitarget-entrance.browser.test.js` | 測試前置／舊介面 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `pointer-opacity.browser.test.js` | 測試規格／量測過時 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `prefix-sum-2d.browser.test.js` | 測試規格／量測過時 | 驗r/c指向正確位置，不要求舊空列表。 |
| `prefix-sum-multi-source.browser.test.js` | 測試規格／量測過時 | 普通=和複合賦值分開；按目前LCS的語意事件選幀，保留常數+1覆蓋關係。 |
| `presentation-camera.browser.test.js` | 測試規格／量測過時 | 依真實畫布／介面分鏡頭；重新整理歸零，勿把頁籤當新畫布。 |
| `read-highlight-defaults.browser.test.js` | 測試規格／量測過時 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `restored-comparison.browser.test.js` | 測試規格／量測過時 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `sample-latex-load.browser.test.js` | 行為不符待深入 | 確認匯入完成時序與當前模式，再保留數學首次渲染、離線素材及介面斷言。 |
| `sample-local-edit.browser.test.js` | 測試前置／舊介面 | 更新編輯器定位與生命週期，保留 undo、本機修改及重開斷言。 |
| `scaled-text-edit.browser.test.js` | 測試規格／量測過時 | 量測border-width/style或像素外觀，不用無邊框時的繼承顏色推斷有框。 |
| `sequence-layout-timing.browser.test.js` | 行為不符待深入 | 查outerframe描邊、錨點與共用插值；不可直接加大容許值。 |
| `slide-animation-parity.test.js` | 測試規格／量測過時 | 替換為目前執行／完成協定的mock，再核對設定相容性。 |
| `slides-embed-tabs.browser.test.js` | 測試規格／量測過時 | 分別驗runtime只含畫布、編輯頁可操作分頁。 |
| `standard-segment-tree.browser.test.js` | 混合原因／需後續定位 | 讀可見tspan及其顯示狀態，再依語意定位事件；其餘幾何與RUN需另外核實。 |
| `structure-length-zero.browser.test.js` | 行為不符待深入 | 核對格子編輯游標／選取時右鍵事件及選單定位，排除點在文字節點造成路徑差異。 |
| `style-replay.browser.test.js` | 測試前置／舊介面 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `table-widget.browser.test.js` | 行為不符待深入 | 核對格子編輯游標／選取時右鍵事件及選單定位，排除點在文字節點造成路徑差異。 |
| `text-arrays.browser.test.js` | 測試前置／舊介面 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `trace-cache-refresh.browser.test.js` | 測試規格／量測過時 | 改驗永久執行檔、每次載入執行及會話結果；舊Trace復原另建legacy fixture。 |
| `trace-chunks.browser.test.js` | 行為不符待深入 | 抓編譯警告、實際source、chunk與hydrate結果，區分來源識別／資料還原／渲染阻塞。 |
| `trace-entry-recovery.browser.test.js` | 測試規格／量測過時 | 依新生命週期驗順序、合併重複工作與失敗頁碼，不要求永久延後執行。 |
| `trace-source-coordinates.browser.test.js` | 測試規格／量測過時 | 改驗執行配方、正規化來源座標與本次結果；保留CRLF span的獨立答案。 |
| `unresolved-markers.test.js` | 混合原因／需後續定位 | 將舊private helper測試轉成事件狀態契約，未知目標／空值不可當0；幾何另用真實DOM核實。 |

## 證據與續跑

- 原始全量：algo-vis-backend/test-results/revalidation-2026-11-17/tests.log、after-tests-state.json、summary.json。
- 整理後：final-summary.json、retry-status.json；所有資料留在本機忽略目錄，不提交Git。
- 動畫原始：test-results/animation/2026-11-17T12-07-53-941Z-294809ea/summary.json；補驗：test-results/animation/2026-11-17T16-32-48-536Z-eef5aac1/summary.json。
- 事件：test-results/revalidation-2026-11-17/events-summary.json；資源與授權：同目錄 linux.log、licenses.log。
- 續跑狀態已根據實際通過紀錄，透過既有 readTestState／recordFileResult API 登記 rich-text；保留原始全量結果、測試指紋與重跑紀錄。仍為failed狀態，下次僅排入64個未通過檔及兩個動畫前置；依賴變動則自動失效。
- 未合併main、未發布release、未更新使用者投影片或雲端資料。


## 後續分類核實

本報告保留全量執行當時的分類；後續查到renderer產品自報版本不一致，不能歸咎於測試過時。最新逐檔原因與分類更正見 [小測試失敗核實](../2026-11-18-small-test-failure-audit/delivery.md)。
