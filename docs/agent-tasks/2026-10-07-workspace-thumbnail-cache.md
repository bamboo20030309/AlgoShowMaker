# 工作區縮圖快取

## 任務與實作

使用者要求只快取工作區卡片的縮圖，節省清單讀取時間。新增獨立 IndexedDB 縮圖庫，不存整份投影片、不接觸草稿或 Trace。資料以帳號、deck_uid、updated_at 區隔與核對；最多保存 64 張，每張不超過既有 500000 字元限制。快取不可用時照常下載。

首頁清單透過 X-ASM-Thumbnail-Mode:lazy 取得不含 base64 圖片的基本資料；舊客戶端未帶此 header 時維持原回傳。快取命中免下載圖片，只有新建或版本改變時呼叫獨立縮圖 API，同時最多三個請求，同一版本的請求合併。既有沒有縮圖的投影片仍保留背景產生功能。清單仍向伺服器核對，刪除不會被快取恢復；更新時間改变會保守地使縮圖失效，包含重新命名。

縮圖 API 必須登入，查詢包含當前 user_uid；回應只含圖片與更新時間，指定 private,no-store。列表查詢目前仍從 Mongo 讀出已存圖片後省略傳輸，此次主要減少網路傳輸與瀏覽器重複圖片載入，不宣稱消除資料庫所有圖片讀取。

## 局部驗證（V1）

- home-thumbnail-cache.browser：首訪兩張下載兩次；重開下載數不增加；只改一份版本僅新增一次下載並核對實際圖片；刪除後卡片消失；切換帳號重新取得；快取不可用可下載；不下載整份 deck；保存數量上限。
- home-thumbnail-api：縮圖清單模式與舊回傳相容、登入與所有者條件、縮圖 API 不回傳完整 deck、404 與快取標頭。
- home-delete-dialog.browser、library-folders.browser 與 entrypoints 通過，涵蓋既有帶縮圖／缺少新欄位的清單、舊投影片缺少縮圖、資料夾與刪除。
- 初次快取測試誤取訪客範例區的圖片而失敗；將定位限制在工作區後核實更新图片，未放寬答案。
- JS 語法與 git diff --check；不執行演算法驗證集。

## 交付

更新 home.js 版本 thumbnail-cache-11，新增 home-thumbnail-cache.js?v=1；交付 intergration、重啟並核實 3100。未合併 main 或更新公開部署；公開站需下一次合併及 backend 重建才能使用新 API。
