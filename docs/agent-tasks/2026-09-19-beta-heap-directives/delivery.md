# 2026-09-19-beta-heap-directives 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-beta
- 共同基準 commit：f66bf9f0066bd66ff1c6ad9eb011cbb805ec6984
- 程式修正 commit：`2950085051806374de7b029fb37d49dc6180a4e1`、`3373b8e1fcb29e7f18f29ae3f9503cbb68b63b6c`
- 驗證時的 HEAD 與未提交修改：程式內容與 commit `3373b8e1fcb29e7f18f29ae3f9503cbb68b63b6c` 相同；當時只有本任務文件尚未提交。
- 驗證日期：2026-09-19

## 根因與修改
- 已確認根因與證據：heap.cpp 仍使用 AV.hpp、AV 物件與 frame_draw；目前指令手冊及 heap_sort 已有 heap render、range、style、text、keep 的替代能力。
- 修正方式與行為變化：改用註解指令顯示插入、向上調整、top、刪除與向下調整；向下調整改為標準左右子節點選最大寫法。後續依使用者修正移除 input 畫面，使用可追蹤的整數上界確保只顯示 1-based heap，並移除交換格背景色及自訂 highlight 顏色。
- 修改檔案及用途：heap.cpp 為新範例；task.md、delivery.md 記錄範圍及證據。
- README／版本紀錄／使用說明更新：不適用；未新增公開指令。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 不依賴舊 API | 靜態搜尋及差異審查 | `heap.cpp` 已移除 `AV.hpp`、`AV av`、`frame_draw` 與 draw 區塊 | 通過 |
| 既有輸入成功執行且輸出正確 | 隔離 analyze/compile 與瀏覽器 RUN | 最終版本產生 108 幀，輸出 `100 67 36 24 24 11 10 5 5 1`；瀏覽器可前進、後退且顯示 heap | 通過 |
| 不顯示 input，heap 採 1-based | Trace 文件及實際 SVG 檢查 | 第一幀 range 為 `[1,2)`，畫面只顯示值 `10` 與索引 `1`，沒有 `heap[0]` 或 input 物件 | 通過 |
| 交換格不塗背景色，highlight 使用預設 | 靜態搜尋及瀏覽器檢查 | 已無交換用 background style 或帶顏色的 highlight；相關格只使用 `highlight` | 通過 |
| 單一左子節點正確處理 | `3 / 10 9 1` 專用輸入 | 輸出 `10 9 1`，25 幀 | 通過 |
| 線段樹未修改 | `git diff --name-only` | 只有 heap sample 與本任務文件 | 通過 |

## 小驗證與重跑方式
### 指令分析、編譯與事件順序
- 目的與對應條件：確認指令可分析、C++ 可編譯、輸出正確，且每幀事件 order 為有限數字並保持遞增。
- 執行目錄與必要環境設定：`algo-vis-backend`；隔離服務 `PORT=32382`、`ASM_REGRESSION=1`。
- 測試資料／fixture：既有 `heap-sample_input.txt`，以及 6、3、2 個元素的縮小案例。
- 完整指令或操作步驟：啟動隔離 `node server.js`，再執行本機暫存檢查程式 `node tmp/beta-heap-check.cjs`；程式逐案呼叫 `/trace/analyze`、`/compile` 並檢查輸出、幀及 event order。
- 預期結果：四案成功且輸出由大到小。
- 實際結果與 exit code（適用時）：exit code 0；最終版本四案分別為 108、50、23、14 幀，輸出皆符合預期。
- 證據位置：結果已摘要於本文件；暫存檢查程式位於忽略提交的 `algo-vis-backend/tmp`，不作長期保存。

### 實際瀏覽器畫面與切換
- 目的與對應條件：確認 RUN 的真實載入路徑會建立 heap SVG，且上一步／下一步可操作。
- 執行目錄與必要環境設定：同一隔離服務；Playwright headless Edge，1600×900。
- 測試資料／fixture：既有 heap 範例與 sample input。
- 完整指令或操作步驟：`node tmp/beta-heap-browser.cjs`；於 `algorithm.html` 寫入範例、按 RUN、切換大步與三個小步、返回一步。
- 預期結果：輸出正確、畫面含 heap layout 與節點，無 page error 或 console error。
- 實際結果與 exit code（適用時）：exit code 0；共 108 幀，第一幀只顯示 1-based 的值 `10`／索引 `1`；切至第 4 幀時標籤為 `67`／`1`、`10`／`2`；錯誤 0。
- 證據位置：結果已摘要於本文件；隔離服務已停止，暫存檢查程式不提交。

### 靜態差異
- 目的與對應條件：確認無空白錯誤且 segment tree 未改動。
- 執行目錄與必要環境設定：beta worktree 根目錄。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`git diff --check`、`git diff --name-only` 與人工差異審查。
- 預期結果：無差異錯誤；修改邊界符合 task.md。
- 實際結果與 exit code（適用時）：exit code 0；僅有 Git 的 LF/CRLF 提示，無 diff error。
- 證據位置：Git commit 與本文件。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression、全部 tests 或其他演算法案例；依使用者要求與驗證分級不屬本次小驗證。
- 已知問題或風險：目前 beta 基準早於 intergration；本變更只碰 heap sample 與任務文件，主代理整合時應以 commit/diff 核實。
- 相依與衝突注意：無共用 runtime 修改。
- 主代理需補驗證的情境：整合版本實際載入 heap 範例並檢查關鍵動畫幀。
- 本機服務重啟：3102 目前可回傳新 heap 範例且 `algorithm.html` 為 HTTP 200；嘗試重啟時，自動審查因無法從作業系統取得既有 PID 的工作目錄而拒絕停止該程序，所以未重啟既有 3102 服務。

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
