# 2026-09-21-beta-BIT 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-21-beta-BIT
- 共同基準 commit：2cb0409d1fd430d1fabea1feb5885e908da02236
- 程式修正 commit：`5b5ad128c97cc6651c8229cd41a63ddfd52de704`、`0fd7da94fe675efc311327e6cf83a7d34480a924`、`7e0ac3e57a7bd0faa07a6fd44a7fe9e4a99decde`、`80c3d15ae893f59ff7e7f94efda9459100e4d1e8`、`399071d5125999b932aacf5a30ce572cb18b9e83`、`93b5a32d2fe6aa732579b4c74600802586d985b1`、`1d83fa39e8d5ad4028a0c83a3f50188abb658a4e`、`de9ebaca102e2618bd013a2dc1b2ef3fb5749337`、`a69a43f837508d64b7c9c1a79b3789d83c8a0a87`、`33a56ff3c2ec4d907f21ddfb406dbf2ccd9ab8b4`
- 驗證時的 HEAD 與未提交修改：`33a56ff3c2ec4d907f21ddfb406dbf2ccd9ab8b4`；只有本任務 task／delivery 文件待提交
- 驗證日期：2026-09-21

## 根因與修改
- 已確認根因與證據：指令 tokenizer、parser 與瀏覽器 runtime evaluator 原先只支援算術、比較及邏輯運算，無法處理 `& | ^ ~ << >>`；舊範例依賴 `AV.hpp` 與手寫繪圖程式；marker position 分類只接受 `write + update`，漏掉 `write + compound`，因此 `i += lb` 直接以新狀態重建。
- 修正方式與行為變化：新增 C++ 優先序的整數位元運算解析與求值，讓安全的位元索引可保存實際索引；新增 `render binary indexed tree` 全名與連字號／底線別名，同時保留 bit／fenwick；將範例改成 num[0] 保留格及 1-based num／BIT 的 build、sum 與 range sum，只用新指令顯示兩個資料物件；採 int、簡短變數與接近舊版的程式結構；角落錨點新增水平在前的四個別名並統一存成原有標準名稱；讓確實命中 marker 來源變數的 compound scalar write 使用既有 position 平移。
- 修改檔案及用途：`trace-instrumenter.js` 與 `public/trace-rules.js` 處理位元運算；`Binary_Indexed_Tree.cpp` 與 sample input 提供新範例；`algorithm.html` 更新 cache key；兩個 BIT 專項測試驗證 parser、compile、SVG、寬格、標籤、highlight 與 marker；`entrypoints.test.js` 對應 cache key。
- README／版本紀錄／使用說明更新：不適用；範例本身示範完整語法，沒有新增獨立公開 API 文件。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 位元運算解析、求值與優先序 | parser/runtime 專項案例及 `arr[i & -i] += 7` compile | 六種運算求值正確，compound write 的 resolvedIndex 為 4 | 通過 |
| Binary Indexed Tree 全名與舊別名 | renderer alias parser 案例 | 全名、連字號、底線、bit、fenwick 均解析為 original-bit | 通過 |
| 只顯示 num 與 BIT，無舊繪圖或 keep | 靜態結構檢查與實際 trace | 每幀只有 num／BIT 兩個資料物件，無 AV.hpp、draw 或 keep | 通過 |
| num 前置 0 保留格、使用 `AV_grey` 並完整顯示於指定位置；BIT 1-based 二進制 label | compile trace 與瀏覽器 SVG | num 完整顯示 11 格與 index 0 至 10，num[0] 值為 0 且呈 `rgb(204, 204, 204)`；`num.left-bottom` 依縮放比例對齊 `BIT.left-top offset(-40,-70)`；BIT 顯示 0001 至 1010 | 通過 |
| 更新、前綴和與區間和正確 | sample compile | 輸出 `sum of L to R = 42`，BIT 最終值符合預期 | 通過 |
| 非 2 的冪次寬格、highlight、marker | n=10 實際瀏覽器 transition | 10 格寬度、BIT[8]=54、寬格 highlight 與 i marker 均正確 | 通過 |
| 反向角落錨點名稱 | @place 靜態解析及 compile API | 四個別名的來源／目標均正規化；`pivot.left-top at arr.left-top` 實際編譯為 top-left | 通過 |
| highlight／point 使用預設顏色 | 靜態 frame styles 與 BIT 瀏覽器專項 | 所有 highlight／point style 的 color 為空；背景色與寬格 highlight 呈現正常 | 通過 |
| num 值飛向 BIT 的建構動畫 | compound event 資料與實際瀏覽器 transition | 每個 BIT write 的 source 是 num[k]；num[8] 的值 15 產生 transfer 且 transform 持續改變後抵達 BIT[8] | 通過 |
| 建樹與查詢的 num 樣式及區間文字 | 指令靜態檢查與實際瀏覽器 frame | build 只以預設 highlight 標示 num[k]，沒有 num background；sum 直接使用 `num[i-lb+1:i] background AV_blue`，沒有只供繪圖使用的 `l` 變數；可見區間使用 `~`，不含 `..` | 通過 |
| compound index marker 平移 | 分類單元案例與 BIT 實際瀏覽器 transition | `i += lb` 產生多個中間位置並抵達下一個 BIT 格；陣列 compound assignment 仍走 value assignment | 通過 |

