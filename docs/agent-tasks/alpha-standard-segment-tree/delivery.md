# alpha-standard-segment-tree 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-21-alpha-standard-segment-tree
- 共同基準 commit：2cb0409d1fd430d1fabea1feb5885e908da02236
- 程式修正 commit：8ba0334cea3fea756f290b564290cb71c8a06c89、81a7237f5eb7f5abbba0e9cc5a253e4048e7d67c、15d2c91c2b1c9363c20656d2a7ee6d8a32e90f6c、cdf0e020f07de8b57800065b996910bbb3cbfacd、a7e859d15f7bbf79e5c6cdffff41daa222655c94、01a2d594c346639179f61a89fc4922ba2ac88702、7f55475475d932a5341fab50fddfa374afe9c0db、5efb734b7bef842eb8e764dc25d2645f70f85725、aeeee48dd49c8a6099535e807ce322ca9a46d291、3fab76fd8f68904a54dc462d951ebe25c5017800、98597b1466773a3d5de9f4c43083a5863c45e2e3、8ceb0774a98f863e901451265e2b11e166168bd7、6525d3a991abfc35e8de298c0955d0282565ca6d
- 驗證時的 HEAD 與未提交修改：6525d3a991abfc35e8de298c0955d0282565ca6d；程式驗證後只有交付文件修改
- 驗證日期：2026-09-22

