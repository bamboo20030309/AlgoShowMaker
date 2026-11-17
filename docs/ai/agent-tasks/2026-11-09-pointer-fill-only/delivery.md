# Pointer 顏色只填背景

## 修改

依使用者要求，`@pointer ... color AV_red` 的 color 只控制指標標籤格子的背景，不再套用到外框與箭頭。頂部與左側箭頭共用相同規則，預設線色維持 #333，文字維持原色；既有獨立樣式覆寫路徑未改。

指令手冊及教材 skill 的指標說明已同步。前端 renderer 更新為 trace-281，投影片腳本 slides-327、嵌入 runtime-82，避免瀏覽器沿用舊畫法。這是繪製變更，不改 Trace 資料格式或產生指紋，無須重編全部範例。

## 驗證

- `node --check`：renderer、slides、相關測試檔通過；`git diff --check` 通過。
- `pointer-matrix-color.browser.test.js`：隔離 Edge／獨立服務通過；涵蓋一維、矩陣列／欄、layout、AV 別名、hex、RGB、自訂背景、移動及越界隱藏。
- 固定答案：自訂填色保持指定值，每個指標外框與箭頭維持 #333、文字維持 #1f282d。核對實際 SVG 的 fill／stroke。
- 新資料保存重開、缺少 pointerColor 的舊資料載入→呈現→再保存→重開皆通過。重新保存使用正規化後內容計算的雜湊，不沿用變更前 ID。

整合提交推送至 intergration，重啟並核對 3100；不合併 main、不發布 Release。
