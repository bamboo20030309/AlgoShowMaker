# Alpha：新版 Fibonacci 遞迴動畫範例交付

## 實作內容

- 移除舊版 `AV.hpp`、`TreeLayout`、`draw{}` 與手寫 `tree.push/pop/paint`。
- 使用 `@layout recursion as "fib_tree"` 與 runtime recursion activation 自動建立二叉呼叫樹。
- 以 `int value = n` 搭配 `@let call = n`，不再建立 C++ `string call`。
- 畫面只保留 recursion node；`left`、`right`、`result` 與同幀暫時的 `value` 不再形成額外畫面物件。
- 同一 layout／activation 再次 `@keep` 時沿用原 object ID 並替換 active snapshot；父子邊會解析到目前有效版本。
- 遞迴節點的顯示標籤固定為 `F`；尚未回傳時以 `with display("F(${call})")` 在格內顯示完整呼叫，回傳時移除模板並在原位置顯示數值。
- 基底呼叫也有明確的回傳狀態，因此 `F(1)` 會更新為 `1`、`F(0)` 會更新為 `0`。
- 新增 Fibonacci 專項 trace 與瀏覽器測試，確認輸入 `5` 產生 15 個有效呼叫節點、30 幀、唯一根節點、左右順序、3 個 `F(2)` 原地更新及最終答案 `5`。
- 新增 recursion growth tween：新 activation 的 keep node 會從 active parent 的中心位置，以縮放 `0.72 → 1`、透明度 `0.35 → 1` 移到 layout 終點；父子邊從父端同步延伸。
- 上一步採對稱行為：移除的新 activation 以 ghost 從 child 位置縮回父節點中心；根節點、找不到父節點與舊 trace 缺少 recursion metadata 時維持既有轉場。
- 同 activation 的 snapshot replacement 以 activation identity 與 `replacesSnapshotId` 排除，因此 `F(2) → 1` 不會重新長出。
- `display("...")` 已由 scalar 擴充到 sequence、matrix、normal、heap、segment tree、BIT、disk、stack、queue、object 欄位、graph node 與 coordinate point 等既有 renderer；自訂模板只改顯示文字，不改 trace value。
- 每個格子可使用 `${value}`、`${index}`；矩陣另有 `${row}`、`${column}`，map／object 可使用 `${key}`、`${field}`，並可與目前 frame 變數或 `@let` 混用。
- 動畫事件重播會重新套用 display 模板，因此 assignment／write 播放前後不會短暫退回原始值；模板內含逗號的引號字串也可正確解析。
- 遞迴 layout 的父子箭頭現在以穩定的 activation／parent 關係做 DFS 前序輸出：父節點先於子節點、左子樹完整先於右子樹；snapshot 回傳替換不再改變模型或 SVG DOM 的箭頭順序。
- 舊 trace 若只有 `layoutNode.parentSnapshotId`、缺少 recursion activation metadata，仍會沿用 snapshot parent 關係畫線。
- recursion keep tween 會在清除上一幀前保存 current recursion node 的實際 presented bounds；新 keep 由該位置位移到新 layout slot，而非只在目的地縮放。
- 父子箭頭每個 tick 直接重算至移動中的 child outerframe，不再做第二次 progress 裁切，因此箭頭與新節點同時延伸且端點不會落後。
- Fibonacci 範例改為 `F(int n)`、`if (n <= 1)` 與 `int sum = F(n - 1) + F(n - 2)` 的版本；初始／base 節點保留 `n`，遞迴回傳使用 `sum` 替換同 activation 的 F 節點，兼顧使用者範例結構與 `F(2) → 1`。sample input 為 `5`。
- 第 1→2 幀的停頓來自 code presenter：第一幀同時含 main／F 片段、第二幀只含 F，layout key 改變卻仍聚焦同一行，舊邏輯因此加入 500ms barrier。現在相同 focus line 的片段清理由 code panel 並行完成，不再阻塞 recursion canvas tween。
- 第 9→10 幀的 F_3 子箭頭跳動來自 same-activation keep 的 live alias；同一 SVG 曾以 `F_3` 與 `F:sum@…` 重複進入 layout edge model。現在以 DOM canonical object key 去重，並以穩定的父子 object key 建立箭頭 identity。

## 目前可供使用者檢視的行為

- 呼叫樹依實際執行順序逐步長出，父子線與左右兄弟順序正確。
- 節點統一顯示 `F`，格內先顯示 `F(n)`，得知答案後才切換為回傳數值。
- 同一 `F_3` 節點會由 `F(2)` 原地更新為 `1`；退回更新前的幀會恢復為 `F(2)`。
- 新 child 會像從目前父節點長出；按上一步時則縮回同一父節點，樹邊與節點位置同步更新。
- 陣列等其他物件可直接寫 `@frame arr with display("${index}: ${value}")`，每格使用自己的 index／value。
- 最終畫面只有 15 個遞迴節點，不存在額外 `left`、`right`、`result` 或 `value` 物件。
- 最終 Fibonacci `F(5)` 的箭頭 target 順序固定為 `F_1`～`F_14`，符合 DFS 前序的首次建立順序。
- 新 child 從上一幀 current node 的中心開始位移；正向播放時箭頭終點持續貼住 child，反向播放則縮回同一 current node。
- 第 1→2 幀的 keep／frame transition 從 0ms 開始；第 9→10 幀的 F_3→F_4、F_3→F_5 箭頭在樹重排全程保持綁定。

## 驗證分級與選擇

