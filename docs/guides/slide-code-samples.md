# 投影片程式碼範例集

在 algorithm.html 的「演算法範例集 → 投影片範例」載入。點程式名稱載入原始碼；點其下方測資會同時載入程式與輸入，不自動執行。載入後可修改，重新整理會沿用工作區本機草稿。

目前整理15份公開範例投影片中的36個動畫，共29份不同程式碼、36組測資。同一份程式碼只存一次，保留每頁對應輸入。保留繪圖指令與程式內的 @asm-view 設定；不複製完整 Trace。既有其他範例保留。

檔案位於 algo-vis-backend/algorithm_sample/Slide_Examples/。所有檔名使用英文，選單以中文名稱顯示。.manifest.json 記錄原投影片、頁碼、來源程式雜湊與測資對應，不在選單中顯示。

| 名稱 | 程式檔（相對於 Slide_Examples） | 測資數 |
|---|---|---:|
| 快速排序 | Sorting/quick-sort.cpp | 2 |
| 合併排序－遞迴版 | Sorting/merge-sort-recursive.cpp | 2 |
| 合併排序－倍增版 | Sorting/merge-sort-iterative.cpp | 2 |
| 冒泡排序 | Sorting/bubble-sort.cpp | 2 |
| 選擇排序 | Sorting/selection-sort.cpp | 2 |
| 插入排序 | Sorting/insertion-sort.cpp | 2 |
| 堆積排序 | Sorting/heap-sort.cpp | 2 |
| 線性篩－逐步版 | Math/linear-sieve-detailed.cpp | 1 |
| 線性篩－濃縮版 | Math/linear-sieve-condensed.cpp | 1 |
| 堆積－插入與刪除 | Data_Structure/max-heap-push-pop.cpp | 1 |
| 堆積－逐筆建堆 | Data_Structure/max-heap-incremental-build.cpp | 1 |
| 堆積－由下而上建堆 | Data_Structure/max-heap-bottom-up-build.cpp | 1 |
| BIT－一般建樹 | Data_Structure/bit-build.cpp | 1 |
| BIT－線性建樹 | Data_Structure/bit-linear-build.cpp | 1 |
| BIT－區間查詢 | Data_Structure/bit-range-query.cpp | 1 |
| 線段樹－遞迴建樹 | Data_Structure/segment-tree-recursive-build.cpp | 1 |
| 線段樹－遞迴區間操作 | Data_Structure/segment-tree-recursive-lazy.cpp | 1 |
| 線段樹－迭代建樹 | Data_Structure/segment-tree-iterative-build.cpp | 1 |
| 線段樹－迭代區間操作 | Data_Structure/segment-tree-iterative-lazy.cpp | 1 |
| 河內塔 | Backtracking/hanoi.cpp | 1 |
| 八皇后－一般迴圈 | Backtracking/eight-queens-loop.cpp | 1 |
| 八皇后－陣列遞迴 | Backtracking/eight-queens-array-recursion.cpp | 1 |
| 八皇后－位元運算 | Backtracking/eight-queens-bitmask.cpp | 1 |
| 費式數列－遞迴 | Backtracking/fibonacci-recursive.cpp | 1 |
| 費式數列－陣列 | Backtracking/fibonacci-array.cpp | 1 |
| 一維前綴和 | Math/prefix-sum-1d.cpp | 1 |
| 二維前綴和 | Math/prefix-sum-2d.cpp | 1 |
| LCS－建表 | DP/lcs-table.cpp | 1 |
| LCS－回溯 | DP/lcs-backtracking.cpp | 1 |

## 更新來源

後續投影片程式改版後，在 algo-vis-backend 執行：

    node scripts/build/export-slide-code-samples.js

此指令依 public/guest-decks.json 目前發布的投影片重新整理程式與輸入，保留英文檔名及中文顯示名稱；不編譯演算法、不下載 Trace、不更改投影片。新增演算法或程式版本時，先在腳本補上明確名稱。