## 小驗證與重跑方式
### V2 Binary Indexed Tree 專項
- 目的與對應條件：確認共用 parser/runtime、frame renderer、索引事件與實際 SVG 呈現。
- 執行目錄與必要環境設定：worktree 的 `algo-vis-backend`；`ASM_TEST_BASE_URL=http://127.0.0.1:3102`。
- 測試資料／fixture：`algorithm_sample/Tree/Binary_Indexed_Tree.cpp` 與 `Binary_Indexed_Tree-sample_input.txt`，n=10、查詢 3..8。
- 完整指令或操作步驟：相關 JavaScript 語法檢查；`node --test --test-concurrency=1 tests/unresolved-markers.test.js tests/binary-indexed-tree.test.js tests/binary-indexed-tree.browser.test.js tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：無語法或差異錯誤；16 個案例全部通過且無 skip。
- 實際結果與 exit code（適用時）：錨點整體相關案例 16 passed、0 failed、0 skipped；compound marker 修正後的 marker、BIT 與入口專項 68 passed、0 failed、0 skipped。3102 回應 HTTP 200 且載入 `trace-frame-tween.js?v=trace-223`。
- 證據位置：已提交測試檔；執行摘要僅存在本次本機工作紀錄，不提交 test-results 或 server log。

## 驗證分級與選擇
- 層級：V2
- 分類：E（指令／frame／綁定／位置）、F（runtime 事件／索引／資料）、G（marker）、H（style／標籤）及 A 的入口快取檢查。
- 選擇依據：本次修改共用指令 parser/runtime、renderer 名稱、索引事件及 Binary Indexed Tree 實際 SVG。
- 執行的測試檔／名稱篩選：完整執行 `place-directives.test.js`、`binary-indexed-tree.test.js`、`binary-indexed-tree.browser.test.js` 與直接受 cache key 影響的 `entrypoints.test.js`。
- 驗證環境與隔離服務：先用 3197 隔離服務驗證並停止；最終從 beta BIT worktree 重啟 3102（PID 45368）後重跑。未操作使用者分頁或資料。
- 驗證版本、完整指令、結果與證據：最新程式 commit `33a56ff3c2ec4d907f21ddfb406dbf2ccd9ab8b4`；`unresolved-markers`、BIT parser／browser 與入口專項在重啟後共 68/68 通過。
- 未執行的驗證及原因：依 V2 分級未執行 `npm test`、完整 regression、廣泛排序或其他無關演算法動畫。
- 需要主代理做的 V3 驗證：整合後實際播放 build 與兩次 sum，確認 num／BIT 的不同索引基準、全名 renderer、二進制索引及區間對照；再依 parser 共用影響決定是否增加其他指令案例。

## 剩餘事項與合併注意
- 未驗證項目及原因：未驗證超過 JavaScript 32 位整數範圍的位元運算；C++ `int` 索引用途不需要該範圍。
- 已知問題或風險：瀏覽器 evaluator 的位元運算遵循 JavaScript signed 32-bit 語意，與目前 C++ `int` 索引一致。
- 相依與衝突注意：`trace-instrumenter.js`、`public/trace-rules.js` 與 `algorithm.html` 是共用檔案，整合時需留意其他 parser 或 cache key 變更。
- 主代理需補驗證的情境：依上述 V3 建議核實整合版本，不將本次小驗證寫成整合驗收完成。

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
