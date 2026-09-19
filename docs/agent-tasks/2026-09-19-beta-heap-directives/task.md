# 2026-09-19-beta-heap-directives：Heap 範例改用目前指令

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：f66bf9f0066bd66ff1c6ad9eb011cbb805ec6984
- 分支：codex/2026-09-18-beta
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-beta

## 問題與預期結果
- 情境與操作：從演算法範例載入 Tree/heap.cpp，執行最大堆積的插入、查詢與刪除動畫。
- 目前行為：範例依賴 AV.hpp、frame_draw 與 draw 區塊，未使用目前的註解指令。
- 使用者希望的結果：先參考 heap_sort，把 heap 改寫為目前的 `@frame`、`@style`、`@text`、`@keep` 指令；之後再設計線段樹所需能力。
- 本次範圍與必要限制：只修改 heap 範例；不修改 segment_tree_easy、segment_tree、解析器或 renderer。

## 需求確認
- 已從使用者或上下文確認：heap 與線段樹都可採 heap 畫法；heap 先完成；線段樹兩項缺口先提出設計，不在本次實作。
- 尚待使用者回答：無。
- 代理採用的合理假設：heap 維持最大堆積、輸出由大到小；改寫時使用標準向上／向下調整，涵蓋只有左子節點的情況。

## 重現與調查
- 最小操作步驟或 fixture：以既有 heap-sample_input.txt 載入 heap.cpp 並執行 analyze/compile。
- 重現狀態：已確認舊檔完整使用 AV.hpp 舊繪圖 API。
- 已確認事實：目前指令支援 heap render、range、style、text、keep 與相對定位；heap_sort 可作為語法參考。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：algo-vis-backend/algorithm_sample/Tree/heap.cpp；本任務 task.md、delivery.md。
- 共用檔案／介面與協調結果：不改共用介面。
- 依賴任務：目前指令解析與 heap renderer。

## 驗收條件
- [x] heap.cpp 不再依賴 AV.hpp 或舊 frame_draw API。
- [x] 既有輸入能成功產生 heap 動畫，插入後維持最大堆積，刪除輸出由大到小。
- [x] 單一左子節點也能正確向下調整。
- [x] segment_tree_easy 與 segment_tree 未被修改。

## 驗證計畫
- 子代理小驗證：語法／差異檢查；隔離服務執行 heap.cpp 的 analyze/compile；檢查輸出、幀與最大堆積狀態；做少量關鍵幀畫面確認。
- 主代理整合驗收：核實 sample diff，執行相關 heap 動畫驗證；不需要廣泛排序整合。
- 測試隔離方式：beta worktree、隨機測試埠與獨立瀏覽器；不使用使用者分頁或資料。

## 變更紀錄
- 2026-09-19：建立初始定義；依使用者要求先完成 heap，線段樹指令只提出方案。
