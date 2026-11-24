# Table 編輯文字基線

- 原因：SVG `dominant-baseline=middle` 與原生 input 垂直置中的基線不同，進入編輯文字下移。
- 以隱藏 SVG 字型探針與原生 input 行內基線量測對齊，使用同一 SVG 座標系，不硬編碼位移。保留原文字、配色、字級與游標操作。
- V1：`table-inline-appearance.browser.test.js`、`structure-inline-scale.browser.test.js` 共 2 項通過。新增實際文字像素上下邊界比對，涵蓋自動縮小表頭與 150% 檢視的大字體內文；並核對舊表自訂設定、明確關閉值、儲存重開與新建 Table。
