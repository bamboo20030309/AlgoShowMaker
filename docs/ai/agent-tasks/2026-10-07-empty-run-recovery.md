# 空白 Run 導致伺服器退出

- 基準：intergration 6397a82；使用者回報空程式碼 Run 讓 3100 整個服務崩潰。
- 真實服務 stderr：artifact-cache.js 的 requireValue 拋出 `TypeError: source is required`，來源 server.js 建立 executableKey。
- 原因：只驗證 code 是字串，沒有拒絕空字串；Express 4 不會自動捕捉 async 路由 Promise rejection，Node 22 因未處理的 rejection 退出。
- 修正：/compile 與 /api/compile/jobs 都拒絕空字串和純空白，回應 HTTP 400 / EMPTY_SOURCE。編譯準備階段的 Promise 例外在請求內捕捉，回應 HTTP 500 / COMPILE_PREPARATION_ERROR 並釋放工作槽。
- 不放寬快取鍵要求、不以全域 uncaughtException 繼續執行不明狀態、不刪除快取或資料。

## 驗證

- `node --test tests/empty-compile.integration.test.js`：2 pass / 0 fail。
- 隔離服務測兩個 API 的空字串、純空白、缺少 code、null、數字、物件：均回應 400，服務仍存活、工作槽歸零，後續有效程式輸出 ALIVE_AFTER_EMPTY。
- 只在獨立測試進程 preload 故障 fixture，強制 cache-key 建立例外：HTTP 500，請求獨立 debug_log 記錄故障，服務仍存活、槽位釋放、下一個有效編譯 OK。
- `node --test tests/no-drawing-transition.browser.test.js`：1 pass / 0 fail。加入實際空編輯器按 Run 的步驟，畫面顯示「程式碼不能為空白」，舊動畫清空，接著 KMP 仍成功產生 34 幀。
- server.js 語法與差異檢查通過；僅執行本次相關小驗證，不執行大型演算法集合。
- 不操作使用者頁面或投影片，測試使用獨立服務與 Edge context。故障 fixture 不由正式服務載入。
- 修正留在 intergration，未合併 main／發布 release；重啟 3100，其他服務不變。