- 層級：V2。
- 分類：E（layout／frame）、F（runtime 遞迴資料）、G（生命週期／遞迴 activation）、J（播放與 Studio）。
- 選擇依據：修改遞迴範例、keep snapshot materialization、recursion renderer 的同 activation 替換行為，以及 frame tween 的遞迴進退場。
- 執行的測試檔／案例：`tests/fibonacci-recursion-sample.test.js`、`tests/fibonacci-recursion-display.browser.test.js`、`tests/display-renderer-options.browser.test.js`、`tests/outerframe-tween.test.js`、`tests/frame-renderer-options.integration.test.js`、`tests/directive-assist.test.js`、`tests/entrypoints.test.js`，以及 `layout-directives.test.js` 的 recursive keep identity 案例。
- 驗證環境：alpha worktree 的 3101 服務與隔離的 Playwright 瀏覽器，輸入 `5`。
- 自動測試結果：本輪前序修改的 `layout-directives.test.js` 與 `entrypoints.test.js` 共 12/12 通過；Fibonacci 實際瀏覽器 1/1 通過，全部 0 fail、0 skipped。先前 Fibonacci trace／瀏覽器 2/2、outerframe／growth tween 7/7、recursive keep identity 1/1 亦已通過。
- 瀏覽器 DOM：同一個 `F(2)` snapshot object 回傳後顯示 `1`，且不再殘留 `F(2)` 文字；replacement 中途不含 growth scale。
- 瀏覽器 tween：正向 1× 驗證父中心起點、縮放／透明度、父子邊延伸與完成定點；反向 2× 驗證 child ghost 縮回父中心並於完成後移除。
- current-node handoff 專項：驗證正向 transform 含遞減至零的位移量，且動畫起點／中點的箭頭端點與 moving child 保持在箭頭頭部預留距離內。
- 使用者指定 F(5) 專項：驗證第一個 child playback plan 的 keep／frame transition start 都是 0ms；驗證第 9→10 幀 F_3 的兩條 child edge 在起點、中段、終點都存在、端點距離小於箭頭頭部預留值且沿同一路徑連續位移。
- 通用 display 瀏覽器：normal sequence、heap、matrix 與 assignment replay 通過；確認 `${value/index/row/column}` 與 frame 變數運算，且 trace 原值未被修改。
- 自動播放與 Trace Studio：本輪未執行完整 UI 操作；待使用者以 3101 預覽複核。專項瀏覽器已驗證 transition Promise 在 1×／2× 完成後清除暫態 transform／ghost。
- 畫面：最終根值 `5`，內部節點顯示回傳值，沒有 `left/right/result/value` 額外區塊。
- 瀏覽器 console：0 error、0 warning。
- 靜態檢查：修改的 JS 通過 `node --check`，入口快取 build 一致性測試與 `git diff --check` 通過；僅有既有 Windows LF/CRLF 提示。
- 未執行：完整 regression、全部 tests、廣泛排序或其他演算法動畫；本次依規範只做直接相關 V2 驗證。
- 需要主代理做的 V3 驗證：整合時建議以 Fibonacci `F(5)` 的 UI 下一步／上一步／自動播放與 Trace Studio 縮圖，核對 child 長出／縮回、樹邊端點及 `F(2) → 1` 原地替換；不需擴大到無關演算法。

## 舊有物件相容性

- 沒有新增或修改持久化投影片／Fabric／widget 欄位；另以缺少 recursion activation metadata、只保留 `layoutNode.parentSnapshotId` 的舊 trace fixture 實際 render，確認父子箭頭仍存在。

## 2026-09-25：遞迴呼叫程式碼事件分流

- Fibonacci 範例將左右遞迴拆為 `int left = F(n - 1);`、`int right = F(n - 2);`，以 C++ 敘述邊界保證左子樹完整返回後才啟動右子樹；兩個區域變數沒有 `@keep`，畫布仍只顯示遞迴節點。
- 一般 CallExpression instrumentation 改由 `event_call_invoke(...)` 包住真正呼叫，call-start 到 invocation return 成為不可由兄弟運算元探針穿插的完整執行單位；保留 `void`、值回傳與 reference 回傳語意。
- runtime event 現在帶所在 recursion activation；callee 的 `FunctionActivation` 會保存 `invokedByCallEventId`，內部 `call-return` 則記錄相同 call event 與 callee activation。
- trace model 建立非持久化 `callLifecycles`，補出 `callOccurrenceId`、`callerActivationId`、`calleeActivationId`、`returnEventId` 與 `returnOrder`，供程式碼呈現依實際 activation 區分呼叫。
- `call-return` 是內部事件，不出現在 Studio inspector、事件時間線或程式碼片段，因此不會多一個可見動畫；原有 call 開關仍控制呼叫反白。
- 間接呼叫只有在 callee 名稱與實際進入函式吻合時才綁定 activation，避免 `sort` 等函式內部 callback 被誤認成直接 callee。

### 驗證分級與選擇

- 層級：V2；分類：F（runtime 函式呼叫事件）、I（程式碼事件呈現）、G（recursion activation 生命週期）。
- 隔離環境：alpha worktree 的 `3191` 測試服務與獨立 headless Edge；未操作使用者分頁。
- `function-call-event.integration.test.js`、`fibonacci-recursion-sample.test.js`、`fibonacci-recursion-display.browser.test.js`：6/6 通過，0 fail、0 skipped。
- `event-defaults.test.js`、`function-enter-event.integration.test.js`：7/7 通過；`code-presentation.integration.test.js` 的 `call-only recursive context`：1/1 通過。
- 實際事件斷言：根 activation 的第一個 call 已完成 `call-return` 後，第二個 sibling call 才取得較大的 runtime order；兩者各自連到不同 callee activation。
- 實際瀏覽器程式碼片段：左、右 call 位於不同 frame，依序只將 `F(n - 1)`、`F(n - 2)` 對應的語法片段標成完成；右側 order 晚於左側 return。
- 回傳語意：另以 `int&` 回傳函式驗證 wrapper 不會把 reference 降成 value。
- 原動畫專項：Fibonacci `F(5)` 的節點長出、箭頭同步、DFS 前序與 `F(2) → 1` 瀏覽器測試仍通過。
- 靜態檢查：所有修改 JS 的 `node --check` 與 `git diff --check` 通過；只有 Windows LF/CRLF 提示。
- 未執行完整 regression、全部 tests 或廣泛演算法動畫，符合 V2 最小相關驗證要求。

### 舊有物件相容性

- 新 trace：call lifecycle 與 activation linkage 完整建立。
- 舊 trace：測試移除所有新增欄位與 `call-return` 後重新 normalize，幀數與既有 call events 保留且可正常載入。
- 本功能沒有新增持久化 Studio/Fabric 欄位；`callLifecycles` 為 normalize 時重建的非 enumerable 資料，不改寫使用者儲存內容與既有事件開關。

## 2026-09-25：return 程式流程事件

- `return` 現在是預設開啟的 code-only 事件：只以 260ms 短反白呈現原始 `return` 敘述，不新增 `@frame`、時間線標籤或畫布物件，並可在 Trace Studio 個別關閉。
- runtime 依序記錄 `return`、回傳運算式內的 call、內部 `return-complete`、目前 activation 的 `scope-exit`、`function-exit`；因此 `return F(...)` 不會在子呼叫前提早顯示函式已離開。
- `return-complete` 保存實際回傳值、`returnEventId`、function 與 recursion activation metadata，但屬內部事件，不出現在 Studio、時間線或程式碼片段。
- `function-exit` 連回同一 `returnEventId`；作用域 guard 在 function-exit 前按逆宣告順序結束，原本 destructor 階段不會重複產生 scope-exit。
- instrumentation 保留值回傳、reference return、`return;`、只求值一次、區域變數 implicit move 與 `return { ... };` braced initializer 的 C++ 語意。
- `break`、`continue` 尚未加入；本輪依分階段決策只完成直接影響遞迴回傳的 `return`。

### 驗證分級與選擇

