# alpha-segment-tree 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-19-alpha-segment-tree
- 共同基準 commit：61a4baade9b06b5e50d0c7a24683e937db9c7112
- 程式修正 commit：34f734a2489336ef359064b696cacb124d8239b9、79073d3e3e05b3f4c97c8218033b8c2dd6e3102e、69a158f4a19c777e9174a6cd87309efa5fba3c03、1f9a95f0e516ad97e4f9a9baae894375b21eeb8a、0158b1c6ea2c481d21c9499ea19c54b03d2b773c、736cf91dba7d7b8695e635a71e2f93ebecec03e2、1a18710eaa7a429159e555ad6b2099e6ebadb8f2、235f7ca4e3e13607cfb057258f8093c3589056f3、bf26ba00c7e50de08f4172e575df409c898e4f8a、f618e1ed7a0a0caa1b0d68771b848f93e7adef3f、6c3688075082ac1580bca25857658787589a569a、eb1337540fab4926089d2e0de409fd3e0a0bfc49、a91ec0624a9988004744f34ff000ec4cc3e28e7e、fc834a35a811278a9cd7786ae274fbaa8346e64c、7a9f9032a96cadbc8b27c279340d2ca8e8fb275e、a712fc56e3b3a25aa68a82548e44e88666e6f122、63b78d12a4108511396a4767589bd86b9ae28bfd、8e0329c708a0ae4d13f7b24cce61c32e5efc4f98、09da3d9b4c58f0c87fe36b740aa6d0bca8c9ddca
- 驗證時的 HEAD 與未提交修改：09da3d9b4c58f0c87fe36b740aa6d0bca8c9ddca；程式驗證完成後僅更新交付commit紀錄
- 驗證日期：2026-09-20

