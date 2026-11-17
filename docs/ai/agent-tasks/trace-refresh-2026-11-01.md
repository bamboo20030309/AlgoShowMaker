# 公開範例 Trace 全量重建

## 任務與範圍

使用者要求所有 Trace 重新執行並載入一次。本次處理公開範例目錄中 15 份教材、36 個現行動畫；私人雲端投影片、使用者目前分頁與本機草稿不覆寫。歷史 ID 保存原結果，僅驗證可載入。

## 結果

- 36 個動畫經獨立服務重新分析、強制編譯、執行成功，更新公開投影片引用與命名 Trace 索引。
- 線篩首幀預覽、獨立完整動畫、manifest 與預設程式碼同步更新。
- 36 個舊結果另存歷史檔，目前 36 個現行與 44 個歷史結果都能以內容 ID 取得。
- 建置工具新增 `--force`，略過前端結果快取與後端執行檔／結果快取。
- 補正忽略規則，避免教材建置原始碼被 `build/` 規則漏掉。
- 新結果暴露 CRLF 與 Ace LF 比對問題：來源設定被誤判修改，導致自訂事件設定覆蓋；預設程式也被誤存私人草稿。比較時統一換行，保留真實內容修改與自訂值。

## 驗證

- 36 次公開動畫 RUN 全部成功。
- 隔離瀏覽器逐份核對 80 個結果：內容 SHA-256、幀數、首／中／末幀導航與 IndexedDB 讀回全部通過。
- `sample-trace-assets.test.js` 5 案例、`guest-gallery-assets.test.js` 2 案例、`default-algorithm-assets.test.js` 2 案例、`algorithm-default-sieve.browser.test.js` 3 案例、`algorithm-draft-storage.test.js` 4 案例，共 16 個相關案例通過。
- 失敗後僅續跑相關案例。獨立動畫大小測試原先假設完整 Trace 內嵌於教材，改比較教材加上其外部壓縮 Trace 的完整傳輸量；沒有改動產品預期上限。來源相等檢查忽略 CRLF/LF 差異，仍逐字比較其餘內容。
- 沒有執行全套 regression 或逐事件視覺大矩陣；本次證據限於重建、資料一致性與載入／導航。

詳細產物位於被忽略的 `algo-vis-backend/test-results/trace-rebuild/`，不提交執行紀錄或 server log。變更先留在 intergration，不合併 main、不發布 release。
