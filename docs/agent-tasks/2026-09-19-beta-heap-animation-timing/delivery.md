# 2026-09-19-beta-heap-animation-timing 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-beta
- 共同基準 commit：fa278c87b3d7fedef11b0b2af4f3fc8b3a0994e4
- 程式修正 commit：554dadc83315a467ab933958e60bdc0aa653f14f、8f15971ecab4c2a42b267ffb16d686fe30ba6973
- 驗證時的 HEAD 與未提交修改：HEAD 8f15971ecab4c2a42b267ffb16d686fe30ba6973；僅本交付文件更新尚未提交
- 驗證日期：2026-09-19

## 根因與修改
- 已確認根因與證據：目標幀先建立最終 heap SVG；第一次修正把 cell 寬度綁到 sequence slot，卻以目標中心插值，導致左緣向左移、寬度向兩側展開。舊 lifetime 賦值框以綁定 cell 頂緣定位，會與該 cell 上方的新 `now` 指標重疊。一般 style highlight 與比較動畫使用不同路徑，可分別保留 value＋index 與 value-only 契約。
- 修正方式與行為變化：sequence resize 以目標左緣為固定局部座標，讓容器位移帶著 cell 左緣跟 outerframe 同步，而寬度向右展開；舊 lifetime 賦值框依完整 marker 高度上移；一般 highlight 恢復包含 index，比較動畫維持只框 value。
- 修改檔案及用途：`trace-frame-tween.js` 處理左緣錨定 resize、marker lifetime 與賦值框位置；`trace-renderer.js` 與四個 array draw renderer 恢復一般 highlight 的 index 高度；兩個測試檔固定 resize 與兩類 highlight 契約。
- README／版本紀錄／使用說明更新：不適用；修正既有動畫行為，無新增使用者語法。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| heap resize 時機與方向 | 隔離瀏覽器播放 3→4 個節點的跨層插入 | sequence 前 cell 左緣 1048.40px、outerframe 左緣 1041.04px；擴張全程兩者左緣固定，cell 寬度由 81.60px 向右增至 147.20px | 通過 |
| 一般與比較 highlight | 單元測試加實際 heap SVG | 一般 heap highlight 高 52px（40＋12）；單元測試確認 compare 30px、style 48px | 通過 |
| marker lifetime 與路徑 | 隔離瀏覽器播放第 4→5 幀並記錄座標 | 賦值框底緣 456.73px，可見 `now` 頂緣 462.25px，兩者無重疊；lifetime 專項測試通過 | 通過 |
| 相關既有行為 | resize/style、lifetime 與 sequence 專項測試 | 11 通過、0 失敗、0 skipped | 通過 |

## 小驗證與重跑方式
### V2 專項 Node 測試
- 目的與對應條件：marker lifetime、sequence、outerframe resize 與 style highlight 契約。
- 執行目錄與必要環境設定：`algo-vis-backend`；既有 beta 服務 `http://127.0.0.1:3102`。
- 測試資料／fixture：測試檔內 fixture 與既有 compile helper。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/outerframe-tween.test.js tests/style-layer.test.js`；`node --test --test-concurrency=1 --test-name-pattern="same-name markers only receive events during their own runtime lifetime" tests/heap-marker-assignment.integration.test.js`；`node --test --test-concurrency=1 tests/sequence-operations.integration.test.js`
- 預期結果：直接相關案例全部通過，無 skip。
- 實際結果與 exit code（適用時）：合計 11 pass、0 fail、0 skipped；各指令 exit code 0。第一次合併執行曾因服務回覆「請求過於頻繁」得到 18 pass、11 環境失敗；分組重跑相關案例後全部通過。
- 證據位置：本次終端輸出；未提交測試 log。

### Heap 第 4→5 幀與跨層插入瀏覽器重現
- 目的與對應條件：核實賦值框、`now` 進場／平移、heap resize 時機與 highlight 高度。
- 執行目錄與必要環境設定：beta worktree 的 `algo-vis-backend`；既有服務 `http://127.0.0.1:3102`；headless Edge。
- 測試資料／fixture：`algorithm_sample/Tree/heap.cpp` 與 `heap-sample_input.txt`。
- 完整指令或操作步驟：編譯範例，分別播放第 4→5 幀及 3→4 節點的跨層插入，使用 trace debug recorder 擷取事件前後的 SVG screen bounds；另讀取 highlight SVG height。
- 預期結果：sequence 前不擴寬；擴張向右；一般 highlight 52px；compare 只框 value；舊、新 `now` 各自依有效 lifetime 定位，賦值框不壓住指標。
- 實際結果與 exit code（適用時）：全部符合；瀏覽器腳本 exit code 0。
- 證據位置：本機忽略檔 `algo-vis-backend/tmp/corrected-transition.json` 及同目錄的 browser check 腳本輸出，不納入提交。

## 驗證分級與選擇
- 層級：V2。
- 分類：F、G、H。
- 選擇依據：修改 sequence runtime、marker lifetime、style layer 與實際 SVG 幾何。
- 執行的測試檔／名稱篩選：outerframe/style 完整檔、sequence 完整檔、heap marker lifetime 名稱篩選。
- 驗證環境與隔離服務：beta worktree、3102、獨立 headless Edge。
- 驗證版本、完整指令、結果與證據：程式內容對應 8f15971ecab4c2a42b267ffb16d686fe30ba6973；結果如上。
- 未執行的驗證及原因：依使用者指示及分級規則，未執行完整 regression、全部 tests 或廣泛排序整合。
- 需要主代理做的 V3 驗證：無；整合時重看 heap 第 4→5 幀與跨層插入即可。

## 剩餘事項與合併注意
- 未驗證項目及原因：未驗證所有 array layout 的實際瀏覽器畫面；共用 style layer 契約已有單元測試，heap 已做實際畫面。未重啟 3102，因服務直接提供 worktree 靜態檔且本輪未能安全核對其 PID 來源。
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
