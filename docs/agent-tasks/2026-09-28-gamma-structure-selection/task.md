# 2026-09-28-gamma-structure-selection：統一 Structure 格子與物件選取

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：033f52b50af17652b35c8ba3afcd9aa351222dc0
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：在投影片編輯模式點擊 Structure 的格子，或選取格子後按 Shift 點擊其他物件。
- 目前行為：第一次點格子會在同一次操作中先選整體再立即切成格子；Shift 點 Fabric 文字或形狀時會清除 Structure widget 選取。
- 使用者希望的結果：第一次點格子只選完整 Structure；完整 Structure 已選取後再點格子才選取格子。格子已選取時 Shift 點其他物件，Structure 應以完整物件參與多選。
- 本次範圍與必要限制：統一 Structure／Table 的格子選取與 DOM widget、Fabric 物件多選交界；執行前端局部驗證，不執行完整 regression。

## 需求確認
- 已從使用者或上下文確認：選取層級必須依「完整物件 → 格子」兩階段進入；Shift 多選不得把 Structure 留在格子層級。
- 尚待使用者回答：無。
- 代理採用的合理假設：Ctrl／Command 與 Shift 同屬加選操作，採用相同的格子升級為完整物件規則；Table 沿用 Structure 的格子選取核心。

## 重現與調查
- 最小操作步驟或 fixture：建立 Structure、Code 與 Fabric Text；直接點第一格兩次，再從格子狀態 Shift 點 Code 或 Text。
- 重現狀態：已重現。
- 已確認事實：DOM widget、Fabric canvas 與 Structure cell 各自保存選取狀態；pointer-down 會先選 widget，而 click 又立即選 cell；Fabric `selection:created`／`selection:updated` 原本無條件退出 widget 編輯。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.js`、`public/slides.html`、`tests/widget-marquee-selection.browser.test.js`、`tests/entrypoints.test.js`。
- 共用檔案／介面與協調結果：不改 deck 格式；只調整編輯器暫態選取流程。
- 依賴任務：沿用既有 widget 選取、Fabric ActiveSelection、Structure cell overlay。

## 驗收條件
- [x] 未選取的 Structure 直接點格子時，只選取完整 Structure。
- [x] 完整 Structure 已選取後再次點格子，顯示格子選取框。
- [x] 格子選取後 Shift 點 Code／LaTeX／Structure／Table 類 widget，原 Structure 以完整物件保留於多選。
- [x] 格子選取後 Shift 點 Text／Shape 類 Fabric 物件，原 Structure 以完整物件保留於混合多選。
- [x] 點擊空白處仍能清除完整物件與格子選取。

## 驗證計畫
- 子代理小驗證：`slides.js` 語法、入口資源、headless Edge 逐步點擊與 Shift 多選、diff 檢查。
- 主代理整合驗收：整合後以 Structure、Table、Code、LaTeX、Text 與 Shape 交叉加選確認工具列與刪除／移動操作。
- 測試隔離方式：瀏覽器測試自行啟動隨機埠並載入臨時 deck，不操作使用者分頁或既有投影片。

## 變更紀錄
- 2026-09-28：依使用者要求建立兩階段 Structure 格子選取與 Shift 完整物件多選規則。
