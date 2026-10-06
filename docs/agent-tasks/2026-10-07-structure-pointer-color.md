# Structure 指標註標線條預設黑色

- 外框與向格子延伸的箭頭改為預設 #000000，共用 renderer，編輯、展示及匯出一致。
- 新物件與缺少 annotationColor 的物件使用黑色；舊版本自動儲存的白色線條在渲染時改成黑色，保留檔案原值。其他自訂色維持不變。
- 更新 style 預設色及入口快取版本。
- structure-annotations.browser.test.js：舊白色物件實際載入、編輯、儲存、重開均為黑色；缺少顏色與自訂色核對外框、箭頭；既有自訂 style 保留。
- entrypoints.test.js、修改 JS 語法及差異檢查通過。不執行大型動畫驗證。
- 重啟 3100，推送 intergration；不合併 main。
