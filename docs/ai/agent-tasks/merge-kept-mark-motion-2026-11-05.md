# 合併排序第 11 幀 mark 未隨格子比較變換

後續確認：本輪座標修正後，仍有 mark 被前景格子遮住的繪製層級問題。已補實際像素驗證並修正，見 [抬起時 mark 的前景修正](merge-mark-foreground-2026-11-05.md)。本頁的位置通過不等於筆畫可見。

## 重現與原因

使用者指出合併排序第 11 幀 mark 仍未跟上。以公開合併排序的兩組遞迴動畫重現第 10→11 幀，並核對 11→12 幀。

比較期間，keep 子樹的格子會被提升到最外層動畫前景，但 mark 留在快照內的巢狀 style 層。原本 `refreshPresentedStyles` 只更新最外層 style 層，忽略這些巢狀裝飾。因此格子上抬、放大／縮小時 mark 位置與尺寸不變；這與上一輪修復的「臨時複本漏帶 style」是不同的路徑。

原始量測在第 11 幀比較高峰，mark 相對格子的垂直位置偏移約 19 px。上一輪測試只涵蓋一般陣列、矩陣及臨時複本，沒有涵蓋這個 keep 巢狀層，先前不能據此宣稱所有 mark 路徑都已正確。

## 修正

更新所有巢狀 style decoration，逐個以實際父層的顯示矩陣反算格子位置。即使格子提升到其他動畫層，mark 仍使用正確的局部座標、移動與縮放。每次更新按父層快取反矩陣；不加演算法名稱、幀號或變數名稱的特例。

保留原有 style 顏色、透明度、格子歸屬、臨時複本與 index 高度處理。只改播放呈現，不更改 C++ 程式、事件次序或 Trace 資料，上一輪已重建的 36 份公開 Trace 繼續使用。

## 驗證

- 新增 `merge-kept-mark-motion.browser.test.js`：公開兩組遞迴合併排序，第 11 與 12 幀，新 Trace／IndexedDB 保存重開且缺少 semantics 的舊 Trace，1 倍／2 倍，共 16 組。每 25 ms 量測實際 SVG mark 中心到格子右下角的距離，要求固定內縮 (9.5,10) px，誤差不超過 0.002 px；答案依 drawMark 的固定形狀手寫，不依播放計畫或 style basis 反推。通過。
- `style-layer.test.js` 四項通過，包括新增「巢狀 keep style 層、格子被移到其他父層」的反矩陣案例。
- `style-cell-motion.browser.test.js` 的陣列與矩陣兩項通過，保留自訂色、一般比較、臨時複本及整格賦值。
- `retained-hint-owner.browser.test.js` 通過，包含手動／自動播放、保存重開、同 alias 的 keep 歸屬與明確關閉設定。
- JS 語法及 Git 差異檢查通過。未執行完整 regression；只跑此次受影響的 style／keep 分類。

詳細前後位置探針保存在被忽略的 `algo-vis-backend/test-results/mark-merge-2026-11-05/`；未操作使用者瀏覽器或私人投影片。

## 交付

renderer 快取更新為 trace-276、slides-305、內嵌 runtime-61。只提交／推送 intergration，核對來源後重啟 3100；不合併 main 或發布 release。
