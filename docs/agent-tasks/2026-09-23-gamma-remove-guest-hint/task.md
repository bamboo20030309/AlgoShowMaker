# 2026-09-23-gamma-remove-guest-hint：移除範例投影片免登入觀賞提示

## 任務資訊
- 負責代理：gamma
- 狀態：開發中
- 共同基準 commit：df34c04ebc61808e7e46df62387795a02f8a3f1a
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：開啟首頁的範例投影片列表。
- 目前行為：每個範例縮圖的分類後方顯示「免登入觀賞」。
- 使用者希望的結果：移除這段提示，分類文字仍正常顯示。
- 本次範圍與必要限制：只修改範例投影片卡片的可見提示與資源版本，不變更免登入開啟範例的能力。

## 需求確認
- 已從使用者或上下文確認：移除範例投影片的「免登入觀賞」提示；完成後 push；不跑大規模驗證。
- 尚待使用者回答：無。
- 代理採用的合理假設：保留頁面 meta description，因使用者指的是範例卡片上的可見提示。

## 重現與調查
- 最小操作步驟或 fixture：開啟 `/?examples=1`，查看任一範例卡片的分類文字。
- 重現狀態：已重現。
- 已確認事實：提示由 `public/guest-gallery.js` 組合在 `.deck-meta` 文字中。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/guest-gallery.js`、`public/index.html`、`tests/entrypoints.test.js`。
- 共用檔案／介面與協調結果：遞增 `guest-gallery.js` query 版本避免瀏覽器舊快取。
- 依賴任務：無。

## 驗收條件
- [ ] 範例卡片不再顯示「免登入觀賞」。
- [ ] 範例卡片仍顯示所屬演算法分類，點擊行為不變。

## 驗證計畫
- 子代理小驗證：JavaScript 語法、入口資源版本與文字差異檢查。
- 主代理整合驗收：在整合預覽開啟範例列表，確認分類存在且提示已移除。
- 測試隔離方式：靜態局部檢查；不操作使用者資料或執行演算法 regression。

## 變更紀錄
- 2026-09-23：依使用者要求建立任務並移除範例卡片提示。
