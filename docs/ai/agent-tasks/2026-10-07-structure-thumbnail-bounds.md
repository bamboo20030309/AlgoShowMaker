# 修正 structure 縮圖裁切

## 原因與修正

SVG 的 DOM 定位 position/left/top 被序列化進獨立圖片，Canvas 再依 paint/transform 定位。圖片內發生額外偏移，縮圖上半部消失。drawCanvas 在序列化前只移除 DOM 定位 CSS，沿用相同 viewBox、尺寸、paint 與變換；編輯器 DOM 畫面不變。

## 局部驗證

新測試 structure-thumbnail-bounds.browser.test.js 修正前重現正常陣列上半裁切，修正後通過：9 種結構 × 25%／50%／100% 共 27 組，直接比較 DOM 實際矩形及線條範圍與 Canvas 像素；另核對 9 個實際 createSlide JPEG 縮圖頂部。DOM getBoundingClientRect 不含線條厚度，標準答案加入實際變換後的 stroke，維持相同 3px 像素容差，沒有放寬斷言。

slide-order-thumbnail-drag.browser.test.js、structure-disk-bounds.browser.test.js（新建及舊物件載入、編輯、儲存、重開）、entrypoints.test.js 通過。JS 語法與差異檢查通過，不啟動大型動畫驗證。

不更改儲存格式或既有自訂值；更新 renderer 快取版本，重啟 3100 並推送 intergration。不合併 main 或發布 release。
