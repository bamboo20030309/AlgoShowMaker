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
- 使用者希望的結果：新增 `render segment_tree`，讓格子寬度反映區間長度，子節點直接位於父節點下一層，且不把葉節點強制對齊到底部；最小格為 40×40px、index 高 12px，並可分別設定水平與垂直 gap；tree index 平常置中，interval 靠右且葉節點使用單端點括號，碰撞時 index 向左避讓；兩段標籤在框內垂直置中；葉節點 value 與其他節點同字級。
- 本次範圍與必要限制：保留既有 `render heap` 與舊線段樹範例；提供標準 `vector<int> tree(4*n+5)` lazy 範例，輸入操作 1/2/3 分別代表 modify、set、query；新增 `gap(horizontal,vertical)` 到陣列類 renderer；新增第一版 `format(...)` 顯示格式並改寫標準範例；範例預設不寫 gap；只做相關 V2 小驗證。第二版 `map(...)`、自訂 `prefix(...)`／`suffix(...)` 先記錄，不在本次實作。

## 需求確認
- 已從使用者或上下文確認：採用區間比例寬度與自然遞迴深度；n=10 必須可表達 3/2 等非等分子區間；新增 renderer 名稱為 `segment_tree`；水平 gap 會擴大 heap／segment tree 等跨單位節點本身，垂直 gap 為 0 時不畫父子連線。
- 尚待使用者回答：無
- 代理採用的合理假設：`range(start,end)` 的起點同時是資料區間起點與 tree 根索引；`gap(x)` 為既有單參數相容寫法，等同 `gap(x,x)`；queue 只使用水平值，stack／disk 只使用垂直值。

## 重現與調查
- 最小操作步驟或 fixture：幾何 fixture 使用 n=10、數列 1 到 10、查詢 [3,8]；正式範例使用 n=15、7 個 modify/set/query 操作，最後查詢 [8,9]。
- 重現狀態：功能新增不適用
- 已確認事實：n=10 幾何 fixture 的標準遞迴索引實際使用 19 個節點；節點 9 位於深度 3，節點 16 位於深度 4；正式 n=15 操作序列最後查詢答案為 12。
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
- [x] 標準線段樹下方標籤將 tree index 置中、interval 靠右且比 index 小 2px；葉節點 `[x,x]` 顯示為 `[x]`，兩位數葉節點不與 index 重疊。
- [x] 一般可容納的 value 在葉節點與非葉節點都使用 16px，只有內容真正超出格寬時才縮小。
- [x] 標準範例讀取指定的 n=15、7 個操作輸入；modify、set、query 分別顯示紫、橘、綠 segment，最後 query [8,9] 輸出 12。
- [x] 標準範例以 `fields(tree,lazy,sets)` 合併欄位，並以 `hide(lazy=0,sets=LM)` 隱藏預設 lazy/set 值。
- [x] n=15 的兩位數葉節點 index 28/29 不與 interval `[13]`／`[14]` 重疊，且 index 與 interval 都在 12px 標籤框中垂直置中。
- [x] update 回朔時插入左右子節點相加並寫回父節點的幀；query 只有跨中點、確實合併兩個回傳值時插入 `leftSum + rightSum = result` 回朔幀。
- [x] update 與 query 的回朔加法幀都帶有對應顏色的 `split(now,after)`，完成當前節點時同步收回 segment。
- [x] 融合顯示的 tree 格執行賦值動畫後，只更新事件所屬欄位；未隱藏的 lazy／sets 欄位與分隔符號不會被清除。
- [x] `format(field=type,...)` 支援 `raw`、`signed`、`assign`、`binary`、`hex`、`bool`、`fixed(n)`、`percent(n)`，且只改顯示、不改原始資料、條件或 hide 判斷。
- [x] 格子靜態文字與事件動畫共用格式；`assign`／`signed` 動畫完成後仍保留 `=`／正負號。
- [x] 標準範例改用 `fields(tree,sets,lazy)`、`hide(sets=LM,lazy=0)`、`format(sets=assign,lazy=signed)`，使 set 與 modify 顯示為 `=8`、`+3` 或 `-2`。
- [x] `tree[a] + tree[b]` 的加法賦值動畫只搬移兩個 tree 欄位的數字，不會把同格的 `=set` 或帶號 lazy 欄位一起搬入父節點。
- [x] 每個格內 segment 的左右邊界各顯示一條 1px 灰色虛線，且在區段寬度補間與 split 淡入淡出時貼合色塊邊緣。

## 驗證計畫
- 子代理小驗證：語法與差異檢查；新 parser／compile 專項；n=10 瀏覽器幾何、gap 與 split 專項；各陣列類 renderer gap 幾何；舊 heap 格內 segment 與既有線段樹範例相容性。
- 主代理整合驗收：整合後以標準 n=10 範例實際操作投影片，確認區間寬度、自然深度、查詢 segment 動畫與跨介面顯示。
- 測試隔離方式：使用本 worktree 與 localhost:3198 的隔離服務及無頭瀏覽器，不操作使用者分頁或投影片。

## 變更紀錄
- 2026-09-21：依使用者確認新增標準線段樹 renderer；不採葉節點底部對齊。
- 2026-09-21：依使用者回饋移除 `domain/root/unit`，改由 `range` 起點推導根索引並採用內建格寬。
- 2026-09-21：依使用者回饋固定最小格 40×40px、index 高 12px，新增 `gap(horizontal,vertical)`；預設 gap 0，範例不額外拉開。
- 2026-09-21：依使用者回饋將 index 與 interval 分開排版；index 置中、interval 靠右，葉節點區間簡化為單一端點。
- 2026-09-21：依使用者回饋保留葉節點單端點括號 `[x]`，interval 比 index 小 2px，value 字級不再隨節點寬度機械縮小。
- 2026-09-21：依使用者指定輸入將標準範例擴充為 15 個值、7 個 modify/set/query 操作；最後 query [8,9] 輸出 12。
- 2026-09-21：依使用者截圖修正兩位數葉節點標籤碰撞；interval 移至距右側 1px，index 在實測碰撞時向左避讓，兩段標籤改為框內垂直置中。
- 2026-09-21：依使用者回饋新增回朔加法幀；update 顯示兩個 child 合併回 parent，query 改為標準回傳值寫法並只在跨中點時顯示左右答案合併。
- 2026-09-21：依使用者回饋在所有回朔加法幀加入 `split(now,after)`；modify、set、query 分別沿用紫、橘、綠 segment。
- 2026-09-22：重現 n=11 輸入第 55 幀 `tree[6]` 遺失 sets 欄位；確認 trace 仍有 `sets[6]=7`，修正賦值動畫只更新複合格內對應變數的文字節點。
- 2026-09-22：依使用者確認新增第一版 `format(...)`，並將標準範例的 set／modify 標記改成 `=value`／帶正負號的 value；第二版值映射與自訂前後綴列為後續優化候選，交由主代理保留。
- 2026-09-22：依使用者回饋修正複合 tree 格的二元加法來源，只搬移 tree 欄位；格內 segment 新增左右 1px 灰色虛線並跟隨既有 segment 動畫。
