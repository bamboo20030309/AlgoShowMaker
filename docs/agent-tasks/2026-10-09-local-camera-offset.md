# 本機暫時鏡頭後偏移

## 任務與規格

使用投影片既有的鏡頭後偏移，擴充至演算法播放、Trace Studio、投影片編輯預覽、投影片展示及內嵌動畫編輯器。各介面獨立保存，投影片相關介面再依草稿來源與頁面 ID 隔離。這是正式鏡頭之後的平移／縮放，不修改 `@camera`、Trace 鏡頭規則或物件座標。

偏移只存於目前分頁的 sessionStorage，重新整理保留，關閉分頁後清除；儲存不可用時退回記憶體。編輯器內的 Studio 與播放也各自隔離。畫布設定的「重置視角」只清除當前介面的暫時偏移。

## 實作與相容性

- `local-camera.js` 共用本機儲存、正規化與舊值遷移。各介面使用不同 scope；切換介面前保存尚未完成 debounce 的手勢。
- `canva.js` 在每次正式鏡頭計算後套用後偏移；`trace-studio.js` 開關切換獨立狀態；`slides-embed.js` 接收來源與介面識別。
- 拖曳不再傳送修改投影片的訊息，不觸發 saveDeck、undo 或雲端儲存。
- 舊 `animation.presentationCamera` 在載入時一次遷入目前分頁的投影片展示 scope，已有本機值（含明確重置）優先。舊 localStorage 草稿須在轉存 IndexedDB 前遷移。
- 動畫正規化、asmdeck 投影及雲端／草稿投影均移除舊持久化偏移欄位；來源、Trace ID、正式鏡頭、字體大小、自訂設定及明確 false 保留。原始舊檔不就地改寫；下一次儲存／匯出使用新規格。
- 縮圖仍反映正式鏡頭與教材內容，不帶入使用者的暫時觀看偏移。

## 驗證結果（V2，限定鏡頭與持久化）

40 個相關案例通過：`camera-embed-parity` 2、`local-camera` 2、`asmdeck` 16、`slide-storage` 13、`slide-cloud-storage` 5、`entrypoints` 1、`presentation-camera.browser` 1。未執行完整 regression 或大型排序驗證。

隔離瀏覽器使用小型雙幀陣列經實際 analyze／compile：右鍵拖曳、滾輪縮放、跨幀維持、Studio 開關及獨立縮放、投影片編輯／展示切換、動畫編輯器獨立縮放／重開、重新整理與實際 asmdeck 下載解碼。畫布手勢不改變 deck revision。舊偏移實際載入／遷移／匯出／重開，字體 19 與 autoFixedEnabled=false 保留；重置後只恢復當前介面。雲端投影另外核對 inline Trace 與 ID-only 兩路均不帶偏移。

最初瀏覽器案例使用的程式未被追蹤器接受，導致等待動畫逾時；改為支援的一般 vector 宣告與兩個手動幀，未修改產品解析規則或放寬畫面斷言。入口快取版號斷言隨實際腳本更新同步。
