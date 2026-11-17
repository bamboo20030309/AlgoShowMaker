# 範例預建 Trace 與多人後端快取交付紀錄

## 完成內容

- 13 份官方 guest decks 已內嵌 29 個預建 Trace；來源、輸入與目前引擎身分一致時直接播放。
- 新增 `prebuild:guest-decks`，依序重建官方範例並以原子替換更新 archive，避免產出半套檔案。
- 新增磁碟式 content-addressed artifact cache：執行檔依來源／編譯器／flags／引擎識別，Trace 再加入輸入與 trace 設定；提供 TTL、LRU、容量、租約與 pinned 支援。
- 官方投影片需要重建時會啟用共用快取；相同輸入命中 Trace，不同輸入重用執行檔。
- 新增 owner-scoped 非同步工作 API：提交、輪詢、下載結果、取消排隊工作；同 key 的同時請求共用一次執行。
- 非同步請求限制 512 KB 並先寫入有容量上限的磁碟 spool；結果以內容雜湊保存及串流下載，排隊工作與慢速下載不複製大型 Trace 到 Node 記憶體。
- 內部 dispatch 具有 420 秒 deadline，排隊 spool 保留 120 分鐘；429／5xx 會成為 failed 而不快取，監控只回傳彙總數字，不公開帳號或瀏覽器 owner ID。
- 匿名公平身分改由伺服器簽章的 HttpOnly cookie 管理，客戶端自訂 UUID 不再能建立無限 owner；結果下載另設每人速率及全站 8 條／每人 2 條並發串流上限。
- 1 GB 容器下將單次 Trace 上限收斂為 64 MB 展開資料、10 萬事件，避免合法的 TLE／OLE 保護之外仍因 Trace 物件膨脹造成 Node OOM。
- `/trace/analyze` 移到 worker thread 並加入有限佇列與 LRU，避免大量解析阻塞 Node 主事件迴圈。
- Nginx 啟用編譯回應 buffering；慢速客戶端不長時間占用 Node upstream 連線。
- Docker 新增 512 MB 持久化 artifact volume；原有 0.5 CPU、1 GB RAM、128 PIDs 上限未調高。
- 新增 `loadtest:compile`，以獨立瀏覽器 session 模擬 1～150 位使用者。

## 驗證分級與選擇

- 層級：V2（asmdeck 動畫載入、trace 還原）＋ L（後端執行保護、排程與快取）。
- 分類：C、D、J、L。
- 選擇依據：修改官方 archive、動畫重建入口、編譯／執行排程、分析 worker、Nginx 與 Docker 儲存。
- 語法及差異：所有新增／修改 JS 通過 `node --check`；`git diff --check` 通過。
- 模組與契約測試：`artifact-cache`、`compile-job-queue`、`compile-job-registry`、`trace-analysis-pool`、`compile-context`、`compile-owner`、`compile-session`、`asmdeck`、`entrypoints`、執行保護與 payload，相關案例最終 70/70 通過。
- 局部整合：`execution-watchdog`、`http-payload-limits`、`provenance`、`sample-progressive-load.browser`，11/11 通過；瀏覽器開啟快速排序範例時 `/trace/analyze` 與 `/compile` 都是 0 次，2/2 動畫 iframe 可播放。
- 實際 C++ 快取與非同步 API：隔離 3197 服務的 `compile-cache.integration.test.js`，2/2 通過；相同輸入 Trace HIT、不同輸入 executable HIT、跨 owner 查詢回 403。
- 50 人尖峰：使用全新快取的隔離 3197 服務執行 `loadtest:compile`，50/50 完成，工作階段 4.911 秒、10.18 jobs/s；結束時 active=0、pending=0、failed=0，公開 metrics 不含 owner map。
- 50 人測試結束後只有 1 個共用 executable 與 50 個按輸入區分的 Trace，非同步結果直接引用穩定 Trace artifact，沒有再複製 50 份結果。
- 容量邊界：非同步 API 的 600 KB 請求實測回 413；相同非同步請求在前一工作完成後再次送出仍成功，沒有 artifact key collision。
- 未執行完整 regression／廣泛排序／全部動畫：本次使用直接相關的官方範例瀏覽器測試及 C++ 快取整合測試，未發現需要擴大至 V3 的失敗。

## 舊有物件相容性

- 新 archive：官方匯出選項才加入 `prebuiltTraces`，雜湊與 provenance 驗證通過才使用。
- 舊 archive：缺少 `prebuiltTraces` 時維持原本 IndexedDB／伺服器重建流程。
- 既有內容：輸入、程式碼或引擎身分改變會拒絕預建 Trace，不覆蓋使用者修改。
- 往返：一般使用者 `ASMDeck.project()` 預設仍移除大型 Trace；官方預建選項 encode/decode 後可播放。
