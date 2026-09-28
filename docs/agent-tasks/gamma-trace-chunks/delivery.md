# gamma-trace-chunks 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：3dd2bfb662bfb7da288fc4a97bf9f73120b6c542
- 程式修正 commit：3e0f922619f7b3bfd62da1d4907a47a731279a72
- 驗證版本：上述 commit 的相同程式內容；提交前執行局部驗證。文件修訂另行提交。
- 驗證日期：2026-09-28。

## 根因與修改
- 100×100 棋盤 fixture 在一幀前產生 96,013 個事件。舊 runtime 將事件完整放入 pending_events，後端一次讀取整個 JSONL，超過 20 MiB 即拒絕。
- runtime 2.0 分塊共享 type/signature/line/activation metadata，event ID 由原始 order 無損重建；每塊至多 1,024 筆或約 256 KiB。超大的單一事件獨立成塊，另受 16 MiB 限制。
- trace-chunk-store.js 以 64 KiB 讀取區塊、逐筆 gzip level 6，產生獨立 gzip member 與 offset/length 索引，再逐塊解壓讀回。事件還原後維持外部 v1 traceDocument，舊檔可直接讀取。
- server.js 使用共用 source metadata，串流 JSON/gzip 回應，清除 JSONL/gzip/index 暫存，追蹤失敗進入公開 error 欄位，不再只寫 debug。
- 實測追加兩處前端瓶頸修正：事件 occurrence key 改單次計數（相同保存鍵）；availability 在一次同步 probe 內共用 marker subset（不跨場景保存，finally 還原）。
- 原 fixture 矩陣 all style 以整列當 value，紅綠顯示斷言失敗。trace-rules.js 修正 all matrix selector 逐格判斷；保留原有明確 matrix range/cell 語法。
- README／使用說明：tests/README.md 新增重跑方式、資源限制及本次尚未實作的前端懶載入範圍。
- 與 task.md 差異：調查中追加上述瓶頸與矩陣 all selector 修正，已同步變更紀錄。

## 實際檔案大小
同一份 LF 來源的 checkerboard fixture；以下是 runtime trace，不是 asmdeck 或 HTTP 回應大小。MB 採十進位。

| 階段 | bytes | 約略大小 |
|---|---:|---:|
| 舊 runtime JSONL | 47,443,024 | 47.44 MB |
| 新版去重 JSONL | 18,048,134 | 18.05 MB |
| 99 個 gzip member 合計 | 654,450 | 654.45 KB |
| 分塊索引 | 5,336 | 5.34 KB |
| gzip + 索引 | 659,786 | 659.79 KB |

去重約減少 62.0%；gzip 本體比原始檔約減少 98.6%。比較的是實際檔案 stat bytes，非估算 gzip 比例。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 棋盤能 RUN 到畫布 | 獨立服務 + Edge 真實畫布 | 1 幀、11,000 格；0/1 正確，紅／綠 fill 存在；放大截圖確認 | 通過 |
| 不少事件／不改順序或內容 | 保存的舊 runtime frame 與新版解碼逐欄位 deepEqual | 96,013 events、frame source、state 完全一致 | 通過 |
| 實際尺寸 | 原始／去重／gzip／index stat | 上表 | 通過 |
| 舊資料與明確 false | v1 reader roundtrip；瀏覽器 old trace apply/save/reopen | false、0、空字串、自訂值保持；舊物件畫布可載入 | 通過 |
| 損毀與限制不略過 | 引用錯誤／事件數不符／截斷 gzip／無效 JSON／file/record/expanded/compressed/events 限額 | 明確 reject；server catch 回填 error | 通過（error UI 轉送由差異審查確認，未注入正式服務故障） |
| 指標分類不變 | 既有 studio-availability-preflight.browser.test.js | Fibonacci 與 marker fixture 的隱藏目標／lifetime 判斷通過 | 通過 |

## 小驗證與重跑方式
執行目錄：本 worktree/algo-vis-backend。Windows：Node、g++、Playwright Edge；瀏覽器測試自建隨機埠與測試 context，不使用使用者分頁。

1. `node --test tests/trace-chunk-store.test.js tests/event-defaults.test.js tests/entrypoints.test.js`
   - 13/13 通過，exit 0。原先 build 字串不同步已修正；保留版本斷言。
2. `node --test --test-name-pattern="matrix all selector" tests/matrix-renderer.test.js`
   - 僅新 selector 小案例，1/1 通過，exit 0；含舊 kind 缺省、ragged data 與 JSON 往返。
3. `node --test tests/trace-chunks.browser.test.js`
   - 1/1 通過，內部同隔離服務的既有 preflight 1/1 通過，exit 0。
   - 早期子程序繼承 NODE_TEST_CONTEXT 導致跳過已修正，現在必須看到 pass 1，不能用 exit 0 代替執行證據。
   - 原始顏色斷言失敗保留記錄，修正 all selector 後原斷言通過。
   - 截圖／摘要：`test-results/trace-chunks/checkerboard.png`、`browser-summary.json`。
4. node --check：server.js、trace-chunk-store.js、trace-events.js、trace-frame-tween.js、trace-rules.js、瀏覽器小測試；git diff --check 均通過。
5. 原始逐事件對照與尺寸：本機 `node test-results/culling-profile/checkerboard-chunks.cjs` 透過自建服務 preload `capture-chunks.cjs` 在暫存回收前保存；preload 調用實際 reader，使用 assert.deepEqual 比對舊 frame。
   - 證據：`test-results/culling-profile/dedup-summary.json`、`checkerboard-raw.jsonl`、`checkerboard-deduplicated.jsonl`、`checkerboard-deduplicated.chunks.gz`、同名 index。
   - 這些是本機忽略產物與診斷腳本，不隨 commit 保存，清理工作目錄後不可依賴。可提交 fixture 與格式／瀏覽器測試已涵蓋可重跑行為。

## 剩餘事項與合併注意
- 未执行完整 regression、全演算法、Docker 或遠端資料庫驗證；此為 gamma V2 局部交付。
- 分塊僅限制 I/O／壓縮的中間緩衝；目前前後端仍保留完整事件模型。前端按需載入事件、固定容量解碼快取及先顯示 state 再讀事件尚未實作，不能宣稱整個處理流程已為固定記憶體。
- gzip 是無損壓縮，解壓後仍須還原資料；沒有刪除初始化事件或調低事件判定。
- shared runtime 及 trace-events/tween/rules 如與其他分支重疊，主代理需核對版本號與事件／marker 行為，不以單純文字 merge 取代驗證。
- 建議主代理整合補驗：keep/loop record、多幀與標記 lifetime；實際範圍依整合內容選擇。
- Gamma 3103 已重啟：僅停止確認指向本 worktree 的 PID 38000，新 PID 75240；algorithm.html HTTP 200，events trace-53 / tween trace-257 / rules trace-29，/trace/analyze 1 frame。
- Push：使用者既有授權，交付文件提交後 push origin/codex/2026-09-22-gamma；未合併 integration/main、未公開部署。

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
