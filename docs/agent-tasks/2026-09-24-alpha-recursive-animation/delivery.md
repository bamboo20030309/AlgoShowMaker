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

## 目前可供使用者檢視的行為

- 呼叫樹依實際執行順序逐步長出，父子線與左右兄弟順序正確。
- 節點統一顯示 `F`，格內先顯示 `F(n)`，得知答案後才切換為回傳數值。
- 同一 `F_3` 節點會由 `F(2)` 原地更新為 `1`；退回更新前的幀會恢復為 `F(2)`。
- 新 child 會像從目前父節點長出；按上一步時則縮回同一父節點，樹邊與節點位置同步更新。
- 陣列等其他物件可直接寫 `@frame arr with display("${index}: ${value}")`，每格使用自己的 index／value。
- 最終畫面只有 15 個遞迴節點，不存在額外 `left`、`right`、`result` 或 `value` 物件。
- 最終 Fibonacci `F(5)` 的箭頭 target 順序固定為 `F_1`～`F_14`，符合 DFS 前序的首次建立順序。
- 新 child 從上一幀 current node 的中心開始位移；正向播放時箭頭終點持續貼住 child，反向播放則縮回同一 current node。

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
- 通用 display 瀏覽器：normal sequence、heap、matrix 與 assignment replay 通過；確認 `${value/index/row/column}` 與 frame 變數運算，且 trace 原值未被修改。
- 自動播放與 Trace Studio：本輪未執行完整 UI 操作；待使用者以 3101 預覽複核。專項瀏覽器已驗證 transition Promise 在 1×／2× 完成後清除暫態 transform／ghost。
- 畫面：最終根值 `5`，內部節點顯示回傳值，沒有 `left/right/result/value` 額外區塊。
- 瀏覽器 console：0 error、0 warning。
- 靜態檢查：修改的 JS 通過 `node --check`，入口快取 build 一致性測試與 `git diff --check` 通過；僅有既有 Windows LF/CRLF 提示。
- 未執行：完整 regression、全部 tests、廣泛排序或其他演算法動畫；本次依規範只做直接相關 V2 驗證。
- 需要主代理做的 V3 驗證：整合時建議以 Fibonacci `F(5)` 的 UI 下一步／上一步／自動播放與 Trace Studio 縮圖，核對 child 長出／縮回、樹邊端點及 `F(2) → 1` 原地替換；不需擴大到無關演算法。

## 舊有物件相容性

- 沒有新增或修改持久化投影片／Fabric／widget 欄位；另以缺少 recursion activation metadata、只保留 `layoutNode.parentSnapshotId` 的舊 trace fixture 實際 render，確認父子箭頭仍存在。