## 根因與修改
- 已確認根因與證據：既有 heap／舊 segment-tree renderer 以完整二元樹層級與固定格寬定位，無法讓 n=10 的 3/2 子區間反映長度，也無法保留深度 3 與深度 4 葉節點的自然遞迴位置。n=11 第 55 幀的 trace 仍保存 `tree[6]=21`、`sets[6]=7`，靜態 render 顯示 `21,7`；從第 54 幀播放賦值動畫後只剩 `21`，證明動畫收尾誤將複合 `<text>` 容器整體覆寫。二元加法進入 value-only 搬移時又只傳入來源格元素，遺失 source target 的 variableId，因此無法選到 tree 對應的 `<tspan>`，會把 `5,=13`／`7,+3` 整串複製。
- 修正方式與行為變化：新增 `render segment_tree with range(start,end)`；range 同時指定資料區間，並以起點推導 tree 根索引；依標準中點拆分建立實際節點，水平寬度按區間長度，垂直位置按真實遞迴深度。最小 value 格固定 40×40px、index 格高 12px；新增 `gap(horizontal,vertical)`，單參數沿用雙軸，垂直 gap 為 0 時 heap／segment tree 不畫父子線。下方標籤將 tree index 平常置中、interval 靠右；碰撞時依 SVG 實測字寬將 index 向左避讓，空間仍不足才縮字，兩者垂直置中。葉節點 `[x,x]` 簡化為 `[x]`。value 一般使用一致的 16px，interval 比 index 小 2px。標準範例現支援區間 modify、set 與 query，並在同一 tree 格合併顯示 lazy/set 標記。賦值事件現在依 target variable 選取複合格內對應的 `<tspan>`，不再刪除同格其他欄位；二元加法的來源也保留各自 variableId，只建立 tree 數字的飛行文字。第一版 `format(...)` 在 renderer 與事件 replay 共用格式器；標準範例依語意顯示 set `=value` 與 modify 的帶號數值。每個格內 segment 另繪左右 1px 灰色虛線，邊界幾何與色塊的寬度補間、split 入場及退場同步。
- 修改檔案及用途：instrumenter/server 解析並解析 renderer 與 gap 選項；trace renderer 分派新排版、split 與格內 segment；各陣列 renderer 套用水平／垂直間距；入口快取及提示同步；手冊與專項測試補充幾何規則。
- README／版本紀錄／使用說明更新：README 與 `ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md` 已加入語法、排版規則與查詢 segment 範例。
- 與 task.md 的差異：無

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 由 range 解析資料區間與根索引 | parser、compile 與 browser 專項 | range(1,n) 使用 tree[1]；range(0,n-1) 使用 tree[0] 及 0-based 子節點 | 通過 |
| n=10 實際節點與比例寬度 | 無頭瀏覽器檢查 SVG 幾何 | 19 節點；gap 0 時根 400px；5/5 子樹各 200px；3/2/1 區間為 120/80/40px | 通過 |
| 自然遞迴深度、基本格與父子邊 | 無頭瀏覽器檢查 y、rect 與 edge metadata | value 格高 40px、index 高 12px；gap 0 不畫線；垂直 gap 24 時畫線且層距為 76px | 通過 |
| style、segment、split | 查詢 [3,8] 瀏覽器逐幀檢查 | gap 0 初始區段 240px；gap(10,24) 為 290px；split 集合與 after 正確 | 通過 |
| 其他 renderer 的 gap | 直接繪製並檢查 SVG 幾何 | normal 兩軸、heap／BIT 跨單位寬度、queue 水平、stack／disk 垂直均符合設定 | 通過 |
| value、index 與 interval 字體 | 無頭瀏覽器檢查文字內容、字級、anchor、座標與實測文字邊界 | 根與葉 value 均為 16px；index 使用 middle；interval 使用 end、距右側 3px且小 2px；葉節點顯示 `[x]`；n=10 的兩位數葉節點不重疊 | 通過 |
| 舊 heap 與範例相容 | 既有 parser、runtime、browser 專項 | fields/hide/segment 及三個既有線段樹範例均通過 | 通過 |
| 指定 n=15、7 操作輸入 | parser/runtime 與 browser 專項 | modify、set、query 均產生對應色彩 segment；lazy/set 欄位顯示非預設值；最後 query [8,9] 輸出 12 | 通過 |
| 兩位數葉節點標籤避讓與垂直置中 | n=15 實際 SVG `getBBox()` 與屬性檢查 | index 28/29 均觸發向左避讓；所有 index/interval 無重疊，y 位於 12px 框中心且使用 central baseline | 通過 |
| update 回朔與 query 累加 | n=15 parser/runtime 與實際 SVG 專項 | update 回朔幀顯示 child 相加寫回 parent；query 不建立 leftSum/rightSum/result，命中時直接執行 `sum += tree[now]` | 通過 |
| segment 收回與 sum 動畫 | n=15 trace descriptor 與逐 tick browser 專項 | modify/set 回朔及 query 命中分別保留紫、橘、綠 after segment；query 只搬移 tree 數字到 sum，sum 在數字到達前維持舊值 | 通過 |
| 動畫後保留複合欄位 | n=11 指定輸入播放第 54→55 幀 | 套用新格式後 `tree[6]` 完成動畫顯示 `21,=7`，tree 與 sets 欄位節點皆存在 | 通過 |
| 第一版 format 語法與執行期保存 | parser/runtime 專項 | 八種格式均解析；欄位名稱、precision 與 variableId 寫入 frame options；未知格式、欄位、重複欄位與 precision 11 均拒絕 | 通過 |
| 靜態與動畫格式一致 | browser 實際 SVG 與連續幀播放 | `signed`、`assign`、binary、hex、bool、fixed、percent 顯示正確；assign 動畫後為 `=9`，signed 動畫後為 `+5` | 通過 |
| 標準範例格式化 lazy/set | n=15 與 n=11 browser 專項 | lazy 顯示 `+...`，sets 顯示 `=...`；第 55 幀顯示 `21,=7` 且欄位仍存在 | 通過 |
| 複合 tree 格二元加法來源 | 最小 heap browser 動畫專項 | 來源格靜態顯示 `5,=13`／`7,+3`；飛行文字只出現 `5`、`7`，父節點完成為 12 | 通過 |
| segment 左右虛線 | heap segment SVG 與逐 tick 幾何專項 | 每個色塊有 left/right 兩條 `#6b7280`、1px、`3 3` 虛線；水平補間及 split 高度變化全程貼齊 | 通過 |

