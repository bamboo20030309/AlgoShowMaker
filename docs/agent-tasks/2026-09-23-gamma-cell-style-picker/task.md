# 2026-09-23-gamma-cell-style-picker：格子內選擇 Structure style 與顏色

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：3ab149dcc46200d97bd48439391063063d7e3fa3
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：編輯投影片中的陣列 style。
- 目前行為：Highlight、Focus、Point、Mark、Background 與註標箭頭的索引和顏色控制集中在左側欄；格子工具列只能切換 style，選完不會進入選色器。
- 使用者希望的結果：左側移除 style 選擇；點格子後選擇 style，接著開啟選色器調整該 style 顏色。
- 本次範圍與必要限制：保留預設註標文字、Array 外框背景及 Tree 箭頭等非格子 style 設定；只做 V1 前端局部驗證。

## 需求確認
- 已從使用者或上下文確認：style 選擇從左欄移至各格子，選擇後開啟選色器。
- 尚待使用者回答：無
- 代理採用的合理假設：同一格可保留多種 style；再次點已套用的 style 用於重新開啟選色器，另提供「清除格子樣式」按鈕移除該格的所有 style。

## 重現與調查
- 最小操作步驟或 fixture：選取 normal Structure 的格子，操作格子上方 style 工具列與選色器，讀取儲存後的 style 索引及顏色。
- 重現狀態：功能調整不適用。
- 已確認事實：格子工具列原本已能修改各 style 的索引；所有顏色共用 `openIro`，但 Structure style 顏色的 anchor 綁在左側欄按鈕。
- 尚待調查：無

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/slides.html`、`slides.css`、`slides.js`、相關 Structure／AV 色票瀏覽器測試、入口測試及任務文件。
- 共用檔案／介面與協調結果：不修改 deck 欄位；沿用既有 `*Indices`、`*Color` 與共用 iro 選色器。
- 依賴任務：2026-09-23-gamma-av-palette；格子 style 選色器沿用其 AV 色票。

## 驗收條件
- [ ] 左側 Structure 編輯欄不再顯示六種 style 的索引與顏色列。
- [ ] 點格子可看到六種 style；點選後 style 套用到該格並開啟選色器，手動色與 AV 色票均可使用。
- [ ] 已套用的 style 可再次開啟選色器；「清除格子樣式」能清掉該格 style。
- [ ] style、顏色與註標文字儲存後重開仍保留。

## 驗證計畫
- 子代理小驗證：Structure style／註標瀏覽器測試、AV 色票測試、入口測試、JS 語法與差異檢查，並檢視局部畫面截圖。
- 主代理整合驗收：整合後以不同格子套用多種 style、重新選色、清除及重開確認。
- 測試隔離方式：專項測試使用隨機埠、內建 deck 與獨立瀏覽器 page，不操作使用者投影片。

## 變更紀錄
- 2026-09-23：依使用者要求將 style 選擇移到格子；為保留重新調色與移除能力，加入清除格子 style 按鈕。
