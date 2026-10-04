# 外框名稱字級自動適配

名稱使用實際顯示字串（包含 as 別名）測量，不使用繪圖用的長 DOM ID。
名稱區左右保留 4px，依寬高、Arial／實際字體與粗細重算字級，預設上限
16px。文字的實際 glyph bbox 再確認一次，並在名稱區內置中。
極長 ID 保留完整內容，必要時壓縮字寬，不因名稱擴張 layout／camera。

陣列 resize 動畫依正在呈現的名稱區尺寸重算字級，先前縮小的文字在
陣列增長後可再放大。keep 使用相同規則。既有自訂 fontSize 作為上限，
不改寫 studio 儲存的值或顏色；不新增 trace 儲存欄位。
遞迴 merge sort 範例顯示別名由 merge_result 縮為 res，C++ 變數不改。

2026-10-05，V2／H、G；獨立 31992＋headless Edge。
name-fit.browser.test.js 檢查空序列、單格、matrix、keep、長名稱在1x/4x
增長動畫每次 browser paint 的實際 glyph bbox；不放寬文字邊界。
缺少 alias 欄位的舊 trace 實際載入、使用、JSON 儲存重開；fontSize=12、
fill 與 autoFixedEnabled=false 保留。
alias-source-continuity.browser.test.js 核對新短別名的九次來源交接；
alias-display-name.browser.test.js 核對名稱相容；entrypoints.test.js 核對
Renderer trace-256／Tween trace-286。JS 語法、差異及局部瀏覽器驗證，
未執行完整 regression 或其他演算法集合。
