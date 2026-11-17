# gamma-visible-lod：可見文字 LOD 與數字寬度快取
- 代理：gamma；分支 codex/2026-09-22-gamma。
- 基準：854d1ea62994967a564d3b9a126ea4cbf81ea35d（開始時工作目錄乾淨）。
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-22-gamma
- 狀態：待交付。

## 需求與邊界
使用者同意上一輪建議：事件目標索引、只建立可見文字與索引、有限節點重用、分幀建立。另要求格子螢幕寬度 ≥24px 顯示文字；純 0–9 字串以單一數字快取寬度相加。
無待確認問題；非純數字仍沿用 SVG 整字量測。正負號／小數點／混合文字不屬於純數字路徑。
不改追蹤內容、事件順序或格子／箭頭定位資料。使用既有平面陣列／矩陣 LOD 支援條件。

## 修改邊界
trace-frame-tween.js：單次 availability probe 的 variable → visual 索引，維持 lifetime/generation/snapshot 判斷。
trace-structure-lod.js：每格實際投影寬度門檻、可見區域加 48px 緩衝、每 group 最多 256 個空閒文字節點、每 RAF 約 4ms／128 筆工作上限。
draw_array_utils.js：每字型／字級／字距／字體特性之 digit cache，與既有整字 fit cache 一同在字型載入時失效。
資產版本、局部測試及文件。

## 驗收條件
- [x] 23.96px 不顯示、24px 顯示；變寬格子使用自己的實際寬度。
- [x] 平移可補齊可見文字；遠離畫面的文字不建立，格子及樣式定位保持。
- [x] 縮放來回、clone、舊 trace 儲存重開及明確 false 相容。
- [x] 數字量測次數受數字種類與字級限制，非純數字仍採完整量測。
- [x] 指標／離開作用域的相容性小案例通過。
- [x] 相同棋盤範例量測載入與文字出現時間，區分整批完成與單幀阻塞。

## 驗證計畫
V2：針對 LOD／文字量測／事件 probe 的小測試，隔離隨機埠 Edge 與相同棋盤 fixture；不執行大型 regression。不操作使用者分頁。正式程式完成後更新自己的 3103。

## 變更紀錄
- 2026-09-28：初始定義。

- 2026-09-28：局部驗證與兩輪棋盤量測通過；另以實際滾輪核實首次及重複放大。沒有變更持久化 schema。
