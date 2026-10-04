# 投影片共同物件操作

## 共用契約

- `selectedAlignmentItems()` 是混合操作的共同入口。Fabric ActiveSelection 與 widget 的 ID 選取集合透過這個入口提供一致的物件清單；DOM 的 `is-selected` class 只呈現 widget 選取結果。
- `fabricSlideBounds()` 把群組內座標換算成投影片座標；`widgetSlideBounds()` 計算旋轉後的投影片外框。框選、對齊、群組外框不得直接混用相對座標。
- `slide-fabric-selection.js` 使用獨立的編輯控制畫布與透明 Fabric Rect 幾何代理。Widget／混合選取使用 Fabric 原生 ActiveSelection、選取框、控制點、命中判定與手勢；代理不寫入 deck、不參與輸出。變換矩陣回寫原物件，由各 renderer 呈現內容。
- 使用 Fabric 原生四角／側邊／旋轉控制；放開後一筆歷史紀錄儲存整組結果。
- Fabric 原生純物件選取及控制器繼續使用；Widget／混合選取時只顯示代理的原生框，移除 HTML 自製選取框與 widget 外框。

## 保留各類元件的實作

文字維持 Fabric 編輯；structure／table 維持格子編輯；code 維持程式碼編輯器；LaTeX 維持公式渲染。群組尺寸修改由 adapter 分別處理內容尺度，不改寫程式碼或格子內容。

## 資料相容性

Widget 使用 `angle`（角度）與 `skewX`（原生變換產生的斜切），舊檔缺少欄位時使用 0；明確的 0 與自訂角度都會保留。位置、尺寸、字體、樣式、圖層與明確關閉的設定仍沿用。LaTeX 手動尺寸不可被自動尺寸計算覆蓋；旋轉不能改變公式固有尺寸。

## 本次驗收

`tests/mixed-object-paste.browser.test.js` 透過真實滑鼠與鍵盤驗證：text → widget → text、普通與純文字剪貼簿、從文字／widget 拖曳全組、等比例縮放、旋轉、一次 undo／redo、儲存重開、自訂樣式與明確 false 保留。涵蓋新貼上的物件，以及缺少 angle 的舊 text、structure、table、code、LaTeX。
