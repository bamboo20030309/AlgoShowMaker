# 2026-09-22-gamma-algorithm-brand-home：演算法頁品牌入口

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：23a2f6e933fb561757e764d1c97929c49a00dfcb
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：開啟 `algorithm.html`，查看或點擊左上角品牌區。
- 目前行為：只顯示藍色文字，沒有首頁使用的圖示，且無法點擊返回首頁。
- 使用者希望的結果：左上角 Logo 與文字和首頁採相同形式，點擊兩者任一處都回到首頁。
- 本次範圍與必要限制：只修改演算法頁品牌入口與直接相關樣式；不執行大規模驗證。

## 需求確認
- 已從使用者或上下文確認：Logo 與文字皆須可點擊並導向首頁；沿用既有首頁元件形式。
- 尚待使用者回答：無。
- 代理採用的合理假設：沿用首頁的 `favicon.svg`、28px 尺寸、間距、字級與字重，避免建立另一套品牌資產。

## 重現與調查
- 最小操作步驟或 fixture：開啟 `/algorithm.html`，觀察 `#top-bar` 左側並點擊品牌區。
- 重現狀態：已重現。
- 已確認事實：首頁品牌由單一 `<a>` 包含 `favicon.svg` 與 `AlgoShowMaker`；演算法頁原先只有不可點擊的 `.menu-brand` 文字。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/algorithm.html`、`algo-vis-backend/public/style.css`、`algo-vis-backend/tests/entrypoints.test.js`。
- 共用檔案／介面與協調結果：沿用既有 `favicon.svg`，不變更品牌資產或其他頁面。
- 依賴任務：無。

## 驗收條件
- [x] `algorithm.html` 左上角顯示與首頁相同的 Logo 與 `AlgoShowMaker` 文字組合。
- [x] 點擊 Logo 或文字所在的品牌連結後會導向 `/` 首頁。
- [x] 品牌入口不擠壓或破壞既有頂端選單排列。

## 驗證計畫
- 子代理小驗證：執行 `entrypoints.test.js`，並以隔離瀏覽器確認圖示載入、品牌尺寸與點擊導向首頁。
- 主代理整合驗收：整合後確認演算法頁頂端品牌外觀及返回首頁操作。
- 測試隔離方式：使用專項測試啟動的隨機本機埠與獨立瀏覽器 context，不操作使用者分頁。

## 變更紀錄
- 2026-09-22：依使用者要求建立初始定義，採 V0 局部畫面與入口驗證。
