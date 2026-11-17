# gamma-text-resolution：提高投影片文字顯示解析度

## 任務資訊
- 負責代理：gamma；狀態：待交付
- 共同基準：ead9f0cdb09bea614b48457d0c3308d7b29a3956
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
使用者確認正文 text 模糊，授權按照調查修改。Fabric 文字繪在固定邏輯畫布，只有裝置 DPR；Reveal 與使用者 CSS 放大沒有提升 raster 解析度。1920x1080、DPR1、200% 時原有畫布／螢幕像素比約 0.36。

## 需求確認
- 待答問題：無。
- 保留字級、文字與座標；只調整顯示 backing density，不重寫已儲存文字或元件。
- 目前顯示投影片依 DOM 實際尺寸乘上 DPR 提升；非目前投影片降低密度為 1，避免所有頁同時占高解析記憶體。
- 單一 backing canvas 限 8192px 邊長與 3200 萬像素。極高 DPR/縮放會受限制，提升清晰度但不宣稱無限解析度。

## 修改邊界
- slides.js：單 canvas retina scale、保持 Fabric 全域 DPR 與邏輯座標、視窗/模式/縮放/換頁更新；縮放動畫结束再次繪製。
- slides.html 與 entrypoints：新 JS 快取版本。
- text-resolution.browser.test.js：實際 canvas 密度、選取編輯、儲存重開、overview PNG、resize。
- 共用介面：保留 Fabric enableRetinaScaling 開關，兼容原生 toDataURL 暫時停用 retina 的流程。未改 trace 或動畫引擎。
- 相依：無。只改 gamma worktree。

## 驗收條件
- [x] 1920x1080、DPR1 正常及 200% 顯示至少約一個畫布像素對一個螢幕像素。
- [x] DPR2 正常顯示同樣匹配；200% 密度提高且符合記憶體上限。
- [x] 換頁時原頁釋放高密度，新的目前頁提高密度。
- [x] 原生雙擊 text 可編輯；字級與位置儲存／重開後不變。
- [x] 縮小視窗能調整密度，overview 原生 PNG 匯出尺寸保持邏輯大小。

## 驗證計畫
V1／B／A：非動畫投影片 text 顯示。語法、diff、entrypoints 與單一隔離 text-resolution.browser。兩張純文字 fixture，無演算法 RUN，不跑 V3。

## 變更紀錄
- 2026-09-18：使用者先要求原因調查，再確認依調查提高正文畫布解析度。