- 層級：V2；分類：F（runtime return/call 順序）、G（activation 與 scope 生命週期）、I（程式碼事件呈現）、J（播放與 Studio 開關）。
- 隔離環境：alpha worktree 的 `3197` 測試服務與獨立 headless Edge，未操作使用者分頁。
- `return-event.integration.test.js`：3/3 通過；覆蓋 recursive return 順序、實際值、activation linkage、260ms code-only schedule、明確關閉設定、reference／void、單次求值、implicit move 與 braced initializer。
- `function-call-event.integration.test.js`、`code-exit-presentation.test.js`、`event-defaults.test.js`、`function-enter-event.integration.test.js`、`fibonacci-recursion-sample.test.js`、`entrypoints.test.js`：20/20 通過。
- `fibonacci-recursion-display.browser.test.js`：1/1 通過，確認新增 return 事件後 F(5) 的節點長出、回傳原地更新與瀏覽器播放仍正常。
- 靜態檢查：修改的 JS 全數通過 `node --check`，`git diff --check` 通過；只有既有 Windows LF/CRLF 提示。
- 未執行完整 regression、全部 tests 或無關演算法動畫，符合 V2 最小相關驗證要求。

### 舊有物件相容性

- 沒有新增持久化物件欄位；舊 trace 沒有 `return`／`return-complete` 時照原資料載入，不會合成額外事件。
- 新 trace 的 `return` 預設開啟；已儲存的 `studio.eventSettings.defaultEnabled.return = false` 經實際套用後仍維持關閉，不會被新預設覆蓋。

## 2026-09-25：遞迴 DFS 進入／返回輔助箭頭

- recursion layout 新增 `flow-arrows on|off` 開關，預設 `off`；Fibonacci 範例已開啟。
- 開啟後依實際 DFS 生命週期保留每一條走訪紀錄：進入 child 時加入 enter arrow，child 的 `function-exit` 出現後加入 exit arrow；同一 child 永遠先 enter、走完其完整子樹後才 exit。
- `top-down`／`bottom-up` 皆由 outerframe 的 `center.left` 進入、`center.right` 返回；`left-right`／`right-left` 皆由 `center.top` 進入、`center.bottom` 返回。
- 箭頭為 1px、`rgba(107, 114, 128, 0.38)` 的二次貝茲曲線，進場以 260ms path draw 呈現；曲率依跨距與遞迴深度限制在 18–38px，避免深層曲線無限制外擴。
- 每條箭頭以 layout、phase、父 activation、子 activation 建立穩定 identity。樹重排與 child growth tween 的每個 tick 都重新讀取節點目前 outerframe，因此歷史箭頭會與節點同步移動，端點不會留在舊位置。
- 輔助箭頭沿用既有 SVG arrow layer 與 frame tween 配對，但不加入 layout placement／camera bounds，避免歷史曲線改變自動鏡頭或樹排版。

### 驗證分級與選擇

- 層級：V2；分類：E（recursion layout directive）、G（activation 生命週期與箭頭 tween）、J（瀏覽器播放）。
- parser／geometry：驗證預設關閉、明確開啟、非法值、四種 direction 的錨點與二次貝茲控制點。
- Fibonacci `F(5)` 瀏覽器：最終 14 條一般父子邊、14 條 enter、14 條 exit；flow sequence 為 0–27，每個 child 的 enter 早於 exit，端點精確貼合 outerframe。
- 重排與長出：驗證第 9→10 幀既有 flow arrows 持續存在並連續位移；新 child 長出時 path dash offset 遞減且終點全程貼住移動中的 child，完成後移除暫態 dash mask。
- 舊物件相容性：`showFlowArrows` 缺欄位與明確 `false` 都不顯示；明確 `true` 經 JSON 儲存、載入、使用、再儲存與重開後仍保留並顯示 28 條走訪箭頭。
- 直接相關 parser、identity、outerframe tween、入口與 Fibonacci 測試共 28/28 通過；其中瀏覽器專項 1/1 通過，0 fail、0 skipped。alpha 3101 重啟後另以實際 `/trace/analyze`＋`/compile` 再驗證範例 1/1 通過，並確認 renderer 217、tween 238、directive assist 23 已載入。
- 未執行完整 regression、全部 tests 或無關演算法動畫；依 V2 規範只跑直接相關的小型驗證。

## 2026-09-25：第 9 幀 auto camera 左偏修正

- 同 activation 的 `@frame sum`／`@keep sum` replacement 現在會清除 live wrapper 與所有 descendant 的 placement／element alias，再將外層 live key 指向保留的 `F_3` 節點。
- `currentBounds()` 增加 scene-root 歸屬檢查；已從 DOM 移除或不屬於目前 SVG root 的暫存元素不再參與 auto camera bounds。
- 修正前第 9 幀殘留 `F:sum@…#0` 於 `x=98`，使 camera center 從約 649 跳到 405；修正後 bounds 由可見遞迴樹的最左側開始，center 與前一幀差小於 20px。
- renderer build 更新為 218。

### 驗證分級與選擇

- 層級：V2；分類：E（camera bounds）、G（same-activation keep replacement）、J（瀏覽器播放鏡頭）。
- `entrypoints.test.js`、`outerframe-tween.test.js`：8/8 通過；Fibonacci 瀏覽器專項 1/1 通過，0 fail、0 skipped。
- 使用者程式與輸入 `5` 的隔離瀏覽器量測：第 8、9、10 幀 camera centerX 為 `649.42 → 640 → 643.39`；第 9 幀 bounds left 為可見樹的 `568`，三幀皆無 detached `sum` descendant alias。
- Fibonacci 專項同時重驗 `F(2) → 1`、遞迴節點長出／縮回、一般父子邊與 DFS flow arrows，既有斷言全部通過。
- 靜態檢查：修改的 JS 通過 `node --check`，`git diff --check` 通過；未執行完整 regression、全部 tests 或無關演算法動畫。

## 2026-09-25：河內塔新版指令範例

- 原有 `algorithm_sample/Backtracking/hanoi.cpp` 完整保留；新版另存為 `algorithm_sample/Backtracking/hanoi-recursion.cpp`，並使用獨立的 `hanoi-recursion-sample_input.txt`。新版移除舊 `AV.hpp`、`TreeLayout` 與 `//draw{}` 呈現層，保留使用者原本的 `map<string, deque<int>> pegs`、兩次遞迴、`front/pop_front/push_front`、`ans.push_back` 與輸出順序。
- 以 `Peg_A`、`Peg_B`、`Peg_C` 三個 reference 直接引用原資料，三者使用 `render disk` 並由上到下固定在左側；`hanoi_tree` 使用 `left-right` recursion layout 固定在右側，degree 2 並開啟 DFS flow arrows。
- 輸入沿用 `4`；實際 trace 為 47 幀、15 個可見非 base activation，最終 Peg_A/Peg_B 為空，Peg_C 為 `[1,2,3,4]`。
- 舊版無法編譯的直接原因是伺服器使用 MinGW GCC 6.3.0：即使參數為 `-std=c++1z`，仍不支援 C++17 structured binding `for (auto const& [color, indices] : color_groups)`，所以 parser 從 `[` 開始連續報錯。新版已移除該舊繪圖 helper。
- instrumentation 修正非數值 subscript：`pegs[from]`／`pegs[to]` 的 `from`、`to` 是 `string`，不再產生非法的 `static_cast<long long>(from/to)`；既有數值 `arr[i]` 仍照常保存 resolved index。
- renderer 允許空 sequence 繼續走 disk renderer，因此搬空後仍保留柱子與底座，不會退回 normal array 外觀；renderer build 更新為 219。

