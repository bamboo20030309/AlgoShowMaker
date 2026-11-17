# 八皇后遞迴樹與 bits 轉換

## 2026-10-04 OR／AND／XOR 位元列事件動畫

- 支援賦值與初始化中的 `|`、`&`、`^`，以及 `|=`、`&=`、`^=`。runtime 保存每一步左右值、結果、運算子及列索引；鏈式／括號運算保留中間結果。compound 複合 RHS 先捕捉原 lhs；結果依目標型別轉換，auto 保留原推導。
- bits/native bitset 列才使用整排效果；identity let 可對應原資料，keep snapshot 排除。必要位元列皆存在才為綠色，缺少來源為 missing-target 黃色；一般數字維持既有 assignment。右排複製移往目標，来源不移走；二維指定列以實際 cell 座標對齊，位數與 order 按 bit significance 配對。
- 動畫以事件自己的 captured 值重建 before/result，不提前洩漏下一事件結果；同一列連續運算有獨立起值。抵達後更新 display、以單一 fill/alpha 插值更新底色，避免相同半透明色因兩層 crossfade 變淡。原 labels(none)、display、style 保留，cleanup 恢復 cell visibility。
- V2（F/G/H/J），隔離 3197 + headless Edge：`node --test tests/bitwise.integration.test.js tests/bitwise-types.integration.test.js tests/bit-shift.integration.test.js tests/bits-eight-queens.test.js`，9/9 通過、0 skip。包含六種運算、scalar fallback、native bitset/二維列、同幀連續值、缺來源、括號／巢狀 compound、窄整數與 auto；1x/2x 前後步進與 autoplay 的 start/end 順序通過，無 pageerror。移位像素與八皇后 216 幀／17 keep 既有測試通過。JS syntax、diff check 通過。
- 持久化相容：新事件 metadata 正常載入；刪除 bitwise 欄位的舊 trace 實際載入、JSON 保存、重新載入與 render 通過。明確 enabled=false、animate=false 保存重開保留，自訂 display/紅底沿用。舊 trace 不猜測運算，需重新 RUN 取得新效果，手冊已說明。
- tween build trace-265；無新繪圖指令。未跑 full regression、Studio 全介面或大規模演算法驗證，未操作使用者分頁；需主代理整合時按相關 scope 核實。本次不提交或推送既有 dirty 工作內容。
- 自身 alpha 3101 核對舊 PID 後已重啟；HTTP analyze/compile 實測 OR：9 | 6 = 15，前端回傳 trace-265。測試 3197 已停止。既有 Mongo DNS `ENOTFOUND mongo` 不影響本機 analyze/compile；本次未驗證雲端儲存。

## 2026-10-03 教學文字改為演算法語意

- 移除 text 中的塗色／繪圖操作描述。取反說明：受攻擊遮罩的 1 不能放置；取反取得未受攻擊的候選位置，再以 N 位遮罩限制棋盤範圍。補充 lowbit、候選移除及三個下一列遮罩的意義。
- 合併下一列的文字不再寫成實際 P 的賦值，以免與尚未取反的攻擊遮罩混淆。僅修改 @text，未改 frame、事件、display 或 style。
- V0：本機解析 15 個 frame 指令通過；未啟動演算法驗證集。沿用本輪前次已通過的動畫行為驗證。

## 2026-10-03 取反移至 P 計算前並恢復真實 P

- 移除 nextR 合併後的取反幀，改放在每次 dfs 的 L/M/R 合併展示後、`int P = ((1 << N) - 1) & ~(L | M | R)` 前。Q 仍保留紅格 1、原白格漸變綠格 1。
- C++ 搜尋變數恢復 P，包含 while、lowbit 與 P ^= p；不再使用 available。繪圖中間別名為 maskP，避免遮蔽 C++ P；計算前顯示合併遮罩，計算後及 lowbit 幀直接取實際 P。右側使用既有 mask_union 物件 ID，避免 as P 與 C++ P 的位置解析衝突。
- V2：隔離 3197 + headless Edge，bits-eight-queens 2/2 通過。確認取反預覽時 P 尚未宣告、下一幀 P declare/assign 事件保留、右側實際 P 正確；Q 1x/2x 漸變、紅格保持、數字與位移、LOD 斷言通過。N=4 216 幀、17 keep。syntax/diff check 通過；未跑 full regression/Studio。僅範例，無持久化 schema 改動。

## 2026-10-03 Q 數字教學與局部取反

- Q 的教學列改成白格 0、紅／綠格 1，不顯示方向箭頭；其他列維持皇后與空白。L/M/R 仍顯示方向箭頭。
- 使用者明確選擇取反時保留紅格 1、原白格轉成綠格 1。取反遮罩只控制 Q，右側 P 保持合併值、數字與紅白底，不再播放取反。
- V2 局部驗證：隔離 3197、headless Edge，bits-eight-queens 2/2 通過；驗證逐格數字與底色、P 不改值、1x/2x Q 白到綠的中間色、紅格全程保持紅色。N=4 217 幀、17 keep；syntax/diff check 通過。未跑完整 regression 或 Studio，不操作使用者分頁。範例修改無新持久化欄位。
- 已重啟自身 alpha 3101；本節取代前節「Q 保留攻擊箭頭、P 播放取反」的行為描述。

## 2026-10-03 取反幀 Q 列紅綠並存

