# Segment Tree 根區間長度交付紀錄

## 實作結果

- 新增 `segmentDomainLength`，明確保存根節點代表的葉區間長度。
- 依遞迴拓樸計算最大 storage index，自動補齊內容陣列；長度 10 會配置至 index 25。
- 長度編輯器顯示並修改根區間長度，不再顯示整個 storage 陣列長度。
- Segment Tree 儲存格選單只保留數值編輯，避免在稀疏 storage 中插入或刪除單一格破壞索引。
- 舊物件缺少 `segmentDomainLength` 時沿用舊公式推導，正規化後補入明確欄位與必要 storage。
- 更新範例投影片第 5、11、15 頁；index 24、25 的值為 6、7。

## 驗證分級與選擇

- 層級：V1（投影片 Structure 編輯、持久化與渲染；不涉及演算法 trace 動畫）
- 分類：A、B、C、E
- 選擇依據：變更投影片 Structure 長度語意、稀疏節點渲染與 `.asmdeck` 範例資料。
- 執行：`node --check public/slide-structures.js`、`node --check public/slides.js`、`git diff --check`。
- 執行：`node --test tests/entrypoints.test.js tests/slide-segment-tree.browser.test.js`，2 通過、0 失敗、0 略過。
- 執行：`node --test tests/structure-length-zero.browser.test.js tests/asmdeck.test.js`，14 通過、0 失敗、0 略過。
- 追加重跑：`node --test tests/slide-segment-tree.browser.test.js`，1 通過、0 失敗、0 略過。
- 驗證環境：獨立隨機埠服務與 headless Edge；未操作使用者分頁。
- 未執行演算法驗證集：本次不修改 trace、runtime 或演算法動畫。
- 需要主代理 V3：無。

## 舊有物件相容性

- 新建物件：Segment Tree 預設根區間長度 7，自動配置至 storage index 13。
- 舊有物件：缺少新欄位的 7 格 fixture 仍推導為 4 個葉區間，載入後長度欄顯示 4。
- 既有內容：原 storage 值保留，新產生的格子填 0；其他 Structure 的長度操作未改變。
- 持久化：長度 10 儲存 `segmentDomainLength: 10` 與 25 格 storage，重新渲染得到 19 個可見節點。
- 範例檔：三頁均經實際 `.asmdeck` 解碼，確認 index 24、25 與可見索引集合。
