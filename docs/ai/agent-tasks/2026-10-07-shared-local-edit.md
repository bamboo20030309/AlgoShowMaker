# 分享觀看連結的本機編輯

## 任務與結果

移除 /workshop.html 專屬入口、temporary 註冊與網站工作坊檔案。使用者 Downloads 原檔未修改；既有獨立 deck-traces 結果保留，避免已匯出 ID 的投影片失去結果。

分享連結的伺服器權限維持 view。前端建立依 share token 隔離的本機副本，初次開啟仍是展示模式，可切換編輯、修改物件、匯入、編輯動畫與匯出。所有草稿及新 Trace 存在瀏覽器 IndexedDB，動畫編輯器使用 localOnly=1；投影片內容與 Trace 不上傳原分享端點。RUN 仍可使用既有後端編譯服務，不代表修改原始分享投影片。

重新開啟會先核實分享仍有效，再保留該瀏覽器的本機副本。不同瀏覽器取得原始內容；分享撤銷後不透過該入口呈現舊草稿。共享編輯 edit 連結和擁有者仍沿用雲端儲存流程。

## 驗證（V1）

sample-local-edit.browser：既有動畫的自訂字級與 false 設定、本機動畫編輯器、新增文字／頁面、保存重開、匿名瀏覽器編輯、不同瀏覽器原始副本、分享撤銷與零投影片 API 寫入。

deck-file-drop.browser：分享本機副本可匯入檔案，個人工作區仍可建立與雲端保存。

sample-view-actions.browser：公開範例連結、匯出內容、回首頁、分享觀看連結的本機編輯標示與隱藏分享管理按鈕。原測試期待原封下載的壓縮位元組，改為核對重匯出的頁數、ID、物件與 widget 內容；展示侧欄以實際 opacity=0 核實。發現 hidden 被 CSS display 覆蓋，已補上 .deck-io-btn[hidden] 規則。

slide-cloud-storage：既有 owner/edit 儲存與分享 Trace 讀取範圍測試通過；未改後端權限。

entrypoints、slides.js 語法與差異檢查。此次不改動畫事件語意，不執行大型動畫驗證集。

## 交付

intergration，重啟 3100 並推送；不合併 main、不發布 release、不部署公開站。