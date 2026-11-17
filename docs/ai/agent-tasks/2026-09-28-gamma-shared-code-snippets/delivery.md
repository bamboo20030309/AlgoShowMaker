# 2026-09-28-gamma-shared-code-snippets 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：b89c10a49b56941c86a52d08af86c622072d2a1e
- 程式修正 commit：94f1a294919a48f130a8bd6df22b9f0e5a003014、9e976c304a425b5965c0ad1cb4017d51b1689f9b、8b9af8758907de39ee7bfd4559ae6372445af77c
- 驗證時的 HEAD 與未提交修改：8b9af8758907de39ee7bfd4559ae6372445af77c；無未提交程式修改
- 驗證日期：2026-09-28

## 根因與修改
- 已確認根因與證據：片段選擇原先依 frame ID 保存，因此同一條 `@frame` 指令的重複執行彼此獨立；片段列使用 `pre-wrap` 且右欄固定 300px，長行會被折成多行。
- 修正方式與行為變化：新增來源指令層級的明確 boolean 設定，透過既有 source selector 套用至同指令的所有幀，並保留舊逐幀資料相容。片段列從固定欄後向左排列、保留原始縮排、單行水平捲動，捲動時固定狀態與行號；純註解列及空白列不顯示。關閉事件列立即生效，不顯示確認警告。省略符號只代表實際未收錄的 C++ 程式碼，不把空白或註解缺口算入。右欄可調寬並保存，也可進入專注檢視。
- 修改檔案及用途：`trace-code-model.js` 處理自動與來源層級狀態；`trace-studio.js` 處理保存、同步與介面互動；`trace-studio.css` 處理版面；`trace-view-source.js` 處理空資料壓縮；`algorithm.html` 更新資源版本；相關測試補上模型、保存與瀏覽器行為。
- README／版本紀錄／使用說明更新：以 task／delivery 文件記錄；本次未新增對外 README 條目。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 自動篩選產生明確 true／false | `trace-code-snippet.test.js` 檢查每列 `autoIncluded` 與 `included` | 全部為 boolean | 通過 |
| 同指令所有幀同步，其他指令不受影響 | 模型測試與 headless Edge 切換同來源幀 | 同來源同步，其他來源維持原值 | 通過 |
| 保存、重新 RUN 與行位移還原 | `view-source-compaction.test.js` 往返並改變 frame ID／來源行 | 設定依來源 selector 還原 | 通過 |
| 舊逐幀資料相容 | 既有模型測試與來源層級優先規則 | 舊格式仍讀取 | 通過 |
| 長行不換行且 gutter 固定 | headless Edge 檢查 computed style、水平 overflow 與 sticky gutter | 符合 | 通過 |
| 可調寬、保存與專注檢視 | headless Edge 拖曳、讀取 localStorage、進出專注檢視 | 符合 | 通過 |
| 左靠、保留縮排且不顯示純註解／空白列 | headless Edge 量測捲動前後 gutter 座標，模型與瀏覽器檢查列內容 | gutter 座標不變，程式碼緊接固定欄，無純註解與空白列 | 通過 |
| 事件列關閉不警告 | headless Edge 點擊含事件動畫列 | 一次點擊後直接變成未收錄，沒有確認介面 | 通過 |
| 省略符號忽略空白及註解 | 模型測試以空白／註解缺口及實際隱藏程式碼缺口比較 | 前者無省略符號，後者保留省略符號 | 通過 |

## 小驗證與重跑方式
### 模型、保存與入口檢查
- 目的與對應條件：確認來源共用狀態、自動 boolean、保存相容及快取版本。
- 執行目錄與必要環境設定：`algo-vis-backend`；無額外設定。
- 測試資料／fixture：測試內建 trace fixture。
- 完整指令或操作步驟：`node --test tests/trace-code-snippet.test.js`；`node --test tests/view-source-compaction.test.js`；`node --test tests/entrypoints.test.js`
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：3/3、12/12、1/1 通過；exit code 0。
- 證據位置：測試輸出僅保留於本次本機工作階段。

### Trace Studio 瀏覽器局部驗證
- 目的與對應條件：確認同指令跨幀套用、長行捲動、固定 gutter、調寬保存與專注檢視。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隔離服務及 headless Edge。
- 測試資料／fixture：測試建立的 bubble sort trace 與長行。
- 完整指令或操作步驟：`node --test tests/trace-code-snippet.browser.test.js`
- 預期結果：全部互動與畫面條件通過。
- 實際結果與 exit code（適用時）：1/1 通過；exit code 0。
- 證據位置：測試輸出僅保留於本次本機工作階段。

### 程式碼呈現相關整合測試
- 目的與對應條件：確認既有程式碼片段呈現與事件高亮未回歸。
- 執行目錄與必要環境設定：`algo-vis-backend`；使用獨立 3197／3198 服務。
- 測試資料／fixture：`code-presentation.integration.test.js` 內建案例。
- 完整指令或操作步驟：以 `ASM_TEST_BASE_URL` 指向隔離服務執行整份測試；因第 35 項遇到請求頻率限制，再於全新服務用 `--test-name-pattern` 單獨重跑。
- 預期結果：35 項皆通過。
- 實際結果與 exit code（適用時）：首輪 34 項通過，最後一項因服務回傳「請求過於頻繁」失敗；該項於全新服務單獨重跑後 1/1 通過，exit code 0。
- 證據位置：測試輸出僅保留於本次本機工作階段。

### 語法與差異檢查
- 目的與對應條件：排除 JavaScript 語法錯誤與空白差異錯誤。
- 執行目錄與必要環境設定：專案 worktree。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/trace-studio.js`；`node --check public/trace-code-model.js`；`node --check public/trace-view-source.js`；`git diff --check`
- 預期結果：全部 exit code 0。
- 實際結果與 exit code（適用時）：全部通過；僅有 Git 的 CRLF 提示。
- 證據位置：測試輸出僅保留於本次本機工作階段。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression／全部 tests，符合前端局部修改的驗證分級與使用者不跑大規模驗證的要求。
- 已知問題或風險：來源文字完全相同且在同函式中重複出現時，以出現次序區分；若插入相同文字行使次序改變，該行設定可能需要重新選擇。
- 相依與衝突注意：依賴 `ASMTraceViewSource.sourceSelector`／`sourceMatches`；若整合分支同時修改 Trace Studio 片段保存，需合併來源層級欄位。
- 主代理需補驗證的情境：在 LCS 建表的實際 trace 中調整由同一 `@frame` 指令產生的第一幀，確認所有同來源幀同步並於重新 RUN 後保留。

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
