# AlgoShowMaker 回歸驗收

## 驗證分工（2026-09-18 更新）

開始前讀取專案根目錄的 [子代理驗證分級通知.md](../../子代理驗證分級通知.md)，依 V0～V3 分級與 A～M 分類選擇驗證。
非動畫的前端／投影片修改不啟動演算法驗證集；只做必要的局部確認與直接相關的小測試。
開發／子代理不得執行全套測試、廣泛排序整合或大規模動畫入口。下方所有完整 regression、animation 與 `ASM_ANIMATION_CASES` 指令僅供主代理使用，不代表每次修改都要執行。
整合測試使用代理自己的隔離服務與 `ASM_TEST_BASE_URL`，不使用使用者的 localhost:3000。

## 主代理完整回歸入口

事件控制與批次箭頭新增專項：`events-batch-arrows.test.js`（語法、條件、展開、線篩編譯與疏幀衍生值）、
`events-batch-arrows.browser.test.js`（真實 SVG、事件排程與 JSON 重載）。
兩者需先設定 `ASM_TEST_BASE_URL` 指向獨立測試服務，瀏覽器檔不回落到使用者開發服務。
範例輸入為 `fixtures/events-batch-sieve.cpp`（明確 `[start:end]` 範圍）與 `fixtures/loop-batch-sieve.cpp`（內層迴圈前的具名濃縮幀）。專項另覆蓋 for／while／do while 入口值、break／continue、零次與重複值、前／內／後引用、具名消歧義、函式／遞迴回合隔離。瀏覽器只驗證線篩 i=8／9 定點與重載，未執行完整演算法集。

共用繪圖區塊專項為 `drawing-loops.test.js`：局部索引、區塊邊界／錯誤、preset、樣式與文字定位、重複入口、巢狀範圍與組合上限。`fixtures/drawing-loop-sieve.cpp` 用同一個 j 展開 style、arrow、text；`events-batch-arrows.browser.test.js` 額外核對 i=9 的實際背景色、高亮外框、文字內容／定位、箭頭目標、事件排程及 JSON 重載。

文字陣列專項為 `text-arrays.test.js` 與 `text-arrays.browser.test.js`，使用 `fixtures/text-arrays.cpp` 核對整個陣列、包含兩端的範圍、端點省略與邊界、空／巢狀／字串陣列、preset／@for局部索引、iteration.last(j)、快照回看及JSON重載。瀏覽器檔透過隔離服務RUN，檢查SVG、TTS與Studio；兩檔需設定 `ASM_TEST_BASE_URL`，不要使用主要服務。

自動固定切幀專項為 `auto-fixed-playback.browser.test.js`，使用 `fixtures/auto-fixed-playback.cpp` 比較有條件style的靜態／動畫繪圖、前進／後退、當幀標記揭露時機、開Studio前後與JSON重載，另確認關閉自動固定後手動mark仍可見。需設定隔離 `ASM_TEST_BASE_URL`。

`@automark`專項為 `automark.test.js`／`automark.browser.test.js`及 `fixtures/automark.cpp`：單／多陣列、none、defaults／preset／本地覆寫、格式錯誤、舊trace相容、runtime別名、事件保留與當幀SVG呈現；瀏覽器核對前進／後退／Studio／JSON重載和手動mark獨立。兩檔的compile／瀏覽器案例需設定隔離 `ASM_TEST_BASE_URL`。

由主代理在需要完整驗證時於 algo-vis-backend 執行：

`events-fixed-state.test.js`／`events-fixed-state.browser.test.js` 使用 `fixtures/automark-events-sieve.cpp`、輸入30，核對內層迴圈後的濃縮幀 i=8／9 自動固定、全域／當幀固定開關、明確fixed規則、零事件動畫steps、回看／JSON重載／Studio的實際SVG。需設定隔離 `ASM_TEST_BASE_URL`；搭配直接相關的 `drawing-arrow-animation.browser.test.js` 確認箭頭與style過渡保留。

Heap複合格與格內區段專項為`heap-composite-segments.test.js`／`heap-composite-segments.browser.test.js`及`fixtures/heap-composite-segments.cpp`：fields來源、hide、separator、pair／tuple、根與子節點局部座標、裁切／重疊、`split(cursor[,after])`遞迴前沿、既有單層segment與實際SVG。`segment-tree-samples.test.js`以兩份sample input核對新版範例不含AV.hpp舊繪圖程式，並確認輸出與特殊線段樹邏輯不變。三檔需設定隔離`ASM_TEST_BASE_URL`。

逗號樣式專項為 `style-list.test.js`（五種樣式、預設色、共用顏色／條件、ID、preset 覆寫、區塊與錯誤格式）及 `style-list.browser.test.js`（實際 SVG 的高亮框與 point 同時可見，條件過濾與 JSON 重載）。編譯及瀏覽器驗證需設定 `ASM_TEST_BASE_URL` 指向獨立服務。