## 根因與修改
- 設計依據：既有 frame renderer options 只處理 range／columns／labels，trace model 尚未正規化 pair／tuple，heap renderer 每格只讀主要陣列；既有 @segment parser 只接受單層陣列範圍，轉場矩形也未插值格內色塊幾何。
- 修正方式與行為變化：新增 fields／hide／separator 解析、runtime 保存及 heap 同格組合；pair／tuple 以單格格式化；新增雙層 @segment 的局部座標、裁切、重疊、色彩及具名轉場；with split(cursor[,after])依遞迴路徑保留尚待處理的另一側；格內segment掛載到style顯示層並跟隨來源cell；保留舊單層 @segment。兩個 Segment Tree 範例改用 render heap 與新指令。
- 最終查詢展示方式：依使用者確認，Segment_Tree_easy只呈現向下遍歷。進入節點使用split(now)，整段命中並累加sum後使用split(now,after)移除完成區段；遞迴返回不建立幀，因此segment不會回來。sum以獨立cell放在tree下方。
- split轉場：新segment固定在格內並由頂端向下展開，完成segment由頂端向下擦除；它仍屬style顯示層，不受事件動畫開關控制。
- `+=`空白根因與修正：compound assignment原本記為缺少payload與source target的一般write，賦值動畫因before／after皆空而清空目的文字，也無法定位tree[now]。instrumenter／runtime現保存目的before／after與可見來源target；播放器保留sum舊值，僅複製來源數字文字移動，落地時提交結果並立即移除複本。具有副作用的目的索引不啟用此擷取，避免重複求值。
- sum反覆入退場根因與修正：renderer只替容器保存runtime identity，純量在main與不同query activation間被scene boundary誤判為新物件。純量與字串現在以lifetime優先、位址後備建立身分，全域sum可跨幀延續。
- 第三幀播放根因與修正：trace與靜態SVG皆有segment，但一般播放套用同格highlight／point時，updatePresentedHints原本會隱藏該格所有data-trace-attached-to視覺，將新歸入style layer的segment一併設為display:none。清理範圍已限縮為highlight／point／mark，segment保持獨立可見。
- 設定保存根因與修正：`trace-view-source`原本明確移除整個`eventSettings`，新trace又會套用帳號偏好，因此自動固定與迴圈邊界無法跟著程式。現在`@asm-view`只序列化`autoFixedEnabled`與`autoLoopBoundaryEnabled`，載入時以它們覆寫帳號預設；事件間隔與各事件類型偏好維持帳號層級。
- 建構／查詢拆分：`Segment_Tree_easy_build.cpp`獨立提供建構動畫，從初始樹、15筆輸入、15個父節點加總到根節點完成共32幀；`Segment_Tree_easy.cpp`先無幀建樹，第一幀直接顯示完整樹並只播放查詢下降、segment分裂及sum累加。兩份範例各有sample input。
- 二元加法動畫：instrumenter辨識`target = left + right`，在左右運算元為可見純量或安全索引格時保存兩個來源target；播放器建立兩個純文字transfer並以相同進度移向目的值，落地時同幀移除兩者並提交結果。Segment_Tree_easy的父節點建構改為`tree[i] = tree[left] + tree[right]`以使用此行為；演算法與輸出不變。
- 完整Segment Tree範例：`Segment_Tree.cpp`靜默完成建樹，第一幀直接進入操作。tree以`range(1,Tsize-1)`裁去未使用補零節點，並用fields／hide在同格顯示原本的tree／lazy／sets；modify與set segment分別使用紫色及橘色。segment只在下降時split並在命中時以after移除；回溯只顯示父節點加總。query命中值另累加到tree下方answer，但函式回傳與輸出維持原演算法。
- 融合與segment邊界：lazy／sets僅作為tree同格文字欄位，0與LM依hide省略，不另由欄位狀態生成色塊。紫色／橘色segment分別只代表當次modify／set操作範圍，沿下降split並在命中後移除。
- 獨立lazy／sets物件根因與修正：fields原先已把附加欄位標成capture-only，但`@style lazy[...]`與`@style sets[...]`會把style目標重新設為可見，因此畫面同時出現複合tree與兩個獨立陣列。style綁定現在辨識非主要複合欄位，保留capture-only並把樣式合併到tree同索引格。
- 投影片取消動畫根因與修正：runtime iframe回報幾何就緒後，ResizeObserver仍可能排入一至兩次畫布重定位；若此時切幀，重定位會呼叫tween cancel，原本1660ms的加法事件約49ms便直接結束。播放器現在在活動播放計畫期間只記錄待重定位，等動畫完成後才重新套用目前幀幾何。
- 3101既有頁面未同步：服務重啟不會替已開啟的瀏覽器iframe重新載入JavaScript，且前次修正未同步提升投影片runtime URL版本，因此既有頁面仍可保留舊播放器。slides.js提升至parallel-merge-197，runtime/editor iframe提升至trace-runtime-37；重新載入投影片頁面後會明確取得新版。
- 重整後仍舊的根因與修正：投影片保存完整traceDocument，重新整理只會重播保存結果。二元加法新增`binaryOperation`與兩個來源target時漏增ENGINE_VERSION，造成同程式／輸入的舊trace被誤判為current。ENGINE_VERSION現為5；編輯器載入version 4時會自動RUN並遷移Studio設定，使用者儲存後主投影片取得包含新事件的trace。入口同步提升至parallel-merge-198、trace-runtime-38及trace-provenance-6。
- 修改檔案及用途：trace-instrumenter.js／server.js 定義與保存語法；ASMTrace.hpp／trace-model.js 處理 tuple；trace-renderer.js／trace-frame-tween.js 繪製與轉場；Segment_Tree_easy.cpp／Segment_Tree.cpp 改寫範例；HTML cache、指令提示、手冊、README 與直接相關測試同步更新。
- README／版本紀錄／使用說明更新：README 與 ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md 已加入新語法及行為；tests/README.md 記錄專項測試。
- 與 task.md 的差異：query 的預設參數改由呼叫端明確傳入，因目前變數分析不會把具有預設值的參數提供給幀指令；傳入值與原預設值相同，演算法結果不變。依使用者後續補充加入split遞迴前沿，並讓point／highlight沿用預設樣式。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| fields、separator、hide 與原變數事件 | parser/runtime 專項及 headless Edge 實際 SVG | 15／7,3／8,8／4,2,9 正確；自訂分隔與逐幀更新正確；lazy／sets 仍有各自 assign 事件與 style | 通過 |
| pair／tuple 單格與 pair 成員 hide | runtime 資料與實際 SVG | pair 顯示 5、0 / 5；tuple 顯示 1,0,3、0,0,0，未展開格數 | 通過 |
| heap 格內 segment 行為 | 根與子節點 SVG 幾何、裁切、空範圍、多色塊、具名轉場及split前沿 | 根 8 段、子節點 4 段；完整／中段／右半段正確；反向範圍隱藏；as 身分與幾何插值正確；往左遞迴時保留一至兩層待處理右側，after只排除已完成節點 | 通過 |
| 格內 segment 顯示層 | headless Edge 檢查SVG父層、cell從屬與圖層順序 | 所有格內segment位於asm-trace-style-layer、不再嵌在cell，style層位於物件上方及前景箭頭下方；具名幾何插值仍通過 | 通過 |
| 舊 @segment 相容 | style-segments 與 fixture 單層範圍 | arr[1:2] 仍產生既有區段；原 style／segment 專項通過 | 通過 |
| 兩個範例移除舊繪圖且保留結果 | /trace/analyze、/compile 與 sample input | 無 AV.hpp、AV av、frame_draw、key_frame_draw、colored_text、_draw_*；point／highlight未指定顏色；輸出分別為 27/3/119/120/8/5/17 與 12 | 通過 |
| 只呈現向下查詢並累加sum | Segment_Tree_easy以15個葉值查詢13～14，實際動畫播放與逐幀檢查 | now下探至14；命中幀移除完成segment；無回溯幀；sum在tree下方顯示27 | 通過 |
| split垂直入退場 | headless Edge逐個requestAnimationFrame取樣新子segment與離場父segment幾何 | 入場高度由0增加且y固定；退場y向下移且高度縮小；最終幾何正確 | 通過 |
| `sum += tree[now]`數字移動與提交 | 實際Segment_Tree_easy動畫逐requestAnimationFrame取樣 | transfer只有文字27、沒有rect；sum在落地前保持0且從未空白；顯示27的同一更新已移除transfer，沒有目的地停留 | 通過 |
| 全域sum跨遞迴幀延續 | 比對前後runtime identity與動畫期間opacity | main／query前後身分相同，所有樣本opacity為1，未重播入退場 | 通過 |
| compound assignment不重複副作用索引 | 編譯執行`arr[nextIndex()] += 2` | nextIndex只呼叫一次，arr[0]由3變5 | 通過 |
| 自動事件設定跟隨檔案 | UI切換兩個選項、檢查`@asm-view`並重新RUN | 寫入false／true；重新RUN後trace仍為false／true，其他事件偏好沿用帳號預設 | 通過 |
| easy建構與查詢獨立動畫 | 兩份sample input編譯、trace來源與headless Edge實際播放 | 建構版32幀且無query幀；查詢版無建構幀／箭頭，七筆輸出不變；兩段皆可獨立RUN | 通過 |
| 二元加法雙來源動畫 | 純量／陣列trace事件與Segment_Tree_easy逐requestAnimationFrame取樣 | `total=a+b`與`tree[parent]=tree[left]+tree[right]`皆保存左右來源；13與14同步移向tree[14]，目的值保持0直到落地，同一更新移除兩個transfer並顯示27 | 通過 |
| 投影片內的二元加法動畫 | 將使用者建樹程式編譯後存入獨立投影片deck，iframe剛完成幾何準備便切到第16幀第一個父節點 | runtime為trace-runtime-38；播放計畫維持1660ms；15與補零來源0的純文字transfer可取樣，抵達前tree[15]仍為0；實際heap-cell-segment數量始終為0 | 通過 |
| 舊投影片trace自動重建與儲存同步 | 將同程式trace改為engineVersion 4並移除全部binaryOperation事件，開啟編輯動畫後儲存 | 編輯器自動重建為engineVersion 5並恢復二元加法事件；儲存後runtime取得新版，第16幀15與0的轉場正常且segment數量為0 | 通過 |
| lazy／sets融合與操作segment分離 | 完整Segment Tree trace及headless Edge實際SVG | 非預設lazy／sets顯示於tree同格文字；獨立lazy／sets物件數皆為0；操作幀有紫色／橘色segment，回溯幀無segment | 通過 |

