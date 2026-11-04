# 全範例事件動畫對齊舊版

工作開始於 2026-11-04，跨日至 2026-11-05 完成。

## 範圍與基準

使用者確認核對所有事件動畫，不只比較。基準為事件系統改版前的 `504d51c`；保留已確認的新規則，不把 Trace 與播放排程整套退回舊版。

盤點 `algorithm_sample` 的 38 份 C++：19 份使用新版 Trace、19 份使用舊式 AV.hpp。依相同檔名配對 sample／worst 輸入，共 45 組；沒有輸入檔的八皇后用 N=4、DP 費式數列用 N=10。另核對 15 份公開教材的 36 份動畫，使用 `03f5ae4` 已重新執行的公開 Trace，不再重編譯相同教材。

## 逐類對照結果

| 類別 | 舊版行為與本次處理 |
| --- | --- |
| 宣告／入場 | 一般純量、指標恢復 220 ms、從上方 16px 到定位點。文字、陣列容器及 keep 不套用這個位移 |
| 退場 | 指標恢復向上 16px 退場；原有文字、陣列、快照的定位規則保留 |
| 一般賦值 | 準備 160、飛入 500、停留 500、收尾 100，共 1260 ms；抵達時提交。常數從目標上方落入 |
| 指標賦值／更新 | 保留來源停留及最後移位；恢復使用傳入的位移時間，而非另寫固定 520 ms；預設不變 |
| 交換 | 恢復傳入的交換時間，動作計畫與實際事件時間一致。不同格同值照常交換；同格維持已確認的 400 ms 強調 |
| 比較 | 沿用前輪已恢復的原版動作：共同上抬與縮放、相等對齊靠近、原運算符與斜線結果；1560 ms。沒有再次改寫比較路徑 |
| min／max、條件選值 | 保留已確認的選值比較，再將選中來源賦值；舊 Trace 缺比較運算元時不虛構值 |
| 陣列插入／push | 保留新規則：擴框與騰位同步 300 ms，之後才入場 220 ms。修正可見 keep 來源被誤判為隱藏來源：匹配本次插入值，不能拿整個 after 容器匹配 |
| 陣列刪除／pop | 保留新規則：先退場 220 ms，再縮框與補位 300 ms |
| resize／clear／assign／move | 保留已確認的容器事件分類與實際執行狀態，不憑 STL 名稱假設 move 後來源必空 |
| 輸出／流程跳轉／函式 | 保留一般程式提示 400 ms、return 260 ms；呼叫身分與生命週期獨立，不提早退出最後畫面 |
| 讀取強調 | 保留附著於所屬操作、預設關閉、開啟預設純紅色，不增加停頓；不恢復舊的逐次讀取步驟 |
| 播放控制 | 保留目前間隔、暫停續播、下一事件變速與明確關閉設定，不倒退回舊排程 |

宣告與初始化分開、同值賦值完整播放、整格複製與數字運算分流、常數落入、讀取設定與陣列分段都是保留項，不能因「對齊舊版」而撤回。

## 額外發現的範例問題

- `AV.hpp` 使用 `std::sort` 卻未自行引用 `<algorithm>`；extend_euclid 與 AVL 範例因此編譯失敗。補上標頭，兩份程式的三組輸入重驗通過。
- Tree_traversal 的結構化綁定不受目前 GCC 6 支援；改以 `std::get` 讀取相同 tuple，不改遍歷順序。重驗通過。
- out_of_bounds 是刻意展示越界的教材，不改成合法程式，也不把未定義行為當成正確答案。45 組中 44 組一般編譯通過，另 1 組列為刻意不安全範例。

## 驗證方法與界線

