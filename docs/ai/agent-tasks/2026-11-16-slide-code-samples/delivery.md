# 投影片程式匯入演算法範例集

## 結果

從公開範例清單15份投影片逐份取得動畫原始碼與輸入，整理36個動畫、29份不同程式、36組測資。相同程式碼共用一份cpp，原始繪圖指令及asm-view保留。新增algorithm_sample/Slide_Examples與可重跑的export-slide-code-samples.js，英文檔名、中文顯示名稱、來源頁碼／雜湊及測資對應保存於隱藏manifest。

範例集API原本指向backend外兩層，修正為backend/algorithm_sample；選單讀取可選displayName，沒有欄位的既有檔案維持name顯示。原有範例保留，不修改投影片或Trace。

## V1 驗證

slide-code-samples.browser.test.js通過：逐份經API核對36個動畫的程式與測資符合投影片；29份程式與36份輸入均可讀取，英文路徑及中文名稱正確；既有檔案仍可讀。隔離瀏覽器點選投影片範例→排序→遞迴合併排序，依名稱載入第二組測資，重新整理後程式與輸入仍一致，無pageerror且無compile請求。

server.js、front.js與匯出腳本語法及diff檢查通過。本次為程式目錄與載入介面修改，不執行演算法動畫驗證集。清單只取公開範例，不操作使用者私人投影片。