### 驗證分級與選擇

- 層級：V2；分類：E（frame/object/place/layout）、F（字串鍵 runtime 寫入）、G（遞迴 activation）、J（實際瀏覽器布局）。
- 環境：alpha 3101 與隔離 headless Edge，輸入 `4`；未操作使用者分頁。
- `hanoi-recursion-sample.test.js`、`empty-initial-render.test.js`、`sequence-operations.integration.test.js`：4/4 通過。
- `assignment-indices.integration.test.js`：6/6 通過，確認數值索引沒有因字串鍵修正而退化。
- `hanoi-recursion-sample.browser.test.js`：1/1 通過；實際 DOM 為 3 個 disk、15 節點、14 一般樹邊與 28 條 DFS flow arrows，三個 disk 全部位於樹左側，空柱仍有 base/peg，canvas-relative X 差精確為 `360 - 70 = 290px`。
- 靜態檢查：`trace-instrumenter.js`、`trace-renderer.js` 與新增測試均通過 `node --check`；未執行完整 regression、全部 tests 或無關演算法動畫。
- 需要主代理做的 V3 驗證：整合時以河內塔輸入 4 手動播放一次，核對盤子轉移與右側遞迴樹同步即可；不需擴大至無關演算法。

### 舊有物件相容性

- 不新增持久化物件欄位；disk renderer 對既有非空 disk 行為不變，新增回歸只覆蓋原本錯誤的空 disk fallback。舊 trace 與明確使用其他 renderer 的 sequence 仍走原路徑。

## 2026-09-26：Trace Studio 全影格事件 availability 預檢

- Studio 開啟前會以隱藏、無動畫、非互動 SVG 依序渲染所有影格，先完成每個事件的實際 canvas target availability，再建立來源程式事件樹。
- 預檢沿用正式 renderer、scene generation、runtime lifetime、marker／binding 與前一幀 visual object；不以是否直接出現在 `@frame` 做簡化判斷。
- Fibonacci 輸入 5 在尚未逐幀播放時直接開啟 Studio，`int left`、`left = F(n - 1)` 與 `left 退場` 現在立即標記為 `missing-target`，不再先顯示為可用的綠色事件。
- 自動 array marker 的 `index = 1` 仍為 available；前一幀曾顯示的 `shown` 自然退場也仍為 available，確認預檢沒有把間接顯示或跨幀退場誤判成黃色。
- 預檢 host 完成後立即移除，不改變主畫布、目前影格或播放順序。

### 驗證分級與選擇

- 層級：V2；分類：F（事件 target availability）、G（lifetime／退場）、J（Trace Studio）。
- `studio-availability-preflight.browser.test.js`、`event-code-tree.test.js`、`entrypoints.test.js`：4/4 通過。
- `heap-marker-assignment.integration.test.js` 直接相關的 unavailable 預設、matching lifetime exit、hidden lifetime exit：3/3 通過。
- 實際瀏覽器確認未走訪 Fibonacci 影格的 left 宣告／退場為 `missing-target`；marker-bound assignment 與 previous-frame exit 保持 available。
- 靜態檢查：修改的 JS 通過 `node --check` 與 `git diff --check`；入口載入 renderer 220、Studio 123。
- 未執行完整 regression、全部 tests 或無關演算法動畫；依 V2 規範只跑直接相關專項。

### 舊有物件相容性

- 沒有新增持久化欄位。既有明確事件開關仍由 `eventInstructionStates` 決定；預檢只補齊每個 occurrence 的衍生 availability，不覆寫使用者選擇。

## 2026-09-26：舊版河內塔 GCC 6.3 相容修正

- 只修改舊版 `algorithm_sample/Backtracking/hanoi.cpp`；新版 `hanoi-recursion.cpp` 不變。
- 將 GCC 6.3 不支援的 structured binding 改成 `map<string, vector<int>>::const_iterator`，再由 `it->first`、`it->second` 取得顏色與索引。
- 將 `<bits/stdc++.h>` 移到 `AV.hpp` 前，確保舊 header 使用 `std::sort` 前已載入 `<algorithm>`。
- 使用 alpha 3101 的舊版 `/compile` 路徑、輸入 4 實際編譯成功；輸出 15 次搬運與「已成功畫圖」，產生 819444 字元 legacy animation script。
- 隔離 headless Edge 實際載入 script，得到 67 幀、初始幀 0，console 0 error。
- 層級：V2；只驗證直接相關的舊編譯與 legacy animation 載入，未執行完整 regression 或無關演算法。

## 2026-09-26：舊版動畫與 trace 編譯分流

- `/compile` 現在會辨識 `AV.hpp` 或 `//draw{}` 舊版動畫來源；即使前端送出 `trace.enabled=true`，也會直接使用 legacy animation compiler，不再把舊繪圖 helper、lambda 參數與型別名稱送進 trace instrumenter。
- debug log 會說明已使用舊版動畫編譯器，但不把這個預期分流當成 warning 而強制切換到除錯頁；舊版仍回傳 `scriptContent`，新版 trace 範例仍回傳 `traceDocument`。
- 新增 `legacy-hanoi-compile.integration.test.js`，刻意依前端路徑先 `/trace/analyze`，再以 trace enabled 編譯完整舊版河內塔，重現並封鎖本次錯誤。

### 驗證分級與選擇

- 層級：V2；分類：E（舊版 draw 指令）、F（trace instrumentation 分流）、J（瀏覽器 RUN 與 legacy script 套用）。
- 隔離環境：alpha worktree 的 3187 測試服務與獨立 in-app browser，未操作使用者既有分頁。
- `legacy-hanoi-compile.integration.test.js`、`hanoi-recursion-sample.test.js`：2/2 通過，0 fail、0 skipped。舊版輸入 4 得到 15 次搬運、無編譯錯誤、`traceDocument=null` 且 legacy `scriptContent` 存在；新版河內塔 trace 同時通過，確認沒有被誤分流。
- 實際瀏覽器由 RUN 按鈕送出預設 `AV.hpp` 程式，顯示編譯成功、退出碼 0，並把 20 幀動畫腳本套用到畫布；debug log 留有 legacy 分流紀錄。
- alpha 3101 已從本 worktree 重啟為 PID 56808；HTTP 200 後在正式預覽埠重跑舊版河內塔專項 1/1 通過。
- 靜態檢查：`server.js` 與新增測試通過 `node --check`，`git diff --check` 通過；只有既有 Windows LF/CRLF 提示。
- 未執行完整 regression、全部 tests 或無關演算法動畫；依 V2 規範只跑直接相關案例。

