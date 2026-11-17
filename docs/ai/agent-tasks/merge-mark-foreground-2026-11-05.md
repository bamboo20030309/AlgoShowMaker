# 合併排序比較抬起時 mark 被前景格子遮住

## 原因與前輪漏項

使用者再次指出比較抬起時 mark 沒跟著顯示。唯讀確認目前 Chrome 投影片使用 runtime-61／renderer trace-276，不能歸因於沒重新整理。

前輪已修正 mark 的座標，重新量測第 11、12、34 幀的位置也正確；但快照內的 style 層仍在根動畫層後面。比較格子提升到動畫前景後，白色格子會蓋住 mark。座標測試與「CSS 未隱藏」不能證明筆畫實際可見，這是前輪驗證漏掉的繪製層級問題。

新增實際影像測試：比較開始 200 ms（抬起）與 1000 ms（放大／縮小）時，擷取畫面並檢查 mark 路徑上的綠色筆畫。修正前，第 200 ms 雖然位置正確，路徑附近仍為 0 個 mark 顏色像素，測試失敗。

## 修正

格子位於根動畫前景層時，將附屬 style 一起提升到該根的前景 style 層，畫在格子上方。沿用完整格子矩陣及原始 style basis，不重新計時、不改變樣式顏色或事件動作。

動畫完成／取消、格子回到原層後，style 依 DOM 佔位記號回到原本快照位置，維持順序及快照重用。暫存 style 被移除時也清掉佔位，避免殘留。前景層仍位於箭頭與指標層的既有層級之間。

此規則作用於附屬 style，不依演算法名稱、變數名或第幾幀寫特例。無新增持久化欄位、無變更 Trace 格式，上一輪 36 份重新產生的公開 Trace 仍可使用。

## 驗證

- `merge-mark-visibility.browser.test.js`：先失敗再修正；抬起與縮放高峰的兩格 mark 均有實際綠色筆畫，並確認位於根前景 style 層。通過。隔離測試將來源格子置於可視範圍以核對像素，不操作使用者頁面。
- `merge-kept-mark-motion.browser.test.js`：第 11、12 幀、兩組輸入、保存重開的舊 Trace、1 倍／2 倍共 16 組位置驗證通過。
- `style-layer.test.js` 四項通過；新增前景提升、保持矩陣與回復原快照層的斷言。
- `retained-hint-owner.browser.test.js` 通過：手動／自動播放與同 alias 的 keep 歸屬。
- `style-cell-motion.browser.test.js` 陣列與矩陣兩項通過，保留顏色及複本行為。
- JS 語法與 Git 差異檢查通過。只跑相關 style／keep 驗證，不機械式執行完整 regression。

抬起及縮放截圖存於被忽略的 `algo-vis-backend/test-results/mark-merge-2026-11-05/paint-200ms.png`、`paint-1000ms.png`，不提交測試影像。

## 交付

前端快取更新為 renderer trace-277、slides-306、內嵌 runtime-62。只推送 intergration，核對來源後重啟 3100；不合併 main、不發布 release。
