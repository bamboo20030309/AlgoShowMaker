# 演算法範例集：投影片程式來源

投影片中的 36 個動畫整理為 29 份程式、36 份輸入，直接放入既有英文分類資料夾，不再使用 `Slide_Examples`。程式與繪圖指令內容保留。

選單直接顯示英文檔名；`.slide-samples.json` 只記錄來源投影片、頁碼、程式與輸入雜湊，不出現在選單。有新版指令的同用途程式直接取代舊版，不另留 `_slides` 副本。尚無新版的舊 AV.hpp 程式及其輸入保留，檔名加上 `old_` 前綴。已使用新版指令的其他獨立變體維持原檔。

## 配對規則

程式檔名使用英文字母、數字與底線，名稱內不使用 `-`。輸入檔第一個 `-` 前的文字，必須與程式檔名去除副檔名後完全相同，大小寫也必須一致。只比同一資料夾的檔案。

- `8queen.cpp` 對應 `8queen-sample_input.txt`、`8queen-input_02.txt`。
- `8queen_recursion-sample_input.txt` 只對應 `8queen_recursion.cpp`。
- `8queen_extra-sample_input.txt`、`8Queen-sample_input.txt` 與沒有 `-` 的 `8queen.txt` 都不會配給 `8queen.cpp`。

## 投影片來源程式

| 內容 | 程式檔（相對於 algorithm_sample） | 輸入數 |
| --- | --- | --- |
| 快速排序 | `Sorting/quick_sort.cpp` | 2 |
| 合併排序－遞迴版 | `Sorting/merge_sort.cpp` | 2 |
| 合併排序－倍增版 | `Sorting/merge_sort_iterative.cpp` | 2 |
| 冒泡排序 | `Sorting/bubble_sort.cpp` | 2 |
| 選擇排序 | `Sorting/selection_sort.cpp` | 2 |
| 插入排序 | `Sorting/insertion_sort.cpp` | 2 |
| 堆積排序 | `Sorting/heap_sort.cpp` | 2 |
| 線性篩－逐步版 | `Math/euler_sieve.cpp` | 1 |
| 線性篩－濃縮版 | `Math/linear_sieve_condensed.cpp` | 1 |
| 堆積－插入與刪除 | `Data_Structure/max_heap_push_pop.cpp` | 1 |
| 堆積－逐筆建堆 | `Data_Structure/max_heap_incremental_build.cpp` | 1 |
| 堆積－由下而上建堆 | `Data_Structure/max_heap_bottom_up_build.cpp` | 1 |
| BIT－一般建樹 | `Data_Structure/bit_build.cpp` | 1 |
| BIT－線性建樹 | `Data_Structure/bit_linear_build.cpp` | 1 |
| BIT－區間查詢 | `Data_Structure/bit_range_query.cpp` | 1 |
| 線段樹－遞迴建樹 | `Data_Structure/segment_tree_recursive_build.cpp` | 1 |
| 線段樹－遞迴區間操作 | `Data_Structure/segment_tree_recursive_lazy.cpp` | 1 |
| 線段樹－迭代建樹 | `Data_Structure/segment_tree_iterative_build.cpp` | 1 |
| 線段樹－迭代區間操作 | `Data_Structure/segment_tree_iterative_lazy.cpp` | 1 |
| 河內塔 | `Backtracking/hanoi.cpp` | 1 |
| 八皇后－一般迴圈 | `Backtracking/8queen_loop_teaching.cpp` | 1 |
| 八皇后－陣列遞迴 | `Backtracking/8queen_array_teaching.cpp` | 1 |
| 八皇后－位元運算 | `Backtracking/8queen.cpp` | 1 |
| 費式數列－遞迴 | `Backtracking/fibonacci_recursive.cpp` | 1 |
| 費式數列－陣列 | `Backtracking/fibonacci_array.cpp` | 1 |
| 一維前綴和 | `Math/prefix_sum_1d.cpp` | 1 |
| 二維前綴和 | `Math/prefix_sum_2d.cpp` | 1 |
| LCS－建表 | `DP/LCS.cpp` | 1 |
| LCS－回溯 | `DP/lcs_backtracking.cpp` | 1 |

## 更新來源

在 `algo-vis-backend` 執行：

```bash
node scripts/build/export-slide-code-samples.js
```

此指令依 `public/guest-decks.json` 的來源重新匯出程式與輸入，維持英文檔名及精確前綴；不編譯、不執行動畫、不更改投影片。


## 尚未移植的舊程式

- `Basic/old_out_of_bounds.cpp`
- `Data_Structure/old_UVA_514_Rails.cpp`
- `Graph/old_color_diffusion_problem.cpp`
- `Math/old_extend_euclid.cpp`
- `Math/old_Sieve_of_Eratosthenes.cpp`
- `Tree/old_AVL_tree.cpp`
- `Tree/old_BST_tree.cpp`
- `Tree/old_Pre_In_to_Post.cpp`
- `Tree/old_Tree_traversal.cpp`