## 小驗證與重跑方式
### Parser、runtime、renderer、瀏覽器與範例專項
- 目的與對應條件：覆蓋本任務全部最小驗收條件及直接相容面。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL 指向 alpha worktree 的隔離服務 http://127.0.0.1:62191。
- 測試資料／fixture：tests/fixtures/heap-composite-segments.cpp、Segment_Tree_easy-sample_input.txt、Segment_Tree-sample_input.txt。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:62191'; node --test tests/heap-composite-segments.test.js tests/heap-composite-segments.browser.test.js tests/segment-tree-samples.test.js tests/frame-renderer-options.integration.test.js tests/style-segments.integration.test.js tests/preset-directives.test.js tests/directive-assist.test.js tests/entrypoints.test.js tests/style-layer.test.js`
- 預期結果：所有直接相關案例通過。
- 實際結果與 exit code：34/34 通過，exit code 0。
- 證據位置：測試檔與 fixture 已提交；執行輸出只保留於本次代理工作階段。

### 語法檢查與受影響編譯重跑
- 目的與對應條件：確認前後端 JavaScript 可解析，tuple header 修改後兩個範例仍能分析、編譯與產生 trace。
- 執行目錄與必要環境設定：algo-vis-backend；同一隔離服務。
- 測試資料／fixture：同上。
- 完整指令：`node --check trace-instrumenter.js; node --check server.js; node --check public/trace-renderer.js; node --check public/trace-frame-tween.js; node --check public/trace-model.js; node --test tests/heap-composite-segments.test.js tests/segment-tree-samples.test.js tests/entrypoints.test.js; git diff --check`
- 預期結果：語法與 6 項測試通過，diff 無空白錯誤。
- 實際結果與 exit code：6/6 通過，全部 exit code 0。
- 證據位置：執行輸出只保留於本次代理工作階段。

