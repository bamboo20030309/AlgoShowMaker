# 小測試修復（2026-11-18）

原本失敗的 **64 檔：62 檔保留並通過，2 檔退役**。只續驗失敗與相關分類；本次未跑完整回歸或大型動畫集。

| 主因 | 處理結果 |
| --- | --- |
| 渲染器版本標記不一致 | 標記改讀共用 build，更新前端快取版本。 |
| 八皇后 OR 找不到前幀 | 用穩定幀 ID 對應事件快照，不再比物件身分。 |
| 外框與陣列位移時鐘不同 | 共用插入／刪除階段時序；外框、格子同步。 |
| RUN 漏帶執行檔 ID、模型又丟掉 ID | 補齊傳遞；實際驗證雲端儲存、匯出與重開。 |
| 共用 iframe 未接回編輯歷史 | 按投影片 ID 切換 Ace session，鏡頭識別另存。 |
| 格子右鍵被畫布拖曳攔截 | 格子選單優先；表格、structure、畫布縮放驗證通過。 |
| 舊測試仍期待永久 Trace、分離初始化或舊介面 | 改驗現行配方／執行檔、合併呈現、來源樣式；保留自訂值與明確關閉的核對。 |
| 尺寸為 0 或尋找舊 DOM 父層 | 先顯示畫布；前景中的格子用穩定 ID 查找。 |
| 大資料 fixture 建表被逐事件追蹤而逾時 | 只隱藏建表準備；保留 11,000 格、內容、壓縮與舊格式檢查。 |

## 已刪除的舊驗證

| 舊測試 | 替代保障 |
| --- | --- |
| binary-addition-slide.browser.test.js | executable-only-storage／runtime、算術與常數動畫。 |
| trace-cache-refresh.browser.test.js | trace-editor-refresh、executable-only-slides：更新、失敗重試、重開重新執行。 |

另刪除舊的「幀前指標重排／初始化先停在未定區」6 案、永久 Trace 匯出與舊 RUN mock 等片段；由 pointer-event-reflow、initializer-visibility、雲端與實際播放案例替代。保留的指標單元測試 **61／61** 通過。

詳細執行證據在本機 test-results/small-repair-final-summary.json 與各小測試 TAP；不納入 Git。本紀錄不代表其餘測試已在本次重跑。
