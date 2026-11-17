# 全量驗證失敗原因與舊測試清理（2026-11-17）

## 範圍與原始結果

基準為 intergration 7e6d3c3（產品基準 5c35338）。上一輪完整執行 383 個測試檔，311 通過、72 失敗；1134 項檢查中 1036 通過、97 失敗、1 項平台略過。71/71 事件契約、10/10 時鐘檢查、20/20 大型動畫及 Linux 資源限制 6/6 通過。這些是清理前結果，不因刪除舊案例改寫成通過。

本次只分析原因、清理退休測試與修訂驗證索引，沒有修正產品或放寬答案。診斷用臨時變體不視為正式測試通過；未完成的後段斷言仍須重驗。

## 確認的產品缺口

1. 巢狀位移賦值：`number <<= amount++` 數值正確，卻沒有 bitShift 中間資料。相較常數與普通變數 RHS，後置遞增版本缺少位移事件。trace-instrumenter.js 的 nested mutation 提早返回，繞過 event_shift_assign；應保留 RHS 單次求值、先取舊值與後置寫回順序，再輸出外層位移語意。
2. 倒退後自動 mark 晚一幀：前進正確，倒退到 [0,1] 卻保留 [0,1,2]；原始 auto-fixed 測試單獨重跑仍失敗，另兩檔有同型結果。需追查倒退目的幀的 fixed 樣式來源及提交，不可改答案接受多留的格子。

以上對應 4 個測試檔、2 類根因，尚未修復；不代表其餘 68 檔都沒有產品問題。

## 本次刪除的退休情境

| 刪除範圍 | 理由 | 現行替代覆蓋 |
| --- | --- | --- |
| slide-trace-lazy.browser.test.js（整檔） | 依永久 Trace ID 與 IndexedDB 結果保存／重開 | executable-only-storage、executable-only-slides |
| sample-progressive-load.browser.test.js（整檔） | 載入預存結果且禁止執行的新舊規格衝突 | executable-only-slides、guest-card-cache |
| algorithm-default-sieve.browser.test.js 前三例 | preview/full 資產、stored 快取及本機 Trace 重開已退休 | executable-only-default、executable-only-storage、default-external-trace |
| trace-cache-refresh.browser.test.js 第一例 | 要求公開動畫零編譯／執行及永久結果快取 | executable-only-runtime、executable-only-default |

共移除 6 個頂層情境，測試檔數 383 → 381。保留 default-sieve 的拖幀／舊箭頭回歸；保留 trace-cache-refresh 的失敗、紅點及重試案例待遷移，不因它仍失敗就整檔刪除。其他指標、賦值、mark、相容性與幾何測試均保留。

## 72 個失敗檔案的首要原因

分類依首個阻擋點；同檔可能另有問題。測試前置修好後仍須驗完整斷言。表中分類是清理前清單，包含這次退休的檔案。

- 測試規格／量測過時：32 檔。
- 測試前置／舊介面：24 檔。
- 已重現產品缺口：4 檔。
- 行為不符待深入：9 檔。
- 混合原因／需後續定位：3 檔。

