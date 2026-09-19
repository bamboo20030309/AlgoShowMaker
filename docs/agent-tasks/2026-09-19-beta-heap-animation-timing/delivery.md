# 2026-09-19-beta-heap-animation-timing 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-beta
- 共同基準 commit：fa278c87b3d7fedef11b0b2af4f3fc8b3a0994e4
- 程式修正 commit：554dadc83315a467ab933958e60bdc0aa653f14f、8f15971ecab4c2a42b267ffb16d686fe30ba6973、8e32ac867b14cea6d8b17862effd3641f48886d5、7bb6ee1806f5cc0673dad25cc6326047de3e1f47、c6bd42abf235392f42d39cbb95369b33960469f9、0d1a9ebdd03ac85b1d94955c82bc20cf42aa9467
- 驗證時的 HEAD 與未提交修改：HEAD 0d1a9ebdd03ac85b1d94955c82bc20cf42aa9467；僅本交付文件更新尚未提交
- 驗證日期：2026-09-20

## 根因與修改
- 已確認根因與證據：目標幀先建立最終 heap SVG；第一次修正只把 rect 寬度綁到 sequence slot，text 仍立即採用目標中心，index entry 也因鎖定目標位置而提早跳位。同名 `now` 的舊 lifetime 在事件執行時已是 detached clone，無法使用 CTM；先前以完整 marker 高度再加 6px 重建位置，重複計入標籤與箭頭高度，因而偏高。一般 style highlight 與比較動畫使用不同路徑，可分別保留 value＋index 與 value-only 契約。第 13→14 幀原本只用剩餘 marker 的前一個 target 判斷退場 reflow；`now` 已由第 6 格移入舊 `parent` 所在的第 3 格，因而沒有為仍可見的 `parent` 保留空間。跨層內縮時，子格的 geometry/motion 已等待 sequence slot，但 top-level heap 容器仍在 frame transition 起點開始移動，讓所有子格隨父層提早位移。
- 修正方式與行為變化：sequence resize 以目標左緣為固定局部座標，讓容器位移帶著 cell 左緣跟 outerframe 同步；value/index 的 rect 寬度、文字中心與字級由同一進度更新，resize 中的 index entry 也使用與 value 相同的相對位移。現在 top-level heap 容器與子格共用 sequence motion slot，內縮與擴展都會在 outerframe resize 開始時一起移動。舊 lifetime 賦值框改用標籤框既有的 `y=-40` 相對錨點；一般 highlight 恢復包含 index，比較動畫維持只框 value。退場排程同時檢查剩餘 marker 的前一與目前 target，讓移入同格的 `now` 先落在讓位位置；scope exit 開始時，舊 `parent` 淡出／上移並讓 `now` 同步回填中央。
- 修改檔案及用途：`trace-frame-tween.js` 處理完整 cell resize、marker lifetime 與賦值框位置；`trace-renderer.js` 與四個 array draw renderer 恢復一般 highlight 的 index 高度；`outerframe-tween.test.js` 固定框與文字同步契約，`style-layer.test.js` 固定兩類 highlight 契約。
- README／版本紀錄／使用說明更新：不適用；修正既有動畫行為，無新增使用者語法。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| heap resize 時機與完整格子 | 隔離瀏覽器播放 3→4 個節點的跨層插入 | sequence 前 root value/index 寬度均維持 80、文字中心維持 x=48；右側既有 value/index 同為 `translate(-40)` 且文字維持舊中心。outerframe 開始擴張後，rect、index 與文字才同步移向最終幾何 | 通過 |
| 一般與比較 highlight | 單元測試加實際 heap SVG | 一般 heap highlight 高 52px（40＋12）；單元測試確認 compare 30px、style 48px | 通過 |
| marker lifetime 與路徑 | 隔離瀏覽器播放第 4→5 幀並記錄標籤與賦值框邊界 | 賦值框底緣與對應可見 `now` 標籤頂緣皆為 462.25px；不再使用額外間距近似。lifetime／anchor 專項測試通過 | 通過 |
| scope exit 前後的同格讓位 | 隔離瀏覽器播放第 13→14 幀，擷取 `now`、舊 `parent` 與退場 wrapper 幾何 | 退場前 `now` 與舊 `parent` 標籤間距約 7.36px；退場開始後 wrapper opacity 由 1 降低並上移，`now` 同時回到中央 | 通過 |
| heap 跨層內縮時序 | 隔離瀏覽器播放 8→7 個可見節點的 `pop_back`，逐 50ms 擷取 outerframe、value/index 格與文字 | sequence resize 前所有幾何保持不變；outerframe、value、index 與文字在同一個 455.28ms 取樣點開始變化，並一起抵達新幾何 | 通過 |
| 相關既有行為 | resize/style、index label、lifetime 與 sequence 專項測試 | 13 通過、0 失敗、0 skipped | 通過 |

