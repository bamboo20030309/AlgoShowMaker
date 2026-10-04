# 統一選色器交付紀錄

日期：2026-10-05。分支：intergration。驗證分級：V1。

所有可操作選色入口沿用 structure 的操作：滑鼠移入開啟選色器，按鈕直接套用上次顏色；鍵盤向下也能開啟。文字、文字底色、形狀填色與框線、structure 外框及樹箭頭、表格、Trace Studio、演算法 GUI 與畫筆共用 color-picker-policy.js。常用色只有色塊；自訂色列只記錄無別名顏色、去重、最多 16 色。瀏覽器記憶鍵沿用舊值，透明度保留。選取或懸停不修改物件本身，必須選色或按鈕套用才更新。

## 驗證

- node --check：5 個修改 JS 通過；git diff --check 通過。
- slides-av-color-palette.browser.test.js：通過，涵蓋新文字、文字底色、缺少新欄位的舊 structure/表格/樹物件，顏色直接套用、AV 透明與不透明色、自訂色、刷新記憶、儲存重開，以及自訂原值和明確 false 保留。
- color-picker-tools.browser.test.js：通過，涵蓋演算法 GUI 懸停不套色、直接套色、透明度、無名色記憶及畫筆使用最後顏色。嵌入模式畫筆按鈕隱藏，該按鈕的套色以 DOM click 驗證；GUI 浮窗使用實際滑鼠操作。
- Trace Studio 共用控制：實際點擊及浮窗色塊確認；未啟動動畫編譯或大型驗證。

服務：僅重啟整合 3100，HTTP 與五個腳本核對一致。未合併 main 或發布範例投影片。

## 2026-10-05：style 記憶分離

Highlight、Focus、Point、Mark、Background、annotation 分別儲存在 asm_slide_style_colors_v1，不將無法辨識 style 的舊全域記憶遷移給所有 style。未選過時沿用該物件的預設 style 顏色；選色只更新該 style，現有格子顏色及明確 false 設定保留。一般選色器、自訂色歷史維持原有共用行為。局部瀏覽器驗證涵蓋舊全域值不污染 style、三種 style 分開選色及儲存重開、未選 Mark 預設色與停用 Focus 記憶色。
