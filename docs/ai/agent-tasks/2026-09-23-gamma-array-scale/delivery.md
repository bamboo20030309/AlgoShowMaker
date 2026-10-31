# 2026-09-23-gamma-array-scale 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：0e0540b67e7b95a4851b274e1af601932d0fb57b
- 程式修正 commit：e224232e32b4d9aeab5cb57c1f75bcba36129c66
- 驗證時的 HEAD 與未提交修改：e224232e32b4d9aeab5cb57c1f75bcba36129c66；程式無未提交修改，交付文件另行提交。
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：長度欄與格子右鍵選單皆呼叫 `updateSelectedStructure`，該函式每次以變更後內容重新計算預設外框尺寸，沒有保留目前格子的顯示比例。
- 修正方式與行為變化：增減陣列格子時，以目前元件與自然尺寸計算實際縮放倍數，再按新格數的自然尺寸建立外框；超出投影片時限制在投影片內。其他 Structure 屬性維持原有尺寸處理。
- 修改檔案及用途：`slides.js` 保留格數變動時的縮放；`slides.html` 更新腳本快取版本；`structure-length-zero.browser.test.js` 驗證格子實際寬度、重載及右鍵選單；`entrypoints.test.js` 更新入口版號斷言；`task.md` 記錄任務。
- README／版本紀錄／使用說明更新：不適用；修復既有陣列編輯互動。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 長度欄增減格子後保持格子寬度；重載後仍一致 | 專項瀏覽器測試比較三格、五格、重載及再縮回三格的第一格畫面寬度 | 差異均低於 1.5px，格數與儲存內容正確 | 通過 |
| 右鍵選單新增／刪除保持格子大小與內容 | 專項測試操作 `Add after`、`Delete item` 並比較格子寬度及格數 | 格數 2→3→2，寬度差異低於 1.5px | 通過 |

## 小驗證與重跑方式
### 陣列格數與縮放瀏覽器測試
- 目的與對應條件：驗證長度欄、重載、右鍵增減格子時的實際畫面縮放。
- 執行目錄與必要環境設定：本 worktree 的 `algo-vis-backend`；測試以隨機埠啟動服務。
- 測試資料／fixture：測試內建三格 normal Structure deck，不讀取使用者投影片。
- 完整指令或操作步驟：`node --test tests/structure-length-zero.browser.test.js`。
- 預期結果：1 個測試通過。
- 實際結果與 exit code：1/1 通過，exit 0。
- 證據位置：已提交的測試檔；輸出僅留本次會話。

### 語法、入口與差異
- 目的與對應條件：確認腳本可解析、入口版號一致及差異無空白錯誤。
- 執行目錄與必要環境設定：本 worktree 的 `algo-vis-backend`。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`node --check public/slides.js`；`node --check tests/structure-length-zero.browser.test.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：皆 exit 0。
- 實際結果與 exit code：皆 exit 0。
- 證據位置：已提交的程式與測試檔；輸出僅留本次會話。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑大規模回歸；本修正屬 V1，依使用者要求不需要。
- 已知問題或風險：當新格數大到無法以目前大小放進投影片時，元件會縮小至投影片可容納的尺寸。
- 相依與衝突注意：`slides.js`、`slides.html` 為共用檔，整合時需核對同區域修改和入口版號。
- 主代理需補驗證的情境：整合後調整非預設大小的陣列長度，操作格子右鍵增減，並重載確認。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：gamma 3104 已重啟，PID 49308；HTTP 200，載入腳本版本 `inline-scripts-205`。
- Push／公開部署狀態：gamma 分支推送至 origin 供主代理核實；未公開部署。