## 小驗證與重跑方式
### 新標準線段樹 parser、runtime 與實際 SVG
- 目的與對應條件：驗證新 range 語法、1-based／0-based 根索引、輸出、區間比例幾何、自然深度、父子邊與 split。
- 執行目錄與必要環境設定：`algo-vis-backend`；本輪隔離服務 `http://127.0.0.1:3199`，`ASM_REGRESSION=1`。
- 測試資料／fixture：`algorithm_sample/Tree/Segment_Tree_standard.cpp` 與指定的 n=15、7 操作 `Segment_Tree_standard-sample_input.txt`；browser 另保留 n=10 幾何 fixture。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/standard-segment-tree.test.js`；`node --test --test-concurrency=1 tests/standard-segment-tree.browser.test.js`。
- 預期結果：3 個 parser/runtime 案例及 1 個 browser 案例通過，無 skip。
- 實際結果與 exit code（適用時）：3199 及重啟後 3101 均為 3/3 pass、1/1 pass；exit code 0；無 skip。最後 query 輸出 12。
- 證據位置：測試檔與提交內 fixture；終端摘要未提交。

### 標準 query 單一 sum 累加
- 目的與對應條件：確認 query 命中時直接 `sum += tree[now]`，不再建立三個回朔暫存格，並保留正確輸出與綠色 after segment。
- 執行目錄與必要環境設定：`algo-vis-backend`；3101 後端 parser/runtime 與 localhost:32791 隔離瀏覽器服務。
- 測試資料／fixture：`Segment_Tree_standard.cpp`、指定 n=15 七項操作輸入，另由 n=10 browser 測試同輪載入正式操作 fixture。
- 完整指令或操作步驟：`ASM_TEST_BASE_URL=http://127.0.0.1:3101 node --test tests/standard-segment-tree.test.js`；`ASM_TEST_BASE_URL=http://127.0.0.1:32791 node --test --test-name-pattern="standard n=10 segment tree uses proportional intervals at natural recursion depths" tests/standard-segment-tree.browser.test.js`。
- 預期結果：parser/runtime 4/4 與 browser 1/1 通過；輸出 12；`+=` 搬移命中 tree 數字且 sum 在抵達前保留舊值。
- 實際結果與 exit code（適用時）：4/4、1/1 pass；exit code 0。第一次未指定 `ASM_TEST_BASE_URL` 誤連 main 3000，因舊 parser 不支援 format/gap 而失敗；指定 alpha 3101 後通過，不列為程式失敗。
- 證據位置：測試檔與終端摘要，未提交暫存產物。

### 舊 renderer 相容性
- 目的與對應條件：確認 `render heap`、舊 split 與既有線段樹範例沒有行為回歸。
- 執行目錄與必要環境設定：`algo-vis-backend`；同一隔離服務 3198。
- 測試資料／fixture：既有 heap composite 與 segment tree samples。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/heap-composite-segments.test.js`；`node --test --test-concurrency=1 tests/segment-tree-samples.test.js`；`node --test --test-concurrency=1 --test-name-pattern='heap fields and local segments|standalone segment tree query descends' tests/heap-composite-segments.browser.test.js`；`node --test --test-concurrency=1 tests/entrypoints.test.js`。
- 預期結果：選定案例全部執行並通過。
- 實際結果與 exit code（適用時）：3/3、3/3、2/2、1/1 pass；exit code 0；無 skip。
- 證據位置：終端摘要未提交。

### renderer gap 幾何
- 目的與對應條件：確認一般陣列、heap、BIT、queue、stack、disk 分別套用正確軸向，heap 的水平 span 與垂直連線條件正確。
- 執行目錄與必要環境設定：`algo-vis-backend`；隔離服務 `http://127.0.0.1:3198`，Playwright 無頭 Edge。
- 測試資料／fixture：測試內建立 3～7 格的最小 SVG 場景。
- 完整指令或操作步驟：`ASM_TEST_BASE_URL=http://127.0.0.1:3198 node --test --test-concurrency=1 tests/renderer-gaps.browser.test.js`。
- 預期結果：1/1 pass，無 skip。
- 實際結果與 exit code（適用時）：1/1 pass；exit code 0；無 skip。
- 證據位置：`tests/renderer-gaps.browser.test.js` 與終端摘要；未提交暫存產物。

