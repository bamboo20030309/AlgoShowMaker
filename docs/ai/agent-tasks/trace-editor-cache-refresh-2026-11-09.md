# 動畫編輯器過期 Trace 更新

## 問題與修正

- 前次紅點與自動恢復主要涵蓋 slides.html；algorithm.html 的 freshness 只更新提示，而嵌入編輯器另有未等待版本檢查的 RUN 路徑。
- 統一在動畫載入時核實 `/api/trace/version`；回到頁面也重新核實，請求合併並禁止 HTTP 快取。
- 過期資料立即顯示紅點並隱藏舊畫面，背景透過現有全站工作佇列重建，成功確認指紋後才套用新 Trace、轉綠並通知既有儲存流程。
- 使用者改碼／改輸入仍需 RUN，不會因輸入變化自動編譯；背景結果不得覆蓋後來的編輯、切換或手動 RUN。
- 失敗保持紅點、寫入除錯紀錄；點擊圓點可重試。同一份失敗結果不在每次刷新時無限重送。
- 移除 slides-embed 重複自動 RUN，保留原有儲存按鈕才套回投影片的操作。
- 沒有改動生成指紋依賴，不重新生成全部公開 Trace。純動畫時序／渲染修改仍按既有規則不使 runtime Trace 過期。

## 驗證與固定答案

- `trace-editor-refresh.browser.test.js`：一般頁面與嵌入編輯器載入舊指紋資料，固定期待紅點、舊 SVG 隱藏；模擬 503 後保持紅點與除錯訊息，重試後須取得目前指紋並轉綠。
- 同例保留字級 19、readHighlightEnabled=false，重新載入更新結果不再次提交工作；背景等待時編輯程式碼，回傳結果不得覆蓋新碼。
- 注意一般 algorithm 草稿原本只保存程式碼／輸入，不把完整 Trace 塞入 sessionStorage；測試的結果重開透過 loadAnimation，未改變這項資料格式。
- `trace-cache-refresh.browser.test.js`：公開範例／預設動畫冷暖載入無編譯請求；投影片端過期結果紅點、重試與新引用 ID 往返仍通過。
- `trace-cache-generation.test.js`：指紋、來源／輸入差異及共用恢復三例通過。
- 僅相關局部測試，未執行 V3／全演算法驗證。
