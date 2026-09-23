# Alpha：新版 Fibonacci 遞迴動畫範例交付

## 實作內容

- 移除舊版 `AV.hpp`、`TreeLayout`、`draw{}` 與手寫 `tree.push/pop/paint`。
- 使用 `@layout recursion as "fib_tree"` 與 runtime recursion activation 自動建立二叉呼叫樹。
- 每次 `fibonacci(n)` 以 `F(n)` 字串建立 live node，再以 `@keep last ... in fib_tree` 保存。
- 基底條件顯示回傳值；非基底呼叫顯示左右結果相加；最終顯示 `F(n)` 答案。
- 回傳計算區固定於畫布左上側，避免與置中的遞迴樹根或最深葉節點重疊。
- 新增 Fibonacci 專項 trace 測試，確認輸入 `5` 產生 15 個呼叫節點、唯一根節點、左右子節點順序與最終答案 `5`。

## 目前可供使用者檢視的行為

- 呼叫樹依實際執行順序逐步長出，父子線與左右兄弟順序正確。
- 保留節點目前顯示變數標籤 `call`；這是現行 scalar renderer 的預設呈現。
- 保留節點保存的是進入呼叫時的 `F(n)`，不會在 return 時原地改寫成答案；return 計算另顯示於畫布左上側。
- recursion layout 目前不能直接作為其他物件的整棵樹外框錨點，因此回傳區先使用固定 canvas anchor。

## 驗證分級與選擇

- 層級：V2。
- 分類：E（layout／frame）、F（runtime 遞迴資料）、G（生命週期／遞迴 activation）、J（播放與 Studio）。
- 選擇依據：修改的是遞迴動畫範例及其 trace/layout 行為，未修改共用引擎。
- 執行的測試檔：`tests/fibonacci-recursion-sample.test.js`。
- 驗證環境：alpha worktree 的隔離 3191 服務、隔離的 Codex in-app browser 分頁，輸入 `5`。
- 自動測試結果：1/1 通過，0 fail，0 skipped；所有事件 order 由共用 compile helper 驗證為有限數字且依序排列。
- 手動播放：連續三次「下一步」由第 1 幀前進至第 4 幀；自動播放等待當前事件後由第 4 幀前進至第 6 幀；跳到最後到達 32/32。
- Trace Studio：代表幀、切片縮圖、事件清單與最終幀同步；完整呼叫樹含 15 個節點。
- 畫面：檢查成長中的第 6 幀與 32/32 最終幀；父子線、節點、回傳區可見，最終樹未與回傳區重疊。
- 瀏覽器 console：0 error、0 warning。
- 靜態檢查：`node --check tests/fibonacci-recursion-sample.test.js`、`git diff --check` 通過；僅有既有 Windows LF/CRLF 提示。
- 未執行：完整 regression、全部 tests、廣泛排序或其他演算法動畫；本次依規範只做直接相關 V2 驗證。
- 需要主代理做的 V3 驗證：無；若後續依使用者意見修改共用 recursion renderer／return 動畫，再按影響範圍決定。

## 舊有物件相容性

- 不適用：本次只更新可重新編譯的 C++ 範例，沒有新增或修改持久化投影片／Fabric／widget 欄位。