- 僅在 P 取反教學幀新增 `@style board background AV_green when row == attack_row && (P & bit)`；沿用 preset 中的紅底與攻擊箭頭，不清除受攻擊位置。下一列的可用格綠、禁用格紅，同時呈現；其餘列不套綠。
- V2 局部驗證：隔離 3197、headless Edge；bits-eight-queens 2/2 通過，新增實際 Q 該列逐格綠／紅底及紅格保留箭頭的 SVG 斷言；既有 P 數字、分幀與取反漸變通過。217 幀、17 keep 不變；JS syntax／diff check 通過。未跑 full regression、autoplay 或 Studio。
- 範例修改，無核心／新持久化欄位，舊物件遷移不適用；3101 自身已核對服务重啟，未操作使用者分頁或其他服務。

## 2026-10-03 nextR 右移與 P 合併分幀

- nextR >>= 1 後先使用 nextR_masks 顯示右移結果，P 保留原本合併值；下一個独立 frame 才用 nextR_merged_masks 合併 nextL/nextM/nextR 到 P 並套用紅底。原取反幀接在最後，綠白漸變與 0/1 顯示不變。
- V2 範例局部驗證：隔離 3197 + headless Edge，bits-eight-queens 2/2 通過。新斷言確認右移幀 P 未提前改值、相鄰下一幀才合併，後續取反按新順序播放；既有 SVG 位移、數字與紅底、1x/2x 取反漸變斷言通過。N=4 217 幀、17 keep；15 個 frame 指令。JS syntax／diff check 通過，未跑全套 regression／autoplay／Studio。
- 僅範例與局部測試修改，無核心或持久化欄位變更；舊物件遷移不適用。3101 自身已核對的服務重啟，未操作使用者分頁或其他服務。

## 2026-10-03 使用者貼上版本與底色合成像素修正

- 使用者再次提供 blocked 舊版完整程式碼，本輪以其內容重新套用 P 命名、全階段數字 display；搜尋變數 available 避免與 let P 撞名，其他設定與流程保留。未寫入使用者正在操作的編輯器；提供完整修正 cpp 文件。
- 前輪的 alpha 修正並未解決另一個合成背景問題。新增真正 screenshot 像素對照重現：靜止紅格 [236,189,177,255]，移位卻是 [245,194,194,255]。原因為整列白色 backing 蓋住原外框的半透明綠底，改變了 AV_red 的合成背景。
- 修正為只隨移位量擴張新補入零位元區域的白底：原有移動格保留原合成底層，不再被整列白底漂白。新像素斷言確認移位紅格與靜止像素完全相同，新補入區域為 [255,255,255,255]。
- V2 隔離 3197 + headless Edge：bit-shift.integration 3/3、bits-eight-queens 2/2、entrypoints 1/1 分別通過；兩個 sample 測試初次因磁碟仍是使用者貼上的 blocked 版本失敗，重新按貼上來源套用修正後原斷言重跑通過，未放寬斷言。N=4 201 幀、17 keep；舊資料／false／custom 往返驗證保留。語法／diff check 通過；未跑全 regression／Studio／autoplay。
- tween trace-264。3101 自身已核對的 worktree 服務重啟，提供修正後範例及前端；沒有操作其他服務或使用者分頁。前次只檢查欄位不足以聲稱顏色一致，本次以實際像素作為修正證據。

## 2026-10-03 P 數字顯示／移位透明度

- 繪圖 blocked 改名 P，所有階段的 mask_union 改成 display("${value}") 顯示 0/1，不再用箭頭。C++ 搜尋用 P 改名 available，避免繪圖 let 同名遮蔽；搜尋運算不變。取反仍為單獨綠白漸變幀。
- 移位 clone 原先重設 fill 為 rgba AV 色票，卻保留先前 tween 的 fill-opacity，導致 alpha 重複相乘而變淡。改成一次解析色票，以 RGB＋單一 fill-opacity 表示，清除 clone inline opacity／舊 CSS transition。AV_red 的有效 alpha 為 0.6，不再變成 0.36；補入白格 alpha=1。
- V2：隔離 3197 + headless Edge；bit-shift.integration、bits-eight-queens 合計 4/4，entrypoints 1/1 通過。新增前一幀 fill-opacity=0.6 的 fixture 並核實移位 RGB/alpha；全階段 P 數字、取反 1x/2x 中間色、別名移位、舊 trace 儲存重開及自訂/false 保留均通過。N=4 201 幀、17 keep 不變；JS syntax／diff check 通過。未跑全 regression、autoplay／Studio 全套，不操作使用者分頁。
- tween trace-263，無新持久化欄位。Alpha 3101 僅重啟本 worktree 已核對服務；確認 HTTP 新範例／前端版本／analyze。範例需重新載入與 RUN。

## 2026-10-03 移位補入白底／取反幀重現

