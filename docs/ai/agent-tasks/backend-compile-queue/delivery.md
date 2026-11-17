# 後端編譯佇列與工作隔離交付紀錄

## 完成內容

- 新增公平的編譯工作佇列，預設單 Worker、每位使用者同時一件、等待三件、全站等待 150 件。
- 使用帳號或伺服器簽章匿名 session 作為 owner；IP 僅保留每分鐘 600 次的粗粒度濫用保護。
- 瀏覽器會持久化隨機 session header，首次平行請求也歸入同一 owner。
- 等候中的連線中斷時會取消尚未開始的工作；回應提供 job id 與 queue wait time 標頭。
- 以 `AsyncLocalStorage` 隔離每個工作自己的 `debug_log`。
- g++ 新增 20 秒逾時與 256 KB stderr 上限；程式執行回應新增 `verdict`。
- `/trace/analyze` 對相同原始碼使用最多 100 筆的程序內 LRU 快取。
- Nginx 的 `/compile` 轉送真實來源資料、等待 360 秒並關閉 trace 回應緩衝。
- Docker Compose 只加入佇列與限流環境設定，未更動 CPU、記憶體或 PID 上限。

## 驗證分級與選擇

- 層級：V1（後端行為與部署設定，不涉及動畫呈現）
- 分類：L（後端／認證／執行保護）
- 選擇依據：修改 HTTP 編譯排程、請求身分、子程序限制與除錯紀錄隔離。
- 執行的測試：`compile-job-queue.test.js`、`compile-context.test.js`、`compile-owner.test.js`、`compile-session.test.js`、`execution-watchdog.test.js`、`http-payload-limits.test.js`、`asmdeck.test.js`。
- 結果：36/36 通過，0 skipped；`node --check` 與 `git diff --check` 通過。
- Compose：`docker compose config -q` 通過，只有既有 `version` 欄位過時警告。
- 隔離 HTTP 服務：localhost:3198；三個同時編譯依序取得 0ms、382ms、752ms 等候時間，三者皆 `OK`，結束後 queue 為 active 0／pending 0。
- 錯誤分類：實際確認 CE、OLE、TLE；MLE 未在 Windows 測試主機刻意耗盡記憶體。
- 分析快取：相同來源連續請求回應依序為 `MISS`、`HIT`。
- 斷線生命週期：TLE 工作開始後中斷客戶端，下一件仍等待 4122ms，直到前一個 child 關閉才開始；未因 HTTP close 提早釋放 Worker。
- 未執行完整 regression 或動畫驗證：本次未修改動畫解析或畫面。

## 舊有物件相容性

- 不適用：本次不修改投影片或其他持久化物件格式；`/compile` 保留原本同步 JSON 欄位並只新增 `verdict` 與回應標頭。

## 尚待後續

- 將編譯流程抽成回傳不可變結果的 Job，才能在 HTTP 層啟用相同工作的執行中去重與 trace 快取。
- 若單 Worker 的同步等待在實際 50 人壓測仍過長，再加入非同步 Job API／輪詢。
- Linux 正式環境若要精準辨識 OOM，使用 cgroup v2 的 `memory.max` 與 `memory.events`。
