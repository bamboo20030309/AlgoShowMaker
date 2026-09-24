# Alpha：新版 Fibonacci 遞迴動畫範例交付

## 實作內容

- 移除舊版 `AV.hpp`、`TreeLayout`、`draw{}` 與手寫 `tree.push/pop/paint`。
- 使用 `@layout recursion as "fib_tree"` 與 runtime recursion activation 自動建立二叉呼叫樹。
- 以 `int value = n` 搭配 `@let call = n`，不再建立 C++ `string call`。
- 畫面只保留 recursion node；`left`、`right`、`result` 與同幀暫時的 `value` 不再形成額外畫面物件。
- 同一 layout／activation 再次 `@keep` 時沿用原 object ID 並替換 active snapshot；父子邊會解析到目前有效版本。
- 遞迴節點的顯示標籤固定為 `F`，內格直接顯示目前值；回傳幀會在原位置把 `F(2)` 的 `2` 更新為 `1`。
- 新增 Fibonacci 專項 trace 測試，確認輸入 `5` 產生 15 個有效呼叫節點、22 幀、唯一根節點、左右順序、3 個 `F(2)` 同幀更新及最終答案 `5`。

## 目前可供使用者檢視的行為

- 呼叫樹依實際執行順序逐步長出，父子線與左右兄弟順序正確。
- 節點統一顯示 `F`，格內數字由呼叫參數逐步更新成回傳結果。
- 第 6 幀的同一 `F_3` 節點為 `2`，前進到第 7 幀後位置不變且值為 `1`；退回上一幀會恢復為 `2`。
- 最終畫面只有 15 個遞迴節點，不存在額外 `left`、`right`、`result` 或 `value` 物件。

## 驗證分級與選擇

- 層級：V2。
- 分類：E（layout／frame）、F（runtime 遞迴資料）、G（生命週期／遞迴 activation）、J（播放與 Studio）。
- 選擇依據：修改遞迴範例、keep snapshot materialization 與 recursion renderer 的同 activation 替換行為。
- 執行的測試檔／案例：`tests/fibonacci-recursion-sample.test.js`；`layout-directives.test.js` 的 2 個 recursion keep 案例；`keep-directives.test.js` 的穩定 canvas ID 案例。
- 驗證環境：alpha worktree 的隔離 3191 服務、隔離的 Codex in-app browser 分頁，輸入 `5`。
- 自動測試結果：三次命令分別為 1/1、2/2、1/1 通過，全部 0 fail、0 skipped。
- 手動進退：第 6 幀 `F_3` 為 `2`，下一步到第 7 幀同座標更新為 `1`；上一步可還原，節點 transform 均為 `translate(522, 584)`。
- 自動播放：由第 1 幀播放至 22/22；最終 15 個物件標籤全為 `F`，額外 live `value` 物件數為 0。
- Trace Studio：22 幀縮圖、事件清單與主畫面同步；最終完整呼叫樹為 15 個節點。
- 畫面：最終根值 `5`，內部節點顯示回傳值，沒有 `left/right/result/value` 額外區塊。
- 瀏覽器 console：0 error、0 warning。
- 靜態檢查：`node --check server.js`、`node --check public/trace-renderer.js`、`node --check tests/fibonacci-recursion-sample.test.js`、`git diff --check` 通過；僅有既有 Windows LF/CRLF 提示。
- 未執行：完整 regression、全部 tests、廣泛排序或其他演算法動畫；本次依規範只做直接相關 V2 驗證。
- 需要主代理做的 V3 驗證：整合時建議以 Fibonacci `F(5)` 核對第 6→7 幀的 2→1 原地替換；不需擴大到無關演算法。

## 舊有物件相容性

- 不適用：本次變更 trace 產生與即時 rendering，沒有新增或修改持久化投影片／Fabric／widget 欄位。
