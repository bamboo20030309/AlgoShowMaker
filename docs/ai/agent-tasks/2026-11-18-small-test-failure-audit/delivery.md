# 小測試未通過原因核實（2026-11-18）

## 範圍與結論

使用者要求只檢查小測試。本輪未啟動大型動畫，也沒有修改產品或正式測試；僅在忽略目錄建立臨時診斷副本。基準 intergration 9f754dc，沿用上輪64個未通過檔案的原始錯誤逐一核對。

**64檔不代表64個已確認的產品bug。** 其中49檔的首個阻擋點與測試前置、fixture或已更動規格有關；2檔抓到同一個產品版本資訊不一致；13檔仍須深入或同時混有量測與行為問題。修好前置後，後段仍可能有產品問題，不可把49檔直接算通過。

先前「52檔前置／規格、12檔待定位」的粗分類需要更正：renderer版本的兩檔屬於產品資訊不一致；八皇后教材匯入的2/9節點數量尚未證明是舊答案，改列待定位。混合物件本輪的第一個錯誤是fixtureCanvas未宣告，不是拖曳位移；修正前置後才重現吸附量測差異。

## 為何大量一起失敗

- 同一個舊前置散落在多份測試。7檔仍等 defaultAnimationCache=stored，但目前前端完成後為 defaultAnimationState=ready、cache=disabled；真正的字元、箭頭或警告斷言尚未開始就逾時。另有舊編輯器iframe、舊事件設定按鈕、未防護的API或fixture識別字。
- 舊測試把永久Trace ID、預建結果與零執行當作答案，但現在保存配方、保留執行檔，開啟後依序執行。這同時影響公開教材、匯出、雲端修復與來源座標測試。
- 7檔仍以studio.objectStyles建立自訂fixture，指令模式已移除該手動欄位。應建立有效的繪圖樣式資料；若舊檔依需求仍應保留自訂值，必須驗證遷移，不能直接刪掉相容性要求。
- 動畫行為已明確更改，但答案未一起遷移：合併初始化、獨立min/max、200ms反白提示、複合符號、鏡頭重整歸零與嵌入介面分工。
- 部分測試檢查實作細節，而非可見結果：CRLF/LF的原字串、display:none的textContent、border為0時的border-color，以及未排除對齊吸附的原始位移。

## 核實後的分類

| 首個阻擋點 | 檔數 | 說明 |
| --- | ---: | --- |
| 就緒訊號／介面前置 | 13 | 等待stored、使用舊iframe／按鈕、或未防護尚未建立的測試變數；先阻擋了真正行為斷言。 |
| 手動樣式fixture | 7 | 測試把自訂值寫進已移除的studio.objectStyles；正常化後值消失。要改成有效繪圖樣式來源，舊檔若仍應支援則須明確遷移，不能刪掉相容性驗證。 |
| 動畫／介面規格已改 | 10 | 舊初始化時長、未計反白提示、舊符號答案、獨立選值事件、額外指標或介面／鏡頭生命週期。要逐個比照已確認需求，而非改回舊產品。 |
| 已變更的Trace生命週期 | 10 | 仍期待永久Trace引用／零執行／舊RUN協定，或把現在重新執行的結果當舊版fixture。需按執行配方流程遷移。 |
| 測資與準備流程 | 2 | 在未載入recipe的首頁生成完整封裝，或對raw Trace缺少的defaultEnabled直接Object.assign；尚未抵達拖檔／256配置的真正驗證。 |
| 待深入／混合原因 | 13 | 仍需逐時定位；包含播放、交接、匯入完成時序、右鍵路由、可見文字量測與幾何，不能直接宣稱全為測試過時。 |
| 舊版本硬編 | 2 | 仍要求舊runtime版本或pointer-4；應核對目前模組宣告及依賴順序。 |
| 來源正規化 | 4 | 直接比較CRLF與LF；成功RUN也等不到原字串相等。 |
| 產品版本資訊不一致 | 2 | 同一份renderer：DOM dataset是trace-291，模組build是trace-292。這不是把測試期待改低就能解決。 |
| 量測判定不當 | 1 | border-width為0卻用border-color判斷多出邊框。應核對實際可見樣式／尺寸。 |

## 代表性小測試診斷

1. char-view第一例：臨時副本只將stored等待換成ready，原本字元、指標、事件、樣式與保存斷言均不變，1/1通過。沒有宣稱第二例或整個正式檔案已通過。
2. style-replay：只將輸入程式CRLF正規化為LF，原樣式、前進、倒退與重播斷言不變，1/1通過。
3. mixed-object-paste第一例：只把fixtureCanvas的等待改為window.fixtureCanvas後，通過準備階段，接著在原20px位移答案失敗，觀測100→115.05。產品有8px對齊吸附；前次Alt診斷已證明首段拖曳停用吸附可達20px。本輪沒有更改答案或將整檔標綠。
4. renderer版本：public/trace-renderer.js的DOM dataset宣告trace-291，而同檔ASMTraceRenderers.build宣告trace-292；pointer-anchor-paint與pointer-children以helpers/builds動態取得模組版本，測試是有效的。應統一產品版本宣告，不能把測試期待調成291。