- 67 個手寫事件／指標／排版／控制標準答案均通過資料與 SVG 檢查。之後的來源匹配修正再以實際遞迴合併排序與陣列分段測試核對。
- `merge-push-lifecycle.browser.test.js` 原本在第 10 幀失敗，修正後兩項通過；`retained-compare.browser.test.js` 通過，沒有放寬其來源格子斷言。
- `sequence-outerframe-phases.browser.test.js` 的 runtime／舊狀態資料、1 倍／2 倍共 20 組情境通過，保留外框分段與完整格子數字入場。
- `event-motion-policy.test.js` 五項通過，包含 120／520／900 ms 的交換與指標計畫。生命週期局部測試核對 -16／-8／0 px，且文字、陣列與 keep 不偏移。
- 範例瀏覽器檢查逐份選取各事件種類／操作／語意的首次出現，檢查實際 SVG、暫存清理與播放後和穩定呈現的格子終態。19 份新版程式加 36 份教材動畫，共 55 份 Trace、326 個事件代表幀通過，無 NaN／Infinity、暫存特效殘留或瀏覽器錯誤。這是逐類抽查，不是每一幀與舊版影片的像素比對；19 份 AV.hpp 舊式範例另外走原路徑編譯核對，沒有宣稱它們使用新版事件播放器。
- 測試使用獨立服務與瀏覽器；不操作私人投影片、不操作使用者分頁。程式碼提示與 CSS paint 有各自完成條件，測試須等它們完成，不能用未完成的 DOM 當答案。最初的終態對照將動畫完整字形與穩定畫面 LOD 省略字形混相比較；保留原始記錄，對仍有差異的項目在測試瀏覽器內停用 LOD、兩側使用完整字形後重核，不改產品 LOD 規則，也不放寬數值斷言。
- 語法與差異檢查通過；測試產物留在被忽略的 `algo-vis-backend/test-results/event-example-audit/`，不提交。

## 交付限制

只提交／推送 `intergration`，完成後核對來源並重啟 3100。main／3000 維持已驗收版本，不發布 release。

3100 已重啟為 PID 56848；首頁與 algorithm.html、slides.html、slides.js、trace-frame-tween.js 均 HTTP 200，四份檔案 HTTP 內容雜湊與 worktree 一致，`/trace/analyze` 通過。更新播放器快取至 trace-313、投影片 slides-303、內嵌 runtime-59。無需重跑 Trace：本次沒有改動新版 C++ 事件追蹤資料格式或教材程式，只修播放端及舊式 AV.hpp 編譯相容。

## 程式與輸入清單

| 程式（algorithm_sample/ 下） | 路徑 | 輸入組數 | 編譯核對 |
| --- | --- | ---: | --- |
| `Backtracking/8queen-array-teaching.cpp` | Trace | 1 | 通過 |
| `Backtracking/8queen-loop-teaching.cpp` | Trace | 1 | 通過 |
| `Backtracking/8queen.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Backtracking/8queen_recursion.cpp` | Trace | 1 | 通過 |
| `Backtracking/8queen_tree.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Backtracking/fibonacci.cpp` | Trace | 1 | 通過 |
| `Backtracking/hanoi-recursion.cpp` | Trace | 1 | 通過 |
| `Backtracking/hanoi.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Basic/out_of_bounds.cpp` | 舊式 AV.hpp | 1 | 刻意越界，另列 |
| `Basic/prefix_sum.cpp` | Trace | 1 | 通過 |
| `Basic/prefix_sum_2D.cpp` | Trace | 1 | 通過 |
| `Data_Structure/UVA_514_Rails.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `DP/fibonacci-dp.cpp` | Trace | 1 | 通過 |
| `DP/LCS.cpp` | Trace | 1 | 通過 |
| `Graph/color_diffusion_problem.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Math/euler-sieve.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Math/extend_euclid.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Math/Sieve_of_Eratosthenes.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Sorting/bubble_sort.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Sorting/heap_sort.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Sorting/insertion_sort.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Sorting/merge_sort.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Sorting/merge_sort_bottom_up.cpp` | Trace | 1 | 通過 |
| `Sorting/merge_sort_recursive_layout.cpp` | Trace | 1 | 通過 |
| `Sorting/quick_sort.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Sorting/quick_sort_recursive_layout.cpp` | Trace | 1 | 通過 |
| `Sorting/selection_sort.cpp` | 舊式 AV.hpp | 2 | 通過 |
| `Tree/AVL_tree.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Tree/Binary_Indexed_Tree_Build.cpp` | Trace | 1 | 通過 |
| `Tree/Binary_Indexed_Tree_Range_Query.cpp` | Trace | 1 | 通過 |
| `Tree/BST_tree.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Tree/heap.cpp` | Trace | 1 | 通過 |
| `Tree/Pre_In_to_Post.cpp` | 舊式 AV.hpp | 1 | 通過 |
| `Tree/Segment_Tree.cpp` | Trace | 1 | 通過 |
| `Tree/Segment_Tree_easy.cpp` | Trace | 1 | 通過 |
| `Tree/Segment_Tree_easy_build.cpp` | Trace | 1 | 通過 |
| `Tree/Segment_Tree_standard.cpp` | Trace | 1 | 通過 |
| `Tree/Tree_traversal.cpp` | 舊式 AV.hpp | 1 | 通過 |
