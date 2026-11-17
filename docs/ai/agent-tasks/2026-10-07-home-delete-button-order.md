# 首頁刪除確認按鈕順序

使用者要求首頁刪除投影片確認視窗：左側「刪除投影片」、右側「取消」。調整 index.html 的按鈕 DOM 順序，保留原事件、取消預設焦點與確認後才送出刪除請求的行為。

V0 局部驗證：home-delete-dialog.browser.test.js 通過，實際量測刪除按鈕位於取消左側，確認取消不送 DELETE、確認只送一次 DELETE。git diff --check 通過；未執行演算法動畫集。

交付到 intergration 並重啟核實 3100；本輪未授權合併 main 或公開部署。

使用者截圖澄清為視窗底部左右兩端，原先僅交換順序不足。移除前置 spacer，僅此確認視窗的操作列使用 space-between；桌面 1280 與手機 390 寬度實際量測左右對齊、同列顯示，並保留取消與確認請求驗證。CSS 版本更新 delete-button-18。
