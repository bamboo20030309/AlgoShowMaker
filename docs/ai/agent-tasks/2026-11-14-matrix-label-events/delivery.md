# 二維陣列來源標籤的事件對應

## 任務與結果

使用者指出 row-labels("",S)、column-labels("",T) 的格子來自真實變數，事件應能對應到標籤。

新增共用 trace-label-sources 模組：在解析標籤內容時，同步保存每格的來源 variableId 與 index。空白前綴、literal 標題不綁來源；例如 S[0] 對應 row-label[1]，不是拿相同的 a 字元去搜尋。

renderer 為標籤格子標記來源。比較、讀取強調與賦值／複製共用 eventOperand 定位；優先使用原變數的直接畫面，未直接顯示時使用可見的來源標籤。投影索引用 WeakMap 按元素集合快取，不逐次掃描整個矩陣。字元大小比較使用字元值，不把 a/b 等字元變成 NaN。

原本 capture-only 的字串，若有明確可見的標籤投影，就能作為正常格子來源。單字元更新與後續讀取亦透過相同標籤還原實際事件值。整個字串或容器的操作不誤綁到第一個標籤。

## 舊資料與設定

新 Trace 保存 sources 陣列。舊 Trace 缺少該欄位時，model 從該幀原始指令 parts 還原，並核對完整的既有標籤設定；不靠字元相同猜身分。既有 sources、明確空 sources、mode:none 和已自訂的標籤內容不覆寫。來源名稱不明確時也不猜同名變數。

來源投影規格納入 trace-generation 指紋；本次僅重建 LCS 建表／回溯兩份預建 Trace（82／22 幀），其程式碼與顯示模式不改。其他舊 Trace 保留前端相容還原。

## 驗證

- matrix-label-events.browser.test.js：比較相等／不同／字元大小、來源格複製、修改字元與後續讀取，來源使用 aba 重複字元排除錯配；新 Trace、移除 sources 的舊格式、存檔重開，1x/4x；讀取強調明確關閉時不顯示。
- matrix-label-sources.test.js：空白與literal前綴偏移、字串與陣列來源、同名變數、舊資料還原、自訂與明確關閉設定。
- LCS 附件原碼的指標／箭頭局部瀏覽器驗證通過。
- matrix-renderer 相關小案例核對既有自訂標籤、hidden/none、非等長矩陣及 SVG。
- 預建工具核對兩份 LCS Trace 雜湊、程式碼座標、來源與生成版本；未執行全部演算法。

前端 model trace-48、renderer trace-288、tween trace-360、iframe trace-runtime-119。