- 移位 overlay 原先隱藏 cell 底色後，空位會露出下層底色；新增裁切範圍內不透明白色 backing，文字／底色移動時新入位置固定白底。清除 clone 的 inline fill，避免覆盖事件前計算的底色；不修改最終 style。
- 本輪開始時磁碟範例缺少取反幀（只有 13 個 frame 指令），已在 nextR 合併後恢復独立取反幀。N=4 為 201 幀、17 keep；C++ 搜尋流程不變。
- V2 局部測試：隔離 3197 + headless Edge；bit-shift.integration 2/2、bits-eight-queens 2/2、entrypoints 1/1 通過。驗證移位中 backing 為白、cleanup、舊 metadata 缺少欄位載入保存重開及自訂/false 保留；實際取反播放在 1x／2x 各格都有多個中間色，確定紅→白和白→綠不是瞬間跳色。JS 語法／diff check 通過；未跑完整 regression、Studio 全套或 autoplay，未操作使用者分頁。
- tween trace-262（入口與兩個 build 標記一致）。無新增持久化欄位，舊 shift event 即可套用白底修正；取反幀需重新載入本次範例並 RUN。Alpha 3101 已重啟自身 worktree 服務，HTTP analyze 14 指令及新範例內容確認；未操作其他服務。

## 2026-10-03 blocked 取反教學幀

- 在 nextR 右移、合併 blocked 後增加一幀，以 let 計算 N 位寬的 `((1 << N) - 1) & ~(nextL | nextM | nextR)`。合併陣列在原位置顯示取反的 0/1；原紅格變白，原白格變 AV_green。L/M/R、棋盤與 C++ 搜尋演算法不改，僅更換該幀的繪圖 let。
- V2 範例局部驗證：隔離 3197、headless Edge，bits-eight-queens 2/2 通過，新增取反數值、單一 mask_union、逐格 0/1 與綠白底色斷言。N=4：201 幀、17 keep；每次非根的 next 更新流程新增一個取反幀（共 16 幀）。JS 語法與 diff check 通過。未跑完整 regression、Studio/autoplay 全套，未操作使用者分頁。
- 無新增持久化欄位、解析器或渲染核心變更，舊物件資料遷移不適用。Alpha 3101 重啟本 worktree 的已核對服務，未操作其他服務。

## 2026-10-03 位元移位動畫

- `<<=`／`>>=` 沿用 write/compound 賦值事件，增加 bitShift 方向、位數及 before/after；RHS 僅計算一次。一般數字保持原賦值動畫，不增加 frame 或獨立事件開關。
- 播放依實際顯示資料分流：bits 展開、std::bitset、明確 bool 陣列使用位元內容平移；普通 0/1 整數陣列不自動推斷為位元陣列。原生 bitset 按 MSB-first 序列化，vector<bitset> 可渲染二維。
- 格線、外框固定，文字與底色平移並裁切；indexed target 僅影響該列。identity let alias 支援，聯集／算術 alias 不誤套位移。keep snapshots 排除，仍保存原值。事件開始前保留移位前內容，移動內容從本事件 before 值產生，而非沿用舊 frame。
- V2 局部驗證：隔離 3197 + headless Edge；bit-shift.integration、bits-eight-queens、entrypoints、provenance 合計 11/11 通過。含 runtime RHS 次數、混合數字/位元顯示、1D/2D/bitset、指定列、實際事件排程、八皇后 mask_L/mask_R 別名、儲存重開缺少新欄位的舊動畫、自訂值及明確 false 保留。N=4 仍 185 幀、17 snapshots。JS 語法與 diff check 通過，未跑全套 regression，未操作使用者分頁。
- engine generation 12、tween trace-261、renderer trace-240、provenance script trace-13。舊 trace 可用原賦值動畫播放；須重新 RUN 才取得移位 metadata。Alpha 3101 僅重啟本 worktree 的既有服務；未操作 main/統合/其他代理服務。
- 最後重跑前隔離服務曾因 sandbox tmp 寫入權限失敗；以已授權工作目錄重啟隔離服務後完整重跑上述局部測試通過。既有 MongoDB ENOTFOUND mongo 不影響本次分析／編譯／播放驗證。

## 2026-10-03 共用 let 精簡

- Q、L/M/R/P 的繪圖集中到 queen_scene_view；bit、皇后、攻擊判定、合併箭頭抽成 let。各階段 preset 僅宣告遮罩與顯示列，不再重複物件和 display；keep 仍獨立保存棋盤灰色皇后。
- 保留五幀 next（L 加 p、左移、M 加 p、R 加 p、右移）、舊箭頭/紅底清除、最後更新 P 與箭頭 fallback 單一空白。
- V2 局部驗證：隔離 3197 + headless Edge；bits-eight-queens 2/2 通過，185 幀、17 keep 不變；逐格箭頭、紅底、移位前後、P 合併與 LOD 相關斷言保留。未跑完整 regression 或操作使用者分頁。JS 語法、差異檢查通過；沒有新持久化欄位或核心修改。

## 2026-10-03 next 移位拆幀修訂

- nextL 與 nextR 各拆成加入 p、再位移兩幀；nextM 維持一幀。Q 在 next 階段清除目前列的舊箭頭與紅底，只保留新標示、皇后灰底及 lowbit highlight。
- 所有箭頭 display 的 false 分支由空字串改成單一空白；皇后符號的 fallback 不變。P 仍在右移完成後更新。
- V2 局部驗證：3197 隔離服務、headless Edge、bits-eight-queens 2/2 通過；N=4 為 185 幀、17 keep。新增檢查移位前後數值與 SVG 箭頭、舊列紅底清除。JS 語法、差異檢查通過；未跑完整 regression 或使用使用者分頁。
- 僅更新範例和局部測試，不新增持久化資料欄位，舊物件遷移不適用。

