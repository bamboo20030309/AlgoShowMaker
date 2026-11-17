# gamma-folder-icons：資料夾標題圖示按鈕

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b5728fe8e61afd5f1bc54936023fb66ef42f1d6e
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境：我的投影片資料夾操作。
- 目前行為：重新命名／移除文字按鈕在標題下方。
- 希望結果：改成標題右側圖示按鈕。
- 範圍：操作位置與樣式；不修改名稱提示或移除確認流程。

## 需求確認
- 已確認：圖示與標題右側、小驗證及 push。
- 尚待回答：無。
- 合理假設：鉛筆代表命名、垃圾桶代表移除；保留 title/aria-label；收合狀態仍可操作。

## 重現與調查
- 功能調整不適用重現；原 tools 位於 summary 後已確認。
- 尚待調查：無。

## 修改邊界與依賴
- library-organizer.js：tools 放入 summary、原生 SVG 與既有 icon-btn；阻止按鈕預設切換 details。
- home.css：標題列 flex 排版與展開標記；index.html／entrypoints 版本；瀏覽器小驗證。
- 共用介面：不改 API 與資料格式；依賴既有資料夾。

## 驗收條件
- [x] 兩個圖示在標題右側、具提示與無障礙名稱。
- [x] 收合狀態按鈕仍可用，重新命名不意外展開。
- [x] 重新命名／移除保留功能，窄螢幕与原整理案例通過。

## 驗證計畫
- 子代理：V1/A/B，專屬工作區瀏覽器與入口／語法檢查，獨立 Edge 與合成資料。
- 主代理：整合後完整回歸與實機版面。

## 變更紀錄
- 2026-09-18：初始定義。
