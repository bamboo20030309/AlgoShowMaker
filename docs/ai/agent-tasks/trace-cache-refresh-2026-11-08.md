# Trace 快取版本與公開教材更新

## 實作

新增可攜式生成指紋與 no-store 版本 API，原生編譯器快取與 Trace 生成身份分開。舊 ID 可讀不代表可直接播放；播放前檢查來源、輸入與指紋，過期時紅點、完整更新，失敗不播放舊動畫或假裝成功。保留明確 false、自訂字級與呈現設定；中途更改來源不被舊工作覆寫。

瀏覽器重建改用既有 async jobs，重複工作共用執行但保留各自授權。失敗在本次工作中記憶，只有明確重試才重送。更新結果套回投影片的新引用，沿用既有匯出／雲端同步流程。紅點狀態不覆蓋儲存狀態。

修正 iframe 等待父頁資料時自行載入預設線篩，避免額外背景工作及過期畫面閃現。獨立 algorithm.html 保留輕量預覽與 IndexedDB 完整快取；過期時先重建，內嵌播放器不執行此預設載入。

預建工具改為暫存全部選定結果、核對後才切清單，資源使用不可變名稱。--rerun 只跳過 Trace 結果快取，保留相容執行檔；--verify-only 是發布前完整性門檻。公開範例編製來源保留可讀檔名，舊引用不刪除。

## 已執行驗證

- trace-cache-generation：生成依賴／換行／UI 不失效、來源與輸入、新舊缺欄位、同時更新合併、新 ID 保存重開。
- trace-cache-refresh.browser：舊結果不閃現、實際紅點、故意回傳 503 後維持紅點、按重試才重送、成功隱藏錯誤提示、新 ID、false 與自訂字級保留、儲存重開不重跑。
- sample-trace-publish：故意讓第二份教材失敗，公開清單及索引仍不變；成功後不可變檔與清單對齊、舊檔仍可讀；refreshTrace 命中執行檔 HIT。
- provenance／slide-trace-store、sample-trace-assets、default-algorithm-assets、trace-bundle 舊格式相容性；asmdeck 的來源、設定、精簡匯出與新外部引用檢查。修正舊測試仍要求內嵌 Trace、硬編固定檔名及比對原始碼格式的過期假設，改核對實際引用／資源。
- compile-job-registry 的跨使用者授權與共用執行兩項。
- 已順序重新執行 15 份公開教材共 36 份動畫，--verify-only 全部通過；36 份最終資料與先前公開結果相同。這是重建一致性佐證，不宣稱等同獨立標準答案或完整動畫時間軸驗收。未執行全量 regression。
- 本機隔離服務與獨立 Edge：預設線篩冷載入約 1391ms、IndexedDB 暖載入約 352ms，合併排序開到第一份動畫約 1515ms；編譯請求 0 次。暖載入在快取寫入完成後量測，非外網保證。

驗證期間曾遇到環境限制的檔案覆寫／HTTP 測試錯誤，允許獨立服務的環境下續跑失敗項目後通過；沒有放寬資料完整性、指紋或畫面判定。

## 交付邊界

整合分支 intergration、重啟 3100；不合併 main、不發布 GitHub Release、不重啟遠端。新規則與完整指令見 docs/guides/trace-cache-updates.md，階段發布要求已寫入 integration-preview.md。