## 2026-10-03 右側遮罩與 next 同步

- 四條單列位元陣列依序為 L、M、R、P；P 是 L|M|R 的封鎖遮罩，原 C++ 可放位置 P 改名 available，搜尋邏輯不變。
- Q 塗紅後保留目前列的攻擊箭頭；next 三幀保留原箭頭，疊加下一列的方向並將所有箭頭格塗紅。右側依序顯示 nextL、nextM、nextR，最後一幀更新合併 P。
- 依 algoshowmaker-regression 執行 V2 局部驗證：隔離 3197、headless Edge、bits-eight-queens 2/2 通過；逐格檢查 next 三幀的遮罩值、箭頭、紅底與不重複顯示；保留 153 幀、17 個 keep。JS 語法與差異檢查通過。
- 僅範例與專項測試變更，沒有新的持久化欄位；舊物件資料遷移不適用。未跑完整 regression、autoplay 或 Studio 全套，不操作使用者分頁。

## 2026-10-02 恢復第一幀前／最後一幀後的追蹤

- runtime 在第一幀前正常記錄事件，結束時 flush 最後區間，不再截斷檔案；code hide 的 scope/lazy suppression 保持有效。
- 分塊讀取將尾端事件按原 order 接到最後一幀，標記 afterCapture；影格數與捕捉 state 不變，captureOrder 不包含尾端事件。既有數量、大小與壓縮安全限制維持，尾端超限不再靜默忽略。
- engine generation 11／provenance script trace-12：舊動畫會明確提示重新 RUN，不能憑空補回已丟棄事件；不改舊文件內容與自訂設定。
- V2（F/G/I）：獨立 3197 與 headless Edge。trace-chunk-store、trace-boundary-events.integration、code-hide、provenance、entrypoints 共 15/15；bits-eight-queens 2/2、control-flow-events.integration 1/1。0 skip；未跑完整 regression 或大型 checkerboard browser 驗證。
- 首尾事件實際出現在程式碼片段，code hide 內呼叫與賦值不出現；保存重开後事件與 availability metadata 一致。缺少 afterCapture 的 generation-10 fixture 已實際載入、使用、保存、重開；明確 enabled=false、空 text、自訂 color 與 autoFixedEnabled=false 保留。
- C++ 數量／bytes 分塊測試、首尾 lazy event 與資源超限、JS 語法、差異檢查通過；未操作使用者分頁。大型 trace-chunks.browser 舊斷言依新規格更新，但本輪僅做語法檢查，未跑其大型畫面 fixture。

## 2026-10-02 逐格遮罩抽成 let（使用者確認後修訂）

- 使用者確認要抽出的僅為位元遮罩：共用 preset 宣告一次 `@let bit = 1 << (N - 1 - column)`。刪除範例中的 cell_text，display 保留原條件而改用 L/M/R/nextL/nextM/nextR & bit；style 也共用 bit。保留順序、P 紅色樣式與 lowbit 幀前的皇后賦值。
- 修訂後 bits-eight-queens 專項 2/2 通過；153 幀、17 棋盤節點、箭頭疊加、禁用格紅色及預設 highlight 均不變。JS 語法及差異檢查通過，未操作使用者分頁。
- `@let` 支援受限字串、三元運算及字串串接；value/index/row/column 逐格求值，相關別名不阻斷其他不需要格子上下文的文字或位置運算。沒有新增 C++ 邏輯或事件。
- V2、分類 E/H：獨立服務 3197、headless Edge；bits-eight-queens 與 entrypoints 3/3，binary-indexed-tree 的 @let 篩選 3/3（含既有數值／字串索引、同格 ↙↓↘、逐格別名鏈、不相關 frame 文字、字面運算子符號及拒絕函式呼叫）。語法與差異檢查通過。
- 舊 inline display／keep 與 labels(none) 仍在八皇后 fixture 實際載入與渲染；沿用既有 lets 格式，不需新欄位或遷移。未執行完整 regression。

## 2026-10-02 編輯器復原歷史修正

- 同內容載入不改 Ace document；不同內容以一個可 undo/redo 的替換更新。範例載入期間不再插入「讀取中」程式碼。
- 動畫編輯器儲存關閉時暫停播放，但保留 iframe 與每張 slide 的獨立 Ace session；重開不重設 undo/redo。整頁重新整理不保存 history。
- 切換 session 後，草稿、新鮮度提示與行動版文字框繼續同步；行動輸入也改為可復原替換。
- 分級 V1（A/B 編輯歷史），獨立服務 3197 與 headless Edge，未操作使用者分頁或 deck。
- `node --test --test-concurrency=1 tests/algorithm-editor-history.browser.test.js tests/entrypoints.test.js tests/editor-clipboard.test.js`：4/4 通過、0 skip，browser pageerror 為空。
- 舊動畫無須新增欄位：實際載入缺少 history 欄位的 fixture，RUN、保存、關閉重開、undo/redo 均通過；原 input 與明確 autoFixedEnabled=false 保留。新 slide key 的 session 為獨立空歷史。
- JS 語法與差異檢查通過；未執行演算法驗證集，這次不更動動畫模型或繪圖邏輯。未驗證跨整頁重載 history（不在本版支援範圍）。

## 交付內容

