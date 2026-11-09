# 快速排序第 4→5 幀無關指標抬升

## 原因與修正

- 一般快速排序第 5 幀含 `arr[j] < pivot`、`i != j`、交換與 `i++`。
- 比較跟隨器先依事件當下的邏輯索引尋找操作數；若沒有匹配，又退回比對實際 SVG 節點。後續交換會重用實體節點，使索引 0 的 i 被誤認為索引 2 的比較格子，跟著上抬 15 單位。
- 實體節點回退匹配現在也必須符合事件當下的格子索引。保留 alias 同索引回退與 retained snapshot 的獨立定位；不改事件順序、比較路徑或持續時間。
- 更新 tween build `trace-323`、內嵌 runtime 78 與 slides 323。屬播放器修正，Trace 生成指紋不變，不要求重新 RUN 公開範例。

## 驗證

- V2：比較／指標跟隨，使用獨立伺服器與瀏覽器。
- 新增 `quick-sort-compare-pointer.browser.test.js`：修正前以公開 Trace 真實重現 i 跟著 j 上抬；修正後 1 倍、4 倍與 JSON 還原通過。答案為比較期間 i 的 y 不變，j 至少抬升 4 單位，未從播放計畫推導答案。
- `bubble-compare-pointer.browser.test.js`：新／舊保存格式與 1 倍／4 倍比較指標方向通過。
- `unresolved-markers.test.js` 相關兩項通過：比較時索引使用 checkpoint、j 與 j+1 維持比較當下的索引。
- 後者單獨篩選時原先依賴前面案例載入 tween，已修正測試準備，使其可獨立執行；沒有更改答案。
- JS 語法與差異檢查通過；未執行無關的完整 V3。
