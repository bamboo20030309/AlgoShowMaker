# Structure 共用幾何交付

## 任務與基準

- 使用者要求依提案統一 structure 的渲染、選取、縮放與定位，修正製作教材後反覆出現的框與物件不對齊。
- 基準：intergration `53a14b6`。保留既有未追蹤的合併排序草稿與製作腳本，不修改使用者投影片。
- 範圍為 V1 編輯器／widget 幾何，沒有修改 C++、Trace、事件播放或引擎；不啟動大型演算法驗證。

## 實作與相容性

- `getWidgetGeometry` 共用主體自然邊界、繪圖邊界、容器內縮放／置中及投影片變換。SVG、Canvas 縮圖、Fabric 幾何代理、混合多選、框選、吸附／對齊及穿過畫布的命中判定沿用同一結果。
- point／外部註標只擴大繪圖範圍；不改變主體大小、中心或選區。刪除原本為 point 補位的特殊座標修正。
- 移除透明 DOM 邊框造成的 1px 原點偏移；Fabric 保留原生控制框，斜切時控制框仍採原生包覆方式。
- 非等比例縮放保存可選的 `structureScaleX/Y`；舊物件缺少欄位時按主體比例適配原容器。舊版本載入不再重設 x/y/w/h 或 manualSize。
- 新建結構既有自然尺寸入口使用相同主體計算。教材製作指南要求沿用實際 renderer 量測，保留作者設定，不以手改選區方式補救。
- 邊界契約與教材建立方式見 `docs/structure幾何計算.md`。

## 驗證

11 個直接相關案例通過（9 個檔案），包含：

- 新增 `structure-geometry.browser.test.js`：陣列的不同容器比例、旋轉及斜切；實際 SVG screen CTM 與 Fabric 幾何代理頂點一致；point 開啟前後值格與選區不動；非等比例側邊拖曳後編輯仍保留縮放；缺少版本與新欄位的舊物件實際載入、編輯、儲存重開；自訂色、false 設定與尺寸保留；新建矩陣；7 種 renderer 的獨立繪圖邊界核對；Canvas 實際包含外部 point。
- `mixed-object-paste.browser.test.js`：structure＋code、純文字剪貼簿橋接、table＋LaTeX，3 案通過。選取命中改用實際格子，群組邊界對照實際 SVG，不再期待包含空白容器。
- `structure-inline-scale.browser.test.js`、`structure-annotations.browser.test.js`、`widget-marquee-selection.browser.test.js`、`structure-cell-drag.browser.test.js`、`structure-length-zero.browser.test.js`、`tree-highlight-alignment.browser.test.js` 各 1 案。
- `entrypoints.test.js` 1 案；新版本為 renderer geometry-1、Fabric selection 4、slides-269、CSS color-swatches-121，首頁 renderer 同步。

測試修正的是新邊界定義：主體自然尺寸不因 point 增大，但繪圖範圍仍包含 point；未放寬座標容許值。首輪平行測試有隔離服務未就緒，後續以單檔併發逐一重驗失敗項目。未宣稱這些案例覆蓋完整 V3。

JS 語法與差異檢查通過；樹 highlight／point 的隔離截圖已人工檢視。驗證產物、server log 與草稿不提交。

## 服務

- 核對 3100 由本輪前既有 PID 85732 執行後，僅重啟該整合服務；新 PID 53744，啟動命令包含整合 worktree 的完整 server.js 路徑。
- 3100 的 slides.html 與新幾何腳本 HTTP 200，來源版本核對通過；main 3000 仍 HTTP 200。
- main／Docker 沒有合併或重建，未發布或修改 release。
