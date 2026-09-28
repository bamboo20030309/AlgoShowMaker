# Gamma：底部時間線與結構格子裁切

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：d9cd5beca09239f629b62216bc9b8a5f2a893134
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期结果
- 底部時間線仍建立全部按鈕；大型結構只做整體裁切，內部格子仍全部顯示。
- 時間線僅建立可見項目與前後一項緩衝。保留總捲動長度、點選和選取狀態。
- SVG 結構增加格子、索引、獨立樣式層的 visibility 裁切；保留 DOM 與幾何，避免破壞箭頭定位和動畫。
- 使用者提及大型矩陣、表格、長陣列。本次僅涵蓋演算法 SVG 中已帶格子 metadata 的結構；獨立 Fabric table 不在此實作內。
- 真正延後格子建立／動畫計算尚未實作，需要先分離幾何模型與 DOM。

## 需求確認
- 沿用使用者小驗證及 push 授權，無新增介面與資料格式。
- 尚待回答：無。

## 修改邊界
- trace-studio.js/css：時間線虛擬化，scroll/resize 重建可見按鈕與當前幀捲動。
- trace-viewport-culling.js：獨立觀察格子和附屬圖層。
- algorithm.html：更新快取版本。
- 直接相關瀏覽器及入口測試。

## 驗收與驗證
- [x] 500 幀時間線按鈕數受 viewport 限制，尾端選取第 500 幀正常。
- [x] 原縮圖可見數與局部 availability 斷言保持通過。
- [x] 單一大型結構內 offscreen 格子與 style 恢復，getBBox 不變。
- [ ] 真實大型矩陣與表格動畫、普通投影片 table：未驗證。
- V1 時間線、V2 畫布顯示層；獨立隨機埠服務、Edge headless、合成 fixture，不修改使用者頁面或檔案。
- 不跑完整 regression。主代理需核實真實結構的箭頭、樣式分層和鏡頭。

## 變更紀錄
- 2026-09-28：初始實作。結構只做繪製裁切，不宣稱初始建構或動畫 CPU 已省略。
