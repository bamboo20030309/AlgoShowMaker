# Point 不計入選取框

2026-10-05，intergration，V1。

新增結構選取幾何 getSelectionRect：比較含 Point 與無 Point 的渲染範圍，依實際 SVG 比例排除 Point 多出來的區域。原 SVG 顯示／匯出範圍、物件持久化資料及動畫引擎維持原狀。Fabric 單選、多選框與對齊／框選邊界共用該幾何，旋轉及傾斜以原物件矩陣換算。不含 Point 的物件走原尺寸快速路徑。

驗證：3 個 JS 語法、git diff --check 通過。tree-highlight-alignment.browser.test.js 通過：陣列、矩陣、樹、線段樹的 Point 空間被排除；實際 Fabric 框；新物件啟用 Point 不擴大選取框；舊物件 Point 與自訂顏色、明確 false、儲存重開保留。mixed-object-paste.browser.test.js 三個案例通過（混合多選、複製貼上、拖曳縮放旋轉與重開）。未啟動大型動畫驗證。

重啟整合 3100，main 未合併。

## Point 開關定位補償

新增／移除 Point 時以結構本體中心做定位補償，保留視覺上的位置；旋轉／skew 依原變換矩陣計算。驗證升級為實際 Fabric 框 left/top/width/height 開啟與關閉前後不變；額外驗證縮放、旋轉 27 度、skew 8 度的結構內容與選取框位置都不變，以及儲存重開和明確 false 設定保留。node --check、git diff --check 與相關 tree-highlight-alignment.browser.test.js 通過。
