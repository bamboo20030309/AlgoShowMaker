# marker-entrance-reflow-sync 交付驗證紀錄

## 交付資訊
- 狀態：整合驗收通過
- 分支：intergration
- 共同基準 commit：0373de1
- 程式修正 commit：b84ae1c9bd75efd749d17c7f969eb07c71ca452f
- 驗證時的 HEAD 與未提交修改：b84ae1c9bd75efd749d17c7f969eb07c71ca452f；無未提交修改
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：跨函式返回的目標幀同時含被呼叫函式的 `now` 退場與呼叫端 `i` 顯示。原排程在 trace 事件前先建立 `i`，使尚未入場的 `i` 提前參與 `heap[5]` 同格排列，將 `now` 往右推。
- 修正方式與行為變化：找出與新指標同格、且會在本幀經賦值／位置／退場事件離開的舊指標，建立事件 barrier；舊指標完成事件與退場後才執行新指標入場及其同格重排。
- 修改檔案及用途：`trace-frame-tween.js` 新增延後入場 barrier 與播放 phase，build 更新為 `trace-228`；`unresolved-markers.test.js` 增加呼叫端指標等待參數退場的最小案例。
- README／版本紀錄／使用說明更新：不適用；本次修正既有動畫排程。
- 與 task.md 的差異：共同基準延續前一輪已推送的 `0373de1`。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| `now` 完成移動與退場前 `i` 不參與讓位 | 最小時間線測試 | `i` 的入場起點為 `now` 退場 barrier 740ms；trace events 從 0ms 開始 | 通過 |
| `now` 退場後 `i` 才進入 heap[5] | 3100 實際重播第 5→6 幀 | 第 5 幀只有 `now` 置中；第 6 幀穩定後只有 `i` 置中，未再出現 `now` 預先右移 | 通過 |
| 一般同格入場行為不回歸 | `unresolved-markers.test.js` | 既有同步入場與讓位案例及全檔 63 個案例通過 | 通過 |

## 小驗證與重跑方式
### 指標播放排程專項
- 目的與對應條件：確認延後入場 barrier，並保留原有同格讓位規則。
- 執行目錄與必要環境設定：`algo-vis-backend`；既有 Node 環境。
- 測試資料／fixture：`tests/unresolved-markers.test.js`。
- 完整指令或操作步驟：`node --test tests/unresolved-markers.test.js`
- 預期結果：所有案例通過。
- 實際結果與 exit code（適用時）：63/63 通過，exit code 0。
- 證據位置：終端測試摘要；未提交額外產物。

### Heap 指標身分整合案例
- 目的與對應條件：確認 heap 函式參數與呼叫端指標維持不同 runtime identity 及正確事件順序。
- 執行目錄與必要環境設定：`algo-vis-backend`；3100 不需啟動。
- 測試資料／fixture：`tests/heap-marker-assignment.integration.test.js`。
- 完整指令或操作步驟：`node --test --test-name-pattern "bottom-up|parameter|caller|distinct runtime identities" tests/heap-marker-assignment.integration.test.js`
- 預期結果：相符案例通過。
- 實際結果與 exit code（適用時）：1/1 通過，exit code 0。
- 證據位置：終端測試摘要；未提交額外產物。

### 3100 實際播放
- 目的與對應條件：以使用者的 bottom-up heapify 程式與輸入重播第 5→6 幀。
- 執行目錄與必要環境設定：intergration 的 3100 服務；獨立 in-app browser 分頁。
- 測試資料／fixture：`10` 與 `10 67 24 1 5 36 5 11 24 100`。
- 完整指令或操作步驟：RUN 產生 34 幀，切至第 5 幀穩定狀態後按下一步。
- 預期結果：第 5 幀 `now` 置中；事件完成後第 6 幀 `i` 置中。
- 實際結果與 exit code（適用時）：符合；頁面載入 `trace-228`。
- 證據位置：隔離瀏覽器即時 DOM 與畫面；未提交截圖。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression；依 V2 分級只跑直接相關動畫專項。
- 已知問題或風險：延後入場以同格舊指標的賦值／位置／退場事件結束點為 barrier；多個延後入場物件以該幀最晚 barrier 一起入場。
- 相依與衝突注意：無。
- 主代理需補驗證的情境：無。

## 主代理核實與整合（由主代理填寫）
- 狀態：整合驗收通過
- 核實的程式 commit 與 diff 範圍：b84ae1c9bd75efd749d17c7f969eb07c71ca452f；播放排程、build ID、專項測試與任務定義。
- 差異審查與必要重跑結果：JavaScript 語法、`git diff --check`、63 個指標排程案例及 heap runtime identity 整合案例皆通過。
- 合併 commit：不適用；直接在 intergration 修正。
- 完整 regression：未執行；依 V2 分級採相關專項驗證。
- 演算法投影片實際驗證：3100 產生 34 幀，重播第 5→6 幀符合預期。
- 未完成或環境阻塞：無。
- 本機服務重啟：3100 已由 intergration worktree 啟動；`slides.html` 與 `trace-frame-tween.js` HTTP 200，build `trace-228`。
- Push／公開部署狀態：待推送 intergration；未公開部署。
