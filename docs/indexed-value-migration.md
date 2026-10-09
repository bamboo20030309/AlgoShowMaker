# 索引取值與指標語法遷移

引擎 14 將取值與指標分開。`@frame arr[i]` 和 `@object arr[i]` 只呈現該元素；`dp[r][c]` 呈現單格，`s[i]` 呈現單一字元。格子保留原始變數及索引身分，供 style、箭頭與事件定位。

需要原本「整個陣列＋指標」的效果時，改寫為：

```cpp
// @frame arr
// @pointer i at arr
// @pointer j at arr
```

`arr[i,j]` 多指標語法已移除，解析時會明確提示改用 `@pointer`。指標可使用 `i-1` 等安全運算式，矩陣列／欄分別使用 `at dp.row`、`at dp.column`。

## 範例與文件

- 專案 C++ 範例、測試 fixture、公開教材程式碼、指令手冊、快速指南、README 範例及教材 skill 已遷移。
- 15 份公開投影片中的 36 個動畫全部重新產生 Trace；投影片只保存引用 ID，結果保存在 `algo-vis-backend/public/deck-traces/`。
- 預設線篩動畫與第一幀快取同步更新。引擎指紋升級至 14，避免誤用舊語法編譯快取。
- 舊 Trace 資料仍可播放；使用者本機檔案及雲端私人投影片不會被批次覆寫。舊程式碼重新 RUN 前須先遷移，單索引舊寫法與新取值語法無法自動判別意圖。

## 一次性遷移工具

`algo-vis-backend/scripts/migrate-indexed-pointers.js` 可改寫指定舊教材原始碼；請先備份並檢查差異。專案批次工具 `migrate-project-pointer-examples.js` 必須帶 `--confirm-legacy`，僅供舊語法遷移，不能對已遷移教材重跑，否則會把刻意使用的新取值語法改成指標。

## 驗證範圍

索引取值與實際 SVG、IndexedDB 儲存重開、指標運算式與顏色、排序指標生命週期、比較抬升方向、插入排序相對索引與整格複製、字串呈現、遞迴子節點指標、公開資產引用與內容指紋。使用獨立服務與瀏覽器，不操作使用者投影片；本輪未執行完整大型演算法驗證集。

分離 Trace 的測試載入器同步還原 `traceView` 中的樣式、規則與 Studio 設定；內容 ID 仍只核對原始結果，不把呈現設定混入雜湊。