### Alpha 3101 預覽服務
- 目的與對應條件：確認更新後的 alpha 服務確實來自本任務 worktree，且新 parser 與前端檔案已載入。
- 執行目錄與必要環境設定：本任務 worktree 的 algo-vis-backend，PORT=3101。
- 完整操作：以 served trace-renderer.js 的 SHA-256 核對 worktree，POST /trace/analyze 分析 fields／hide／雙層 segment 最小程式，再讀取 algorithm.html cache 版本。
- 預期結果：來源 hash 相符；fields=tree,lazy,sets、cellRange=true、color=AV_green；新前端版本可見。
- 實際結果與 exit code：2026-09-20動畫拆分後，停止已核對的alpha PID 4668並重啟為PID 4472。HTTP 200；重啟後範例3/3與兩個獨立動畫瀏覽器案例2/2通過。
- 操作segment範圍更正後：停止已核對的alpha PID 4568並從本worktree重啟為PID 60412；HTTP 200。`/trace/analyze`解析7個frame、9個操作segment描述、0個狀態型segment；3101瀏覽器專項1/1通過。
- 證據位置：本機 http://localhost:3101；程序與端點核對輸出只保留於本次代理工作階段。

### Segment Tree查詢segment消失專項
- 目的與對應條件：重現單一路徑查詢在整段命中幀沒有任何待處理片段，確認命中節點仍保留segment。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL=http://127.0.0.1:3101。
- 測試資料／fixture：Segment_Tree_easy.cpp；n=15、值1～15、查詢13～14。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test --test-concurrency=1 tests/heap-composite-segments.browser.test.js tests/segment-tree-samples.test.js; git diff --check`
- 預期結果：既有heap segment行為、實際範例命中幀及兩範例輸出均通過。
- 實際結果與 exit code：4/4通過，exit code 0；diff無空白錯誤。
- 證據位置：新增的瀏覽器案例與範例已納入分支；執行輸出只保留於本次代理工作階段。

### 第三幀動畫與style清理專項
- 目的與對應條件：確認一般播放套用highlight／point時，不會將同格segment誤設為display:none；同時核對既有style前進、倒退及重播。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL=http://127.0.0.1:3101。
- 完整指令：`node --check public/trace-renderer.js; node --check tests/heap-composite-segments.browser.test.js; $env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test --test-concurrency=1 tests/heap-composite-segments.browser.test.js tests/style-replay.browser.test.js tests/entrypoints.test.js; git diff --check`
- 預期結果：第三幀segment保持可見，原style重播與入口版本檢查正常。
- 實際結果與 exit code：4/4通過，exit code 0；語法與diff檢查通過。
- 證據位置：瀏覽器案例已直接檢查動畫後computed display；執行輸出只保留於本次代理工作階段。

### 向下遍歷、sum與split垂直轉場專項
- 目的與對應條件：確認easy範例沒有回溯幀、命中值累加至tree下方的sum，並實際取樣split segment由上往下入退場。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL=http://127.0.0.1:3101。
- 測試資料／fixture：heap-composite-segments.cpp與Segment_Tree_easy.cpp；easy輸入為15個葉值、查詢13～14。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --check public/trace-frame-tween.js; node --check tests/heap-composite-segments.browser.test.js; node --check tests/segment-tree-samples.test.js; node --test --test-concurrency=1 tests/segment-tree-samples.test.js tests/heap-composite-segments.browser.test.js; git diff --check`
- 預期結果：四項直接相關案例通過；入退場取得中間幾何；命中後無segment、sum=27且位於tree下方；輸出不變。
- 實際結果與 exit code：4/4通過，exit code 0；語法與diff檢查通過。
- 證據位置：測試檔、範例與手冊已納入程式commit 736cf91dba7d7b8695e635a71e2f93ebecec03e2；執行輸出只保留於本次代理工作階段。