### 舊有物件相容性

- 沒有新增持久化物件欄位。既有 legacy source 自動走舊編譯器；不含 `AV.hpp`／`//draw{}` 的新版 trace source 維持原路徑與資料格式。

## 2026-09-28：河內塔 keep 對齊、盤子塗色與跨柱圖層

- live object 轉成 `@keep` snapshot 時，改以來源與目標的 outerframe 結構位置對齊，不再使用會包含 highlight／point 外擴範圍的整體 placement；第 1→2 幀 root 的動畫中螢幕 Y 座標維持不變，且不再產生補償用 transform。
- disk renderer 的條件背景色改為同幀原子提交；第 19→20 幀 `Peg_A` 的盤子 2 與 `Peg_B` 的盤子 1 不再各自做不同色距的 CSS 漸變，而是在同一提交點套用綠色與紅色。既有跨柱移動 paint barrier 保留，盤子飛行途中仍維持來源顏色。
- 具有相同 disk continuity identity、但 owner Peg 不同的格子，在跨容器 tween 期間會暫時提升到共用 animation effect layer；wrapper 保留目的 Peg 的 variable identity，動畫完成後恢復原 DOM 位置。第 6→7 幀移動盤子因此位於 Peg_C 之上，不再被目的柱整組遮住。
- tween build 與入口 cache version 更新為 `trace-246`。

### 驗證分級與選擇

- 層級：V2；分類：G（keep handoff／跨容器 continuity）、H（disk style 與動畫圖層）、J（實際瀏覽器逐幀播放）。
- `hanoi-recursion-sample.browser.test.js`、`hanoi-recursion-sample.test.js`：2/2 通過；瀏覽器斷言涵蓋第 1→2、6→7、19→20 幀。
- `outerframe-tween.test.js`、`animation-effect-layer.test.js`：8/8 通過。
- `entrypoints.test.js`：1/1 通過，入口 cache version 與 tween／renderer build 相符。
- 修改的 JS 與瀏覽器測試通過 `node --check`；`git diff --check` 通過，只有既有 Windows LF/CRLF 提示。
- alpha 3101 已從本 worktree 重啟為 PID 36664；HTTP 200，入口與腳本皆確認載入 `trace-246`，重啟後新版河內塔 `/trace/analyze`＋`/compile` 專項 1/1 通過。
- 未執行完整 regression、全部 tests 或無關演算法動畫；依 V2 規範只跑直接相關案例。

### 舊有物件相容性

- 沒有新增持久化欄位。既有 snapshot、disk 與自訂 style 資料格式不變；修正只影響播放時計算的 outerframe 對齊、disk paint 提交與跨 Peg 暫時圖層。

## 2026-09-28：name 連續性與 root handoff 白色回程

- outerframe name label 在 scene generation 改變時會改由其 owner object 判定視覺連續性；同一個 `ans`／一般物件不再因 root 被 `@keep` 就被誤判為新物件淡入。第 1→2 幀的非 root name 保持 opacity 1，沒有 `data-trace-appearing`。
- 根節點三分支預覽結束後，第 6→7 幀恢復真實盤面時以 handoff 幀實際可見的白色作為四個盤子的飛行色；移動完成後才原子套用當前狀態的紅、紅、綠、白。
- 白色回程只套用 recursion depth 0 的 root handoff；較深層 handoff 繼續保留先前指定的分支搬運色，因此第 31→32 幀盤子 2 的紅色飛行不退化。
- tween build 與入口 cache version 更新為 `trace-247`。

### 驗證分級與選擇

- 層級：V2；分類：G（scene generation／label continuity）、H（disk paint barrier）、J（實際瀏覽器逐幀播放）。
- `hanoi-recursion-sample.browser.test.js`、`hanoi-recursion-sample.test.js`：2/2 通過；同時驗證第 1→2 幀 name 不閃爍、第 6→7 幀四盤白色飛行後提交目的色，以及第 31→32 幀既有紅色搬運要求。
- `outerframe-tween.test.js`、`animation-effect-layer.test.js`：8/8 通過。
- 修改的 JS 與瀏覽器測試通過 `node --check`；`git diff --check` 通過，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。

### 舊有物件相容性

- 沒有新增持久化欄位；只修正現有 owner identity 與 handoff metadata 的播放時解讀。

## 2026-09-28：所有 recursion handoff 統一依可見顏色搬運

- 上一輪只將 root handoff 設為白色回程，仍讓較深層 handoff 回頭讀取 branch preview 的紅色；因此第 16→17 幀雖然第 16 幀已取消塗色，Peg_C 的盤子仍被舊 preview paint 覆蓋成紅色搬運。
- 現在所有 `systemBranchHandoff` 都以 handoff 畫面當下的實際 paint 作為跨 Peg 飛行色，不再讀取更早的 `transitionStyleFrameId`。白色盤子保持白色完成移動，落地後才原子提交下一幀條件樣式。
- 第 31→32 幀同步改成同一規則；先前「較深層維持紅色」的暫行行為由本節取代。
- 新增實際 `CodeScript.next()` 中斷播放驗證：快速 14→15→16 後 Peg_C 保持白色、進入下一層 recursion 時 outerframe name 不重新入場、快速 18→19→20 時 Peg_A[2]／Peg_B[1] 同步完成綠／紅塗色。
- tween build 與入口 cache version 更新為 `trace-248`。

### 驗證分級與選擇

- 層級：V2；分類：G（recursion handoff）、H（disk paint barrier）、J（連續手動下一步）。
- `hanoi-recursion-sample.browser.test.js`、`hanoi-recursion-sample.test.js`：2/2 通過；包含第 16→17 幀兩個 Peg_C 盤子在 animation effect layer 中皆為白色。
- `outerframe-tween.test.js`、`animation-effect-layer.test.js`：8/8 通過。
- 修改的 JS 與測試通過 `node --check`；`git diff --check` 通過，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。

### 舊有物件相容性

- 沒有新增持久化欄位；既有 handoff trace 會直接採用前一幀實際呈現的 paint，無需重新儲存或資料遷移。

## 2026-09-28：disk fallback name 不再於遞迴換層重新入場

- 實際重現第 16→17 幀時，`Peg_A`、`Peg_B`、`Peg_C` 三個 name 都被設成 `data-trace-appearing=1`，動畫開始 20ms 的 opacity 為 0；先前測試只選取 `.outerframe-label`，因此漏掉 `render disk` 由 renderer 補上的一般文字 name。
- renderer 現在會以 `asm-trace-object-label` 標記沒有 outerframe label 的 fallback name；tween 將 outerframe name 與 fallback name 統一按 owner object 判定視覺連續性。同一個 Peg 跨 recursion scene generation 保持 opacity 1，不再重新淡入。
- 測試 selector 改為涵蓋所有 `:label` 視覺，不再只驗 outerframe；修正前可穩定失敗並列出三個 Peg name，修正後通過。
- tween build 更新為 `trace-249`，renderer build 與入口 cache version 更新為 `trace-227`。