- 新增 `bits(value, width)` 幀資料轉換：整數轉成一列位元；一維序列轉成二維位元矩陣。
- 位元採 MSB-first 顯示，與舊版 pion 八皇后範例一致。
- 新增 `labels(none)` 與 `symbols(zero, one)`，支援隱藏數字並以 `♕` 顯示 bit 1。
- 皇后所在格使用灰色；L／M／R 依序以 `↙`／`↓`／`↘` 顯示目前列的攻擊方向，聯集禁用位置使用紅色，P 可用位置使用綠色。
- 格內方向文字改由既有 `with display("模板")` 計算；模板支援三元運算與字串分支，可引用其他變數，明確的 display 在 labels(none) 下仍顯示。已移除試作的 style symbol 解析與渲染。
- `bits` 矩陣的樣式條件可使用 `row`、`column`、`index`、`value`。
- width 與樣式依賴只捕捉資料，不會成為額外畫布物件。
- 新增 `Backtracking/8queen_recursion.cpp` 與 N=4 範例輸入；舊版檔案保持不變。
- 每次 `dfs` activation 以 `@keep board as "Q" in queen_tree` 明確建立一個棋盤節點；實際遞迴呼叫自動形成父子邊與兄弟順序，不再以 `@keep last` 保存整個上一幀來代替節點。
- 已移除重複計算全棋盤攻擊範圍的 `queens`／`attacked` 繪圖輔助程式；目前直接由演算法原有的 L／M／R 位元遮罩驅動畫面。
- 相鄰向前播放時，未改變且非目前 active 的 keep snapshot 直接沿用原 SVG DOM；只建立新節點並重新計算樹位置與連線。倒退、跳幀、隱藏物件與 active snapshot 保留完整重建 fallback。
- LOD 已擴充至所有畫布物件與箭頭：每個物件都有 full／simple／overview 狀態；陣列、矩陣及 keep 遞迴棋盤另有格子層級 LOD，縮遠省略文字與箭頭裝飾，拉近後依原資料恢復 `♕` 等內容。
- overview 會將格子移入停止繪製的 detail host，以相同 background 共用的 fill path 及單一 grid path 保留完整棋盤；返回 full LOD 時原格子 DOM、文字、樣式與語意錨點原地恢復。
- 新增通用 `@keep variable ... use preset1, preset2`：多個 preset 與緊接 keep 的多條 `@style` 會在當次執行解析，透過不進入時間線的內部視圖保存 renderer、options、style 及其區域變數依賴。`without style` 仍明確關閉樣式保存，舊 `@keep` 不受影響。
- `bits(board, N)` 轉換後仍保留 `board` 作為資料與語意指令名稱；範例另以 `as chess_board` 指定畫布 ID，兩者用途分離。
- 八皇后範例每次 activation 建立 styled keep snapshot，並新增 L／M／R 分色預覽、攻擊遮罩聯集、P 可用位置、lowbit highlight，以及遞迴前 nextL／nextM／nextR 三段位移結果；只有同時包含 object 與皇后樣式的棋盤視圖保留 preset，單行遮罩 style 全部寫回對應 frame；branch preview 明確關閉。
- active recursion keep 節點現在沿用持久的節點身分與位置，但資料、renderer options 與 style 取自當前 frame；已返回的節點與兄弟節點仍維持各自保存時的快照。因此 L／M／R 預覽會立即套在目前棋盤，而不會被 keep 建立時的空樣式覆蓋。
- L／M／R 不轉成單一 index，而是在轉換後棋盤上以 `row`／`column` 直接測試每個 bit；只有單一 lowbit 使用藏於 `@code hide` 的 `selected_column = N - 1 - __builtin_ctz(p)` 對應 MSB-first 棋盤欄位。
- 主畫面的 focus camera 與縮圖語意統一：目標存在時直接以目標錨點為中心，使用 directive 指定的固定 zoom，不再按整棵遞迴樹 bounds 縮小。
- overview LOD 不再隱藏 recursion layout 的共用箭頭頭部；線段預留的 head 距離由箭頭尖端補齊，因此縮遠後仍與棋盤 outerframe 綁定。

## 相容性

- 未設定 `dataTransform`、`symbols` 或 `showValue` 的既有 trace 文件沿用原行為。
- 既有 `labels(index)`、`labels(value)` 的 runtime renderer options 不增加欄位。
- `bits` 的來源仍是原始變數，事件與 keep snapshot 不需資料遷移。
- 舊 trace 缺少 `dataTransform`／`symbols` 時不啟用轉換；既有明確標籤與 Studio 樣式仍由原路徑處理。

## 驗證

