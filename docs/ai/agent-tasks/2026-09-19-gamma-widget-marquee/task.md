# 2026-09-19-gamma-widget-marquee：框選 LaTeX 與 Code 物件

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：65b8ba5af62f4691b8020d3572f0811716354717
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：在一般投影片編輯模式從空白處拖曳框選範圍。
- 目前行為：框選只由 Fabric canvas 處理，無法命中獨立 DOM layer 的 LaTeX 與 Code widget。
- 使用者希望的結果：框線覆蓋 LaTeX 或 Code 時，它們能和一般投影片物件一起被選取。
- 本次範圍與必要限制：一般投影片的框選命中與聚焦前端驗證；不執行大規模 regression。

## 需求確認
- 已從使用者或上下文確認：LaTeX 與 Code 物件必須能被框選。
- 尚待使用者回答：無。
- 代理採用的合理假設：同一套 DOM widget 選取邏輯也適用 Structure；框選採範圍相交即選取，並支援與 Fabric 物件混合選取。

## 重現與調查
- 最小操作步驟或 fixture：建立 LaTeX、Code 與 Fabric 文字物件，從空白處拖曳框線包住三者。
- 重現狀態：已重現。
- 已確認事實：Fabric 原生框選只知道 canvas 內物件，LaTeX／Code／Structure 儲存在 `slide.widgets` 並由 `.widget-layer` 呈現。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/slides.js`、`slides.html`、入口測試與新增聚焦瀏覽器測試。
- 共用檔案／介面與協調結果：不改 deck 格式；沿用 `.is-selected` 與既有多選操作。
- 依賴任務：無。

## 驗收條件
- [x] 框線與 LaTeX 相交時選取 LaTeX。
- [x] 框線與 Code 相交時選取 Code。
- [x] 框外既有 widget 選取在非加選框選後清除。
- [x] DOM widget 與 Fabric 物件可在同一次框選後進入既有多選操作。

## 驗證計畫
- 子代理小驗證：單一框選瀏覽器測試、入口檢查、JavaScript 語法與 diff 檢查。
- 主代理整合驗收：在整合版本實際框選 LaTeX、Code 及一般文字／圖形，確認選框與後續拖曳或對齊操作。
- 測試隔離方式：測試使用隨機本機埠、獨立瀏覽器與測試 deck。

## 變更紀錄
- 2026-09-19：依使用者回報建立並完成初始任務定義。
