# 全部現行公開 Trace 強制重新 RUN

## 範圍與結果

依使用者要求，15 份公開教材的 36 個現行動畫，透過獨立服務逐一重新分析、強制編譯及執行，全部成功，共 2487 幀。使用 `prebuild-guest-decks.js --force`，略過前端結果快取及後端執行檔／結果快取。

36 個動畫全部產生新內容 ID；更新 15 份 asmdeck 的 traceRef、36 份命名 Trace 與索引。Trace 仍為外部檔案，不內嵌回投影片。同步重建預設線篩的首幀預覽、116 幀完整動畫及 manifest。

原本 36 個現行結果轉入歷史保存，加上既有 44 個歷史結果，現在為 36 個現行、80 個歷史，共 116 個可解析 ID。歷史結果不重新執行或改寫，避免破壞既有投影片引用；私人雲端教材、目前使用者分頁與本機草稿沒有覆寫。

## 內容保留

- 15 份教材的非動畫內容逐份核對一致。
- 36 個動畫的程式碼、輸入及 traceView 顯示設定完全保留。
- 15 份檔案的標題、分類、標籤、頁數、最後編輯時間、封面縮圖一致。
- 預建腳本補上傳遞原封面區給 serializer，避免只重跑 Trace 卻把封面快取或分類清空。

## 驗證

- 36／36 次強制 RUN 成功，0 失敗。
- 116／116 個現行及歷史內容 ID 逐一核對 SHA-256 與可解析幀資料，全部一致；所有原 ID 都保留。
- 隔離瀏覽器逐一從 HTTP 索引載入 36 個新 ID，核對雜湊、IndexedDB 保存讀回，再實際導航首／中／末幀，共 108 次導航通過，0 pageerror。
- sample-trace-assets.test.js 5 項、guest-gallery-assets.test.js 2 項、default-algorithm-assets.test.js 2 項通過。
- algorithm-default-sieve.browser.test.js 4 項、sample-trace-assets.browser.test.js 1 項通過，包含首幀預覽、完整結果、瀏覽器快取、編輯時取消下載及舊 ID 保存重開。
- 預建腳本語法及 git diff --check 通過。未執行全套 regression，以上不代表逐事件動畫全量視覺驗收。

原始 RUN、完整性與瀏覽器報告在被忽略的 `algo-vis-backend/test-results/trace-rebuild-2026-11-04/`，不提交暫存產物或服務 log。

## 交付

提交並推送 intergration；核對來源後只重啟 3100，確認 HTTP、索引、新 ID 與預設動畫 manifest。main／3000 不動，不發布 release。
