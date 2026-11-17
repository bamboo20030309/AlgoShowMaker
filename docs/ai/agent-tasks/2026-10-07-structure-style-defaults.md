# 投影片 style 預設色與動畫一致

## 結果

getStyleDefaults 集中投影片編輯器、正規化與 renderer 的預設色。Highlight／Point 為 red (#ff0000)，Focus 為 #ccc (#cccccc)，Mark 為 limegreen (#32cd32)。Background 使用對應動畫結構的預設：一般陣列／矩陣／heap／BIT／一般樹為 rgb(231,144,255)，stack 為 rgba(255,200,200,0.8)，queue 為 rgba(200,255,200,0.8)，disk 與標準 segment tree 為白色。註標外框與箭頭沿用此前黑色要求。

只有缺少顏色欄位與新建物件使用新預設；已儲存的明確顏色、各格自訂色、分 style 的選色記憶及明確關閉設定不覆寫。

## 驗證

- structure-style-defaults.browser.test.js：直接呼叫既有動畫 renderer 並省略 color，對比投影片實際 SVG；8 種模式 × 5 styles 共 40 組，核對 focus 的未選格。另實際新增物件、儲存與重開，確認預設及舊物件自訂值。
- structure-annotations.browser.test.js：缺少欄位舊物件使用、儲存、重開與自訂 style 色。
- slides-av-color-palette.browser.test.js：style 按鈕預設色、獨立記憶、舊 table/tree、自訂／明確關閉設定。
- entrypoints.test.js：快取版本及載入順序。
- JS 語法與差異檢查通過；未執行大型動畫驗證。

重啟 3100 並推送 intergration，不合併 main 或發布 release。
