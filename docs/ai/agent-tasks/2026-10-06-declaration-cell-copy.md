# 插入排序初始化複製完整格子

## 需求與原因

使用者提供的插入排序，輸入 `10 / 1 8 7 2 6 5 3 9 10 12`，第一次 `int key = arr[i]` 應複製 `arr[1]` 的數字 8 與格子，一起移到 key。宣告初始化原本一律使用只轉移文字的路徑，因此沒有來源格子的框。

## 修正

可見的單一索引格子初始化純量時，使用既有完整格子轉移；來源保留，帶入來源既有樣式，落地後清除轉移副本。宣告仍使用原本 500ms 提交時機，不變成一般賦值的 660ms。容器初始化、算式、複合賦值維持原有數值動畫。沒有新增 Trace 欄位，既有儲存結果不必重新編譯。前端 tween build 為 trace-300。

## 驗證

- 獨立伺服器、Windows Edge，3 檔共 8 個具名案例全部通過。
- 新增 `declaration-cell-copy.browser.test.js`：使用正式插入排序的程式碼及上述輸入，檢查實際 SVG 有框、有數字 8、位置確實移動、來源仍為 8、自訂框色保留、落地後副本清除。涵蓋新編譯 1x／4x、舊儲存 Trace、JSON 儲存重開、明確停用。
- 相關 `arithmetic-assignment.browser.test.js` 與 `insertion-relative-index.browser.test.js` 全部通過，核實容器／算式轉移及舊有 j+1 定位。
- 報告：`algo-vis-backend/test-results/declaration-cell-copy-related.tap`（不提交）。JavaScript 語法及 git diff 檢查通過。

本輪是局部修復驗收，未重跑完整 V3 或大型動畫，不代表整體發布驗收完成。僅交付 intergration，重啟 3100；main 不合併、不發布。
