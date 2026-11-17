# UI 轉場統一

依 `transitions-dev` 的 modal、dropdown、tabs 配方及 `transitions-polish` 的進退場規則，沿用現有配色與版面。

## 更動

- 首頁五種管理對話框、投影片兩種分享對話框：250ms 淡入並由 0.96 倍回到原尺寸，150ms 關閉；背景遮罩同步淡入／淡出。
- 演算法導覽列選單、投影片形狀／structure 工具選單：從左上方展開，250ms 開啟、150ms 收起。
- 登入／建立帳號頁籤：藍色底線滑動，初次顯示、重新出現與視窗縮放時直接對齊，不從零寬度飛入。演算法頁籤也使用共用時序，只轉換必要屬性。
- 工作區卡片 hover 與封面顯示使用相同緩動；系統減少動態效果時停用新增轉場及既有縮圖脈動。
- 分享彈窗開啟時，Esc 優先交給瀏覽器關閉原生 dialog，不觸發投影片總覽快捷鍵；原生焦點還原與 close 事件保持原行為。

## 實作範圍

`public/ui-motion.css` 集中配方與專案配接；`public/ui-motion.js` 只處理頁籤指示線及彈窗 Esc。三個 HTML 入口載入共用 CSS，首頁與投影片頁另載入共用 JS。未修改畫布物件幾何、投影片資料或演算法事件動畫時序。

原生 dialog 使用 `@starting-style`、`transition-behavior: allow-discrete` 與 display/overlay 轉場，無須延遲 `close()` 或建立隱藏狀態計時器。較舊瀏覽器不支援時仍可立即開關，功能不依賴動態效果。

## 驗證

- 分級：V1／A，一般前端互動；未啟動演算法大型驗證。
- 隔離 Edge 瀏覽器、獨立靜態伺服器，vendor 路徑對應正式 Express 設定；未連線或修改私人雲端投影片。
- 通過：首頁頁籤切換後指示線位置與寬度、彈窗快速開關及重開、Esc、焦點返回、390px 手機版無水平溢出、減少動態效果。
- 通過：演算法導覽選單 hover 開關、投影片 Reveal/Fabric 初始化、形狀／structure 選單開關、分享彈窗關閉後 display 清理、減少動態效果；最終投影片檢查無 pageerror。
- 首次後端隔離服務未於 helper 的 10 秒等待期限內就緒，因此改為純前端靜態服務。首次靜態預覽漏載 vendor 引起的初始化錯誤已補齊環境後重驗；檢查發現的 Esc 衝突已修正並重驗通過。
- 截圖位於未提交的 `algo-vis-backend/test-results/ui-motion/`；JS 語法與 Git 差異檢查另於提交前執行。
- 持久化相容性：不適用；沒有新增或修改投影片、Trace 或已儲存物件欄位。

## 來源

配方來源：[Transitions.dev](https://transitions.dev/skill.html)，僅將本次使用的 CSS 轉場接入產品，未將整份 skill／素材庫加入專案。
