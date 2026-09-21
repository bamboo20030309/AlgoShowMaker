# 2026-09-22-gamma-slide-segment-tree：同步新版 Segment Tree 到投影片 Structure

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：23a2f6e933fb561757e764d1c97929c49a00dfcb
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：在投影片編輯器新增或載入 Segment Tree Structure。
- 目前行為：投影片仍呼叫舊 `draw_array_segment_tree()`，以完整 heap 層排列，未使用整合分支新增的區間比例與自然遞迴深度畫法。
- 使用者希望的結果：投影片 Segment Tree 使用目前演算法畫布的新版畫法。
- 本次範圍與必要限制：同步 renderer 與索引映射；保留投影片既有內容、編輯、樣式及註標操作。

## 需求確認
- 已從使用者或上下文確認：從目前 `intergration` 節點開新分支，將新版 Segment Tree 畫法同步至投影片 Structure。
- 尚待使用者回答：無。
- 代理採用的合理假設：投影片既有 `content` 仍代表 breadth-first tree storage 節點；葉區間長度以 `ceil((節點數 + 1) / 2)` 推導，既有 7 節點預設對應 4 個葉位置。

## 重現與調查
- 最小操作步驟或 fixture：建立 7 節點 Segment Tree Structure，比較 SVG 的 `data-layout`、節點寬度、區間標籤、連線及可編輯索引。
- 重現狀態：已重現。
- 已確認事實：演算法畫布在 `original-segment-tree` 模式使用 `draw_standard_segment_tree()`；投影片 `slide-structures.js` 的 Segment Tree 分支仍固定呼叫舊 renderer。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slide-structures.js`、投影片／舊入口快取版本、入口測試及聚焦瀏覽器測試。
- 共用檔案／介面與協調結果：重用整合分支既有 `draw_standard_segment_tree()`，不複製 renderer；投影片 0-based item index 映射到 renderer 1-based storage index。
- 依賴任務：整合分支的標準 Segment Tree renderer，已包含於基準 commit。

## 驗收條件
- [x] 投影片 Segment Tree 的 renderer 標記為 `standard-segment-tree`，layout 為 `segment_tree_interval`。
- [x] 節點寬度依 `[L,R]` 涵蓋範圍成比例，並顯示區間與父子連線。
- [x] 投影片 `indexBase` 會控制區間從 0 或 1 開始。
- [x] 原本 0-based 的格子點選、數值編輯、樣式及註標仍對應正確節點。
- [x] 新畫法沿用投影片 gap 設定，並保留自然遞迴深度。

## 驗證計畫
- 子代理小驗證：JavaScript 語法、入口測試、獨立投影片 Segment Tree 瀏覽器測試、diff 檢查。
- 主代理整合驗收：在整合版本新增 Segment Tree Structure，檢查不同長度、0/1 起始索引、編輯、樣式與註標；依影響範圍補做投影片實際驗證。
- 測試隔離方式：瀏覽器測試使用隨機本機埠、獨立 headless 瀏覽器與獨立 localStorage deck。

## 變更紀錄
- 2026-09-22：從整合節點建立新分支；完成標準 Segment Tree renderer 與投影片索引操作的映射。
