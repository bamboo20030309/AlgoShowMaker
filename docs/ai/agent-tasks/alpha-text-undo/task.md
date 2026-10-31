# alpha-text-undo：投影片文字編輯復原

## 任務資訊
- 負責代理：alpha 開發代理 text_undo
- 狀態：整合驗收通過（V1 針對性驗證）
- 共同基準 commit：a524dd83b00f6ce137cf651fc7511219c2f0b772
- 分支：codex/2026-09-18-alpha-text-undo
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-text-undo

## 問題與預期結果
- 情境與操作：投影片 Fabric 文字編輯中選取文字、打字，按 Ctrl+Z。
- 目前行為：hiddenTextarea 被一般 DOM 編輯排除條件攔下；瀏覽器原生復原可能恢復字串，但增加新 deck 快照並破壞字元樣式。
- 使用者希望的結果：文字編輯中可復原及重做。
- 本次範圍與必要限制：保持文字物件、樣式與編輯游標；一般 input/textarea/Ace 使用原生快捷鍵；不操作使用者投影片或分頁。

## 需求確認
- 已從使用者或上下文確認：使用者指出文字選取打字時無法復原；主代理指定共同基準與分工。
- 尚待使用者回答：無。
- 代理採用的合理假設：Ctrl/Meta+Z、Ctrl/Meta+Shift+Z、Ctrl/Meta+Y 都應支援；組字中交由 IME 操作。

## 重現與調查
- 最小操作步驟或 fixture：獨立瀏覽器匯入只有文字的 fixture，雙擊文字、選取、取代、復原。
- 重現狀態：已重現；基準 Ctrl+Z 後 historyIndex 由 2 增至 3，正確應為 1，且取代文字樣式未正確還原。
- 已確認事實：全域 keydown 的 isEditableDomTarget 在 undo 前 return；text:changed 每次已保存 deck 快照；既有 restoreHistory 重載 canvas 會退出文字編輯。
- 主代理實際匯入線篩 deck 補验發現首次編輯多物件頁面仍 fallback：整張 canvas 序列化會補齊未編輯兄弟物件的預設欄位，與匯入 raw JSON 差異被當成其他操作。已以單頁 2 textbox + rect fixture 重現並修正；進入文字編輯前提交待保存顏色歷史，再只正規化 live/history 當前 slide.canvas，不新增歷史步。
- 尚待調查：無；已驗證 browser 合成 IME 事件契約，未執行 OS 中文輸入法實測。

## 修改邊界與依賴
- 預計修改檔案或模組：public/slides.js、public/slides.html 快取版本、新增 tests/slides-text-undo.browser.test.js、本任務文件。
- 共用檔案／介面與協調結果：主代理同意；不修改 deck 格式。wireCanvas sync 改依 slide.id 取最新 slide，修復普通 deck undo 後再編輯保存至舊 slide 的相依問題。
- 依賴任務：無。

## 驗收條件
- [x] 選取取代、插入、刪除後可連續復原／重做，保留樣式與合理選區。
- [x] 復原後繼續打字會清除重做分支，保持同一編輯物件與 textarea 焦點。
- [x] 匯入含多個文字與圖形的頁面後首次編輯可原地復原，未編輯物件不變，進入編輯不增加歷史步。
- [x] IME 組字中不攔快捷鍵，完成文字作為一次歷史操作（合成事件契約）。
- [x] 一般 DOM textarea/input 及 Ace 快捷鍵仍交由原生處理（Ace 委派邊界）。

## 驗證計畫
- 子代理小驗證：語法與差異檢查；獨立 headless Edge 真實鍵盤文字瀏覽器測試、既有 LaTeX 復原測試。
- 主代理整合驗收：依使用者最新要求與驗證分級通知，採 V1 語法／差異檢查及文字、LaTeX、入口三項相關測試；以原線篩 deck 做文字復原與動畫前後步進定點操作，不執行大規模回歸。
- 測試隔離方式：隨機埠、獨立伺服器及瀏覽器 context，fixture 不寫入使用者 deck；node_modules junction 唯讀復用現有相依。

## 變更紀錄
- 2026-09-18：初始定義。使用者多代理分工規定子代理小驗證、主代理合併後完整回歸。
- 2026-09-18：主代理實際 deck 補驗揭露兄弟物件首次序列化相依問題，新增嚴格多物件驗收，主代理同意只正規化目前 slide.canvas 基線。
- 2026-09-18：使用者指定「這個不用跑大規模驗證」；依最新 AGENTS.md 與子代理驗證分級通知，改採 V1 針對性整合驗收，並記錄實際驗證範圍。