回放樣式專項 `style-replay.browser.test.js` 使用 `fixtures/style-replay-sieve.cpp`，只比較線篩 i=8／9 的實際 SVG：往前／往後、再次播放、JSON 重載及兩種速度的單次 autoplay；高亮、focus 填色與箭頭必須符合目的幀，事件關閉仍保留原資料。設定 `ASM_TEST_BASE_URL` 指向隔離服務，不播放整套演算法。

`drawing-arrow-animation.browser.test.js` 取樣同一 fixture 的 i=8／9／10：同一繪圖槽的箭頭 ID 必須跨回合保留，既有箭頭的實際 SVG 端點移動，新增／移除箭頭淡入／淡出。分別開啟／關閉 runtime 事件，關閉時仍取樣到 style 填色過渡；JSON重載仍能位移。僅播放這些定點之間的局部切換。

```sh
npm run regression
```

需要 Node.js、已安裝 npm dependencies、Git，以及 server.js 使用的 C++ 編譯器。
指令檢查專案 JavaScript 語法、git diff --check，啟動獨立連接埠的臨時伺服器，
執行所有 tests/*.test.js，結束後關閉自己啟動的伺服器。不會停止 localhost:3000、
改寫投影片或產生 server log 檔。測試完成後會接著執行無頭瀏覽器實際動畫驗證。
Windows 預設使用已安裝的 Microsoft Edge；其他環境先執行 `npx playwright install chromium`。
可用 `ASM_BROWSER_CHANNEL` 指定瀏覽器。瀏覽器缺少或無法啟動時會失敗，不會跳過。
全套小測試可由主代理使用 npm test，但應設定 ASM_TEST_BASE_URL 指向獨立測試服務。

單獨重跑實際動畫：`npm run regression:animation`（同樣自動啟動隔離服務）。
使用冒泡、插入、選擇、Heap、遞迴 Quick Sort，
走實際 RUN 與 `CodeScript` 播放，另外透過投影片的同源 iframe 載入協定驗證 editor/runtime。
此 iframe 驗證不取代完整的 slides.html 匯入、雲端儲存及手機目視驗收。

報告保存在 `test-results/animation/<時間>/`，包含 summary、逐幀實錄與截圖，預設不提交 Git。
`slide-order-toggle` 使用獨立草稿驗證左側排序按鈕、Esc 狀態同步、空白鍵、返回所選投影片、實際拖曳排序及儲存後重開；不修改使用者投影片。
重疊僅檢查事件開始／結束與幀的定點；動畫作用中的交叉不算違規，不改變指標交換路徑。
keep 可見性與數值提前提交仍檢查動畫過程中的樣本。
依整合影響範圍由主代理決定執行；失敗則查看第一個違規時間點、追查修正並重跑，不能只更換基準。

### 持久動畫結果儲存驗證

先執行 `node --test tests/slide-storage.test.js tests/slide-cloud-storage.test.js`：檢查內容雜湊去重、獨立 Studio 設定、跨草稿參照回收、交易失敗保留舊資料，以及雲端增量結果與分享讀取。雲端路由測試使用替代資料庫，不等同實機 MongoDB 驗收。公開 HTTP 的 SHA-256 相容性亦有固定測試。

`deck-import-repair` 瀏覽器案例另檢查成功 RUN 並儲存後重新載入，完整 trace 與事件間隔保持一致，且不發出分析／編譯請求。最後用 `ASM_ANIMATION_CASES=selection` 執行 `npm run regression`，核對三介面定點、步進、自動播放與 Studio 同步；不提交產生的報告與截圖。

### 全域預設驗證項目

`defaults-directives.test.js` 檢查每幀展開、preset／當幀覆寫、作用域、刪除後不殘留及拒絕流程動作，
並透過實際編譯確認 camera 與 style 進入共用 trace。`defaults` 固定小案例驗證三個介面的實際交換播放。
可先跑 `node --test --test-name-pattern='defaults apply|removing defaults|defaults resolve|defaults reject' tests/defaults-directives.test.js` 的解析項目；
整合項目與瀏覽器使用隔離服務，可用 `ASM_ANIMATION_CASES=defaults` 執行 `npm run regression`。

### 呼叫函式固定驗證

`function-call` 固定案例另驗證呼叫先於被呼叫函式進入，無畫布目標仍可排程，
三介面呼叫片段塗灰而非黃色提示。`report.callCodeChecks` 必須取得實際呼叫通知樣本。

### style 入幀套用驗證

`insertion-style-labels` 使用 `6 / 1 8 7 2 6 5`，完整 RUN 後只播放前六幀。
逐次 requestAnimationFrame 檢查 arr[5] 的 index 保持白色，以及每格 value／index 的實際 computed fill
進度一致；必須取得真正 CSS fill transition 樣本，不能用兩邊一起瞬間換色通過。
報告 `labelPaintChecks` 包含樣本數、過渡樣本與第一批違規。此檢查不涉及動畫中物件重疊。

沿用 `style-frame-completion` 案例名稱，但驗證已改成入幀套用：同一幀連續賦值兩次，
實際事件播放中的 value／index 背景必須已是新幀最終色，不因中途 key 提交而切換。
`report.styleCompletionChecks`（保留既有欄位名稱）必須有動畫樣本且沒有等待到幀末才套用。
單元／整合案例另外確認關閉的賦值及 highlight／point／mark 不以事件提交作為 style 時間屏障。

`quick-style-swap` 使用 `6 / 5 7 2 1 9 4`，完整 RUN 後播放前五幀。
三介面逐次量測第 4→5 幀：交換開始前保留來源格子填色，交換中必須取得 CSS fill transition 樣本。
`report.swapPaintChecks` 記錄保色樣本、變色樣本及違規；小型整合測試另確認程式碼提示時間不是交換起跑時間，關閉交換不等待。

### highlight 固定驗證

`highlight-swap` 案例預設包含在 `npm run regression`，並驗證三個介面：

- style highlight 完整包含 value＋index，不漏框或多算高度。
- 一般陣列／heap 交換期間逐次量測實際 SVG：框不消失，位置與寬度跟隨移動、縮放的格子；必須取得移動、縮放及 heap 副本路徑樣本，沒有樣本不能通過。
- 閃爍使用全域節奏；同一框在移動、縮放時 animationDelay／動畫起點不重設、播放時間不倒退。單元測試另驗證重建框會加入當下全域相位。
- 比較事件框只包數值格的規則另外驗證，不與 style highlight 混用。
- 顏色過渡必須取得原生 SVG fill／stroke transition 的中間進度樣本；自動播放等待有限變色動畫，但不等待無限閃爍。

可先跑 `node --test tests/style-layer.test.js tests/presentation-hints.test.js`，再以 `ASM_ANIMATION_CASES=highlight-swap` 執行完整回歸。各介面報告的 `report.highlightChecks` 包含樣本數與第一批違規資料。

## 動畫實錄回歸

演算法編輯器「除錯記錄」頁籤的「記錄全部幀」會透過實際 `CodeScript` 播放路徑依序等待每幀完成，並記錄 `playbackPlan`、實際事件起訖、SVG DOM 幾何與樣式、鏡頭、程式碼片段及高亮。完整 JSON 可作為問題附件或基準，CSV 則適合人工逐列檢查。

比較基準時應使用 `ASMTraceDebugRecorder.compare(expected, actual)`，不要直接比對整份 JSON。記錄時間和瀏覽器像素可能有微小差異；比較器會嚴格檢查事件順序、排程結構、物件存在性與程式碼狀態，並以可設定誤差比對時間和幾何。

## 固定案例

- fixtures/bubble.cpp：後置 @frame、j++、比較、交換、@keep last。
- fixtures/insertion.cpp：key 取值、右移、j--、回填。
- keep-directives：`@keep` 的來源位置／綁定繼承、`offset` 單獨微調、手動位置覆蓋與樣式保存。
- 共用 fixtures/sorting.json：6 個元素，輸入 5 7 2 1 9 4；結果 1 2 4 5 7 9。
- assignment-indices：事件發生時的索引、不可重複執行索引函式。
- unresolved-markers：array/heap/stack 的未知指標、range、越界與取得有效值。
- heap-marker-assignment：`largest = l/r` 可直接用事件快照移動 largest，
  不要求 l/r 有自己的畫面物件；真正缺少目的指標時仍略過。
- studio-event-availability：事件表刷新、縮圖分批與取消。
- slide-animation-parity：舊 asm-view 不可覆蓋儲存設定、legacy 與 trace 互斥、儲存先完成 pending edits。
- playback-parity：真實 model/editor/player/Studio 鏡頭路徑，兩種速度、
  每幀前進、後退、重播及跳幀；SVG 邊界使用 spy，不宣稱像素驗證。
- provenance：修改/復原原始碼與輸入、CRLF、外觀設定、缺少與未來版本資料。

## 瀏覽器驗收（修改動畫、鏡頭、Studio 或投影片後）

使用隔離測試頁及本機草稿，不覆盖使用者工作內容。
1. 在 algorithm.html 實際 RUN 兩個固定案例。
2. Studio 核對畫布、目前幀、事件表與縮圖；以事件 order 而非事件類型判斷先後。
3. 上一步、下一步、1.2x 與 2.0x autoplay；前一動畫完成才進入下一幀。
4. Studio 手動拖曳仍即時；關閉 Studio 後核對一般播放器的物件、樣式與鏡頭。
5. 投影片編輯器貼入相同程式與輸入、RUN、修改事件開關/鏡頭後儲存，
   重新開啟與整頁重載後核對；runtime 只顯示畫布、控制列及必要版本提示。
6. 修改輸入/程式後出現尚未 RUN 提示，復原後消失；修改 Studio 外觀不應要求 RUN。
7. 舊投影片無 provenance 時顯示版本提示，保留原動畫，不自動編譯；
   新版成功 RUN 並儲存後提示消失。失敗 RUN 不能把舊資料標為新版。
8. 檢查 console；清楚區分新錯誤與未定位/既有錯誤。

## 版本維護

public/trace-provenance.js 同時被後端及瀏覽器使用。
ENGINE_VERSION 只在追蹤事件/狀態契約改變、需要重新 RUN 時增加；
FORMAT_VERSION 用於來源識別格式。schemaVersion 目前為 1.0。
不要因純 renderer/CSS 改善要求使用者重跑。
provenance 只由成功執行的後端產生，載入/儲存不得將舊資料升級成當前版本。
fingerprint 是變更偵測，不是安全驗證；忽略原始碼行尾格式及尾端 @asm-view 外觀區塊，
其餘程式（含 @frame 等追蹤註解）及輸入改動仍會要求 RUN。

## 2026-09-05 實測紀錄

- npm run regression：33 項測試通過，JS 語法及 diff 檢查通過。
- algorithm.html 實際 RUN 固定冒泡（17 幀）及插入排序（20 幀）。
- Studio 冒泡 1.2x、一般播放器插入排序 2x、投影片冒泡 2x 均播放至最後一幀；
  手動前後步進、事件表和縮圖已核對。
- 舊隔離草稿顯示版本提示；RUN、儲存、重開及整頁重載後提示消失，
  關閉的 j++ 事件仍保持關閉。
- 修改程式或輸入顯示 dirty 提示，復原輸入後回到 current。
- 一般編輯器 console 無 error/warn；嵌入頁關閉時仍觀察到先前已有的
  MutationObserver「parameter 1 is not of type Node」錯誤，未取得來源堆疊。
  未宣稱 console 完全通過，也未用猜測性修改隱藏此錯誤。
- 三介面畫布尺寸不同，驗收以事件/狀態/物件與鏡頭規則一致為準，
  不要求編輯工具、留白與螢幕像素完全相同。尚未涵蓋所有 draw type 的目視驗收。

## 匯入後修正驗證

`arrow-identity` 三介面案例量測同 ID 改綁的中間端點、顏色及線寬、未知名箭頭唯一候選的自動配對，以及綁定未變時跟隨格子不延遲。`arrow-identity.test.js` 檢查空白行／preset 順序穩定性、ID 衝突、候選歧義和遞迴呼叫隔離。

統一瀏覽器驗證會執行 `deck-import-repair`：實際匯入含第 5 行錯置 `@camera` 的 `.asmdeck`，確認其他投影片及原始碼／輸入／設定完整保留；未 RUN 即儲存、重載後仍可編輯。修正後實際 RUN，再驗證設定還原、前後步進、兩種速度播放與 Studio 縮圖／事件，最後保存正常 trace。正常保存會將還原設定寫進 `@asm-view`，因此以演算法正文及還原設定分別核對，而非要求附加區塊也與修正前字串相同。

## 大型雲端儲存

`node --test tests/cloud-content.test.js tests/slide-cloud-storage.test.js` 檢查分塊／續傳、未修改原 deck、替換回收、提交失敗保留、跨 deck 拒絕及中斷暫存回收。
統一瀏覽器驗證額外執行 `cloud-storage-browser`：實際 RUN 後附加 9 MB 測試資料，再由編輯頁拖曳排序觸發真實自動儲存，核對請求小於 8 MB、動畫完整保留與重開不 RUN。此案例攔截雲端 API，用真實儲存核心驗證，不寫正式資料。
手動執行 `node scripts/cloud-storage-mongo.js` 可使用 MONGO_URI 做真實 Mongo／HTTP 驗證；僅建立隨機命名 `asm_cloud_regression_*` 資料庫，結束自行刪除，核對 >8 MB、去重、分享編輯與跨使用者拒絕、替換回收及失敗安全。

## 遞迴角色接續驗證

`recursive-roles` 固定案例包含外層同名指標、遞迴指標與一般數值、深入和返回。
三介面實際 RUN 驗證連續角色不被標記為入場，且指標和數值都有接續樣本；沒有樣本即失敗。
`scene-exit-entrance-order.test.js` 另驗證不同宣告位置、兄弟呼叫、keep 分界與已消失角色不接續。
