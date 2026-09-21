# 2026-09-21-beta-BIT：Binary Indexed Tree 新指令範例

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：2cb0409d1fd430d1fabea1feb5885e908da02236
- 分支：codex/2026-09-21-beta-BIT
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-21-beta

## 問題與預期結果
- 情境與操作：舊 Binary Indexed Tree 範例仍依賴 AV.hpp 與手寫繪圖程式，指令運算式也不能解析位元運算。
- 目前行為：範例混入大量繪圖輔助碼；renderer 只提供 bit／fenwick 縮寫；沒有 Binary Indexed Tree 專項解析與實際 SVG 驗證。
- 使用者希望的結果：改成只使用新指令的完整範例；畫面只比較 num 與 BIT，不使用 keep；renderer 在範例中使用 Binary Indexed Tree 全名，只有變數命名使用 BIT；num 前置一個值為 0 的保留格並完整顯示，使用預設十進制 label，num[0] 以 `AV_grey` 填色，並以 `num.left-bottom` 對齊 `BIT.left-top offset(-40,-70)`；BIT 使用前導零二進制 label；建樹時只 highlight 當前 num 格，查詢時才以 background 顯示使用區間；可見區間使用 `~`；指令運算式支援位元運算；程式沿用舊版 build／sum 結構並使用簡短 int 變數。
- 本次範圍與必要限制：保留既有 bit／fenwick 相容名稱；角落錨點同時接受水平在前的別名並正規化；不做完整 regression 或全部測試；修改後重啟 beta 3102、commit 並 push。

## 需求確認
- 已從使用者或上下文確認：支援常見位元運算；不使用 keep；只顯示 num 與 BIT；num[0] 是值為 0 的保留格並使用 `AV_grey`，實際 num 與 BIT 資料均為 1-based；BIT 使用前導零二進制 label；使用 int 與簡短變數並盡量保留舊版程式結構。
- 尚待使用者回答：無；若查詢路徑在函式返回後是否保留影響最終教學行為，再提出具體差異。
- 代理採用的合理假設：全名語法採 `render binary indexed tree`，並支援連字號／底線別名；位元運算採 C++ 優先序與 JavaScript 32 位整數求值，符合目前 trace 的 int 索引用途。

## 重現與調查
- 最小操作步驟或 fixture：讀取 `algorithm_sample/Tree/Binary_Indexed_Tree.cpp`；以 num[0] 保留格、1-based num／BIT、build、sum 與 range sum 重寫；另以非 2 的冪次資料檢查排版。
- 重現狀態：已重現
- 已確認事實：parser 與 runtime evaluator 均缺少 `& | ^ ~ << >>`；`render bit` 已接到 original-bit renderer；BIT renderer 以可見內容的第一格作為邏輯 index 1；目前沒有 BIT 專項測試。
- 尚待調查：無；寬格 marker、compound assignment 與二進制 index 標籤均已用專項案例確認。

## 修改邊界與依賴
- 預計修改檔案或模組：`trace-instrumenter.js`、`public/trace-rules.js`、`algorithm_sample/Tree/Binary_Indexed_Tree.cpp`、sample input、BIT 專項測試、必要入口 cache key、本任務文件。
- 共用檔案／介面與協調結果：運算式 parser／evaluator 是共用介面；保留既有語法並新增運算子，不改現有算術與條件語意。
- 依賴任務：無；使用 main v4.9 既有 renderer、marker 與播放行為。

