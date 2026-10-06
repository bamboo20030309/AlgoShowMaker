# 左側編輯程式碼按鈕

依使用者確認，入口放在最左側始終顯示的 controlChrome，而非元件側欄。

- 刪除 runtime 動畫分頁的「本機編輯」按鈕。
- 演算法投影片顯示左側「編輯程式碼」按鈕；開啟／收起同步 aria-expanded、aria-pressed。動畫載入完成前停用，非演算法頁隱藏。
- 父頁與目前 runtime iframe 透過來源核對的 message 切換本機編輯；保持原 IndexedDB 草稿、還原原版及儲存規則。
- 更新父頁／子頁快取版本。

V1 驗證：runtime-local-editor.browser 1/1，最左側按鈕、舊入口移除、Present 模式開啟、RUN、本機持久化與重新載入、跨投影片隔離、自訂字體／明確關閉設定、還原原版；未發送 deck、trace-upload 或帳號偏好寫入，未通知父頁保存動畫。entrypoints 1/1；JS 語法及 diff whitespace 通過。

使用隔離服務與獨立瀏覽器，未操作使用者資料；未啟動大型動畫驗證。提交 intergration 後重啟 3100，main/3000 保持既有版本。
