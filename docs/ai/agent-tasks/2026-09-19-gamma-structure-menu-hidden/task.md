# 2026-09-19-gamma-structure-menu-hidden：移除空白 Structure 工具列黑點

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：a0a1cb814b2d5d9d2a5fb1b4e65ff24466193342
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：開啟指定 deck 的一般投影片編輯畫面，未展開 Structure 格子工具列。
- 目前行為：畫面出現 12×12 像素深色圓角黑點。
- 使用者希望的結果：確認來源並讓已隱藏的工具列完全不顯示。
- 本次範圍與必要限制：Structure context menu CSS 與聚焦前端驗證。

## 需求確認
- 已從使用者或上下文確認：使用者提供實際頁面與問題元素 HTML。
- 尚待使用者回答：無。
- 代理採用的合理假設：工具列正常展開時仍需維持 flex 排列。

## 重現與調查
- 最小操作步驟或 fixture：檢查 `#structureContextMenu.structure-cell-style-toolbar[hidden]` 的 computed style 與 bounding rect。
- 重現狀態：已重現。
- 已確認事實：元素雖有 `hidden`，後段 `.structure-context-menu.structure-cell-style-toolbar { display:flex }` 與 hidden 規則同優先度且出現較晚，造成 hidden 容器仍顯示為深色 12×12 方塊。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.css`、`slides.html`、Structure 與入口測試。
- 共用檔案／介面與協調結果：不改 DOM 或 deck 格式。
- 依賴任務：無。

## 驗收條件
- [x] 帶有 `hidden` 的 cell style toolbar computed display 為 `none`。
- [x] 點選 Structure 格子後工具列仍可正常展開與操作。
- [x] 前端入口載入新的 CSS 版本。

## 驗證計畫
- 子代理小驗證：Structure annotations 聚焦瀏覽器測試、入口測試、diff 檢查。
- 主代理整合驗收：在使用者提供的 deck 開啟同一頁，確認原黑點消失，格子 Style 工具列仍正常。
- 測試隔離方式：自動測試使用隨機本機埠與獨立瀏覽器；實際頁面只做唯讀檢查。

## 變更紀錄
- 2026-09-19：依實際頁面、元素 HTML 與 computed style 建立任務並完成修正。