## 小驗證與重跑方式
### V2 專項 Node 測試
- 目的與對應條件：marker lifetime、sequence、outerframe resize 與 style highlight 契約。
- 執行目錄與必要環境設定：`algo-vis-backend`；既有 beta 服務 `http://127.0.0.1:3102`。
- 測試資料／fixture：測試檔內 fixture 與既有 compile helper。
- 完整指令或操作步驟：`node --test --test-concurrency=1 tests/outerframe-tween.test.js tests/style-layer.test.js`；`node --test --test-concurrency=1 tests/index-label-growth.test.js tests/sequence-operations.integration.test.js`；`node --test --test-concurrency=1 --test-name-pattern="same-name markers only receive events during their own runtime lifetime" tests/heap-marker-assignment.integration.test.js`
- 預期結果：直接相關案例全部通過，無 skip。
- 實際結果與 exit code（適用時）：原專項合計 13 pass、0 fail、0 skipped；內縮修正後追加重跑 outerframe／sequence 7 pass 與 heap lifetime 1 pass，全部 exit code 0。第一次合併執行曾因服務回覆「請求過於頻繁」得到 18 pass、11 環境失敗；分組重跑相關案例後全部通過。
- 證據位置：本次終端輸出；未提交測試 log。

### Heap 第 4→5 幀與跨層插入瀏覽器重現
- 目的與對應條件：核實賦值框、`now` 進場／平移、heap resize 時機與 highlight 高度。
- 執行目錄與必要環境設定：beta worktree 的 `algo-vis-backend`；既有服務 `http://127.0.0.1:3102`；headless Edge。
- 測試資料／fixture：`algorithm_sample/Tree/heap.cpp` 與 `heap-sample_input.txt`。
- 完整指令或操作步驟：編譯範例，分別播放第 4→5 幀及 3→4 節點的跨層插入，使用 trace debug recorder 擷取事件前後的 SVG screen bounds；另讀取 highlight SVG height。
- 預期結果：sequence 前 value/index rect 與文字均維持舊幾何；outerframe 擴張時完整格子同步向右；一般 highlight 52px；compare 只框 value；舊、新 `now` 各自依有效 lifetime 定位，賦值框不壓住指標。
- 實際結果與 exit code（適用時）：全部符合；瀏覽器腳本 exit code 0。
- 證據位置：本機忽略檔 `algo-vis-backend/tmp/heap-cell-growth-after.json`、`heap-outer-growth-after.json`、`corrected-transition.json`，不納入提交。

