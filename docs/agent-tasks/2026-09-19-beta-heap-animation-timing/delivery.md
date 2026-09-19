# 2026-09-19-beta-heap-animation-timing 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-beta
- 共同基準 commit：fa278c87b3d7fedef11b0b2af4f3fc8b3a0994e4
- 程式修正 commit：554dadc83315a467ab933958e60bdc0aa653f14f
- 驗證時的 HEAD 與未提交修改：驗證內容與 554dadc83315a467ab933958e60bdc0aa653f14f 相同；當時僅任務文件尚未提交
- 驗證日期：2026-09-19

## 根因與修改
- 已確認根因與證據：目標幀先建立最終 heap SVG，原邏輯只把 outerframe resize 綁到 sequence slot，既有 cell 的位置與寬度仍提早採用目標幀幾何。無 lifetime 的舊 `now` assignment 又會按相同 variable id 命中同幀稍後宣告的新 lifetime。style layer 則明確將 index 高度加回 highlight。
- 修正方式與行為變化：heap 既有 cell 的 motion 與矩形寬度改由同一 sequence slot 驅動；marker 依 declare／scope-exit 的事件順序判定當下有效 lifetime，前一幀 marker 的賦值框以其綁定 cell 定位；highlight 僅包住值格。
- 修改檔案及用途：`trace-frame-tween.js` 處理 sequence 幾何與 marker lifetime；`trace-renderer.js` 統一值格 highlight；四個 array draw renderer 移除 index 高度；三個測試檔補上對應契約。
- README／版本紀錄／使用說明更新：不適用；修正既有動畫行為，無新增使用者語法。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| heap resize 時機 | 隔離瀏覽器播放 3→4 個節點的跨層插入 | sequence 視覺開始前根格寬 74px，完成後 147px；新格於 sequence 才進場 | 通過 |
| highlight 不含 index | 隔離瀏覽器查詢 heap highlight SVG | 三個實際 highlight 高度均為 40px | 通過 |
| marker lifetime 與路徑 | 隔離瀏覽器播放第 4→5 幀並記錄座標 | 舊賦值框位於 446,331；新 `now` 宣告 x 固定 451，初始化移動 y 固定 311 | 通過 |
| 相關既有行為 | 四個直接相關 Node 測試檔 | 29 通過、0 失敗、0 skipped | 通過 |

## 小驗證與重跑方式
### V2 專項 Node 測試
- 目的與對應條件：marker lifetime、sequence、outerframe resize 與 style highlight 契約。
- 執行目錄與必要環境設定：`algo-vis-backend`；`ASM_TEST_BASE_URL=http://127.0.0.1:32382`。
- 測試資料／fixture：測試檔內 fixture 與既有 compile helper。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/heap-marker-assignment.integration.test.js tests/outerframe-tween.test.js tests/sequence-operations.integration.test.js tests/style-layer.test.js`
- 預期結果：直接相關案例全部通過，無 skip。
- 實際結果與 exit code（適用時）：29 pass、0 fail、0 skipped；exit code 0。
- 證據位置：本次終端輸出；未提交測試 log。

### Heap 第 4→5 幀與跨層插入瀏覽器重現
- 目的與對應條件：核實賦值框、`now` 進場／平移、heap resize 時機與 highlight 高度。
- 執行目錄與必要環境設定：beta worktree 的 `algo-vis-backend`；隔離服務 `http://127.0.0.1:32382`；headless Edge。
- 測試資料／fixture：`algorithm_sample/Tree/heap.cpp` 與 `heap-sample_input.txt`。
- 完整指令或操作步驟：編譯範例，分別播放第 4→5 幀及 3→4 節點的跨層插入，使用 trace debug recorder 擷取事件前後的 SVG screen bounds；另讀取 highlight SVG height。
- 預期結果：sequence 前不擴寬；highlight 40px；舊、新 `now` 各自依有效 lifetime 定位。
- 實際結果與 exit code（適用時）：全部符合；三次瀏覽器腳本 exit code 0。
- 證據位置：本機忽略檔 `algo-vis-backend/tmp/final-transition.json`、`final-growth.json`、`final-highlight.json`，不納入提交。

## 驗證分級與選擇
- 層級：V2。
- 分類：F、G、H。
- 選擇依據：修改 sequence runtime、marker lifetime、style layer 與實際 SVG 幾何。
- 執行的測試檔／名稱篩選：上述四個完整專項檔，未使用名稱篩選。
- 驗證環境與隔離服務：beta worktree、32382、獨立 headless Edge。
- 驗證版本、完整指令、結果與證據：程式內容對應 554dadc83315a467ab933958e60bdc0aa653f14f；結果如上。
- 未執行的驗證及原因：依使用者指示及分級規則，未執行完整 regression、全部 tests 或廣泛排序整合。
- 需要主代理做的 V3 驗證：無；整合時重看 heap 第 4→5 幀與跨層插入即可。

## 剩餘事項與合併注意
- 未驗證項目及原因：未驗證所有 array layout 的實際瀏覽器畫面；共用 style layer 契約已有單元測試，heap 已做實際畫面。
- 已知問題或風險：共用 `trace-frame-tween.js` 與 `trace-renderer.js` 可能和其他代理修改重疊。
- 相依與衝突注意：`trace-frame-tween.js` 為共用動畫 runtime，主代理合併時需留意同檔變更。
- 主代理需補驗證的情境：heap 跨層插入整合畫面。

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
