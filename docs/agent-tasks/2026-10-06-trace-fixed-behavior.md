# Trace 歷史 bug 與固定畫面規則

日期：2026-10-06；分支：intergration；基準：0ff4b375457ca5e05259043f00304d5fee99060c＋既有未提交修改。

## 需求與交付

整理指標、標籤與其他 Trace 歷史問題，補進「固定行為規則：判斷畫面是否符合要求」。不修改交換動畫路徑，不以 renderer 的計畫作為獨立標準答案。

- 新增 `docs/Trace固定行為規則.md`，18 類歷史問題與測試索引，標明既有覆蓋、此次補強及待補強。
- 新增 `scripts/trace-behavior-rules.js`，固定索引、作者順序、比較方向、指定物件可見性及固定值的獨立契約。缺失／重複標籤和缺失幾何不能通過。
- 新增十個正反例，將此入口接到插入排序、選擇排序、冒泡排序三個實際瀏覽器測試，保留原本的 RAF 連續採樣與額外斷言。
- 更新驗證集設計與使用手冊；既有工作與私人教材草稿保留。

## 核實

環境：Windows、Node、隔離隨機埠服務、Playwright Edge；瀏覽器案例採一個 worker，未操作使用者分頁或資料庫內容。

| 執行範圍 | 結果 |
|---|---|
| `node --test tests/trace-behavior-rules.test.js tests/animation-assertions.test.js` | 20 個具名案例通過（新增 10、既有錄影判定 10），無略過 |
| `node --test --test-concurrency=1 tests/insertion-relative-index.browser.test.js tests/selection-pointer-lifecycle.browser.test.js tests/bubble-compare-pointer.browser.test.js` | 3 個具名案例通過，約 83 秒；含新舊 Trace、1x／4x、前進／倒退及 JSON 儲存重開，無略過 |

固定答案：插入排序第 11 幀 j+1 為索引 2；選擇排序下一輪 i/min_idx 為索引 1、反向回前輪 i 為 0、同錨點依 arr[...] 順序、最終 arr 可見；冒泡排序指定 8>7 的比較，左 j 高於右 j+1。答案來自固定輸入與程式語義，實際位置來自 SVG／DOM。

這次只驗證上述補強，不代表既有 18 類全部通過。完整 V3 仍需追查原失敗，尤其 style 中間進度、選擇排序大型錄影與雲端儲存；未重新跑完整 V3、未合併 main、未發布。

語法與 git diff --check 通過，文件列出的測試檔均存在。3100 整合服務已重啟，HTTP 200 與 trace-298 腳本來源核對一致；未停止 main 或其他代理服務。