- `node --check`：instrumenter、server、rules、renderer、directive assist。
- `tests/bits-eight-queens.test.js`：2/2 通過，包含實際編譯、153 個教學幀、17 個 styled keep 棋盤、L／M／R 只作用於目前列、實際 SVG 三幀依序累積 `↙`、`↙↓`、`↙↓↘`、nextL 同幀棋盤資料與方向符號更新、聯集與 P 顏色、lowbit 二維 highlight、headless browser SVG、全物件／箭頭／keep 棋盤 LOD、overview 背景與完整格線 path、detail host 卸載／還原，以及每條 recursion edge 的目標 outerframe 綁定。
- `tests/fibonacci-recursion-display.browser.test.js`：1/1 通過，確認 active keep 覆蓋不破壞 `display("F(${call})")`、回傳值替換、遞迴連線與相機穩定性；scalar cell 不啟用矩陣專用的延遲文字 LOD。
- `tests/camera-directives.test.js`：5/5 通過；涵蓋有效 focus 的目標中心與固定 zoom，以及目標不存在時安全退回 auto capture。
- `tests/entrypoints.test.js`、`tests/directive-assist.test.js`：4/4 通過；camera 及 directive assist cache 版本與載入順序正確。
- `tests/keep-directives.test.js`：17/17 通過；涵蓋舊 keep、`when`、位置、樣式相容性，以及多 preset／多 style 的 silent keep view。
- `tests/preset-directives.test.js`：12/12 通過；多 preset 合併與 runtime 依賴沒有回歸。
- `tests/scene-load-performance.browser.test.js`：1/1 通過，確認 3,000 格大型陣列／矩陣在 overview 使用 2 個隱藏 detail hosts 與 2 條完整 grid paths，拉近還原格子，並保持 viewport culling、縮圖 reuse 與文字節點池。
- `@code hide` 只保留 lowbit 到棋盤欄位的 `selected_column` 繪圖座標計算；八皇后專項確認該行不產生 runtime 事件。
- N=4：153 個正式幀、17 個遞迴樹棋盤節點與 16 條父子邊；只有一個根節點，根節點依四個合法首列位置分出四個子樹。棋盤 4×4、`♕`、皇后灰底、L／M／R 累積方向符號、聯集／P 遮罩、lowbit 選格、無 0/1 標籤與縮遠箭頭綁定均已驗證。

## 驗證分級與選擇

- 層級：V2。
- 分類：E（frame／renderer／camera）、G（keep／生命週期）、H（style）、I（程式碼呈現）、J（鏡頭一致性）。
- 選擇依據：修改 trace 指令解析、runtime options、keep 場景渲染與實際 SVG 節點生命週期。
- 隔離服務：本 worktree 的 `127.0.0.1:3398`，未操作 3000／3100／使用者分頁。
- 統合基準：已快轉至 `intergration` 的 `7aa1aa6`（公平編譯佇列與工作隔離）；相關新測試 17/17 通過。
- alpha 預覽：由本 worktree 提供 `127.0.0.1:3101`；renderer `trace-239`、rules `trace-32`，已重啟該 worktree 服務。
- 靜態驗證：所有修改 JS 的 `node --check` 與 `git diff --check` 通過。
- 未執行完整 regression：依 V2 分級只執行直接相關專項；需要主代理 V3 驗證：無。

## 舊有物件相容性

- 新建：`bits(board,N)`、`labels(none)`、`symbols("","♕")` 已實際編譯與渲染。
- 舊物件：沒有 `use`／`styleFrame` 的舊 keep 仍走既有來源 frame 與 renderer 路徑；17 個既有 keep 測試全部通過。
- 既有自訂值：原有 labels、Studio visibility／style、`without style` 與 active snapshot 不由新 silent view 覆蓋。
- 持久化：本功能欄位存在 trace 文件的既有 rendererOptions 中，無新增投影片 schema；不需資料遷移。

## 2026-10-04：八皇后 OR 範例來源補齊

### 複合位元事件中間值露出最終幀修正

- 本次核對磁碟範例仍為 `int P = L | M | R` 加上後續取反；已依使用者確認的需求實際恢復完整 `int P = ((1 << N) - 1) & ~(L | M | R);`，保留 Q/P 同幀結果與呼叫前退場。
- 原因為位元覆蓋層移除後，底下 bits 格子仍來自目的幀的最終值；後續子運算再建立中間值覆蓋層時會回跳。prepareForwardValues 現在依 checkpoint 重播整排 bits 文字／背景，支援 identity let alias、native bitset 和矩陣的位元列；不改普通 scalar animation。更新 LOD draw record，避免文字再載入時還原為未提交值。
- 只索引當前非 keep 的有變數視覺，避免為每個 value track 掃描整棵 retained tree；keep 不參與 runtime 中間值更新。無新增持久化欄位。
- V2／E、G、H、J。獨立 3197、headless Edge 實際 RUN，compound-bitwise-replay.integration.test.js 核對完整式、舊拆段式和 `P = x | y | z`；1x/2x 每 tick 的可見序列分別為單一 11111、00000→11111、00001→00011→00111，不能最終值出現後回到舊值。初始化完整式沒有中間運算幀，P 直接以唯一結果入場。
- 最終相關測試 compound-bitwise-replay、bitwise-commit-timing、bitwise、eight-queens-or-sample 共 6/6 通過、0 skip；另外只篩選 bit-shift 的 shifted paint 案例 1/1 通過。合計 7/7，包含 n=5 XOR、Q/P 的數值／顏色與呼叫前退場、native bitsets、scalar fallback、缺來源黃色、Studio 綠色、手動前後步／autoplay、舊 trace 載入保存重開與明確關閉，無 pageerror。
- JS 語法及 git diff --check 通過；未執行完整 regression，未操作使用者分頁。前端快取 trace-269；alpha 3101 核對 PID、來源後重啟。

### 恢復完整 P 計算式

