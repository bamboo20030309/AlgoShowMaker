# 2026-09-22-gamma-array-length-save 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：102a6ef9a5dd5f770e43d2df5e76a4b0d75bec0a
- 程式修正 commit：ff6d4315f897931b3eda9dc47524f65be882b873
- 驗證時的 HEAD 與未提交修改：ff6d4315f897931b3eda9dc47524f65be882b873；程式無未提交修改，交付文件另行提交。
- 驗證日期：2026-09-22

## 根因與修改
- 已確認根因與證據：長度欄只有 `change` 監聽，直接輸入數字但仍停留欄位時不會執行 `updateSelectedStructureLength` 與 `saveDeck`。
- 修正方式與行為變化：輸入後停止 300ms 即提交長度；Enter／離開欄位時沿用 `change` 立即提交。暫時清空欄位不自動改成 1，重複的相同長度不產生多餘儲存。
- 修改檔案及用途：`slides.js` 增加輸入後提交；`slides.html` 更新腳本快取版本；`structure-length-zero.browser.test.js` 增加不按 Enter、重載和逐位輸入驗證；`entrypoints.test.js` 更新入口斷言；`task.md` 記錄任務。
- README／版本紀錄／使用說明更新：不適用，修復長度欄既有的儲存行為。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 直接輸入長度且不按 Enter，陣列、草稿及重載後一致 | 專項瀏覽器測試填入 5，等待格數變化、讀取草稿並重載 | 5 格、內容 `5, 6, 7, 0, 0`，重載仍為 5 格 | 通過 |
| 逐位輸入兩位數；Enter 與補零／截短仍正常 | 專項測試逐位輸入 12，再輸入 2 並按 Enter | 12 格及已儲存內容；縮至 2 格後內容 `5, 6` | 通過 |

## 小驗證與重跑方式
### 陣列長度瀏覽器測試
- 目的與對應條件：驗證輸入後自動儲存、重載、兩位數輸入和既有 Enter 路徑。
- 執行目錄與必要環境設定：本 worktree 的 `algo-vis-backend`；測試自行啟動隨機埠服務。
- 測試資料／fixture：測試內建的三格 normal Structure deck；不讀取使用者投影片。
- 完整指令或操作步驟：`node --test tests/structure-length-zero.browser.test.js`。
- 預期結果：1 個測試通過。
- 實際結果與 exit code：1/1 通過，exit 0。
- 證據位置：已提交的測試檔；輸出僅留本次會話，無持久化報告。

### 語法、入口與差異
- 目的與對應條件：確認 JS 可解析、入口快取版號一致、差異無空白錯誤。
- 執行目錄與必要環境設定：本 worktree 的 `algo-vis-backend`。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`node --check public/slides.js`；`node --check tests/structure-length-zero.browser.test.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：皆 exit 0。
- 實際結果與 exit code：皆 exit 0。
- 證據位置：程式與測試檔已提交；輸出僅留本次會話。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑大規模回歸，依使用者要求與 V1 分級不需要。
- 已知問題或風險：無已知問題。
- 相依與衝突注意：`slides.js`、`slides.html` 為共用檔，整合時需核對同區域變更與快取版號。
- 主代理需補驗證的情境：整合後直接輸入陣列長度、停留欄位等待更新，再重開確認內容。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：gamma 3104 已重啟，PID 51920；HTTP 200，載入腳本版本 `inline-scripts-204`。
- Push／公開部署狀態：gamma 分支推送至 origin 供主代理核實；未公開部署。