| 測試檔 | 分類／證據 | 原因 | 下一步 |
| --- | --- | --- | --- |
| `algorithm-default-sieve.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍期待preview/full asmtrace、stored快取／IndexedDB Trace；現在預設動畫依執行配方執行，且快取disabled。 | 改驗永久執行檔、每次載入執行及會話結果；舊Trace復原另建legacy fixture。 |
| `algorithm-editor-history.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 仍尋找 algorithmEditorFrame/algorithmEditorModal；現在編輯頁搬移既有 runtime frame 到 algorithmEditorStage。 | 更新編輯器定位與生命週期，保留 undo、本機修改及重開斷言。 |
| `alias-display-name.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | fixture寫studio.objectStyles，指令模式會主動移除手動欄位；讀不存在集合或期待其顏色／字體故失敗。 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `arithmetic-assignment.browser.test.js` | 測試規格／量測過時；隔離後完整取到所有算術樣本，剩餘失敗是-3/*3//3對舊3答案 | 初始化仍期待180ms獨立宣告；算術後段仍期待-=/*=//=/沒有符號。另有普通頁預設動畫干擾採樣。 | 按合併初始化、200ms提示及完整複合符號更新；API播放用embed避免預設動畫。 |
| `arrow-index-label.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `auto-fixed-playback.browser.test.js` | 已重現產品缺口；auto-fixed原測試單獨重跑仍失敗；另兩檔同型倒退記錄一致 | 倒退完成後自動mark仍停在離開的畫面，晚一幀；例expected[0,1]實際[0,1,2]，濃縮線篩倒退亦多留9。 | 修倒退終態的fixed樣式來源／提交，確保目的幀完成後清掉未完成格。 |
| `automark.browser.test.js` | 已重現產品缺口；auto-fixed原測試單獨重跑仍失敗；另兩檔同型倒退記錄一致 | 倒退完成後自動mark仍停在離開的畫面，晚一幀；例expected[0,1]實際[0,1,2]，濃縮線篩倒退亦多留9。 | 修倒退終態的fixed樣式來源／提交，確保目的幀完成後清掉未完成格。 |
| `binary-addition-slide.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | savedTrace helper 現在實際重新執行配方，卻仍把所得當舊v4且斷言不存在binaryOperation。 | 另外建立明確的舊格式fixture，不能用現行執行結果冒充舊快照。 |
| `bit-shift.integration.test.js` | 已重現產品缺口；常數、普通變數、後置++三組隔離對照已重現 | number <<= amount++走renderNestedMutation提早返回，未保留event_shift_assign的bitShift metadata。值9→18、amount1→2正確，但5個位移事件只剩4個，後續效果為null。 | 統一巢狀副作用與位移語意：RHS求值一次、舊值作位移量、寫回後保留位移事件。 |
| `char-view.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `cloud-trace-repair.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 抓到 iframe 後立即執行未防護的 ASMTracePlayer 名稱，尚未載入即 ReferenceError；未抵達雲端修復斷言。 | 先等正確的 runtime frame 和 API 就緒，再檢查修復／儲存。 |
| `compile-pipeline-warnings.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `compound-bitwise-replay.integration.test.js` | 測試前置／舊介面；程式與記錄核實 | 範例字串直接從Windows檔案讀取，Ace／Trace改用LF，split variant的原字串深比較不同。 | 先正規化來源字串，再核對位元中間結果；不可僅改最終值。 |
| `constant-assignment-drop.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 新常數呈現保留運算符號，舊答案仍期待3、0b101；實際+3、+0b101。 | 保留下落與格式同行斷言；同步純常數符號規格。 |
| `deck-file-drop.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 測試在首頁使用 ASMDeck.project 生成檔案，但首頁未載入 animation-recipe；尚未完成拖檔驗證。 | 改用Node或投影片頁生成archive，再測首頁真正的readCover→編輯器匯入；另外核對首頁是否需提供完整封裝API。 |
| `declaration-cell-copy.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | fixture寫studio.objectStyles，指令模式會主動移除手動欄位；讀不存在集合或期待其顏色／字體故失敗。 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `directive-follow.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | fixture寫studio.objectStyles，指令模式會主動移除手動欄位；讀不存在集合或期待其顏色／字體故失敗。 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `eight-queens-loop-playback.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 實際執行回傳的 raw Trace 未保證 defaultEnabled 集合，測試對 undefined 做 Object.assign 即失敗。 | 先走正式正規化；保留256種配置與2解的獨立答案。 |
| `eight-queens-or-sample.integration.test.js` | 行為不符待深入；程式與記錄核實 | 直接建立的OR effect可用，但實際CodeScript播放六組全部未看到bitwise motion。 | 查目前選值／巢狀事件排程及範例事件開關，不改成只驗可建effect。 |
| `eight-queens-teaching-deck.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 匯入後預期9個頂層section，實際讀到2個；可能讀到匯入前的ready狀態，亦混有舊Trace／靜態服務假設，尚未證明教材內容有誤。 | 等待本次匯入完成而非先前ready，再核對實際教材結構及三種解法。 |
| `entrypoints.test.js` | 測試前置／舊介面；程式與記錄核實 | 以固定 runtime 45/47、舊腳本版本字串檢查入口；現在 runtime 146，編輯沿用 runtime。 | 驗模組依賴與實際版本一致，不固定歷史版本號。 |
| `event-settings-source.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 等待已不存在的 eventSettingsBtn；設定已移至側欄事件頁籤。 | 使用目前事件頁籤；同步核對新增輸入、取大／取小分類。 |
| `events-batch-arrows.browser.test.js` | 測試前置／舊介面；已實際 RUN：分別44、9、34幀；正規化後相同、無頁面錯誤 | 直接比較 CRLF 測資與已轉為 LF 的 sourceCode，成功 RUN 仍等不到相等。 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `events-fixed-state.browser.test.js` | 已重現產品缺口；auto-fixed原測試單獨重跑仍失敗；另兩檔同型倒退記錄一致 | 倒退完成後自動mark仍停在離開的畫面，晚一幀；例expected[0,1]實際[0,1,2]，濃縮線篩倒退亦多留9。 | 修倒退終態的fixed樣式來源／提交，確保目的幀完成後清掉未完成格。 |
| `fibonacci-teaching-deck.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 要求預存Trace開啟時零analyze／零執行；實際按新規格重新執行，例子出現2/2或1/1。 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `first-frame-name.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `force-recompile.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `formatted-assignment.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 新常數呈現保留運算符號，舊答案仍期待3、0b101；實際+3、+0b101。 | 保留下落與格式同行斷言；同步純常數符號規格。 |
| `guest-gallery-contract.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 要求預存Trace開啟時零analyze／零執行；實際按新規格重新執行，例子出現2/2或1/1。 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `hanoi-hidden-sequence.browser.test.js` | 行為不符待深入；程式與記錄核實 | visual lifecycle start超過舊180ms門檻；測試同時忽略新200ms提示，後續磁碟動作尚未由此次失敗判定。 | 先校準prompt與visual時間，再逐時驗外框先長、格子入場及磁碟連續性。 |
| `hanoi-recursion-sample.browser.test.js` | 行為不符待深入；程式與記錄核實 | visual-move後找不到預期磁碟rect顏色，回傳空字串，而非單純色值不同。 | 查移動後owner／continuity key及測試選取器，確認磁碟真消失還是找錯節點。 |
| `hanoi-teaching-deck.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 要求預存Trace開啟時零analyze／零執行；實際按新規格重新執行，例子出現2/2或1/1。 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `heap-caller-marker-reentry.browser.test.js` | 測試前置／舊介面；已實際 RUN：分別44、9、34幀；正規化後相同、無頁面錯誤 | 直接比較 CRLF 測資與已轉為 LF 的 sourceCode，成功 RUN 仍等不到相等。 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `heap-composite-segments.browser.test.js` | 混合原因／需後續定位；已實測可見文字15、7,3、8,8、4,2,9皆正確 | textContent包含display:none欄位，誤判隱藏lazy/sets顯示；同檔其餘案例另有舊範例指標／選幀／RUN等待假設。 | 讀可見tspan及其顯示狀態，再依語意定位事件；其餘幾何與RUN需另外核實。 |
| `initializer-visibility.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍期待min/max選值和初始化塞在一個3040ms槽；目前選值是獨立事件。 | 依語意事件拆分核對選值→初始化，不能改回舊綁定。 |
| `lcs-sample.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 普通=複製來源值不加符號，舊測試期待+17/-18或+0；實際原值。LCS另有硬編舊DFS來源的失敗。 | 普通=和複合賦值分開；按目前LCS的語意事件選幀，保留常數+1覆蓋關係。 |
| `local-camera.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍假設project產生永久Trace references並可由新store直接還原，配方投影後沒有該引用。 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `matrix-label-events.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | custom變體同樣寫入被移除的studio.objectStyles，卻期待#123456表頭色。 | 改用矩陣標籤可用的指令樣式；保留原地放大縮小與來源身分斷言。 |
| `merge-declaration.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 以visual start相減當間隔，忽略新增200ms程式反白；觀測700而期待500。 | 分開promptStart與visualStart，保留真正500ms間隔。 |
| `merge-push-handoff.browser.test.js` | 行為不符待深入；程式與記錄核實 | 以固定第10→11幀和舊提交時間檢查，看到正式格尚隱藏而搬移副本仍在；同時判斷指標未動。 | 先以實際push事件及提交點選範圍，再查副本→正式格接手是否真的留空。 |
| `missing-slide-trace.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 抓到 iframe 後立即執行未防護的 ASMTracePlayer 名稱，尚未載入即 ReferenceError；未抵達雲端修復斷言。 | 先等正確的 runtime frame 和 API 就緒，再檢查修復／儲存。 |
| `mixed-object-paste.browser.test.js` | 測試規格／量測過時；臨時副本僅對第一段拖曳按Alt，原20px及群框斷言通過；未宣稱整檔已通過 | 20px拖曳會觸發中心吸附，實際約15.05px；測試未略過吸附卻要求原始位移。 | 幾何測試以Alt停用吸附，另設吸附案例。 |
| `name-fit.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | fixture寫studio.objectStyles，指令模式會主動移除手動欄位；讀不存在集合或期待其顏色／字體故失敗。 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `no-drawing-transition.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `pointer-anchor-paint.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 尚未測畫面就要求 renderer trace-292；現在模組為 trace-291，與正在載入的宣告版本一致。 | 用共用 builds helper 核對版本後繼續原畫面斷言。 |
| `pointer-children.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 尚未測畫面就要求 renderer trace-292；現在模組為 trace-291，與正在載入的宣告版本一致。 | 用共用 builds helper 核對版本後繼續原畫面斷言。 |
| `pointer-model.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 首例硬等 pointer-4，產品為 pointer-6；後例硬編舊幀4→5，與目前範例事件排列不符。 | 由模組宣告與事件來源選幀；再重驗指標行為。 |
| `pointer-multitarget-entrance.browser.test.js` | 測試前置／舊介面；已實測 ready；char 第一例僅換等待訊號即通過 | 前置等待 defaultAnimationCache=stored；目前固定為 disabled、state=ready，真正案例尚未開始。 | 改等目前就緒狀態，再保留原行為斷言重驗。 |
| `pointer-opacity.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | fixture寫studio.objectStyles，指令模式會主動移除手動欄位；讀不存在集合或期待其顏色／字體故失敗。 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `prefix-sum-2d.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 全部數值、色塊、公式、鏡頭皆相同；只因範例新增r/c獨立指標，而測試仍期待空指標列表。 | 驗r/c指向正確位置，不要求舊空列表。 |
| `prefix-sum-multi-source.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 普通=複製來源值不加符號，舊測試期待+17/-18或+0；實際原值。LCS另有硬編舊DFS來源的失敗。 | 普通=和複合賦值分開；按目前LCS的語意事件選幀，保留常數+1覆蓋關係。 |
| `presentation-camera.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 把ASMTraceStudio.open側欄當作第二畫布，期待鏡頭歸零；現在Studio只有側欄、沿用同一畫布。後段仍要求跨重整保留偏移。 | 依真實畫布／介面分鏡頭；重新整理歸零，勿把頁籤當新畫布。 |
| `read-highlight-defaults.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍假設project產生永久Trace references並可由新store直接還原，配方投影後沒有該引用。 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `restored-comparison.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | fixture寫studio.objectStyles，指令模式會主動移除手動欄位；讀不存在集合或期待其顏色／字體故失敗。 | 以實際指令／frame.styles建立樣式，再驗保存、複製和動畫，不恢復已刪手動樣式。 |
| `sample-latex-load.browser.test.js` | 行為不符待深入；程式與記錄核實 | 匯入後editorChrome未如預期可見；初始模式檢查已通過，不能歸因於modeToggle按鈕規格。 | 確認匯入完成時序與當前模式，再保留數學首次渲染、離線素材及介面斷言。 |
| `sample-local-edit.browser.test.js` | 測試前置／舊介面；程式與記錄核實 | 仍尋找 algorithmEditorFrame/algorithmEditorModal；現在編輯頁搬移既有 runtime frame 到 algorithmEditorStage。 | 更新編輯器定位與生命週期，保留 undo、本機修改及重開斷言。 |
| `sample-progressive-load.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 要求預存Trace開啟時零analyze／零執行；實際按新規格重新執行，例子出現2/2或1/1。 | 驗可重用的執行檔HIT及正確依序執行，不要求完全零請求。 |
| `scaled-text-edit.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 只因borderTopColor非透明而失敗；實際.slide-widget為border:0，不產生額外選取框。 | 量測border-width/style或像素外觀，不用無邊框時的繼承顏色推斷有框。 |
| `sequence-layout-timing.browser.test.js` | 行為不符待深入；程式與記錄核實 | 尺寸與位置插值不滿足測試的同一線性比例，觀測約0.5px差；最終幾何相同。 | 查outerframe描邊、錨點與共用插值；不可直接加大容許值。 |
| `slide-animation-parity.test.js` | 測試規格／量測過時；程式與記錄核實 | mock只提供舊RUN按鈕點擊；新配方載入流程不透過該mock，故clicked=0。 | 替換為目前執行／完成協定的mock，再核對設定相容性。 |
| `slide-trace-lazy.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍假設project產生永久Trace references並可由新store直接還原，配方投影後沒有該引用。 | 改為儲存配方、重開執行；讀取開關的明確false／自訂色仍須保留。 |
| `slides-embed-tabs.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 要求runtime顯示subTabs；目前runtime明訂只顯示畫布，輸入在投影片側欄，其他分頁在編輯頁。 | 分別驗runtime只含畫布、編輯頁可操作分頁。 |
| `standard-segment-tree.browser.test.js` | 混合原因／需後續定位；已實測可見文字15、7,3、8,8、4,2,9皆正確 | textContent包含display:none欄位，誤判隱藏lazy/sets顯示；同檔其餘案例另有舊範例指標／選幀／RUN等待假設。 | 讀可見tspan及其顯示狀態，再依語意定位事件；其餘幾何與RUN需另外核實。 |
| `structure-length-zero.browser.test.js` | 行為不符待深入；程式與記錄核實 | 右鍵後未出現item-after／matrix-row-after；指令仍在產品內，不能當作功能已移除。 | 核對格子編輯游標／選取時右鍵事件及選單定位，排除點在文字節點造成路徑差異。 |
| `style-replay.browser.test.js` | 測試前置／舊介面；已實際 RUN：分別44、9、34幀；正規化後相同、無頁面錯誤 | 直接比較 CRLF 測資與已轉為 LF 的 sourceCode，成功 RUN 仍等不到相等。 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `table-widget.browser.test.js` | 行為不符待深入；程式與記錄核實 | 右鍵後未出現item-after／matrix-row-after；指令仍在產品內，不能當作功能已移除。 | 核對格子編輯游標／選取時右鍵事件及選單定位，排除點在文字節點造成路徑差異。 |
| `text-arrays.browser.test.js` | 測試前置／舊介面；已實際 RUN：分別44、9、34幀；正規化後相同、無頁面錯誤 | 直接比較 CRLF 測資與已轉為 LF 的 sourceCode，成功 RUN 仍等不到相等。 | 用共用來源正規化或 provenance 比對，再檢查後段畫面。 |
| `trace-cache-refresh.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍期待preview/full asmtrace、stored快取／IndexedDB Trace；現在預設動畫依執行配方執行，且快取disabled。 | 改驗永久執行檔、每次載入執行及會話結果；舊Trace復原另建legacy fixture。 |
| `trace-chunks.browser.test.js` | 行為不符待深入；程式與記錄核實 | compile已回應且有gzip，但90秒後播放器仍不符合該程式與grid；不能僅歸為慢。 | 抓編譯警告、實際source、chunk與hydrate結果，區分來源識別／資料還原／渲染阻塞。 |
| `trace-entry-recovery.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 仍要求未觀看動畫零執行；新規格在投影片開啟後依序執行，已觀測1次。 | 依新生命週期驗順序、合併重複工作與失敗頁碼，不要求永久延後執行。 |
| `trace-source-coordinates.browser.test.js` | 測試規格／量測過時；程式與記錄核實 | 先期待舊ID修復的updating狀態，另一例要求公開教材零編譯；現行配方流程不同。 | 改驗執行配方、正規化來源座標與本次結果；保留CRLF span的獨立答案。 |
| `unresolved-markers.test.js` | 混合原因／需後續定位；程式與記錄核實 | 8項失敗混有已移除的幀前barrier／未初始化停放假設，及targetMissing、x143對180的幾何問題。 | 將舊private helper測試轉成事件狀態契約，未知目標／空值不可當0；幾何另用真實DOM核實。 |