- 使用者確認恢復 `int P = ((1 << N) - 1) & ~(L | M | R);`；取消獨立聯集幀，不改動畫引擎。保留一幀顯示 Q/P 最終可選位置，Q 紅格 0、綠格 1，以及 dfs 前 p/P 退場。
- V2／E、G、H、J：隔離 3197，bitwise-commit-timing.integration.test.js、eight-queens-or-sample.integration.test.js 共 3/3 通過、0 skip，實際 N=5 RUN、1x/2x 下一步、XOR 提交時序、Q/P 11100、紅綠底、每 activation 單一結果幀、呼叫前退場；N=4 既有 nextL/M/R OR 動画、Studio 綠色與舊 trace 保存重開均通過。
- 無新增持久化欄位；完整式不再產生獨立聯集 initializer commit，N=4 恢復 48 個 next-mask commit，對應精確斷言和 roundtrip 數量已更新。語法與差異檢查通過，無 pageerror，未跑完整 regression、未操作使用者分頁。3101 核對 PID 和來源後重啟。

### 單幀 L | M | R、Q/P 同步取反、呼叫前退場

- 依使用者最新要求，聯集使用單一 `int P = L | M | R` 敘述與單一教學幀，不拆成三幀。runtime 在該幀內依序播放 L/M 的 OR 和中間結果/R 的 OR，來源綁定當前 mask_L、mask_M、mask_R，結果綁定 P。
- `P = ((1 << N) - 1) & ~P` 後只留一個 Q/P 共用取反幀：Q 保留紅格但文字為 0，原白格改綠且為 1；P 同時更新為可選遮罩，0 白底、1 綠底。刪除後續 P 專用重複幀。
- dfs 呼叫前準備幀不使用 union_view 或 lowbit_view，p/P 在此退場；新 activation 入場仍不顯示 p/P，到聯集幀才顯示 P。
- V2／E、G、H、J；只修改範例與對應測試，不改儲存格式或動畫引擎。N=5 專項 bitwise-commit-timing.integration.test.js 2/2 通過：1x/2x 正常下一步、同一聯集幀兩段 OR 均有副本位移、dfs 前 p/P 不在場、Q/P 的 11100 與紅綠底正確、五個 n=1 activation 各只有一幀取反、XOR 完成前保持 11111。Q LOD 未載入文字時核對同一實際 SVG draw record 的 display value。
- eight-queens-or-sample.integration.test.js 1/1 通過：nextL/M/R 動畫、Studio 綠色與舊 trace 保存重開。N=4 新增 15 個非終止 activation 的聯集初始化 commit，加上原 48 個 next-mask commit 共 63 個；測試更新精確預期並保留 roundtrip 數量斷言。
- 合計相關案例 3/3、0 skip，無 pageerror；語法／差異檢查通過。測試隔離 3197，未操作使用者分頁、未跑完整 regression。3101 核對未占用後由此 worktree 重新啟動，HTTP 新範例及 /trace/analyze 已確認。

### p 再入場外框時序、P 階段顯示

- V2／E、G、H、J。獨立瀏覽器 N=5 確認原 p 外框與格子 opacity 同步；提前可見的是預 staging XOR 建立的 source flying copy，不是原始格子。
- bitwise effect staging 僅顯示目的地旧值，隱藏 incoming row，實際事件開始才顯示副本。普通 scalar 賦值及 shift 不變；無新增儲存欄位。
- 範例將 P 從 queen_scene_view 拆到 union_view；dfs 入場、L/M/R 分別展示與 next 遮罩傳播不顯示 P，Q 聯集／取反／候選／lowbit 與 next 聯集階段才顯示，子 activation 入場退場。
- 隔離 3197、N=5、實際 RUN 和 CodeScript.next 1x/2x：初次與根層回溯再入場 opacity 同步、incoming 不提前、P 顯示階段正確、XOR 完成前維持 11111。bitwise-commit-timing.integration.test.js、bitwise.integration.test.js、eight-queens-or-sample.integration.test.js 共 5/5 通過、0 skip；含 OR/XOR、手動前後步/autoplay、缺來源黃色、scalar fallback、舊 trace 保存重開和明確關閉。
- node --check 和 git diff --check 通過；無 pageerror，未操作使用者分頁，未跑完整 regression。前端快取 trace-268。

### n=5 第 3→4 幀 P 提前顯示修正

- 核對使用者附件與現行範例完全一致；本次不修改範例原始碼。
- staging 不再把 `read P` 誤認成先前寫入，確保目的幀的新值先被舊值遮住。
- 位元列運算統一以 520ms 動畫完成時點提交數字與 replay 狀態；只有實際位元列動畫使用此時序，一般數字賦值不變。
- 新增 bitwise-commit-timing.integration.test.js：實際 RUN、N=5、正常下一步 1x/2x，逐 tick 確認 XOR 結束前皆為 11111，結束後為 11110，無結果提前顯示或回跳。
- V2 隔離 3197：該測試、bitwise.integration.test.js、eight-queens-or-sample.integration.test.js 共 4/4 通過、0 skip；涵蓋 OR 與其他位元運算、缺來源黃色、普通數字 fallback、明確關閉與舊 trace 保存重開。語法與 git diff --check 通過，未跑完整 regression，未操作使用者分頁。
- 無新增持久化欄位；前端快取版本 trace-267。

### 簡化來源與抵達停留

#### 正常下一步補驗、p 持續顯示

