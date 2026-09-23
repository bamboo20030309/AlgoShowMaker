# 2026-09-23-gamma-inline-script-live 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：2ddbb6dffd5b894358c3329ecb4a97c88289185a
- 程式修正 commit：fbfa1933dae64e14499b75ddb9fdefb25746ab54
- 驗證時的 HEAD 與未提交修改：程式驗證內容對應 fbfa1933dae64e14499b75ddb9fdefb25746ab54；程式 commit 後工作樹乾淨，之後僅新增本交付紀錄與更新 task 狀態。
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：既有 `applyInlineScripts` 在文字物件仍為 `isEditing` 時直接返回；Fabric 的離開編輯事件執行期間也可能仍保持該旗標，因此輸入 `1^n` 時不會即時套用，離開後亦可能漏套用。
- 修正方式與行為變化：每次文字輸入前暫時還原可編輯的基礎樣式，`text:changed` 後立即重建上下標樣式；離開編輯及文字 undo/redo 後重新確認顯示樣式。未完成的 `^`／`_` 維持普通文字。
- 修改檔案及用途：`public/slides.js` 調整文字編輯事件與上下標套用生命週期；`public/slides.html` 更新腳本快取版本；`tests/special-text-cursor.browser.test.js` 驗證即時上標、復原、重做與離開編輯。
- README／版本紀錄／使用說明更新：不適用；語法與既有按鈕不變，本次修正既有行為。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 輸入 `1^n` 後編輯中立即顯示 | headless Edge 逐字輸入並讀取 Fabric 樣式 | `^` 為透明、`n` 的 `deltaY` 為負值且仍在編輯 | 通過 |
| 繼續輸入、離開及重新呈現保持正確 | 同一瀏覽器案例離開編輯後再次讀取樣式 | 原始文字保留，離開後上標樣式仍存在 | 通過 |
| 復原維持文字、游標及上下標格式 | 專項案例執行 undo/redo；另跑既有文字 undo 測試 | undo 回到不完整 `1^` 時不隱藏符號，redo 後恢復上標；既有測試通過 | 通過 |

## 小驗證與重跑方式
### 語法與差異檢查
- 目的與對應條件：確認前端腳本語法及提交差異格式。
- 執行目錄與必要環境設定：`algo-vis-backend`；無額外設定。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/slides.js`；在 worktree 根目錄執行 `git diff --check`。
- 預期結果：exit code 0，無差異錯誤。
- 實際結果與 exit code（適用時）：兩者 exit code 0；Git 僅提示 Windows 行尾轉換。
- 證據位置：本交付紀錄摘要；未保留暫存 log。

### 行內上下標單元測試
- 目的與對應條件：確認 `_`、`^`、群組與跳脫語法未退化。
- 執行目錄與必要環境設定：`algo-vis-backend`；無額外設定。
- 測試資料／fixture：測試檔內字串 fixture。
- 完整指令或操作步驟：`node --test tests/slide-inline-scripts.test.js`
- 預期結果：2 項測試通過。
- 實際結果與 exit code（適用時）：2 passed、0 failed，exit code 0。
- 證據位置：`tests/slide-inline-scripts.test.js`。

### Fabric 文字瀏覽器驗證
- 目的與對應條件：驗證 `1^n` 即時呈現、undo/redo、離開編輯及特殊字元游標。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隨機埠及 headless Edge。
- 測試資料／fixture：測試內臨時匯入 deck，不使用使用者資料。
- 完整指令或操作步驟：`node --test tests/special-text-cursor.browser.test.js`
- 預期結果：1 項測試通過。
- 實際結果與 exit code（適用時）：1 passed、0 failed，exit code 0，約 3.0 秒。
- 證據位置：`tests/special-text-cursor.browser.test.js`。

### 既有文字復原驗證
- 目的與對應條件：確認一般文字選取、樣式及 undo/redo 未受影響。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隨機埠及 headless Edge。
- 測試資料／fixture：測試內臨時匯入 deck。
- 完整指令或操作步驟：`node --test tests/slides-text-undo.browser.test.js`
- 預期結果：1 項測試通過。
- 實際結果與 exit code（適用時）：1 passed、0 failed，exit code 0，約 2.7 秒。
- 證據位置：`tests/slides-text-undo.browser.test.js`。

## 驗證分級與選擇
- 層級：V1
- 分類：B（投影片元件／歷史）
- 選擇依據：修改一般 Fabric 文字編輯、即時樣式與 undo/redo，不涉及動畫、trace 或播放。
- 執行的測試檔／名稱篩選：`slide-inline-scripts.test.js`、`special-text-cursor.browser.test.js`、`slides-text-undo.browser.test.js`，皆完整執行且無 skip。
- 驗證環境與隔離服務：各瀏覽器測試使用隨機埠、獨立 headless Edge 與臨時 deck。
- 驗證版本、完整指令、結果與證據：程式內容為 fbfa1933dae64e14499b75ddb9fdefb25746ab54；指令與結果如上。
- 未執行的驗證及原因：未執行演算法驗證集與完整 regression；本次為非動畫文字編輯修正，依 V1 分級不執行。
- 需要主代理做的 V3 驗證：無；主代理應在整合版手動輸入 `1^n` 並確認立即顯示及復原。

## 剩餘事項與合併注意
- 未驗證項目及原因：未驗證所有輸入法組字情境；實作會在組字完成後套用格式，建議主代理視需要抽查中文輸入後接上下標。
- 已知問題或風險：即時上下標會將語法符號隱藏，游標仍依原始字串索引運作；這是既有呈現規則延伸到編輯期間。
- 相依與衝突注意：`public/slides.js` 的 `wireCanvas`、文字 undo 與 `applyInlineScripts` 若整合分支同期修改，需人工合併事件順序。
- 主代理需補驗證的情境：開啟一般文字物件的上下標功能，逐字輸入 `1^n`，確認 `n` 立即上標；執行 undo/redo 並離開編輯。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
