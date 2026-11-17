# gamma-brand-favicon：左上角圖示統一

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b302c67e271ef0da6d37ab97e940413251645a8d
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 首頁、訪客範例及登入工作區共用頁首，左上角原為 A 字方塊。
- 使用者希望與瀏覽器圖示完全相同；直接使用既有 favicon.svg。
- 範圍：頁首圖示與樣式，保留首頁連結與品牌文字。

## 需求確認
- 已確認：與瀏覽器圖示一致，不跑大規模驗證。
- 尚待回答：無。
- 合理假設：維持原28×28尺寸。

## 重現與調查
- 已確認 index.html 原用 span.brand-mark，而瀏覽器用 favicon.svg。
- 重現狀態：已確認。
- 尚待調查：無。

## 修改邊界與依賴
- public/index.html、public/home.css、相關兩個測試。
- 共用介面：home.css 快取版本更新，主代理整合時需協調。
- 依賴：無。

## 驗收條件
- [x] 頁首與瀏覽器引用同一圖示檔，圖片載入成功。
- [x] 保持28×28、無額外背景與邊框；首頁連結保留。

## 驗證計畫
- 小驗證：入口測試、隔離無頭 Edge 檢查素材網址、載入與樣式。
- 主代理：整合後完整驗收。
- 隔離：隨機埠測試伺服器與獨立瀏覽器，無使用者資料。

## 變更紀錄
- 2026-09-18：初始定義及完成實作。