## 可重現證據與限制

- 原始完整 TAP：algo-vis-backend/test-results/regression.tap；原始全量摘要：test-results/full-revalidation-2026-11-16/summary.json。
- 本次診斷：test-results/failure-causes-2026-11-17/ 下的 cases.json、classification.json、probe.json、source-comparison.json 與各 TAP。這些為忽略的本機證據，不提交 Git。
- 三份實際 RUN 來源正規化後相同且無頁面錯誤；CRLF 與 LF 的原字串不同不能判為舊程式。
- 隱藏 tspan 的 textContent 仍含值；已檢查可見文字 15、7,3、8,8、4,2,9，不能將不可見內容誤判成畫面多字。
- 混合物件第一段拖曳按 Alt 關閉吸附後通過原 20px 與群框斷言；這僅證明首個位移失敗的原因，不代表整檔通過。
- 八皇后教材匯入頂層 section 數量 2/9 與 sample-latex 的 editorChrome 可見性尚未完成定位，不宣稱教材內容或按鈕規格已確定錯誤。
- regression 續跑狀態載入時會依現存測試清單過濾已刪檔案；刪除不會將舊失敗改成通過。

## 後續順序

先修已重現的巢狀位移資料與倒退 mark，再遷移共用就緒訊號、來源正規化、手動樣式 fixture、編輯器定位與量測方式；每類修完只跑相關失敗項。保留所有仍符合需求的獨立標準答案。未知的河內塔、位元 OR 播放、handoff、右鍵格子選單及分塊載入繼續逐時定位。

## 清理後局部驗證

- 7 個相關測試檔共 13 項通過：保留的 default-sieve、executable-only-default、executable-only-slides、executable-only-storage、executable-only-runtime、guest-card-cache、default-external-trace。
- regression-resume 7/7 通過；第一次受限環境有 4 項因 Temp 檔案重新命名 EPERM 失敗，正常權限重跑後全部通過，未更改測試。
- 修改的兩份測試語法檢查及 git diff --check 通過。本輪沒有重跑完整 381 檔，不宣稱全量已通過。
