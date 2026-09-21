# alpha-standard-segment-tree：標準線段樹區間排版

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：2cb0409d1fd430d1fabea1feb5885e908da02236
- 分支：codex/2026-09-21-alpha-standard-segment-tree
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-21-alpha-standard-segment-tree

## 問題與預期結果
- 情境與操作：標準線段樹使用一維陣列與遞迴區間建樹，n 可能不是二次方。
- 目前行為：既有 heap 排版用完整二元樹層級安排固定寬度格子，不能直接呈現節點區間長度，也會讓不同深度的葉節點失去自然父子關係。
- 使用者希望的結果：新增 `render segment_tree`，讓格子寬度反映區間長度，子節點直接位於父節點下一層，且不把葉節點強制對齊到底部；最小格為 40×40px、index 高 12px，並可分別設定水平與垂直 gap；tree index 置中，interval 靠右且葉節點不重複顯示相同端點。
- 本次範圍與必要限制：保留既有 `render heap` 與舊線段樹範例；提供標準 `vector<int> tree(4*n+5)` 範例；新增 `gap(horizontal,vertical)` 到陣列類 renderer；範例預設不寫 gap；只做相關 V2 小驗證。

## 需求確認
- 已從使用者或上下文確認：採用區間比例寬度與自然遞迴深度；n=10 必須可表達 3/2 等非等分子區間；新增 renderer 名稱為 `segment_tree`；水平 gap 會擴大 heap／segment tree 等跨單位節點本身，垂直 gap 為 0 時不畫父子連線。
- 尚待使用者回答：無
- 代理採用的合理假設：`range(start,end)` 的起點同時是資料區間起點與 tree 根索引；`gap(x)` 為既有單參數相容寫法，等同 `gap(x,x)`；queue 只使用水平值，stack／disk 只使用垂直值。

## 重現與調查
- 最小操作步驟或 fixture：執行 `Segment_Tree_standard.cpp`，輸入 n=10、數列 1 到 10，查詢 [3,8]。
- 重現狀態：功能新增不適用
- 已確認事實：標準遞迴索引實際使用 19 個節點；節點 9 位於深度 3，節點 16 位於深度 4；查詢答案為 33。
- 尚待調查：無

## 修改邊界與依賴
- 預計修改檔案或模組：frame renderer 選項 parser、trace renderer、各陣列類 SVG renderer、指令提示、快取入口、標準範例、手冊與專項測試。
- 共用檔案／介面與協調結果：`domain/root/unit` 僅開放給 `render segment_tree`；既有 `range`、heap 與雙層 `@segment` 介面保持相容。
- 依賴任務：無

## 驗收條件
- [x] `render segment_tree with range(1,n)` 可解析並在 trace 中解析執行期 n，且以 `tree[1]` 為根。
- [x] n=10 只畫實際存在的 19 個節點，根寬 10 單位，左右子樹各寬 5 單位，3/2 子區間寬度正確。
- [x] 葉節點保留真實遞迴深度，父子邊連接正確，不進行底部對齊。
- [x] 既有 style、格內 `@segment` 與 `split(now)`／`split(now,after)` 可作用於新排版。
- [x] 現有 `render heap` 與原線段樹範例行為不受影響。
- [x] 標準線段樹最小 value 格為 40×40px，index 格高 12px；不寫 gap 時格子貼合且不畫父子線。
- [x] `gap(10,24)` 分別套用水平與垂直間距；三單位跨區間格寬為 140px，垂直 gap 大於 0 時才畫父子線。
- [x] 一般陣列、heap、BIT、queue、stack、disk 依各自排版軸套用 gap，且格內 `@segment` 不跨越水平 gap。
- [x] 標準線段樹下方標籤將 tree index 置中、interval 靠右；葉節點 `[x,x]` 顯示為 `x`，兩位數葉節點不與 index 重疊。

## 驗證計畫
- 子代理小驗證：語法與差異檢查；新 parser／compile 專項；n=10 瀏覽器幾何、gap 與 split 專項；各陣列類 renderer gap 幾何；舊 heap 格內 segment 與既有線段樹範例相容性。
- 主代理整合驗收：整合後以標準 n=10 範例實際操作投影片，確認區間寬度、自然深度、查詢 segment 動畫與跨介面顯示。
- 測試隔離方式：使用本 worktree 與 localhost:3198 的隔離服務及無頭瀏覽器，不操作使用者分頁或投影片。

## 變更紀錄
- 2026-09-21：依使用者確認新增標準線段樹 renderer；不採葉節點底部對齊。
- 2026-09-21：依使用者回饋移除 `domain/root/unit`，改由 `range` 起點推導根索引並採用內建格寬。
- 2026-09-21：依使用者回饋固定最小格 40×40px、index 高 12px，新增 `gap(horizontal,vertical)`；預設 gap 0，範例不額外拉開。
- 2026-09-21：依使用者回饋將 index 與 interval 分開排版；index 置中、interval 靠右，葉節點區間簡化為單一端點。