### Heap 第 13→14 幀 marker 退場與回填
- 目的與對應條件：核實即將退場的舊 `parent` 在真正退場前仍保留空間，並與 `now` 回填同步動畫。
- 執行目錄與必要環境設定：`algo-vis-backend`；既有 beta 服務 `http://127.0.0.1:3102`；獨立 headless Edge。
- 測試資料／fixture：`algorithm_sample/Tree/heap.cpp` 與 `heap-sample_input.txt`。
- 完整指令或操作步驟：播放第 13→14 幀，在賦值完成、scope exit 前、scope exit 中段與結束擷取兩個 marker 的 screen bounds、退場 wrapper transform 與 opacity；另執行 `node --test --test-concurrency=1 tests/unresolved-markers.test.js` 及 heap marker lifetime 名稱篩選測試。
- 預期結果：scope exit 前兩個標籤不重疊；scope exit 開始時舊 `parent` 淡出／上移，`now` 同時回填。
- 實際結果與 exit code（適用時）：賦值完成及退場前兩個定點的標籤間距約 7.36px；退場中段 wrapper opacity 已降至約 0.115 且上移約 14.16px，`now` 同時接近中央；結束時 wrapper opacity 為 0、`now` 位於中央。JS 語法、52 個 marker 單元案例與 1 個 heap lifetime 整合案例全部通過，exit code 0。
- 證據位置：本次終端輸出與本機忽略檔 `algo-vis-backend/tmp/heap-exit-reflow.cjs`，不納入提交。

### Heap 跨層內縮瀏覽器重現
- 目的與對應條件：核實 `pop_back` 造成層級寬度下降時，剩餘格子不會早於 outerframe 移動。
- 執行目錄與必要環境設定：`algo-vis-backend`；既有 beta 服務 `http://127.0.0.1:3102`；獨立 headless Edge。
- 測試資料／fixture：`algorithm_sample/Tree/heap.cpp` 與 `heap-sample_input.txt`，播放 frame 57→58 的 8→7 個可見節點內縮。
- 完整指令或操作步驟：以 50ms 間隔擷取 outerframe、7 個剩餘 value/index 格與文字的 screen bounds；斷言 sequence resize 前位置誤差小於 0.2px，並比較四類元素首次變化時間。另重播跨層擴展。
- 預期結果：resize 前所有元素保持原位；resize 開始後 outerframe、value、index 與文字同步移動；既有擴展行為保持正常。
- 實際結果與 exit code（適用時）：resize 前所有斷言通過；四類元素皆在同一個 455.28ms 取樣點開始變化，腳本 exit code 0。跨層擴展重播 exit code 0。
- 證據位置：本次終端輸出與本機忽略檔 `algo-vis-backend/tmp/heap-shrink-after.json`、`heap-outer-growth-after-shrink-fix.json`，不納入提交。

## 驗證分級與選擇
- 層級：V2。
- 分類：F、G、H。
- 選擇依據：修改 sequence runtime、marker lifetime、style layer 與實際 SVG 幾何。
- 執行的測試檔／名稱篩選：outerframe/style/index-label/sequence 完整檔、heap marker lifetime 名稱篩選。
- 驗證環境與隔離服務：beta worktree、3102、獨立 headless Edge。
- 驗證版本、完整指令、結果與證據：程式內容對應 0d1a9ebdd03ac85b1d94955c82bc20cf42aa9467；結果如上。
- 未執行的驗證及原因：依使用者指示及分級規則，未執行完整 regression、全部 tests 或廣泛排序整合。
- 需要主代理做的 V3 驗證：無；整合時重看 heap 第 4→5 幀、跨層擴展／內縮與第 13→14 幀 scope exit 即可。

## 剩餘事項與合併注意
- 未驗證項目及原因：未驗證所有 array layout 的實際瀏覽器畫面；共用 style layer 契約已有單元測試，heap 已做實際畫面。未重啟 3102，因服務直接提供 worktree 靜態檔且本輪未能安全核對其 PID 來源。
- 已知問題或風險：共用 `trace-frame-tween.js` 與 `trace-renderer.js` 可能和其他代理修改重疊。
- 相依與衝突注意：`trace-frame-tween.js` 為共用動畫 runtime，主代理合併時需留意同檔變更。
- 主代理需補驗證的情境：heap 跨層擴展、內縮與第 13→14 幀 scope exit 整合畫面。

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