### 驗證分級與選擇

- 層級：V2；分類：G（scene generation／object continuity）、H（fallback object label）、J（實際遞迴換層播放）。
- `hanoi-recursion-sample.browser.test.js`、`hanoi-recursion-sample.test.js`：2/2 通過；直接驗證第 16→17 幀所有既存 object name 的 label、owner、motion opacity 都維持 1，且沒有 `data-trace-appearing`。
- `outerframe-tween.test.js`、`animation-effect-layer.test.js`：8/8 通過。
- `entrypoints.test.js`：1/1 通過，入口 cache version 與 tween／renderer build 相符。
- `trace-renderer.js`、`trace-frame-tween.js` 通過 `node --check`；`git diff --check` 通過，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已從本 worktree 重啟為 PID 77980；HTTP 200 且入口確認載入 tween `trace-249`、renderer `trace-227`。正式預覽埠的河內塔瀏覽器與 trace 專項 2/2 通過。

### 舊有物件相容性

- 沒有新增持久化欄位；class 只在渲染時補到既有 fallback name，舊 trace 不需重建資料或遷移。

## 2026-09-28：恢復 disk paint 過渡與右側接木紅色搬運

- 上一輪為同步 disk paint，對所有 `disk:*` continuity 視覺移除了 `.asm-trace-style-paint`，因此連盤子停止移動後原本的 180ms fill 過渡也被關閉。現在所有盤子仍會在幾何移動期間由 paint barrier 固定來源色，落地釋放 barrier 後再同步執行 fill 過渡。
- recursion handoff 改為依目前 activation 的 sibling role 判斷：左分支進入下一層時維持先前要求的白色回程；右分支「接木」handoff 則沿用最後 branch preview 的紅色搬運群組。第 31→32 幀盤子 2 移動期間保持紅色，落地後才過渡到下一幀的目標色。
- 快速 14→15→16 仍會等待目前 paint transition 完成；第 16 幀穩定狀態的 Peg_C 兩個盤子皆為白色。快速 18→19→20 的最終紅／綠狀態也保持正確。
- tween build 與入口 cache version 更新為 `trace-250`。

### 驗證分級與選擇

- 層級：V2；分類：G（recursion handoff）、H（disk style paint）、J（快速下一步與瀏覽器播放）。
- `hanoi-recursion-sample.browser.test.js`：1/1 通過；驗證第 19→20 幀存在起始色、中間插值色與最終色，第 31→32 幀移動中的盤子 2 為紅色，settled 後為目的幀顏色，第 16 幀快速連點後兩盤皆為白色。
- `hanoi-recursion-sample.test.js`、`style-replay.browser.test.js`、`outerframe-tween.test.js`、`animation-effect-layer.test.js`、`entrypoints.test.js`：11/11 通過。
- `trace-frame-tween.js` 通過 `node --check`；`git diff --check` 通過，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已從本 worktree 重啟為 PID `22100`；HTTP 回應 200，入口載入 tween `trace-250`、renderer `trace-227`。重啟後以正式 3101 再驗證 Hanoi browser 與 trace 測試，2/2 通過。

### 舊有物件相容性

- 沒有新增持久化欄位。既有 trace 的 disk continuity、branch handoff metadata 與 style 指令直接套用新播放規則，不需要資料遷移。

## 2026-09-28：無事件影格沿用上一幀程式碼片段

- `trace-code-model` 現在會讓時間線中沒有任何 runtime event 的影格沿用上一幀可顯示的程式碼片段；連續多個無事件影格會繼續回溯到最近的可顯示片段。第一幀或前方沒有可用片段時仍維持原本的空白／setup-source 行為。
- `trace-code-presenter` 對真正沒有可顯示片段的目的幀直接回傳 0ms delay，避免空白 code plan 錯誤阻擋畫布 500ms。
- Hanoi 第 7 幀會沿用第 6 幀的片段，layout／focus 不變，因此第 6→7 幀盤子與遞迴畫面立即開始轉場；正常跨片段捲動仍保留 500ms。
- cache version 更新為 model `code-29`、presenter `code-32`。

### 驗證分級與選擇

- 層級：V2；分類：I（程式碼呈現）、J（播放時間表）、G（遞迴交接）。
- `code-presentation.integration.test.js` 相關案例 2/2 通過：無事件影格繼承與正常跨片段捲動。
- `hanoi-recursion-sample.browser.test.js`、`entrypoints.test.js`：2/2 通過；實際確認第 7 幀具有繼承片段且 code delay 為 0ms。
- `trace-code-model.js`、`trace-code-presenter.js` 與 browser test 通過 `node --check`；`git diff --check` 無 whitespace error，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已從本 worktree 重啟為 PID `22136`；HTTP 200，入口載入 model `code-29`、presenter `code-32`、tween `trace-250`。重啟後上述 4/4 專項案例再次通過。

### 舊有物件相容性

- 沒有新增持久化欄位。規則只讀取既有 frame event 與時間線順序；缺少額外欄位的舊 trace 可直接套用，無需資料遷移。

## 2026-09-28：位移落地後保留 180ms 上色階段

- style paint barrier 釋放時，先提交位移期間的來源色，再重新啟用 CSS fill transition；即使 barrier 剛好在最後一個幾何 tick 釋放，也不會在同一 tick 直接清除 transition。
- 只有具有位移 barrier 且來源色與目標色實際不同的物件，才會建立 `style-paint-transition` 阻擋階段。沒有變色的位移不會被額外延長。
- Hanoi 第 11→12 幀的盤子 1、2 先以白色由 Peg_B 搬回 Peg_A，落地後分別以 180ms 過渡成紅色與綠色。
- tween build 與入口 cache version 更新為 `trace-251`。

### 驗證分級與選擇

- 層級：V2；分類：G（跨容器位移）、H（style paint）、J（播放完成時序）。
- `hanoi-recursion-sample.browser.test.js`：1/1 通過；逐 30ms 取樣確認搬運期間為白色、落地後盤子 1／2 都存在中間插值色、最終為紅／綠，且播放時間表包含 180ms paint phase。
- `style-replay.browser.test.js`、`entrypoints.test.js`：2/2 通過；`outerframe-tween.test.js`、`animation-effect-layer.test.js`：8/8 通過。
- `trace-frame-tween.js` 與 Hanoi browser test 通過 `node --check`；`git diff --check` 無 whitespace error，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已從本 worktree 重啟為 PID `55156`；HTTP 200，入口載入 tween `trace-251`、model `code-29`、presenter `code-32`。重啟後核心 3/3 專項案例再次通過。