### alpha 3101 預覽服務
- 目的與對應條件：確認推送後的 alpha 預覽實際載入新後端與前端，而非只更新磁碟上的靜態檔案。
- 執行目錄與必要環境設定：本 worktree `algo-vis-backend`；`PORT=3101`。
- 完整指令或操作步驟：核對 3101 舊 PID 46680 後只停止該服務並從本 worktree 重啟；確認 `algorithm.html` 載入 `trace-205` 與 `gap-1`；向 `/trace/analyze` 提交包含 `render segment_tree with range(1,n), gap(10,24)` 的最小程式；再以 `ASM_TEST_BASE_URL=http://127.0.0.1:3101` 重跑三個直接相關專項測試檔。
- 預期結果：HTTP 200；後端接受 range 與雙軸 gap；前端使用最新 cache key；專項測試全部通過。
- 實際結果與 exit code（適用時）：gap 更新後 PID 9044；標籤排版更新後 PID 69684；字體更新後 PID 61468；指定操作範例更新後 PID 9956；標籤避讓更新後 PID 63888；回朔加法幀更新後 PID 59676；回朔 split after 更新後 PID 59292；複合欄位動畫修正後 PID 49992；format 更新後 PID 52864；二元加法欄位與 segment 邊界更新後 PID 23232；標準 query sum 範例更新後 PID 36992。最新 `algorithm.html` 載入 `trace-225`、`trace-207`、`directive-20`；3101 上的標準 n=15 parser/runtime 專項 1/1 pass；exit code 0。
- 證據位置：本機 3101 服務與終端摘要，未提交 server log。

## 驗證分級與選擇
- 層級：V2
- 分類：E（指令／frame／位置）、H（style／分層／標籤）
- 選擇依據：修改 renderer 選項解析、SVG 幾何、格內 segment 與 split 路徑。
- 執行的測試檔／名稱篩選：`standard-segment-tree.test.js`、`standard-segment-tree.browser.test.js`、`renderer-gaps.browser.test.js`、`entrypoints.test.js`、`directive-assist.test.js`、`frame-renderer-options.integration.test.js`、`heap-composite-segments.test.js`、`segment-tree-samples.test.js`，以及 heap composite browser 的兩個直接相關案例。
- 驗證環境與隔離服務：本分支 worktree、localhost:3198／3199 隔離服務、重啟後的 alpha localhost:3101、Playwright 無頭 Edge；未操作使用者分頁或投影片。
- 驗證版本、完整指令、結果與證據：程式 commit 6525d3a991abfc35e8de298c0955d0282565ca6d；先前 3199 的 parser／runtime／入口／提示 8/8、標準線段樹 browser 3/3、binary addition browser 1/1、舊 segment tree samples 3/3、heap composite 直接相關 browser 1/1 通過。本次 query sum 調整後，alpha 3101 parser/runtime 4/4、32791 標準 browser 1/1、重啟後 3101 的 n=15 專項 1/1 通過。3101 現為 PID 36992。
- 未執行的驗證及原因：依分級未執行完整 regression、全部 tests 或廣泛演算法動畫驗證。
- 需要主代理做的 V3 驗證：整合後以 n=10 幾何 fixture 核對比例寬度與自然深度，再以指定 n=15、7 操作範例核對 modify／set／query segment、複合欄位及最後答案 12。

## 剩餘事項與合併注意
- 未驗證項目及原因：未做完整跨介面／全演算法回歸，依分工由主代理決定。
- 已知問題或風險：無。
- 相依與衝突注意：入口快取版本與 `trace-renderer` build 必須一併合併。
- 主代理需補驗證的情境：n=10 幾何 fixture 與指定 n=15 操作序列，確認 segment 在下降與 after 幀的視覺連續性，並確認 set／modify 標記分別顯示為 `=value`／帶號數值。
- 後續優化候選（本次未實作）：`format(field=map(...))` 將 sentinel／enum 映射為 `∞` 或狀態文字；自訂 `prefix(...)`／`suffix(...)` 顯示單位或欄位名稱。待實際案例提出時再決定語法與跳脫規則。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
