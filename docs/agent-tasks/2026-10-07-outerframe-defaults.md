# Outerframe 預設色共用

動畫與投影片背景原本已同為 rgba(209,230,172,0.5)，但各自硬寫。改由 draw_array_outerframe.defaultBackgroundColor 提供唯一預設，動畫繪製、投影片 renderer、正規化、新建與選色按鈕共用。外框線沿用既有動畫 #333。不改變動畫預設呈現。

新增局部驗證：直接比較動畫 outerframe 與缺少設定的投影片 SVG 背景及框線；自訂背景保留；明確關閉不產生外框；實際新建、儲存重開仍為同一預設，舊物件自訂背景和關閉設定保留。structure-style-defaults.browser.test.js 與 entrypoints.test.js 通過，修改 JS 語法及差異檢查通過。

更新三個入口的共用繪圖腳本快取版本，重啟 3100，推送 intergration；不合併 main、不發布 release。
