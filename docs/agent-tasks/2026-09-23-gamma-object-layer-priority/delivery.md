# 2026-09-23-gamma-object-layer-priority 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：7f6e886674171bd22334e6f884783f64d2ce5dc8
- 程式修正 commit：待填
- 驗證時的 HEAD 與未提交修改：待填
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：Fabric 與 widget 使用不同預設層級；執行排序後會重寫每個物件的 layerIndex，讓未被操作的 structure 也被降級。
- 修正方式與行為變化：新增物件取目前最大 layerIndex 加一級；排序只更新被移動物件及相鄰交換項目；DOM 顯示直接使用保存的 layerIndex。
- 修改檔案及用途：待填。
- README／版本紀錄／使用說明更新：不適用；既有操作方式不變。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 新箭頭自動位於最高層 | 局部瀏覽器測試讀回 deck | 待驗證 | 未驗證 |
| 箭頭排序不降低 structure | 前後比對兩個 structure layerIndex 與 SVG 顯示 | 待驗證 | 未驗證 |
| 後續新 structure 成為最高層 | 新增 structure 後比較所有 layerIndex | 待驗證 | 未驗證 |

## 小驗證與重跑方式
### 投影片物件圖層優先級
- 目的與對應條件：驗證跨 Fabric／widget 新增與頂底層排序。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自動使用隨機埠。
- 測試資料／fixture：兩個固定 layerIndex 的一般陣列及由介面新增的箭頭／structure。
- 完整指令或操作步驟：待驗證後填寫。
- 預期結果：新物件最高；箭頭上下移動不改既有 structure 的 2000／2010。
- 實際結果與 exit code（適用時）：待驗證。
- 證據位置：相關測試檔與終端摘要。

## 剩餘事項與合併注意
- 未驗證項目及原因：待填。
- 已知問題或風險：Fabric 物件共用同一 canvas DOM 層；既有模型可控制整個 Fabric canvas 與 widget 的前後，不能把單一 DOM widget 插在兩個 Fabric 物件之間。
- 相依與衝突注意：`slides.js`、`slides.html`、`entrypoints.test.js` 為共用檔案。
- 主代理需補驗證的情境：實際重疊箭頭與 structure，確認顯示與滑鼠命中符合層級。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