### Compound +=數字移動與全域sum身分專項
- 目的與對應條件：確認`sum += tree[now]`具備before／after與來源格；動畫只搬移數字、sum不空白且落地後提交；全域sum不因跨遞迴activation重播入退場；副作用索引不重複執行。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL=http://127.0.0.1:3101。
- 測試資料／fixture：Segment_Tree_easy.cpp的15個葉值、查詢13～14；另以`arr[nextIndex()] += 2`最小程式驗證求值次數。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --check trace-instrumenter.js; node --check public/trace-renderer.js; node --check public/trace-frame-tween.js; node --test --test-concurrency=1 tests/assignment-indices.integration.test.js tests/heap-composite-segments.browser.test.js tests/segment-tree-samples.test.js; git diff --check`
- 預期結果：trace資料、求值安全、實際數字轉場、sum持續身分與兩範例輸出全部通過。
- 實際結果與 exit code：落地消失調整後，直接相關範例／入口／瀏覽器組合5/5通過；3101重啟後實際動畫2/2通過。逐幀取樣確認sum仍為0時transfer持續移動，sum顯示27的同一更新中transfer已移除；語法與diff檢查通過。
- 證據位置：測試與手冊分別納入程式commit bf26ba00c7e50de08f4172e575df409c898e4f8a及後續文件commit；執行輸出只保留於本次代理工作階段。

### 自動固定與迴圈邊界設定保存專項
- 目的與對應條件：確認兩個選項只以檔案級覆寫寫進`@asm-view`，其餘事件偏好保持帳號層級；重新RUN後仍套用檔案選擇。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL=http://127.0.0.1:3101，獨立headless Edge。
- 完整指令：`node --check public/trace-view-source.js; node --check public/trace-editor.js; node --test tests/view-source-compaction.test.js tests/slide-animation-parity.test.js tests/event-defaults.test.js tests/entrypoints.test.js`；`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test --test-concurrency=1 tests/event-settings-source.browser.test.js`；`git diff --check`。
- 預期結果：序列化／重載、檔案優先順序、既有事件預設與實際UI重新RUN全部通過。
- 實際結果與 exit code：單元與整合32/32通過；headless UI 1/1通過；JavaScript語法與diff檢查通過，exit code均為0。
- 證據位置：tests/event-settings-source.browser.test.js、tests/view-source-compaction.test.js及tests/slide-animation-parity.test.js，納入程式commit 235f7ca4e3e13607cfb057258f8093c3589056f3。

### Segment_Tree_easy建樹展示專項
- 目的與對應條件：確認葉節點依輸入順序逐筆呈現，父節點依原演算法由下往上逐一相加，左右來源及算式在實際畫面可見。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL=http://127.0.0.1:3101，獨立headless Edge。
- 測試資料／fixture：Segment_Tree_easy.cpp與原sample input（n=15、值1～15、七筆查詢）。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test --test-concurrency=1 tests/segment-tree-samples.test.js tests/heap-composite-segments.browser.test.js; git diff --check`。
- 預期結果：15個輸入幀、15個父節點相加幀；每個父節點trace具兩條箭頭；實際SVG顯示兩條具名箭頭及算式文字；查詢輸出不變。
- 實際結果與 exit code：3101重啟後4/4通過，exit code 0；輸出仍為27／3／119／120／8／5／17。
- 證據位置：範例與測試納入程式commit f618e1ed7a0a0caa1b0d68771b848f93e7adef3f；執行輸出只保留於本次代理工作階段。

