# 2026-09-28-gamma-text-auto-width：文字物件自動縮緊寬度

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：926ffb91a0ff3bfcec73376d312eba221ce15d8d
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：編輯一般 Text 物件，先輸入較長文字，再刪除或改成較短內容。
- 目前行為：Fabric Textbox 會因長字串擴張最低寬度，但文字縮短後不會縮回，物件會保留曾經出現過的最大寬度。
- 使用者希望的結果：未手動調整過寬度的 Text 維持自動縮緊模式，寬度跟隨目前最長一行；手動調整過寬度後保留使用者指定值。
- 本次範圍與必要限制：一般 Fabric Text；不改 Code、LaTeX、Structure 或 Table 尺寸模型；只執行前端局部驗證。

## 需求確認
- 已從使用者或上下文確認：預設應採自動縮緊，不能只增不減；寬度以目前最長文字行為準。
- 尚待使用者回答：無。
- 代理採用的合理假設：拖曳任何 Text 縮放控制點視為使用者明確設定寬度，模式切換為固定；Ctrl／復原仍由既有完整物件歷史處理。

## 重現與調查
- 最小操作步驟或 fixture：載入寬 600 的 Text，輸入長句後改成 `tiny\nx`，觀察寬度；再手動縮放後輸入單字。
- 重現狀態：已重現。
- 已確認事實：`Textbox.initDimensions` 只在內容超過既有寬度時提高 `dynamicMinWidth`，不會在內容變短時主動縮回；原資料沒有保存自動／固定寬度意圖。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.js`、`public/slides.html`、`tests/text-auto-width.browser.test.js`、`tests/entrypoints.test.js`。
- 共用檔案／介面與協調結果：新增 Fabric 自訂欄位 `asmTextWidthMode`，值為 `auto` 或 `fixed`，隨 deck 保存。
- 依賴任務：沿用 Fabric Textbox、inline scripts 與文字編輯歷史。

## 驗收條件
- [x] 新建及明確設為 `auto` 的 Text，輸入或刪除後縮到目前最長一行。
- [x] 自動寬度支援多行文字，較短行不影響最長行的寬度。
- [x] 手動縮放寬度後切換為 `fixed`，後續輸入不改動指定寬度。
- [x] 缺少新欄位且未產生自動換行的舊 Text 採 `auto`；已被寬度限制而換行的舊 Text 採 `fixed`。
- [x] 已保存的 `auto`／`fixed` 明確設定在載入、使用、儲存及重開時不被覆蓋。

## 驗證計畫
- 子代理小驗證：JS 語法、專項 headless Edge、文字編輯／inline scripts 相關既有測試、入口及 diff 檢查。
- 主代理整合驗收：整合後實際建立 Text，測試長文縮短、多行、手動改寬、儲存重開與復原。
- 測試隔離方式：專項瀏覽器測試使用隨機埠與臨時 deck，不操作使用者分頁或既有投影片。

## 變更紀錄
- 2026-09-28：依使用者要求新增 Text 自動縮緊與手動固定寬度模式。