這些副本只用於定位；原64個未通過狀態不變。診斷證據位於algo-vis-backend/test-results/small-failure-audit-2026-11-18/，不提交Git。

## 64檔逐一對照

同檔可能有多個失敗；下表依第一個阻擋點分類，不代表後段已排除。

| 檔案 | 首個阻擋點 | 下一步 |
| --- | --- | --- |
| `algorithm-editor-history.browser.test.js` | 就緒訊號／介面前置 | 更新編輯器定位與生命週期，保留 undo、本機修改及重開斷言。 |
| `alias-display-name.browser.test.js` | 手動樣式fixture | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `arithmetic-assignment.browser.test.js` | 動畫／介面規格已改 | 按合併初始化、200ms提示及完整複合符號更新；API播放用embed避免預設動畫。 |
| `arrow-index-label.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `binary-addition-slide.browser.test.js` | 已變更的Trace生命週期 | 另外建立明確的舊格式fixture，不能用現行執行結果冒充舊快照。 |
| `char-view.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `cloud-trace-repair.browser.test.js` | 就緒訊號／介面前置 | 先等正確的 runtime frame 和 API 就緒，再檢查修復／儲存。 |
| `compile-pipeline-warnings.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `constant-assignment-drop.browser.test.js` | 動畫／介面規格已改 | 保留下落與格式同行斷言；同步純常數符號規格。 |
| `deck-file-drop.browser.test.js` | 測資與準備流程 | 改用Node或投影片頁生成archive，再測首頁真正的readCover→編輯器匯入；另外核對首頁是否需提供完整封裝API。 |
| `declaration-cell-copy.browser.test.js` | 手動樣式fixture | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `directive-follow.browser.test.js` | 手動樣式fixture | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `eight-queens-loop-playback.browser.test.js` | 測資與準備流程 | 先走正式正規化；保留256種配置與2解的獨立答案。 |
| `eight-queens-or-sample.integration.test.js` | 待深入／混合原因 | 查目前選值／巢狀事件排程及範例事件開關，不改成只驗可建effect。 |
| `eight-queens-teaching-deck.browser.test.js` | 待深入／混合原因 | 核對本次匯入完成訊號、render節點及靜態服務能力，不能僅修改2/9答案。 |
| `entrypoints.test.js` | 舊版本硬編 | 驗模組依賴與實際版本一致，不固定歷史版本號。 |
| `event-settings-source.browser.test.js` | 就緒訊號／介面前置 | 使用目前事件頁籤；同步核對新增輸入、取大／取小分類。 |
| `events-batch-arrows.browser.test.js` | 來源正規化 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `fibonacci-teaching-deck.browser.test.js` | 已變更的Trace生命週期 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `first-frame-name.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `force-recompile.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `formatted-assignment.browser.test.js` | 動畫／介面規格已改 | 保留下落與格式同行斷言；同步純常數符號規格。 |
| `guest-gallery-contract.browser.test.js` | 已變更的Trace生命週期 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `hanoi-hidden-sequence.browser.test.js` | 待深入／混合原因 | 先校準prompt與visual時間，再逐時驗外框先長、格子入場及磁碟連續性。 |
| `hanoi-recursion-sample.browser.test.js` | 待深入／混合原因 | 查移動後owner／continuity key及測試選取器，確認磁碟真消失還是找錯節點。 |
| `hanoi-teaching-deck.browser.test.js` | 已變更的Trace生命週期 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `heap-caller-marker-reentry.browser.test.js` | 來源正規化 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `heap-composite-segments.browser.test.js` | 待深入／混合原因 | 讀可見tspan及其顯示狀態，再依語意定位事件；其餘幾何與RUN需另外核實。 |
| `initializer-visibility.browser.test.js` | 動畫／介面規格已改 | 依語意事件拆分核對選值→初始化，不能改回舊綁定。 |
| `lcs-sample.browser.test.js` | 動畫／介面規格已改 | 普通=和複合賦值分開；按目前LCS的語意事件選幀，保留常數+1覆蓋關係。 |
| `local-camera.test.js` | 已變更的Trace生命週期 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `matrix-label-events.browser.test.js` | 手動樣式fixture | 改用矩陣標籤可用的指令樣式；保留原地放大縮小與來源身分斷言。 |
| `merge-declaration.browser.test.js` | 動畫／介面規格已改 | 分開promptStart與visualStart，保留真正500ms間隔。 |
| `merge-push-handoff.browser.test.js` | 待深入／混合原因 | 先以實際push事件及提交點選範圍，再查副本→正式格接手是否真的留空。 |
| `missing-slide-trace.browser.test.js` | 就緒訊號／介面前置 | 先等正確的 runtime frame 和 API 就緒，再檢查修復／儲存。 |
| `mixed-object-paste.browser.test.js` | 就緒訊號／介面前置 | 先修fixture等待，再把純幾何與吸附分開驗證，保留原位移與群框答案。 |
| `name-fit.browser.test.js` | 手動樣式fixture | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `no-drawing-transition.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `pointer-anchor-paint.browser.test.js` | 產品版本資訊不一致 | 統一DOM與模組的版本宣告後，重跑原完整畫面斷言；不要放寬版本答案。 |
| `pointer-children.browser.test.js` | 產品版本資訊不一致 | 統一DOM與模組的版本宣告後，重跑原完整畫面斷言；不要放寬版本答案。 |
| `pointer-model.browser.test.js` | 舊版本硬編 | 由模組宣告與事件來源選幀；再重驗指標行為。 |
| `pointer-multitarget-entrance.browser.test.js` | 就緒訊號／介面前置 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `pointer-opacity.browser.test.js` | 手動樣式fixture | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `prefix-sum-2d.browser.test.js` | 動畫／介面規格已改 | 驗r/c指向正確位置，不要求舊空列表。 |
| `prefix-sum-multi-source.browser.test.js` | 動畫／介面規格已改 | 普通=和複合賦值分開；按目前LCS的語意事件選幀，保留常數+1覆蓋關係。 |
| `presentation-camera.browser.test.js` | 動畫／介面規格已改 | 依真實畫布／介面分鏡頭；重新整理歸零，勿把頁籤當新畫布。 |
| `read-highlight-defaults.browser.test.js` | 已變更的Trace生命週期 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `restored-comparison.browser.test.js` | 手動樣式fixture | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `sample-latex-load.browser.test.js` | 待深入／混合原因 | 確認匯入完成時序與當前模式，再保留數學首次渲染、離線素材及介面斷言。 |
| `sample-local-edit.browser.test.js` | 就緒訊號／介面前置 | 更新編輯器定位與生命週期，保留 undo、本機修改及重開斷言。 |
| `scaled-text-edit.browser.test.js` | 量測判定不當 | 量測border-width/style或像素外觀，不用無邊框時的繼承顏色推斷有框。 |
| `sequence-layout-timing.browser.test.js` | 待深入／混合原因 | 查outerframe描邊、錨點與共用插值；不可直接加大容許值。 |
| `slide-animation-parity.test.js` | 已變更的Trace生命週期 | 替換為目前執行／完成協定的mock，再核對設定相容性。 |
| `slides-embed-tabs.browser.test.js` | 動畫／介面規格已改 | 分別驗runtime只含畫布、編輯頁可操作分頁。 |
| `standard-segment-tree.browser.test.js` | 待深入／混合原因 | 讀可見tspan及其顯示狀態，再依語意定位事件；其餘幾何與RUN需另外核實。 |
| `structure-length-zero.browser.test.js` | 待深入／混合原因 | 核對格子編輯游標／選取時右鍵事件及選單定位，排除點在文字節點造成路徑差異。 |
| `style-replay.browser.test.js` | 來源正規化 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `table-widget.browser.test.js` | 待深入／混合原因 | 核對格子編輯游標／選取時右鍵事件及選單定位，排除點在文字節點造成路徑差異。 |
| `text-arrays.browser.test.js` | 來源正規化 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `trace-cache-refresh.browser.test.js` | 已變更的Trace生命週期 | 改驗永久執行檔、每次載入執行及會話結果；舊Trace復原另建legacy fixture。 |
| `trace-chunks.browser.test.js` | 待深入／混合原因 | 抓編譯警告、實際source、chunk與hydrate結果，區分來源識別／資料還原／渲染阻塞。 |
| `trace-entry-recovery.browser.test.js` | 已變更的Trace生命週期 | 依新生命週期驗順序、合併重複工作與失敗頁碼，不要求永久延後執行。 |
| `trace-source-coordinates.browser.test.js` | 已變更的Trace生命週期 | 改驗執行配方、正規化來源座標與本次結果；保留CRLF span的獨立答案。 |
| `unresolved-markers.test.js` | 待深入／混合原因 | 將舊private helper測試轉成事件狀態契約，未知目標／空值不可當0；幾何另用真實DOM核實。 |

## 處理順序

1. 先集中就緒、來源正規化、iframe與fixture等待的共用helper；保留所有後段行為斷言。單檔通過不代表同族全部通過。
2. 修產品版本資訊不一致；將版本維持為單一宣告，兩個出口共用。
3. 依現行需求遷移執行配方、樣式fixture及時序答案；已退休的情境須有替代覆蓋才能刪除。
4. 對13檔待定位案例找第一個真正違規點：八皇后OR與教材匯入、河內塔、合併push交接、線段樹複合欄位、樣式可見性、右鍵格子選單、幾何時序、分塊載入與未知目標指標。
5. 每次只跑修正類別與依賴已變更的小測試，不重跑已有效通過項、不啟動大型動畫。