### 二元加法雙來源動畫專項
- 目的與對應條件：確認一般純量與陣列格加法都保存兩個來源，兩個數字同時移向目的格，且落地、移除與結果提交發生在同一更新。
- 執行目錄與必要環境設定：algo-vis-backend；隔離服務http://127.0.0.1:3197，重啟後另以alpha http://127.0.0.1:3101重跑實際瀏覽器案例。
- 測試資料／fixture：最小`total = a + b`／`tree[parent] = tree[left] + tree[right]`及Segment_Tree_easy的15個葉值、查詢13～14。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3197'; node --test tests/assignment-indices.integration.test.js tests/segment-tree-samples.test.js`；`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test --test-name-pattern="segment tree descends" tests/heap-composite-segments.browser.test.js`；`node --check trace-instrumenter.js; node --check public/trace-frame-tween.js; node --test tests/entrypoints.test.js; git diff --check`。
- 預期結果：雙來源metadata、結果重播、兩個純文字transfer與落地同幀提交皆通過；範例輸出及入口版本正常。
- 實際結果與exit code：assignment-indices 6/6、segment-tree-samples 2/2、瀏覽器專項1/1、entrypoints 1/1通過，exit code均為0；3101重啟後PID 4668，algorithm.html與腳本皆為trace-217。
- 證據位置：程式及測試納入commit 6c3688075082ac1580bca25857658787589a569a；執行輸出只保留於本次代理工作階段。

### Easy建構／查詢動畫拆分專項
- 目的與對應條件：確認建構與查詢各自可直接RUN，查詢不產生建構教學幀，建構不包含查詢流程。
- 執行目錄與必要環境設定：algo-vis-backend；重啟後alpha服務http://127.0.0.1:3101，獨立headless Edge。
- 測試資料／fixture：Segment_Tree_easy_build及其15個輸入值；Segment_Tree_easy及原15個值、七筆查詢。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test tests/segment-tree-samples.test.js`；`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test --test-name-pattern="standalone segment tree" tests/heap-composite-segments.browser.test.js`；`git diff --check`。
- 預期結果：建構版32幀、15個雙箭頭父節點幀、根值120且無query幀；查詢版無建構幀與箭頭，segment與sum動畫正常且輸出不變。
- 實際結果與exit code：範例3/3、瀏覽器2/2通過，exit code均為0；3101重啟後PID 4472並回應HTTP 200。
- 證據位置：範例、sample input與測試納入commit eb1337540fab4926089d2e0de409fd3e0a0bfc49；執行輸出只保留於本次代理工作階段。

### 投影片iframe首幀播放與尺寸重排專項
- 目的與對應條件：重現3101投影片介面中，建樹父節點加法在iframe剛顯示後被延遲重排取消；確認修正後不需等待即可播放完整雙來源轉場。
- 執行目錄與必要環境設定：algo-vis-backend；重啟後alpha服務http://127.0.0.1:3101，獨立headless Edge與測試deck localStorage。
- 測試資料／fixture：使用者同款`Segment_Tree_easy_build.cpp`，額外套用`@style tree[1:Tsize-1] focus`；n=15、值1～15。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3101'; node --test tests/binary-addition-slide.browser.test.js`；`node --test --test-name-pattern="standalone segment tree build" tests/heap-composite-segments.browser.test.js`；`node --check public/trace-player.js; node --check tests/binary-addition-slide.browser.test.js; node --test tests/entrypoints.test.js; git diff --check`。
- 預期結果：投影片與演算法頁各1個建樹播放案例通過；入口版本與JavaScript語法正常。
- 實際結果與exit code：舊trace重建、儲存及第16幀投影片1/1，演算法頁1/1，過期trace編輯器遷移1/1，provenance／入口6/6通過，exit code均為0；停止已核對的3101 PID 64696並從本worktree重啟為PID 54924，HTTP 200，投影片入口為parallel-merge-198、iframe為trace-runtime-38、trace引擎版本為5。
- 證據位置：tests/binary-addition-slide.browser.test.js、tests/provenance.test.js及程式commit a91ec0624a9988004744f34ff000ec4cc3e28e7e、fc834a35a811278a9cd7786ae274fbaa8346e64c、7a9f9032a96cadbc8b27c279340d2ca8e8fb275e；執行輸出只保留於本次代理工作階段。

