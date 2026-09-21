# alpha-standard-segment-tree 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-21-alpha-standard-segment-tree
- 共同基準 commit：2cb0409d1fd430d1fabea1feb5885e908da02236
- 程式修正 commit：8ba0334cea3fea756f290b564290cb71c8a06c89
- 驗證時的 HEAD 與未提交修改：8ba0334cea3fea756f290b564290cb71c8a06c89；程式驗證時無未提交程式修改
- 驗證日期：2026-09-21

## 根因與修改
- 已確認根因與證據：既有 heap／舊 segment-tree renderer 以完整二元樹層級與固定格寬定位，無法讓 n=10 的 3/2 子區間反映長度，也無法保留深度 3 與深度 4 葉節點的自然遞迴位置。
- 修正方式與行為變化：新增 `render segment_tree with domain(start,end)`；依標準中點拆分建立實際節點，水平寬度按區間長度，垂直位置按真實遞迴深度；支援 `root`、`unit`、既有 style、格內 segment 與 split。
- 修改檔案及用途：instrumenter/server 解析並解析 renderer 選項；trace renderer 分派新排版與 split；draw renderer 繪製節點、區間標籤與父子邊；入口快取及提示同步；新增標準範例、手冊與專項測試。
- README／版本紀錄／使用說明更新：README 與 `ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md` 已加入語法、排版規則與查詢 segment 範例。
- 與 task.md 的差異：無

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 解析 domain/root/unit | parser 與 compile 專項 | domain=[1,10]、root=1、unit=48 | 通過 |
| n=10 實際節點與比例寬度 | 無頭瀏覽器檢查 SVG 幾何 | 19 節點；根 480px；5/5 子樹各 240px；3/2/1 區間為 144/96/48px | 通過 |
| 自然遞迴深度與父子邊 | 無頭瀏覽器檢查 y 與 edge metadata | tree[9] 在深度 3，tree[16] 在深度 4；父子邊存在 | 通過 |
| style、segment、split | 查詢 [3,8] 瀏覽器逐幀檢查 | 初始區段 288px；split 集合包含 [2,3]、[3,5,9]，after 為 [3,5] | 通過 |
| 舊 heap 與範例相容 | 既有 parser、runtime、browser 專項 | fields/hide/segment 及三個既有線段樹範例均通過 | 通過 |

## 小驗證與重跑方式
### 新標準線段樹 parser、runtime 與實際 SVG
- 目的與對應條件：驗證新語法、執行期 domain、輸出、區間比例幾何、自然深度、父子邊與 split。
- 執行目錄與必要環境設定：`algo-vis-backend`；隔離服務 `http://127.0.0.1:3198`，`ASM_REGRESSION=1`。
- 測試資料／fixture：`algorithm_sample/Tree/Segment_Tree_standard.cpp` 與 `Segment_Tree_standard-sample_input.txt`。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/standard-segment-tree.test.js`；`node --test --test-concurrency=1 tests/standard-segment-tree.browser.test.js`。
- 預期結果：2 個 parser/runtime 案例及 1 個 browser 案例通過，無 skip。
- 實際結果與 exit code（適用時）：2/2 pass、1/1 pass；exit code 0；無 skip。
- 證據位置：測試檔與提交內 fixture；終端摘要未提交。

### 舊 renderer 相容性
- 目的與對應條件：確認 `render heap`、舊 split 與既有線段樹範例沒有行為回歸。
- 執行目錄與必要環境設定：`algo-vis-backend`；同一隔離服務 3198。
- 測試資料／fixture：既有 heap composite 與 segment tree samples。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/heap-composite-segments.test.js`；`node --test --test-concurrency=1 tests/segment-tree-samples.test.js`；`node --test --test-concurrency=1 --test-name-pattern='heap fields and local segments|standalone segment tree query descends' tests/heap-composite-segments.browser.test.js`；`node --test --test-concurrency=1 tests/entrypoints.test.js`。
- 預期結果：選定案例全部執行並通過。
- 實際結果與 exit code（適用時）：3/3、3/3、2/2、1/1 pass；exit code 0；無 skip。
- 證據位置：終端摘要未提交。

## 驗證分級與選擇
- 層級：V2
- 分類：E（指令／frame／位置）、H（style／分層／標籤）
- 選擇依據：修改 renderer 選項解析、SVG 幾何、格內 segment 與 split 路徑。
- 執行的測試檔／名稱篩選：見上方兩組小驗證。
- 驗證環境與隔離服務：本分支 worktree、localhost:3198、Playwright 無頭 Edge；未操作使用者分頁或投影片。
- 驗證版本、完整指令、結果與證據：程式 commit 8ba0334cea3fea756f290b564290cb71c8a06c89；全部選定案例通過。
- 未執行的驗證及原因：依分級未執行完整 regression、全部 tests 或廣泛演算法動畫驗證。
- 需要主代理做的 V3 驗證：整合後實際開啟標準 n=10 範例，核對編輯器、Studio、投影片介面的比例寬度、自然深度及查詢 segment 動畫。

## 剩餘事項與合併注意
- 未驗證項目及原因：未做完整跨介面／全演算法回歸，依分工由主代理決定。
- 已知問題或風險：新 renderer 目前以單一 `tree` 欄位為主；標準 lazy tree 若要合併多欄位，需後續將既有 `fields/hide` 契約延伸到此 renderer。
- 相依與衝突注意：入口快取版本與 `trace-renderer` build 必須一併合併。
- 主代理需補驗證的情境：n=10 及至少一個奇數長度查詢，確認 segment 在下降與 after 幀的視覺連續性。

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
