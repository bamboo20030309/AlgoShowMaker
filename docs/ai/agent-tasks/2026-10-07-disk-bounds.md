# 修正投影片 disk 頂部裁切

## 原因與結果

disk 的盤子可能在負 Y 座標，舊尺寸算法卻固定 top=0，只使用柱子與底座估算。新增獨立 diskBodyBounds，依實際盤子／柱子／底座聯集量測，保留負座標。其餘結構繼續使用各 renderer 的外框／主體 metadata，再共用定位、縮放、選取與匯出介面。指標與註標不計入主體尺寸。

不修改 Trace、動畫 renderer 或已儲存物件的尺寸／位置／自訂設定；更新共用投影片 renderer 快取版本。

## 驗證

structure-disk-bounds.browser.test.js 在修正前確實因頂部裁切失敗，修正後通過：舊缺少欄位物件實際載入、選取四角對齊、旋轉／傾斜、自訂顏色和明確关闭設定、非最大盤子文字編輯、儲存重開；空資料、單盤、等寬多盤、不同盤寬與八盤；新建 disk 儲存重開。檢查實際 SVG 矩形與 viewBox，沒有放寬斷言；保存截图並確認全部八盤可見。

structure-geometry.browser.test.js 的其他七種結構幾何確認與 entrypoints.test.js 通過；JS 語法及差異檢查通過。共 3 個局部案例，不啟動大型動畫驗證。

完成後重啟 3100，推送 intergration，不合併 main 或發布 release。