### 舊有物件相容性

- 沒有新增持久化欄位。現有 frame、style 與 transition 設定直接使用新的完成時序；舊 trace 不需要資料遷移，明確沒有顏色變化的物件也不會新增等待。

## 2026-09-28：撤回位移期間固定 style

- 完整播放器重現第 19→20 幀：盤子 2 約 61ms 開始變色，但盤子 1 約 477ms 才開始。原因是上一輪新增的 geometry paint barrier 將「存在 previous outerframe geometry」誤判為「物件正在移動」，並把 Peg_B 的錯誤等待時間傳給盤子 1。
- 依使用者要求撤回一般位移的 style barrier、handoff paint hold 與落地後 `style-paint-transition`；一般幀的 style 現在與幀轉場同時開始。保留 disk continuity 身分配對、name 連續性及其他無關修正。
- tween build 與入口 cache version 更新為 `trace-252`。

### 驗證分級與選擇

- 層級：V2；分類：G（位移／容器連續性）、H（style paint）、J（完整播放器時序）。
- `hanoi-recursion-sample.browser.test.js`、`entrypoints.test.js`：2/2 通過。完整 `ASMTracePlayer` 第 19→20 幀在前 90ms 內確認 Peg_A 盤子 2 與 Peg_B 盤子 1 都已離開來源色，最終分別為綠色與紅色；一般位移不再建立 post-motion paint phase。
- `trace-frame-tween.js` 與 Hanoi browser test 通過 `node --check`；`git diff --check` 無 whitespace error，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已從本 worktree 重啟為 PID `74960`；HTTP 200，入口確認載入 tween `trace-252`、model `code-29`、presenter `code-32`，並在正式 3101 再次通過上述 2/2 專項案例。

### 舊有物件相容性

- 沒有新增或移除持久化欄位；本次只還原播放器的上色時序，既有 trace 無需遷移或重新儲存。

## 2026-09-28：以 visual-move 事件精確控制移動中的 style

- tween 會先依實際世界座標差、真正的 geometry transition 或 arc 路徑建立內部 `visual-move` 播放事件；layout／跨容器移動即使沒有 C++ runtime event 也能產生事件。事件不進入程式碼片段。
- style controller 不再自行推測幾何，只讀取 `visual-move` 事件的目標與結束時間。只有真正移動且顏色也改變的物件會維持來源色，事件結束後才執行 180ms 目的色過渡。
- 沒有位移的第 19→20 幀不產生 disk `visual-move`，Peg_A 盤子 2 與 Peg_B 盤子 1 同步開始變色；第 31→32 幀會產生 cross-container `visual-move`，盤子 1 移動期間不會提前出現目的幀綠色，落地後才變綠。
- tween build 與入口 cache version 更新為 `trace-253`。

### 驗證分級與選擇

- 層級：V2；分類：G（跨容器位移）、H（style paint）、J（播放計畫與重播）。
- `hanoi-recursion-sample.browser.test.js`、`entrypoints.test.js`、`style-replay.browser.test.js`：3/3 通過；實際瀏覽器驗證 visual-move event 的有無、19→20 同步上色、31→32 落地後上色，以及 style 前進／後退／重播。
- `outerframe-tween.test.js`、`animation-effect-layer.test.js`：8/8 通過。
- `trace-frame-tween.js` 與相關 browser test 通過 `node --check`。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已從本 worktree 重啟為 PID `47420`；HTTP 200，入口確認載入 tween `trace-253`，並在正式 3101 再次通過 Hanoi browser 與入口 2/2 專項案例。

### 舊有物件相容性

- `visual-move` 是每次播放時由既有前後幀幾何動態建立的內部事件，沒有新增持久化欄位；舊 trace 無需遷移、重存或重新編譯。

## 2026-09-28：河內塔教學範例投影片

- 新增 8 頁原生 `.asmdeck` 教學範例，依序說明 Édouard Lucas 於 1883 年推出的河內塔、64 個黃金盤子的遊戲傳說、三項移動規則、遞迴觀念、移花／搬動底盤／接木、程式碼與複雜度，以及動畫閱讀方式。
- 最後一頁直接引用 `algorithm_sample/Backtracking/hanoi-recursion.cpp`，輸入固定為 `4`，可逐幀播放左側盤面、右側遞迴樹與搬運紀錄。
- 新增 `scripts/build-hanoi-teaching-deck.py`，可由同一份範例程式重新產生 `public/guest-decks/hanoi-teaching.asmdeck`；並在訪客範例清單登記為 `Backtracking` 類別。
- 中文文字方塊啟用逐字換行，避免沒有空白的中文長句超出規則卡片。

### 驗證分級與選擇

- 層級：V2；分類：投影片範例載入與動畫重建。
- `hanoi-teaching-deck.browser.test.js`：1/1 通過；確認 8 頁、由來／規則／三步驟文字、動畫原始碼完全一致、輸入 `4`，且獨立伺服器中 `/trace/analyze` 與 `/compile` 重建完成為 1/1，無瀏覽器錯誤。
- 以獨立 headless 瀏覽器逐頁視覺檢查封面、由來、規則、三步驟、程式碼、動畫導讀與實際動畫；修正中文換行後未見裁切或重疊。
- alpha 3101 已由本 worktree 重啟為 PID `52724`；HTTP 200，正式 3101 載入 8 頁並完成動畫重建 1/1，無瀏覽器錯誤。
- 未執行完整 regression 或無關演算法動畫。

### 舊有物件相容性

- 本次只新增範例檔、產生器與訪客範例索引，沒有修改既有投影片儲存格式或動畫欄位；舊投影片與既有自訂值不需要遷移。

## 2026-09-28：Fibonacci 遞迴與動態規劃教學投影片

- 新增 10 頁原生 `.asmdeck` 教學範例，依序說明費式數列定義、由左到右手算 `F(5)`、遞迴樹與重複子問題、遞迴程式碼、陣列 DP 填表、DP 程式碼，以及兩種方法的時間／空間複雜度。
- 複雜度頁明確區分：單純遞迴時間 `O(φⁿ)`（常見上界 `O(2ⁿ)`）、空間 `O(n)`；陣列 DP 時間與空間皆為 `O(n)`，並補充只保留前兩項可降為 `O(1)` 空間。
- 最後一頁直接引用 `algorithm_sample/Backtracking/fibonacci.cpp`，輸入固定為 `5`，可逐幀觀察 DFS 呼叫、基本情況回傳，以及節點由 `F(n)` 更新為結果值。
- 新增 `scripts/build-fibonacci-teaching-deck.py`，可由同一份 Fibonacci 範例重新產生 `public/guest-decks/fibonacci-teaching.asmdeck`；並在訪客範例清單登記為 `DP` 類別。

### 驗證分級與選擇

