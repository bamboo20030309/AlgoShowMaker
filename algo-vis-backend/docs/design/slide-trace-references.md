# 投影片 Trace 引用與按需載入

日期：2026-10-05；開發分支：intergration。

## 儲存契約

- 編輯中的 deck、本機 IndexedDB deck 紀錄、雲端快照與 undo/redo 只保留動畫 `traceRef` 和 `traceView`。`traceRef` 是不含 studio／skins／rules 的執行結果 SHA-256；各頁的播放設定仍獨立保留。
- Trace 本體在 IndexedDB `algoshowmaker-drafts-v1` 的 `traces` store，以及雲端 `SlideResourceChunk` 保存。文字、位置或播放設定修改不重新雜湊、複製或上傳完整 Trace。
- 雲端投影片用 `?traceMode=lazy` 讀取；進入動畫頁才建立 runtime iframe，再透過 `/api/slides/:deck_uid/traces/:key` 或 `/api/shared-slides/:share_token/traces/:key` 取得結果。已讀取結果存入 IndexedDB。
- 頁面記憶體保留最多兩份讀取結果與兩個 runtime iframe。讀取失敗顯示錯誤，切回頁面可重試。
- 擁有者與分享編輯者可讀取同一份 deck 的近期歷史结果以支援 undo；分享檢視者只能讀取目前快照引用的結果。分享停止後 API 拒絕存取。

## 相容與資料生命週期

- 舊的內嵌 Trace 在本機載入／匯入時轉成 ID。舊雲端紀錄第一次提交新快照時由伺服器搬移結果，不要求瀏覽器下載全部動畫再上傳。
- 新動畫結果建立新 ID；既有自訂 skins／rules／studio 和明確的 false 不被預設值覆蓋。當前工作階段中的歷史引用受保護。
- 雲端未引用的歷史資料沿用 48 小時清理，保留目前快照所需結果。本機儲存只清除本次移除且沒有保留引用的結果，避免清掉其他分頁尚未完成的匯入。
- 可攜式 `.asmdeck` 匯出仍在獨立 `prebuiltTraces` 資料區附帶結果，離線匯入可播放；這是匯出包的資料，不是編輯中的 deck JSON。匯入這種檔案仍需讀取包內資料一次。
- 公開範例目前仍以 `.asmdeck` 檔下載，下載後會拆成本機引用；公開範例檔首次下載尚未改成分頁資源 API。

## 局部驗證紀錄

- 儲存／雲端契約：舊資料遷移、缺失／偽造 ID、跨 deck 資源隔離、停止分享、明確關閉與自訂樣式、併發分頁匯入、歷史引用、未改 Trace 不重傳，相關單元測試通過。
- 隔離瀏覽器：封面不請求 Trace；進入才取得；快取重開；可攜匯出；編輯動畫結果由 3 幀變成 2 幀、undo 回到 3 幀、redo 回到 2 幀、儲存重開仍為 2 幀，通過。
- 八皇后草稿實際匯入／重開：三個動畫 runtime 在封面維持 `about:blank`；可編輯 JSON 為 149,629 字元，Trace 不包含在其中。
- 導航與儲存狀態隔離瀏覽器檢查通過；修改 JavaScript 語法與 Git 差異檢查通過。沒有執行大型動畫驗證集。

相關測試：`slide-storage.test.js`、`slide-trace-store.test.js`、`slide-cloud-storage.test.js`、`cloud-content.test.js`、`slide-trace-lazy.browser.test.js`、`slide-load-save-status.browser.test.js`。
