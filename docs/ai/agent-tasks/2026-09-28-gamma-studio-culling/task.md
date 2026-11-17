# Trace Studio 可見縮圖載入
- 負責代理：gamma
- 狀態：待交付
- 基準：1b0537ab55431f2c0b004eb3bb7848a05d0bfc61（開始時工作樹乾淨）
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與需求
大量幀開啟編輯動畫時耗時，使用者要求只建立目前可見的約 7～8 個切片縮圖。
調查發現 SVG 已有 culling，但仍建立全部卡片 DOM，且 open 同步對所有幀執行隱藏場景的事件檢查。

## 邊界與方案
- trace-studio.js：固定卡片高度的虛擬清單，上下空白佔位保留完整捲動距離，只建立可見與前後各一張緩衝。
- 已離開畫面的卡片移除，縮圖沿用既有 24 筆上限快取與逐張排程。
- trace-renderer.js：新增單幀範圍的事件檢查；Studio 進入當前幀時才檢查，前一幀僅用於退場目標資訊。原完整 preflight API 仍可明確呼叫。
- 選取仍存於資料層；畫面外跳轉、重新開啟會捲到當前幀。
- 不改持久化格式、關鍵幀邏輯或底部輕量時間線。未訪問幀的事件可用性延至訪問時判定。

## 驗收
- 500 幀時卡片及初始 SVG 數量受視窗高度限制，非隨總幀數成長。
- 捲到最後、切換當前幀、外部跳轉中段、關閉重開均正常。
- 當前幀隱藏事件、指標目標、退場目標判斷保持原有標準。

## 小驗證
V2 / J：隔離隨機埠、Edge、合成 500 幀與既有事件可用性的小型 fixtures。
不啟動大型 regression，不操作使用者分頁與資料。
