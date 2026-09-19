# 2026-09-19-gamma-structure-menu-hidden 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：a0a1cb814b2d5d9d2a5fb1b4e65ff24466193342
- 程式修正 commit：0879ef7b1c5a81d5757360c3e063cad24c923ce5
- 驗證時的 HEAD 與未提交修改：0879ef7b1c5a81d5757360c3e063cad24c923ce5；程式驗證時無未提交修改
- 驗證日期：2026-09-19

## 根因與修改
- 已確認根因與證據：實際頁面黑點的 bounding rect 為 12×12，元素是 `#structureContextMenu.structure-cell-style-toolbar[hidden]`；computed style 為深色背景、5px padding、flex display。後段雙 class flex 規則與 hidden 規則同優先度且較晚，覆蓋 `display:none`。
- 修正方式與行為變化：新增更精確的 `.structure-context-menu.structure-cell-style-toolbar[hidden] { display:none; }`，關閉時完全隱藏，展開時保留 flex 工具列。
- 修改檔案及用途：`public/slides.css` 修正規則；`slides.html` 更新 CSS 版本；Structure 與入口測試新增斷言。
- README／版本紀錄／使用說明更新：不適用；修正純視覺缺陷。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| hidden 工具列完全隱藏 | 頁面載入後讀取 attribute 與 computed display | `hidden=""` 且 display `none` | 通過 |
| 格子工具列仍能展開操作 | 重跑 Structure annotations 瀏覽器測試 | Style／註標工具列操作通過 | 通過 |
| 入口載入新版 CSS | entrypoints 測試與 3103 HTTP 檢查 | `structure-menu-hidden-104` 存在 | 通過 |

## 小驗證與重跑方式
### Structure 工具列瀏覽器測試
- 目的與對應條件：確認關閉狀態不顯示且格子工具列仍可使用。
- 執行目錄與必要環境設定：`algo-vis-backend`；隨機本機埠與獨立瀏覽器。
- 測試資料／fixture：既有 structure annotations fixture。
- 完整指令或操作步驟：`node --test tests/structure-annotations.browser.test.js`
- 預期結果：1 個測試通過。
- 實際結果與 exit code（適用時）：1 passed，exit code 0。
- 證據位置：終端摘要與已提交測試。

### 入口與差異檢查
- 目的與對應條件：確認新 CSS 版本與修改格式。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：既有入口 fixture。
- 完整指令或操作步驟：`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：全部通過，exit code 0。
- 證據位置：終端摘要。

### Gamma 預覽服務
- 目的與對應條件：套用修正供主代理與使用者檢查。
- 執行目錄與必要環境設定：gamma worktree，PORT 3103。
- 測試資料／fixture：無。
- 完整指令或操作步驟：核對 PID 與 gamma worktree 後只重啟 3103；請求 `/slides.html`。
- 預期結果：HTTP 200 且載入 `slides.css?v=structure-menu-hidden-104`。
- 實際結果與 exit code（適用時）：HTTP 200、版本存在；PID 52856。
- 證據位置：http://localhost:3103/slides.html

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行大規模 regression，依前端驗證分級規則。
- 已知問題或風險：使用者既有分頁需重新整理才會載入新 CSS URL。
- 相依與衝突注意：`slides.css`、`slides.html` 與入口測試為共用檔案，整合時保留較新版本字串。
- 主代理需補驗證的情境：使用指定 deck 重新整理後確認黑點消失，點選 Array／Heap 格子確認工具列正常。

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
