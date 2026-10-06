# Structure 與 widget 的共用幾何

`algo-vis-backend/public/slide-structures.js` 的 `AlgoStructureRenderer.getWidgetGeometry(widget)` 是 SVG 渲染、Fabric 選取、框選、對齊／吸附、命中判定及縮圖繪製的共同入口。

## 座標與邊界

| 回傳值 | 定義 |
| --- | --- |
| `naturalSize` | 主體自然尺寸；包含格子、名稱與索引，排除 point／外部註標 |
| `bodyBounds` | SVG 自然座標下的主體範圍，包含原有邊緣留白 |
| `paintBounds` | SVG 自然座標下包含 point／註標的繪圖範圍 |
| `selection` | 主體縮放、置中後，在 widget 容器內的矩形 |
| `paint` | 整份 SVG 在 widget 容器內的繪圖矩形，可超出容器 |
| `scaleX/scaleY` | 自然座標到容器座標的縮放 |
| `transform/center/corners/slideBounds` | 容器到投影片的旋轉／斜切／位移及主體範圍 |

code／LaTeX 仍使用原本容器範圍，但共享容器到投影片的變換。Fabric 文字保留原生幾何與控制；混合多選只將各來源適配成幾何代理，不重新繪製內容。

## 呈現與操作

- 未指定縮放的舊 structure，以主體自然比例適配已儲存的 `w/h`，並計入置中留白。選取框對應實際主體，不直接包住整個容器。
- point／外部註標只擴大 `paintBounds`，不改變主體的縮放、中心或選區；SVG 與 Canvas 縮圖使用相同繪圖範圍，避免裁切外部效果。
- widget 不再使用透明 DOM 邊框；選取邊框由 Fabric 繪製，避免內容原點多出 1px。
- 非等比例變形產生可選的 `structureScaleX/structureScaleY`，保存實際縮放，避免手勢結束後 SVG 又重新適配。缺少欄位時使用自然比例；無效值不作為有效縮放。
- 改值／style 不重設縮放；改結構大小依主體自然尺寸變化調整容器，保持原有縮放比例。舊版 `structureFrameVersion` 更新不再重寫作者的 `x/y/w/h` 或 `manualSize`。
- 斜切主體為平行四邊形；Fabric 沿用原生控制框包住它。主體頂點與幾何代理須一致，不把原生框的矩形四角誤當成斜切後的主體頂點。

## 教材建立

在已載入專案 renderer 的瀏覽器環境，用 `getNaturalSize(widget)` 取得主體大小，再用單一比例適配指定區域；新建介面的 `constrainedStructureSize` 已沿用此入口。產生器若先組 JSON，須在實際載入後量測、驗證，而不是另寫一份格子尺寸公式。

既有投影片可以保留作者指定的容器比例；共用幾何會處理其留白與選區。不要為了讓框貼齊而修改選取框座標、放大測試容許值或強制重新縮放所有舊物件。

## 局部驗證

`algo-vis-backend/tests/structure-geometry.browser.test.js` 對照實際 SVG 的 outerframe、screen CTM 與 Fabric 代理頂點，驗證不同容器比例、旋轉、斜切、point、非等比例縮放、編輯、舊資料儲存重開、新建矩陣，以及 point 的實際 Canvas 繪製。另以混合貼上、格子拖曳、框選、註標及樹 highlight 案例檢查操作相容性；本變更不涉及演算法 Trace／事件播放。


## 選取命中與框選

`containsSlidePoint(widget, point)` 以共用主體四角判斷投影片座標中的點；`intersectsSlideRect(widget, rect)` 以分離軸檢查框選矩形與實際四邊形。旋轉／傾斜後的外接矩形僅供對齊與排版，不用來判斷滑鼠命中。

单擊、雙擊、右鍵、拖曳及多物件拖曳一律由 `widgetAtEvent` 解析實際主體與圖層順序。DOM 容器空白處將事件傳給底下 Fabric 畫布，可取消選取或開始框選。物件操作中的指標捕捉及輸入欄位不轉送。

格子命中使用 `getScreenCTM().inverse()` 將滑鼠轉回 SVG 格子座標；格子選取框使用相同 SVG 變換，避免旋轉後呈現外接矩形。


## 各種結構的主體範圍

共用的是量測結果、變換與選取介面，不是把所有結構套入同一個矩形公式。陣列、矩陣、樹與表格使用各自 renderer 產生的主體／外框 metadata；disk 沒有一般陣列的 outerframe，使用盤子、柱子、底座矩形的聯集，包含負座標。disk 的主體頂部不能固定為 0，否則會裁掉柱子原點上方的盤子。Point 與註標仍單獨計入 paintBounds，不影響 bodyBounds 與選區。


## 縮圖／Canvas 序列化

createSvg 的 position/left/top 僅供 DOM widget 內定位。drawCanvas 在把 SVG 序列化為獨立圖片前移除這三項 CSS，由共用 paint 與 transform 單獨定位，避免 SVG 图片內再次偏移而裁切。width/height、viewBox 與實際繪圖尺寸仍保留。
