# Gamma：RUN 畫布與場景載入加速

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準：74bbda71e1168e0d9054719d4f2d3f93b3096c82
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 使用者的 500 格陣列／50×50 矩陣單幀案例 RUN 後自動開 Studio，建立四次場景。
- RUN 成功直接顯示畫布，不自動開 Studio；錯誤仍顯示除錯分頁。
- 快取相同文字、字型、可用尺寸之精確字級量測結果。
- 事件可用性重用目前場景及最近前幀定位；缺少前幀才建立必要場景。
- Studio 開啟時重用穩定場景；隱藏物件需重建以恢復編輯灰化。
- 目前穩定幀縮圖複製已完成 SVG，重映射 ID、移除裁切標記；未繪製幀或不適用者保留原 renderer。

## 確認與邊界
- 已授權以上四項及 push；不改 trace 持久化格式。
- 不對任意 getBBox 全域快取，避免修改尺寸／樣式後讀到舊結果。藉場景重用減少查詢。
- 修改：compile、trace-editor、trace-studio、trace-renderer、draw_array_utils、三個 HTML 資產版本及直接相關測試。
- 無依賴其他代理，無新增共用資料介面。

## 驗收條件
- [x] RUN 正常後畫布 active、Studio 關閉。
- [x] 同一 fixture 僅繪製一次主要場景；手動開 Studio 不額外繪製。
- [x] 目前縮圖保留 3000 格、無重複 DOM ID／裁切殘留。
- [x] 隱藏物件編輯灰化與事件可用性既有斷言保留。
- [x] 文字相同設定快取命中，換字型／字距後與清空快取重新量測一致。
- [x] trace JSON 保存再載入，明確關閉 autoFixed/autoLoopBoundary 不被覆寫。

## 驗證計畫
- V1 RUN、V2 場景／縮圖／事件顯示；只跑局部瀏覽器案例與入口检查。
- 隔離隨機埠服務、Edge headless；不操作使用者分頁。
- 以同份使用者 C++ fixture 前後量測，不用硬性毫秒閾值當功能斷言。
- 主代理再核實動畫中斷後進入 Studio、複合結構及跨幀自訂樣式。

## 變更紀錄
- 2026-09-28：初始定義與實作。
