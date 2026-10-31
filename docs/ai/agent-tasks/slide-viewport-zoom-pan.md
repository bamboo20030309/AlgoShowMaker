# 投影片滑鼠縮放、平移與閃爍修正

## 行為與原因

單頁投影片的 Ctrl／Command + 滾輪以滑鼠位置為錨點；左側縮放按鈕與鍵盤縮放沿用最近位於畫布的滑鼠位置，沒有位置時用檢視區中心。單頁與排序總覽仍各自保存比例，總覽沿用原本縮圖捲動邏輯。

右鍵拖曳、中鍵拖曳、空白鍵加左鍵拖曳可移動單頁檢視，不移動物件或改變其尺寸。Ctrl／Command + 0 或重設按鈕恢復 100% 並清除平移。輸入框及可編輯文字保留空白字元輸入；按鈕與彈窗不攔截空白鍵。比例和平移只存在目前介面記憶體，不寫入投影片或雲端。

既有縮放路徑沒有重新載入投影片物件。Fabric 提升 backing bitmap 解析度時，setDimensions 先清空 bitmap，再由 requestRenderAll 等到下一個 animation frame 重畫，可能呈現短暫空白。改為同一個 task 內 renderAll；連續縮放停止 180ms 後才調整解析度，避免每個滾輪事件重設大畫布。移除單頁內容的縮放 transition，確保滑鼠錨定不被中間插值破壞；頁面淡入與位移效果保留。

## 實作

- 平移與縮放套用同一個頁面外層 CSS transform，Fabric、structure、code 與其他 widget 同步，不改 deck 資料。
- 依 Reveal 實際螢幕比例換算平移量，不假設外層比例為 1。
- pointer capture 與 window capture 事件隔離平移，避免同時啟動物件拖曳或框選。
- 重設按鈕也辨識只有平移、比例仍為 100% 的狀態。
- 前端 slides-288／color-swatches-124，入口版本斷言同步。

## 驗證

V1，沒有修改演算法 Trace／動畫邏輯，不啟動大型動畫驗證。隔離 Edge 與獨立靜態服務，未操作使用者分頁、雲端投影片或公開教材。

3 檔／3 案例通過：

- slide-viewport-zoom.browser.test.js：編輯及展示模式的錨點誤差小於 1 CSS px、三種拖曳方式、連續縮放後每次 bitmap 重設均立即重畫、沒有 loadFromJSON／物件重建、structure SVG 身分不變、重設、缺少新欄位的舊文字物件與新建物件經儲存重開保留位置／比例／自訂顏色。
- slide-click-drag.browser.test.js：原有文字雙擊、游標、真正拖曳與 widget 編輯不受影響。
- entrypoints.test.js：各介面共用資產載入及本次前端版本通過。

node --check public/slides.js 與 git diff --check 通過。結果證明此次修正路徑的空白重畫間隔已消除，不宣稱排除所有顯示卡或瀏覽器的其他閃爍來源。

本次僅提交／推送 intergration 並重啟 3100；main、3000、公開 Docker 與已發布版本保持原狀。