- 層級：V2；分類：投影片範例載入與動畫重建。
- `fibonacci-teaching-deck.browser.test.js`：1/1 通過；確認 10 頁、數列公式、DP 與複雜度內容、動畫原始碼完全一致、輸入 `5`，且獨立伺服器完成動畫重建 1/1，無瀏覽器錯誤。
- 以獨立 headless 瀏覽器逐頁視覺檢查 10 頁；公式、遞迴樹、兩個程式碼元件、DP 陣列與複雜度表格未見裁切或重疊。另將 DP 格子索引改為 `dp[i]`，並移除會被中文逐字換行拆開的英文片語。
- `git diff --check` 通過，只有既有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已由本 worktree 重啟為 PID `62212`；HTTP 200，正式 3101 載入 10 頁並完成動畫重建 1/1，無瀏覽器錯誤。

### 舊有物件相容性

- 本次只新增範例檔、產生器、專項測試與訪客範例索引，沒有修改既有投影片儲存格式或動畫欄位；舊投影片與既有自訂值不需要遷移。

## 2026-09-28：同步最新 intergration

- 先以 `da9cb72` 保存 Fibonacci 教學投影片，再取得並合併 `origin/intergration` 的最新提交 `b89c10a`（`fix: use modal for deck deletion`）；合併提交為 `4ec7f1e`，沒有內容衝突。
- 統合分支將追蹤引擎更新為 `10/1`，並替 Fibonacci 範例加入檔案說明；已把投影片產生器的 engine version 更新為 `10/1`，保留來源檔原始 CRLF，重新產生 deck，確保內嵌程式碼與目前範例逐位元一致。
- 修正統合分支既有 `entrypoints.test.js` 仍尋找舊 `home.js?v=header-examples-9` 的問題，使斷言對齊實際入口 `home.js?v=delete-dialog-10`。

### 驗證分級與選擇

- 層級：V2；分類：D（動畫設定還原）、I（遞迴程式碼呈現）、入口依賴順序。
- `fibonacci-teaching-deck.browser.test.js`：1/1 通過；10 頁與動畫重建 1/1，內嵌來源、輸入與教學內容均正確。
- 在獨立 3196 測試服務執行 `fibonacci-recursion-sample.test.js`、`fibonacci-recursion-display.browser.test.js`、`entrypoints.test.js`：3/3 通過，無 skip。
- `git diff --check` 通過，只有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已由合併後 worktree 重啟為 PID `39312`；正式預覽載入 10 頁、動畫重建 1/1，無瀏覽器錯誤。

### 舊有物件相容性

- 同步未新增持久化欄位；Fibonacci deck 依目前 `10/1` 引擎重新封裝，既有 deck 仍由 asmdeck 的同格式相容規則載入，不需資料遷移。

## 2026-09-28：重排 Fibonacci 教學流程並新增 DP 動畫

- 依使用者指定將教學順序改為：定義與手算 → 遞迴程式碼 → 遞迴動畫 → 重複計算原因 → DP 陣列概念 → 精簡 DP 程式碼 → DP 動畫 → 複雜度比較。
- 重畫完整 `F(5)` 遞迴樹；三個 `F(2)` 都繼續展開成各自的 `F(1)` 與 `F(0)`，用顏色標示重複子問題。
- DP 程式碼頁改為使用者指定的三行短版：`vector<int> dp(n+1);`、`dp[1]=1;`、單行 `for` 更新。
- 新增 `algorithm_sample/DP/fibonacci-dp.cpp` 與第二段原生動畫；輸入 `5`，逐幀呈現 dp 陣列初始化、基本答案、每格由前兩格相加與完成結果。
- deck 維持 10 頁，其中第 5 頁是遞迴動畫、第 9 頁是 DP 動畫、第 10 頁才比較複雜度；範例 cache key 更新為 `fibonacci-deck-2`。

### 驗證分級與選擇

- 層級：V2；分類：E（frame/style）、D（動畫設定還原）、投影片範例載入。
- `fibonacci-teaching-deck.browser.test.js`：1/1 通過；確認 10 頁、三個完整展開的 `F(2)`／`F(0)`、精簡 DP 程式碼、兩段動畫原始碼與輸入，且獨立服務完成動畫重建 2/2，無瀏覽器錯誤。
- 以獨立 headless 瀏覽器檢查第 4–10 頁：完整遞迴樹無裁切、精簡程式碼可讀，DP 動畫正確建立 `dp[0...5]` 並顯示 7 幀，複雜度表格無重疊。
- alpha 3101 已重啟為 PID `16140`；正式預覽載入 10 頁、兩段動畫重建 2/2，無瀏覽器錯誤。
- 未執行完整 regression 或無關演算法動畫。

### 舊有物件相容性

- 本次重建既有範例 deck 並新增獨立 DP 範例原始碼，沒有修改投影片或動畫持久化格式；其他既有 deck 不需遷移。

## 2026-09-28：Fibonacci 遞迴改為依實際執行顯示分支

- 新增 recursion layout 設定 `branch-previews on|off`；預設維持 `on` 以相容既有河內塔與已儲存範例，Fibonacci 明確設為 `off`。
- `branch-previews off` 不再建立執行前的系統預覽幀；左子樹開始時右子節點尚未出現，只有真正執行 `F(n - 2)` 時才建立。
- Fibonacci 範例移除預設的 `direction top-down`、`mode compact`、`sibling-gap`、`level-gap`、`degree 2`，移除 `flow-arrows on`；進入節點文字改為「目前呼叫 F(n)」。
- 重建 10 頁 Fibonacci 教學 deck，內嵌遞迴動畫同步套用新行為，cache key 更新為 `fibonacci-deck-3`。

### 驗證分級與選擇

- 層級：V2；分類：E（layout/frame）、G（recursion keep 生命週期）、J（實際瀏覽器播放）。
- 獨立 3197 服務執行 `layout-directives.test.js`、`directive-assist.test.js`、`fibonacci-recursion-sample.test.js`、`fibonacci-recursion-display.browser.test.js`、`fibonacci-teaching-deck.browser.test.js`：22/22 通過，0 skip。
- 契約斷言確認系統預覽幀為 0，且根節點的左孩子建立幀不含右孩子；投影片兩段動畫重建 2/2。
- `node --check` 與 `git diff --check` 通過，只有 Windows LF/CRLF 提示。未執行完整 regression 或無關演算法動畫。
- alpha 3101 已確認停止舊 PID `16140`，從本 worktree 重啟為 PID `43556`；HTTP 200，正式 3101 再驗證 Fibonacci 範例與 deck 2/2 通過。

### 舊有物件相容性

- 新建 layout 未指定時預設為 `showBranchPreviews: true`。
- 舊 trace/layout 缺少欄位時，server 只在值明確為 `false` 時關閉預覽，因此舊物件行為不變；明確關閉的 Fibonacci 重新分析後仍保留 `false`。
