# 矩陣標籤的比較呈現

## 更改

來源明確的矩陣標籤仍經共用 eventOperand、createCompareEffect 與值格複製／提交流程。來源格預設白底黑字，作者設定在預設之後套用；空白、純文字標題不變。

一般 compare 若涉及來源標籤，使用同一效果生命週期內的 labelComparison 動作設定：原地向上 15px、放大 1.25 倍，沿用原比較等待及還原時間。相等／不等／大小比較均相同；不靠攏、不複製同格自比較、不額外顯示結果框與符號。min/max 獨立選值保留既定規則。

## 驗證範圍

V2：matrix-label-events.browser.test.js 驗證新／舊資料、儲存重開、明確關閉讀取、自訂填色、1x/4x。每次比較均檢查 x 不變、上移與放大、事件結束前復原，並保留來源格複製與單字元寫入斷言。

restored-comparison.browser.test.js 核對一般格子大小比較、相等／不等靠攏與同格比較，包含舊資料、IndexedDB 重開、自訂顏色及 1x/2x。使用隔離服務與瀏覽器，不啟動完整動畫驗證集。

這次只改前端呈現，不更改 Trace 語意或後端生成指紋，不需重跑預建 Trace。renderer trace-289、tween trace-361、iframe trace-runtime-120。

## 驗證結果
兩份隔離瀏覽器測試通過，無 skip／失敗。JS 語法與 diff 檢查通過。一般比較舊測試補上既定的 200ms code prompt 後才取樣，保留原本精確的幾何、縮放與結果淡入斷言；產品原比較時序未變更。
