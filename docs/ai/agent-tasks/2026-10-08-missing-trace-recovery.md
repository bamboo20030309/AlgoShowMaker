# Trace ID 缺失時按需重建

## 問題與行為

工作坊匯出檔中第 24 頁下方的動畫（依檔案順序第 25 張）保存了 a5eda253… Trace ID，完整結果不在檔內，靜態結果資源回傳 404。既有載入只回報錯誤；漸進重建又排除所有有 ID 的動畫。

現在目前頁動畫先讀 IndexedDB，再讀所屬伺服器資源；只有結果不存在／404 才重建，403、網路與其他 HTTP 錯誤不啟動編譯。使用保存的 C++、輸入、watches、sliceMode 與版面設定，沿用 /trace/analyze、/compile 的後端佇列、快取與資源限制，不掃描整份教材重跑。

新版 rebuild 設定使用既有重建路徑；舊 ID-only 物件缺少 rebuild 時，以重新產生的幀恢復保存的 traceView、自訂值與明確關閉設定。成功寫入獨立 Trace 與更新 ID，自己的雲端教材排程上傳、本機／觀看分享只保存瀏覽器。失敗保留可編輯程式、明確回報，不因切頁或 iframe ready 不斷重編譯；可修正後手動 RUN。

同一動畫版本的並行請求共用重建 Promise。成功記錄只保存替代 ID／設定，完整 Trace 仍依既有兩份載入快取處理，不額外保留整套結果。新匯入或不同編輯已取代原動畫時不覆蓋它。

## 局部驗證

V2，僅動畫載入與結果保存分類；未跑大型 V3。

- slide-trace-store：舊內嵌結果、懶載入、雜湊、同版本一次重建、替代 ID 保存重開、自訂值與 false、上傳標記；權限／網路不編譯及失敗不循環。
- asmdeck：格式、舊公開教材可解碼、既有預建結果、重建與設定還原等相關案例。
- entrypoints：依賴順序及新快取版本。
- missing-slide-trace.browser：以附件實際前綴和程式建立獨立 fixture，隔離服务、Edge、404 後真正編譯，播放器得到 9 幀並產生 SVG；autoFixedEnabled／autoLoopBoundaryEnabled 仍 false；保存與重開不再編譯。
- sample-local-edit.browser：既有範例本機編輯、自訂值／關閉設定、保存重開、匯出及分享權限。
- slide-cloud-storage：既有獨立結果分塊與雲端保存契約。

以上測試通過，修改 JS 的 node --check 與 git diff --check 通過。未操作使用者分頁或改動附件／公開範例原檔。

## 交付

提交並推送 intergration，重啟 3100 後核對 HTTP 與新前端版本。本次不合併 main、不更新 Release 或公開 Docker 部署。
