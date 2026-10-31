# 2026-09-19-gamma-structure-length-zero：Structure 格子編輯與零值長度設定

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：29054a9636cd76df9780cc1976fbdc712f5b44bd
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：在投影片編輯器修改 heap 格子，或於 structure 左側編輯欄調整陣列。
- 目前行為：heap 編輯第 n 格時會修改第 n-1 格；左側沒有可直接指定陣列長度的欄位；新 structure 使用非零範例值。
- 使用者希望的結果：heap 修改命中的格子；線性 structure 可直接指定長度；新格子與新 structure 預設為 0。
- 本次範圍與必要限制：投影片前端及聚焦測試；不執行大規模 regression。

## 需求確認
- 已從使用者或上下文確認：需要修正 heap 編輯偏移、增加陣列長度選擇、structure 初始值全為 0。
- 尚待使用者回答：無。
- 代理採用的合理假設：長度調大保留既有值並在尾端補 0，調小截去尾端；矩陣與樹有不同維度模型，不顯示單一長度欄位。

## 重現與調查
- 最小操作步驟或 fixture：建立 content 為 `10, 20, 30, 40` 的 heap，雙擊索引 2 並輸入 99。
- 重現狀態：已重現。
- 已確認事實：heap、segment tree、BIT 的畫面格子已使用零起算索引，編輯路徑又減 1，造成寫入前一格。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/slides.js`、`slides.html`、聚焦瀏覽器測試及入口測試。
- 共用檔案／介面與協調結果：structure widget 的既有 `content` 字串格式不變。
- 依賴任務：無。

## 驗收條件
- [x] 修改 heap 任一格只更新被點擊的格子，不修改前一格。
- [x] 線性 structure 左側編輯欄可指定 1 至 100 的長度，放大補 0、縮小截短。
- [x] 新建 Array、Matrix、Tree 與其他 structure 的初始內容使用 0。
- [x] 既有 structure 註標與入口載入仍正常。

## 驗證計畫
- 子代理小驗證：語法檢查、單一 structure 長度／heap 編輯瀏覽器測試、既有 structure 註標測試、入口檢查。
- 主代理整合驗收：核對 heap 編輯、長度調整和各 structure 新建值；此純前端變更不要求演算法大規模回歸。
- 測試隔離方式：測試使用隨機本機埠、獨立瀏覽器與測試 deck。

## 變更紀錄
- 2026-09-19：依使用者需求建立任務；明確排除大規模驗證。
