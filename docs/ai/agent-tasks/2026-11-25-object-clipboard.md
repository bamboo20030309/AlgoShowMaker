# 跨分頁物件貼上

- 複製攜帶版本化完整 Fabric／widget 資料；自訂 MIME 與純文字備援均可還原，不依賴來源分頁記憶體。貼上沿用既有 ID 更新、排版、樣式及相對圖層規則。
- 舊識別碼有本分頁資料時仍相容；失效識別碼、損壞內容顯示編輯欄錯誤，不產生文字物件。圖片與文字的原有貼上方式保留。
- V1：依序執行 `cross-tab-object-paste.browser`、`mixed-object-paste.browser`、`slides-image-paste.browser`、`slides-rich-text-paste.browser`、`slides-paste-cursor.browser`，7 項通過。剪貼簿測試不可並行，以免覆寫系統剪貼簿。
- 涵蓋來源分頁關閉、目的分頁重整、純文字備援、自訂 MIME、舊物件自訂樣式／明確關閉值，以及貼上後儲存重開。
- 不修改使用者原投影片；先前已存成識別碼文字的物件無完整資料可還原，需從來源重新複製。
