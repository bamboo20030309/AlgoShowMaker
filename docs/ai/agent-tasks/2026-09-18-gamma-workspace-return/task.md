# 2026-09-18-gamma-workspace-return：範例頁返回按鈕

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：15ddd04c959f9f152ab3c0214f4cf5763133a484
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 情境：範例演算法投影片頁面的「返回投影片工作區」。
- 目前行為：文字連結。
- 希望結果：有返回圖示的按鈕，仍連至工作區。
- 範圍：前端外觀；沿用 quiet-btn 元件樣式。

## 需求確認
- 已確認：使用者指定圖示按鈕；不跑大規模驗證。
- 尚待回答：無。
- 合理假設：使用返回箭頭，保留原文字與 href。

## 重現與調查
- 操作：開啟 /?examples=1。
- 重現狀態：已確認原連結樣式。
- 已確認事實：既有 quiet-btn 可重用，examples-view 控制顯示。
- 尚待調查：無。

## 修改邊界與依賴
- public/index.html、public/home.css；相關入口與瀏覽器測試。
- 共用介面：只更新 home.css 快取版本。
- 依賴任務：無。

## 驗收條件
- [x] 範例頁顯示返回箭頭與原文字，按鈕高度至少36px。
- [x] 連結保留 /，登入區塊仍隱藏。

## 驗證計畫
- 小驗證：入口測試及隔離瀏覽器確認圖示、樣式、連結。
- 主代理：整合後驗收與完整回歸。
- 隔離：隨機埠、ASM_REGRESSION 測試服務、獨立無頭 Edge。

## 變更紀錄
- 2026-09-18：初始定義與實作。
