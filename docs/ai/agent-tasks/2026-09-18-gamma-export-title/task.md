# gamma-export-title：匯出以投影片標題命名

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：d0031f3c0d77924e45b5a7773aae4d758334b86e
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：投影片編輯頁點匯出。
- 目前行為：檔名為產品名稱加日期。
- 希望結果：以工作區投影片標題作為 .asmdeck 檔名。
- 範圍：只修改檔名；不修改匯出資料格式。

## 需求確認
- 已確認：標題命名、相關小驗證、完成後 push。
- 尚待使用者回答：無。
- 合理假設：空白標題採未命名投影片；禁用字元替換為底線、移除結尾點與空格、Windows 保留名稱加底線。

## 重現與調查
- 重現狀態：既有 exportDeckJson 固定指定產品與日期，靜態確認。
- 已確認：cloudDeckTitle 已載入工作區標題及訪客範例標題，未登入空白編輯器預設未命名投影片。
- 尚待調查：無。

## 修改邊界與依賴
- slides.js exportDeckJson、slides.html 入口快取與 entrypoints.test.js、專屬瀏覽器測試。
- 共用介面：沿用現有 cloudDeckTitle；不改格式與 API。
- 依賴：無。

## 驗收條件
- [x] 中文、英文標題匯出檔名對應標題並附 .asmdeck。
- [x] 空白與不合法檔名產生可用檔名。

## 驗證計畫
- 子代理小驗證：V1/A，實際瀏覽器下載 suggestedFilename 與入口靜態檢查。
- 主代理整合驗收：整合後回歸及投影片匯出實際驗證。
- 隔離：隨機埠、獨立 Edge、合成空白投影片、mock 雲端標題，無真實使用者資料。

## 變更紀錄
- 2026-09-18：初始定義。
