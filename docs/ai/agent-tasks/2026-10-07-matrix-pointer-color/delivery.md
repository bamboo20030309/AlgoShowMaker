# 矩陣獨立指標與顏色

- 需求：`@pointer i at dp.row`、`@pointer j at dp.column` 使用變數值；所有獨立 pointer 可設定 color。
- 解析新增 pointerAxis/indexDimension 與可選 pointerColor，不取代 rendererOptions；非矩陣 axis 與無效顏色明確報錯。
- 明確 axis 使用列左／欄上定位，保留標籤與顯示設定。自動指標的 none/inner 設定保留，明寫的 axis 指標按作者指定顯示。
- 列欄定位點使用正確 canonical targetKey，避免相同數字的列／欄誤用同一避讓群組。
- 修正 std::vector<std::vector<T>> 型別識別；未指定顏色與缺少新欄位的舊 Trace 維持原本外觀。
- 文件與指令列表更新；renderer trace-270、assist directive-35。

## 驗證
- V2，E/G/H 分類，僅跑相關最小驗證，不跑大型動畫。
- 18 個案例通過：pointer-directives、pointer-model、pointer-matrix-color.browser、entrypoints。
- 真實隔離 compile＋SVG：二維 vector、row/column 值更新、越界隱藏、預設色、AV/hex/rgb 色、陣列與 layout current。
- 新功能、缺少新欄位的舊 binding、IndexedDB 保存與重開；自訂顯示及 marker-layout(none)、未指定 color 的預設均確認。
- preset 組合與既有 inner 設定解析保留。JS 語法及差異檢查通過。

## 整合
- intergration，不合併 main 或發布 release；保留無關教材與腳本草稿。
- 重啟並確認3100後推送。

- 3100 重啟新 PID 85732；HTTP 200、renderer trace-270、assist directive-35，/trace/analyze 新 axis/color 指令成功。main 3000 HTTP 200。
