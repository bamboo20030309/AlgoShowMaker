# 2026-09-19-beta-heap-animation-timing：Heap 跨幀動畫時機修正

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：fa278c87b3d7fedef11b0b2af4f3fc8b3a0994e4
- 分支：codex/2026-09-18-beta
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-beta

## 問題與預期結果
- 情境與操作：執行 `algorithm_sample/Tree/heap.cpp`，觀察第二次插入所形成的第 4 幀到第 5 幀動畫。
- 目前行為：目標 heap 在 `push_back` 前已採用新層級寬度；含 index 的節點 highlight 連 index 一起框住；前一輪 `now = parent` 會錯綁下一輪 `now`，使賦值框與新 `now` 的移動起點錯誤。
- 使用者希望的結果：節點寬度於新格子加入時才開始改變；highlight 只框資料值；賦值與新指標依各自生命週期從正確位置呈現。
- 本次範圍與必要限制：修正 heap 繪圖與共用 trace tween；不改 heap 範例內容；只做 V2 專項小驗證，不跑完整 regression。

## 需求確認
- 已從使用者或上下文確認：三個畫面問題及指定的第 4→5 幀；完成後 commit 並 push。
- 尚待使用者回答：無。
- 代理採用的合理假設：`push_back` 的 sequence slot 是 heap 擴張開始點；index 是標籤而非 highlight 的一部分。

## 重現與調查
- 最小操作步驟或 fixture：以既有 heap sample input 編譯範例，跳至第 4 幀後播放到第 5 幀並記錄 SVG 幾何與事件時間。
- 重現狀態：已重現。
- 已確認事實：序列事件順序正確，但只有 outerframe 延後 resize；heap 節點仍使用目標幀寬度。舊 `now` 的 assign 缺少 lifetime，依 variable id 誤選了同幀稍後宣告的新 lifetime。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/trace-frame-tween.js`、`public/draw/draw_array_heap.js`、直接相關測試。
- 共用檔案／介面與協調結果：不改 trace 格式；以既有 declare/scope-exit lifetime metadata 判斷事件當下有效指標。
- 依賴任務：無。

## 驗收條件
- [x] 跨層 `push_back` sequence slot 前，既有 heap 節點維持前一幀寬度；新節點在該 slot 才出現並帶動 resize。
- [x] `labels(value,index)` 下的 heap highlight 高度只包含 40px 值格，不包含 12px index 格。
- [x] `now = parent` 使用舊 `now` lifetime 的位置；下一輪 `now = heapSize` 不受前一 lifetime 的 assignment motion 汙染，從宣告後的正確目標位置進場。
- [x] 既有 declaration initializer、sequence、outerframe 與 style layer 專項測試仍通過。

## 驗證計畫
- 子代理小驗證：JS 語法與 diff；相關 Node 測試；隔離 32382 服務實際播放第 4→5 幀並檢查事件前後 SVG 幾何、highlight 與 marker 路徑。
- 主代理整合驗收：合併後重看 heap 第二次與跨層插入，並決定是否補做更廣泛的動畫驗證。
- 測試隔離方式：使用 beta worktree、既有隔離埠 32382 與獨立 headless browser，不操作使用者分頁。

## 變更紀錄
- 2026-09-19：依使用者回報建立初始定義；範圍限定為 heap 跨幀幾何、highlight 與 marker lifetime。
- 2026-09-19：實際重現確認 highlight 的共用 style layer 也會補回 index 高度，因此同步修正 normal／heap／segment tree／BIT 的值格 highlight 契約。