- 使用者確認網址為 localhost:3101/algorithm.html。隔離測試進一步改為實際 Ace 編輯器輸入、點擊 RUN，使用前端 compile.js／TraceEditor 載入結果，再進行三種 OR 的 1x/2x 正常下一步播放。專項 1/1 通過，未重現消失；已請使用者提供當前 editor 原始碼、input 及出問題的幀號。未宣稱尚未重現的問題已修正。

- 將 lowbit_view 補到選格、右移和下一列遮罩合併幀，p 在同次候選嘗試的教學幀持續顯示，位置保持 L 上方；不把 p 加到 keep。
- 本輪未重現使用者所述動畫消失，未擅自更改動畫引擎。新增直接使用 CodeScript.next 的正常播放斷言：三種 OR 在 1x/2x 下確實產生飛行副本、實際位移、完成清理。N=4 隔離 3197 專項 1/1 通過、0 skip，Studio 綠色與既有停留、舊 trace 重開斷言亦通過。
- 已詢問使用者當前 URL／不同版本的編輯器原始碼，以便追查未重現的那一版。3101 前端 trace-266 核對後重啟；未操作使用者分頁。

- 刪除範例 `or_source`／original_mask；共用 `lowbit_view` 將 p 放在 L 上方，L 左移幀持續顯示 p。
- bitwisePlan 支援同一持續顯示列從 L/M/R 換成 nextL/nextM/nextR 的 identity alias：僅當上一幀有明確 renderer、非 capture-only，且來源與結果是同一 live element 才沿用上一幀綁定，不以數值相等猜測來源。
- 位元運算飛行副本抵達後保留 100ms，再淡出；使用原有 520ms 邏輯時間，在播放倍速下與其他動畫一致縮放。
- V2 3197 隔離驗證：eight-queens-or-sample.integration.test.js、bitwise.integration.test.js 共 3/3、0 skip，直接檢查 Studio 綠色、p 在左移幀的位置、抵達 99ms 仍完整顯示／101ms 才淡出、手動前後步與 1x/2x autoplay、缺來源仍黃色、舊 trace 保存重開與明確關閉保留。JS 語法與差異檢查通過。
- 無新儲存欄位，未跑廣泛回歸；alpha 3101 重啟，快取版本 trace-266。

### Studio 黃色事件補驗與修正

- 核對當前檔案時原始遮罩／p 的補齊指令已不在範例內，重新在目前版本加入共用 preset，保留其餘程式。
- 開啟實際 Studio 後，OR 可用時仍會有另一個 `nextL = L | p` 初始化 commit 黃色按鈕。新增 runtime `bitwiseCommit` metadata，只標記純 bitwise initializer 的不播放重複 commit；Studio 隱藏該內部紀錄，真正 OR 的 availability 仍依兩個來源與結果判斷，未強制染綠。
- V2 最小驗證：`eight-queens-or-sample.integration.test.js` 與 `bitwise-types.integration.test.js` 共 3/3 通過、0 skip。測試直接開 Studio，斷言三種 OR 所有對應事件按鈕為 is-available 且非黃色，驗證位移及清理；48 個初始化 commit 仍保留在 runtime，缺少新欄位的舊 trace 載入、儲存重開仍保留所有 commit；瀏覽器無 pageerror。
- JS 語法與差異檢查通過。未跑完整 regression；3101 原 PID 78476 與 alpha 範例來源核對後停止並重啟，3197 隔離測試服務停止。前端 trace-events 快取版本更新為 trace-61；需重新 RUN 產生新的 runtime metadata。

- 保留使用者最新範例的演算法、文字、樣式與 asm-view 開關；加入共用 `or_operands_view`，只在 `L | p`、`M | p`、`R | p` 幀顯示原始遮罩及 p 的位元列，讓來源和結果都能綁定。未修改事件引擎。
- V2／E、H、J：隔離服務 3197，以 N=4 編譯完整範例；只渲染三種 OR 的首個代表幀。`tests/eight-queens-or-sample.integration.test.js` 1/1 通過、0 skip：三者 availability、來源/結果綁定、移動效果與清理皆正確，瀏覽器無 pageerror。
- `node --check tests/eight-queens-or-sample.integration.test.js` 與 `git diff --check` 通過；未執行廣泛回歸或完整 Studio 驗收。
- 無新持久化欄位、不需資料遷移；保留貼上來源的 eventInstructionStates 和 eventSettings。測試未操作使用者分頁。
- 測試服務 3197 已停止。3101 核對為未占用後，從此 worktree 啟動 alpha 服務。

## 2026-10-04：使用者附件範例更新與分支推送

- 八皇后範例更新為附件 cb0a5521-7a34-48b2-bfc9-efd6419ca53c，正規化換行後逐字比對一致；保留使用者的設定、文字與朗讀標記。
- 本次附件更新僅調整教學文字（V0），未更動動畫引擎；git diff --check 通過，3101 /trace/analyze success=true，10 個靜態 frame directives，前端 trace-269。
- alpha 3101 已核對原服務並重啟；未操作使用者分頁或其他服務。本次推送沿用上述相關 V2 驗證證據，不重跑完整 regression。
- 依使用者「先幫我 push 這版」授權，提交目前八皇后開發分支的功能、修正、範例、相關測試與交付文件；不提交暫存產物、test-results 或 server log，不合併 main 或 intergration。
