# alpha-text-undo：投影片文字編輯復原

## 任務資訊
- 負責代理：alpha 開發代理 text_undo
- 狀態：待交付
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
- 尚待調查：無；已驗證 browser 合成 IME 事件契約，未執行 OS 中文輸入法實測。

## 修改邊界與依賴
- 預計修改檔案或模組：public/slides.js、public/slides.html 快取版本、新增 tests/slides-text-undo.browser.test.js、本任務文件。
- 共用檔案／介面與協調結果：主代理同意；不修改 deck 格式。wireCanvas sync 改依 slide.id 取最新 slide，修復普通 deck undo 後再編輯保存至舊 slide 的相依問題。
- 依賴任務：無。

## 驗收條件
- [ ] 選取取代、插入、刪除後可連續復原／重做，保留樣式與合理選區。
- [ ] 復原後繼續打字會清除重做分支，保持同一編輯物件與 textarea 焦點。
- [ ] IME 組字中不攔快捷鍵，完成文字作為一次歷史操作。
- [ ] 一般 DOM textarea/input 及 Ace 快捷鍵仍交由原生處理。

## 驗證計畫
- 子代理小驗證：語法與差異檢查；獨立 headless Edge 真實鍵盤文字瀏覽器測試、既有 LaTeX 復原測試。
- 主代理整合驗收：合併後完整 npm run regression；相關演算法投影片實際驗證。
- 測試隔離方式：隨機埠、獨立伺服器及瀏覽器 context，fixture 不寫入使用者 deck；node_modules junction 唯讀復用現有相依。

## 變更紀錄
- 2026-09-18：初始定義。使用者多代理分工規定子代理小驗證、主代理合併後完整回歸。