### 完整Segment Tree新版範例專項
- 目的與對應條件：確認既有完整Segment Tree可直接使用新版renderer指令播放建樹、lazy／set、區間分裂、query累加及回溯加總，且原演算法輸出不變。
- 執行目錄與必要環境設定：algo-vis-backend；隔離服務http://localhost:3198與獨立headless Edge。驗證後停止隔離PID 57680，再重啟alpha 3101為PID 67964。
- 測試資料／fixture：Segment_Tree.cpp及Segment_Tree-sample_input.txt（15個輸入、七筆add／set／query操作）。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://localhost:3198'; node --test --test-concurrency=1 tests/segment-tree-samples.test.js`；`node --test --test-concurrency=1 --test-name-pattern="full segment tree sample" tests/heap-composite-segments.browser.test.js`；`node --check tests/segment-tree-samples.test.js; node --check tests/heap-composite-segments.browser.test.js; git diff --check`。
- 預期結果：建樹不建立幀；heap範圍裁到索引30；fields／hide顯示原三陣列；modify／set使用紫色／橘色segment；操作segment可見；回溯幀segment為0；最終answer與輸出皆為12。
- 實際結果與exit code：範例3/3、完整範例瀏覽器1/1通過，exit code均為0；trace共123幀且build幀為0，renderer範圍為`[1,31)`，操作時可見複合欄位與segment，回溯加總幀無segment，最終answer及stdout皆為12。3101重啟後PID 53472、HTTP 200，`/trace/analyze`解析7個frame指令。
- 證據位置：Segment_Tree.cpp、tests/segment-tree-samples.test.js、tests/heap-composite-segments.browser.test.js，最終調整納入程式commit 63b78d12a4108511396a4767589bd86b9ae28bfd；執行輸出只保留於本次代理工作階段。

### 融合欄位與操作segment分離專項
- 目的與對應條件：確認lazy／sets只顯示在tree格子文字，且紫色／橘色segment只出現在modify／set操作範圍。
- 執行目錄與必要環境設定：algo-vis-backend；隔離服務http://127.0.0.1:3199與獨立headless Edge。
- 測試資料／fixture：Segment_Tree.cpp及Segment_Tree-sample_input.txt。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3199'; node --test --test-concurrency=1 tests/segment-tree-samples.test.js`；`node --test --test-concurrency=1 --test-name-pattern='full segment tree sample shows lazy fields' tests/heap-composite-segments.browser.test.js`；`node --check trace-instrumenter.js; node --check public/trace-renderer.js; git diff --check`。
- 預期結果：範例3/3與瀏覽器專項1/1通過；複合欄位文字與操作segment可見，回溯segment為0，輸出仍為12。
- 實際結果與exit code：範例3/3、瀏覽器專項1/1、語法檢查通過，exit code均為0；capture-only保留lazy／sets，實際SVG獨立lazy／sets物件數均為0。
- 證據位置：Segment_Tree.cpp與兩個直接相關測試；執行輸出只保留於本次代理工作階段。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑完整 regression／全部 tests／大規模動畫驗證，依使用者及 V2 分級由主代理決定整合範圍。
- 已知問題或風險：hide 的 LM／INT_MAX 對應目前以 32 位 int 最大值格式化；若未來支援自訂巨集值，需在 trace metadata 加入常數求值。二元加法的雙來源動畫目前限直接的可見純量或安全索引格；巢狀算式、函式呼叫或帶副作用索引沿用一般賦值動畫。
- 相依與衝突注意：修改 parser、renderer、tween、入口 cache 與兩個範例；合併時需保留 integration 上這些共用檔案的後續版本號。heap.cpp 未修改。
- 分支推送：已依使用者確認推送至`origin/codex/2026-09-19-alpha-segment-tree`，並以`git ls-remote`核對遠端HEAD。
- 主代理需補驗證的情境：合併後分別以 Segment_Tree_easy_build 播放一個葉節點與父節點雙來源加法幀，再以 Segment_Tree_easy 播放數個查詢幀；並以 Segment_Tree 確認複合文字、樣式與局部色塊，再依動畫影響範圍執行整合驗證。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
