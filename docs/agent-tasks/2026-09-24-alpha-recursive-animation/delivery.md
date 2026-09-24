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
