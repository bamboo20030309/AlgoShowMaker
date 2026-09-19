# alpha-segment-tree：Heap 複合欄位與格內區段

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：61a4baade9b06b5e50d0c7a24683e937db9c7112
- 分支：codex/2026-09-19-alpha-segment-tree
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-19-alpha-segment-tree

## 問題與預期結果
- 情境與操作：新版指令目前只能讓heap呈現單一來源值，既有@segment只表示一般陣列範圍；兩個線段樹範例仍依賴AV.hpp及舊繪圖資料。
- 目前行為：無法直接合併tree／lazy／sets同索引，也無法在heap節點格內依局部範圍著色。
- 使用者希望的結果：新增fields／hide／separator、pair／tuple單格格式及雙層@segment，並以新語法改寫兩個範例。
- 本次範圍與必要限制：三種結構統一使用既有render heap；不新增標準線段樹renderer；保留特殊線段樹演算法、儲存與輸出；不修改已完成的heap.cpp；point／highlight使用預設樣式；遞迴下降時顯示目前與尚待處理的segment，命中後移除完成區段，回溯不建立幀；格內segment歸入style顯示層。

## 需求確認
- 已確認：fields保留各來源身分與事件；hide逐幀按欄位判斷；separator預設逗點；segment局部端點包含、裁切、L>R隱藏、後者在上；as提供穩定身分；when與既有單層@segment相容。
- 尚待使用者回答：無。
- 合理假設：fields第一個欄位為heap的幾何、索引與主要style目標；其他欄位作為同索引顯示來源，仍可由各自變數的@style命中對應格。

## 重現與調查
- fixture：tests/fixtures/heap-composite-segments.cpp及兩個既有Segment Tree sample input。
- 重現狀態：功能新增不適用。
- 已確認事實：frame rendererOptions可保存並重載複合選項；pair已有trace編碼，tuple需新增同類編碼；heap格內segment可沿用節點矩形幾何；具名segment需以data-av-key配對相鄰幀。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改：trace-instrumenter.js、server.js、trace-model.js、trace-renderer.js、trace-frame-tween.js（如既有繪圖配對需要）、入口cache、指令提示／手冊、兩個線段樹範例、直接相關測試。
- 共用介面：rendererOptions新增fields／hide／separator；segment新增cellExpression／cellRange／color欄位，舊欄位保留。
- 依賴：基準已包含目前intergration整合內容；heap.cpp新版參考位於beta分支，按使用者要求不修改。

## 驗收條件
- [x] fields同格顯示、預設／自訂separator及逐幀hide正確，更新事件仍屬各原變數。
- [x] pair／tuple每元素一格，預設保留零並支援pair成員hide。
- [x] heap根／子節點格內segment依局部範圍著色，裁切、空範圍、多層、重疊、when及as正常。
- [x] split(cursor)顯示目前遞迴節點與待處理右側前沿，split(cursor,after)排除已完成節點；point／highlight不指定自訂色。
- [x] Segment_Tree_easy只在下降與命中時建立幀；命中後以split(now,after)移除完成區段，回溯不再建立幀。
- [x] split產生的新segment由頂端向下淡入，完成segment由頂端向下淡出；事件動畫開關不會停用這些style動畫。
- [x] Segment_Tree_easy在tree下方顯示sum，完整命中時把tree[now]累加至sum，輸出與原演算法相同。
- [x] 格內segment位於style顯示層、跟隨綁定格子且保留具名幾何轉場，不受事件動畫層控制。
- [x] 一般播放套用同格highlight／point時不會清除segment；第三幀、倒退及重播皆維持正確顯示。
- [x] 既有@segment arr[L:R]與heap既有行為不變。
- [x] Segment_Tree_easy.cpp與Segment_Tree.cpp移除AV.hpp及舊繪圖資料，保留演算法及輸出，能以sample input編譯產生trace。

## 驗證計畫
- 開發代理小驗證：V2 E/F/H/J，新增parser／model／renderer局部專項；隔離服務與headless瀏覽器只跑最小fixture及兩個範例sample input；C++原輸出對照改寫前版本。
- 主代理整合驗收：核對diff與兩範例定點，視合併範圍決定相關V2或V3；不機械式跑全部測試。
- 隔離方式：alpha worktree、隨機埠測試服務與獨立headless Edge；完成後只重啟alpha 3101。

## 變更紀錄
- 2026-09-19：依使用者完整規格建立初始任務定義，基準為intergration 61a4baa。
- 2026-09-19：完成parser、trace model、renderer、轉場與兩個範例改寫；31項直接相關小驗證通過，待主代理核實。
- 2026-09-19：依使用者補充新增with split(cursor[,after])遞迴前沿，並將Segment Tree範例的point／highlight改回預設樣式；相關31項小驗證通過。
- 2026-09-19：依使用者補充將格內segment移至style顯示層；實際SVG確認不再嵌在cell內，圖層位於物件與前景箭頭之間，具名區段插值仍通過。
- 2026-09-19：依實際Segment Tree播放回報修正整段命中幀誤用split(now,after)造成單一路徑segment消失；命中幀改用split(now)，after只保留於回溯／合併幀。
- 2026-09-19：重現第三幀僅在一般播放消失；根因是presented hint更新會隱藏同格所有attached視覺，誤包含style layer segment。清理範圍改為highlight／point／mark並新增實際動畫路徑驗證。
- 2026-09-20：依使用者修正展示流程：Segment_Tree_easy移除所有回溯幀，完整命中後直接移除該segment並累加tree下方的sum；split segment新增由上往下淡入／淡出動畫。