## 驗收條件
- [x] 指令運算式可解析並正確求值 `& | ^ ~ << >>`，優先序符合 C++ 常見整數運算。
- [x] `render binary indexed tree` 解析為既有 original-bit renderer，舊 bit／fenwick 仍可用。
- [x] 範例不含 AV.hpp、av 繪圖呼叫、draw 輔助變數或 keep，只顯示 num 與 BIT。
- [x] num 完整顯示 0 保留格與所有輸入，num[0] 使用 `AV_grey`，並以 `num.left-bottom` 對齊 `BIT.left-top offset(-40,-70)`；實際 num 與 BIT 資料都是 1-based，BIT 以固定寬度二進制顯示。
- [x] point update、prefix sum 與 range sum 的輸出正確，畫面能對照目前 BIT 節點涵蓋的 num 區間。
- [x] 非 2 的冪次長度仍有正確格寬、索引、highlight 與 marker 定位。
- [x] `left-top`、`right-top`、`left-bottom`、`right-bottom` 可用於來源及目標錨點，並分別正規化為既有角落名稱。
- [x] 範例中的 highlight 與 point 不指定顏色，沿用 renderer 預設值；只有 background 使用教學色彩。
- [x] 建構時 `BIT[i]` 的 compound assignment 明確以可見的 `num[k]` 為來源，播放時數值會從 num 格移向 BIT 格。
- [x] 建樹畫面以預設 highlight 指定目前的 `num[k]`，不替 num 區間加 background；查詢畫面保留使用區間 background，可見區間以 `i-lb+1~i` 顯示。
- [x] `i += lb` 與 `i -= lb` 會讓依賴 i 的 marker 沿既有 position 路徑平移；BIT／num 的 compound value assignment 不被誤判為 marker 移動。

## 驗證計畫
- 子代理小驗證：Node 語法與差異檢查；位元運算／renderer alias parser 測試；BIT sample compile/output 測試；3102 的單一 BIT 瀏覽器 SVG 專項。
- 主代理整合驗收：核實 parser 共用行為，整合後實際播放一輪 update 與兩次 prefix sum，依影響範圍決定其他 V3 驗證。
- 測試隔離方式：beta worktree 與 beta 3102；不操作使用者分頁或投影片，不執行完整 regression。

## 變更紀錄
- 2026-09-21：依使用者指示建立初始定義；BIT renderer 使用全名語法，範例使用教學變數並移除所有舊繪圖程式。
- 2026-09-21：完成位元運算 parser/runtime、全名 renderer、新範例及非 2 的冪次 SVG 專項驗證；程式 commit 為 `5b5ad128c97cc6651c8229cd41a63ddfd52de704`。
- 2026-09-21：依使用者補充將 num 改為 0-based 預設 label、num[0] 灰色，型別改為 int，函式與變數靠近舊版簡短寫法；程式 commit 為 `0fd7da94fe675efc311327e6cf83a7d34480a924`。
- 2026-09-21：移除 num 的 range 裁切以顯示完整 vector，並改用 `@place num at BIT.top offset(-40,-70)`；程式 commit 為 `7e0ac3e57a7bd0faa07a6fd44a7fe9e4a99decde`。
- 2026-09-21：依使用者釐清在 num 前置值為 0 的保留格，使用 `AV_grey`，實際輸入回到 num[1..n] 並直接與 BIT 對齊；程式 commit 為 `80c3d15ae893f59ff7e7f94efda9459100e4d1e8`。
- 2026-09-21：新增四個水平在前的角落錨點別名，支援 @place 來源與目標，並同步 camera、arrow 與前端文字指令綁定辨識；程式 commit 為 `399071d5125999b932aacf5a30ce572cb18b9e83`。
- 2026-09-21：拆開 BIT 的 highlight 與 background 指令，highlight／point 保留預設顏色，只有 background 指定 AV_green／AV_blue；程式 commit 為 `93b5a32d2fe6aa732579b4c74600802586d985b1`。
- 2026-09-21：將 build 改為保存原始索引 k 並執行 `BIT[i] += num[k]`，讓事件來源對應可見 num 格並播放數值 transfer；程式 commit 為 `1d83fa39e8d5ad4028a0c83a3f50188abb658a4e`。
- 2026-09-21：依指定改用 `num.left-bottom at BIT.left-top offset(-40,-70)`；建樹只 highlight `num[k]`，查詢才顯示 num 區間 background，區間文字改用 `~`；程式 commit 為 `de9ebaca102e2618bd013a2dc1b2ef3fb5749337`。
- 2026-09-21：移除只供繪圖使用的區間左端點變數 `l`，改由 `@style` 與 `@text` 直接計算 `i-lb+1`；程式 commit 為 `a69a43f837508d64b7c9c1a79b3789d83c8a0a87`。
- 2026-09-21：修正 scalar compound write 未進入 marker position 動畫的分類缺口；只有事件目標確實控制 marker 時才平移，陣列 compound assignment 維持數值動畫；程式 commit 為 `33a56ff3c2ec4d907f21ddfb406dbf2ccd9ab8b4`。
