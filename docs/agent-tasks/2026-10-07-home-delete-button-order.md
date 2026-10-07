# 首頁刪除確認按鈕順序

使用者要求首頁刪除投影片確認視窗：左側「刪除投影片」、右側「取消」。調整 index.html 的按鈕 DOM 順序，保留原事件、取消預設焦點與確認後才送出刪除請求的行為。

V0 局部驗證：home-delete-dialog.browser.test.js 通過，實際量測刪除按鈕位於取消左側，確認取消不送 DELETE、確認只送一次 DELETE。git diff --check 通過；未執行演算法動畫集。

交付到 intergration 並重啟核實 3100；本輪未授權合併 main 或公開部署。
