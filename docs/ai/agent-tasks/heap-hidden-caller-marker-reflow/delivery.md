# heap-hidden-caller-marker-reflow 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-21-beta-BIT
- 共同基準 commit：c939917827bf110fa98654cc93fe683d96172844
- 程式修正 commit：441dfbe784d2a89f803c96872e278b01baa9425a
- 驗證時的 HEAD 與未提交修改：441dfbe784d2a89f803c96872e278b01baa9425a；無未提交修改
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：目的幀已建立 caller `i` 的 DOM，但其入場受事件 barrier 延後。離場 `now` 的 peer 掃描仍把這個不可見元素視為同格同伴，因此在 `i` 真正入場前就採用雙指標排列。修正前第五幀 `now.x = 578.936`，轉場約 211ms 變為 `588.504`。
- 修正方式與行為變化：從同格舊 marker 的賦值／位置／退場事件計算每個新 marker 的入場 barrier；延遲 marker 不參與預先重排、播放計畫的立即入場，也不參與 outgoing ghost 的 peer 排列。各 marker 依自己的 barrier 入場。
- 修改檔案及用途：`public/trace-frame-tween.js` 修正排程；`tests/unresolved-markers.test.js` 驗證排程契約；`tests/fixtures/heap-caller-marker-reentry.cpp` 提供 34 幀最小案例；`tests/heap-caller-marker-reentry.browser.test.js` 以實際下一步操作抽樣標籤座標。
- README／版本紀錄／使用說明更新：不適用；本次不改使用者介面或指令語法。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| `i` 尚未入場期間，`now` 不向右讓位 | 3102 實際第五幀按下一步，50ms 取樣 motion opacity 與 label x | `i` motion opacity 為 0；`now.x` 由 578.936 保持為 578.936 | 通過 |
| `now` 完成後才顯示 `i` 並回到單指標中央 | 同一轉場完成後讀取 marker DOM 與畫面 | `now` 已移除，只保留中央的 `i`，x 為 578.936 | 通過 |
| unresolved marker 專項維持正常 | 執行完整 `unresolved-markers.test.js` | 63 通過、0 失敗、0 skip | 通過 |

## 小驗證與重跑方式
### 指標排程單元測試
- 目的與對應條件：確認延遲 caller entrance 等到 outgoing parameter 結束，且不可參與 outgoing ghost 讓位。
- 執行目錄與必要環境設定：`algo-vis-backend`；無 HTTP 服務。
- 測試資料／fixture：測試內建立 `main:i` 與 `sift_down:now` 的同格生命週期。
- 完整指令或操作步驟：`node --test tests/unresolved-markers.test.js`
- 預期結果：全部案例通過。
- 實際結果與 exit code（適用時）：63 通過、0 失敗、0 skip；exit code 0。
- 證據位置：測試檔與本交付摘要；未保存暫存 log。

### 3102 瀏覽器最小案例
- 目的與對應條件：以真實 SVG 與使用者下一步路徑確認不可見 `i` 不改變 `now` 的橫向位置。
- 執行目錄與必要環境設定：beta `algo-vis-backend`；`ASM_TEST_BASE_URL=http://127.0.0.1:3102`；3102 載入 `trace-224`。
- 測試資料／fixture：`tests/fixtures/heap-caller-marker-reentry.cpp`，輸入 `10` 與 `10 67 24 1 5 36 5 11 24 100`。
- 完整指令或操作步驟：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:3102'; node --test tests/heap-caller-marker-reentry.browser.test.js`
- 預期結果：第五幀進入第六幀時，`i` opacity 為 0 的期間 `now.x` 不變。
- 實際結果與 exit code（適用時）：1 通過、0 失敗、0 skip；exit code 0；人工抽樣同樣得到 578.936 → 578.936。
- 證據位置：專項測試檔與本交付摘要；未保存瀏覽器暫存影像。

### 語法與差異檢查
- 目的與對應條件：排除 JavaScript 語法錯誤與 diff 空白錯誤。
- 執行目錄與必要環境設定：beta `algo-vis-backend`。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/trace-frame-tween.js`、`node --check tests/heap-caller-marker-reentry.browser.test.js`、`git diff --check`
- 預期結果：exit code 0。
- 實際結果與 exit code（適用時）：全部 exit code 0；Git 僅提示工作目錄換行格式，不是 diff 錯誤。
- 證據位置：本交付摘要。

## 驗證分級與選擇
- 層級：V2
- 分類：G（指標／生命週期／排程）、J（實際播放路徑）
- 選擇依據：修改 marker 入場 barrier 與離場 peer reflow，並影響實際 SVG 轉場。
- 執行的測試檔／名稱篩選：完整 `tests/unresolved-markers.test.js`；`tests/heap-caller-marker-reentry.browser.test.js`。
- 驗證環境與隔離服務：beta worktree 的 3102；獨立 headless Edge context；人工檢查使用代理建立的 3102 分頁。
- 驗證版本、完整指令、結果與證據：程式修正 commit 441dfbe784d2a89f803c96872e278b01baa9425a；結果見上方小驗證。
- 未執行的驗證及原因：未執行完整 regression 與廣泛演算法動畫，依使用者指示與 V2 分級只跑直接相關最小案例。
- 需要主代理做的 V3 驗證：合併時重跑相同第五至第六幀；若與其他 marker 排程變更同時整合，再抽查其他跨函式返回案例。

## 剩餘事項與合併注意
- 未驗證項目及原因：未驗證所有演算法的跨函式 marker 組合；本次範圍只驗證 heap 最小重現與同分類 63 個排程案例。
- 已知問題或風險：延遲入場判定依賴舊 marker 與新 marker 的相同 binding target；若未來 target 格式變更，需同步更新判定。
- 相依與衝突注意：`public/trace-frame-tween.js` 是動畫共用檔案，整合其他排程分支時需人工審查 5780 至 6240 附近的播放計畫衝突。
- 主代理需補驗證的情境：bottom-up heapify 第五至第六幀；callee 參數退場後 caller 迴圈指標恢復的同格案例。

## 主代理核實與整合（由主代理填寫）
- 狀態：已由主代理核實並整合至 `intergration`
- 核實的程式 commit 與 diff 範圍：`441dfbe`；整合時保留 `trace-228` 的延後進場播放階段，加入 hidden peer 排除後更新為 `trace-229`。
- 差異審查與必要重跑結果：`unresolved-markers.test.js` 與 `entrypoints.test.js` 共 65 項通過；3199 隔離服務的 Heap 實際播放案例 1 項通過；語法與 diff 檢查通過。
- 合併 commit：`e392f48`
- 完整 regression：依 V2 分級未執行；本次只影響同格 marker 退場與 caller marker 延後入場，已跑 G、J 類直接相關驗證。
- 演算法投影片實際驗證：使用 `heap-caller-marker-reentry.cpp` 在隔離服務確認 caller `i` 隱藏期間，outgoing `now` 不會提前橫移。
- 未完成或環境阻塞：無。
- 本機服務重啟：3100 已重啟為 PID 59108；`algorithm.html` 與 `slides.html` 皆回應 HTTP 200，並分別載入 `trace-229` 與 `slides-209`。
- Push／公開部署狀態：本輪整合與紀錄將推送 `origin/intergration`；未合併 main、未發布 Release 或公開部署。
