# 強制重編譯並執行

- 基準：intergration 7b59158；使用者要求在 RUN 右側新增按鈕與快捷鍵。
- RUN 右側新增「↻ 重編譯」，快捷鍵 Ctrl+Shift+Enter；Mac 為 Cmd+Shift+Enter。Ctrl/Cmd+Enter 仍為一般 RUN。
- 兩個操作共用同一 Run 流程與 busy 狀態；編譯期間兩按鈕禁用，快捷鍵連按不會新增請求。捕捉階段處理快捷鍵，避免 Ace 把快捷鍵轉成插入空行。
- 強制操作送出 request-only 的 forceRecompile=true，不修改原始碼、不寫進投影片持久化設定。
- 後端只有明確 true 才略過執行檔與 Trace 快取的讀寫，記錄 FORCE_RECOMPILE 並回傳 BYPASS。既有省略欄位／false 的客戶端維持原有行為。
- 保留其他請求的共用快取，仍遵守編譯佇列、限流、執行時間／輸出／記憶體限制，不新建不受限的編譯路徑。
- 前端版本 compile syntax-11、front random-id-49、algorithm 的 style brand-shared-11。

## 驗證

- `node --test tests/force-recompile.browser.test.js tests/entrypoints.test.js`：2 pass / 0 fail。
- 獨立服務與 Edge 頁面，以只在測試进程載入的 preload 記錄真實 compiler spawn；首次一般 RUN 啟動一次，再次一般 RUN 不新增 compiler。
- 預先暖好共用 Trace 與執行檔快取，再送 forceRecompile=true：兩種快取回應 BYPASS，確實新增 compiler spawn 且正常輸出 17。
- 點擊新按鈕、在 Ace 內按 Ctrl+Shift+Enter、Cmd+Shift+Enter：每次都新增一次 compiler；Ctrl+Enter 仍命中舊執行檔快取。快捷鍵不修改原始碼。
- 延遲一個請求，確認兩按鈕停用、兩種快捷鍵不新增請求，完成後恢復可用；新按鈕位置位於 RUN 右側；pageerror 為空。
- 編譯流程依賴改變，續跑 `node --test tests/no-drawing-transition.browser.test.js tests/empty-compile.integration.test.js`：3 pass / 0 fail，核實空白 Run 不崩潰、KMP 切換正確。
- server.js、compile.js、front.js 語法與 git diff --check 通過。沒有執行大型動畫驗證。
- 修正推送 intergration，重啟 3100 並核對新前端版本；未合併 main／發布 release。
