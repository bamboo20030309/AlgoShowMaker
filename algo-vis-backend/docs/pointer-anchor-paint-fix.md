# Pointer 定位物件填色隔離（2026-10-05）

## 修正

第 8→9 幀加入 children pointer 時，定位用 rect 改變了 Tween 的矩形順序；ordinal 配對把舊 index label 的綠色套到定位 rect。
定位 g 現在標記 `data-trace-anchor-only="1"`。Tween 的矩形狀態擷取、來源／目標配對、播放共用同一份排除定位物件的列表，並不為定位 g 建立獨立 motion entry。
定位幾何仍隨所屬 keep 格子移動，原格子、index、outerframe 的填色與動畫保持原邏輯。

## 驗證分級與選擇

- V2，G／H：只驗證新增 children pointer 的定位、填色與相鄰轉場。
- 隔離服務：本工作樹 31992；獨立 headless Edge，不操作使用者分頁。
- 輸入：`10`，`38 27 43 3 9 82 10 19 84 60`。
- `pointer-anchor-paint.browser.test.js`：第 8→9 幀及後續合併，1 倍／4 倍手動轉場和實際 Play 按鈕自動播放；MutationObserver 與 requestAnimationFrame 檢查定位 rect 始終無填色、沒有獨立 motion；part(38) 保留。
- `pointer-children.browser.test.js`：左右 kept 子節點配對、移動、越界隱藏、新舊語法混用與 trace 往返。
- `entrypoints.test.js`：renderer trace-251／tween trace-283 與入口快取版本一致。
- 上述 4 個案例通過；JS 語法及 diff whitespace 檢查通過，瀏覽器無 pageerror。
- 未執行完整 regression、Studio 縮圖或投影片嵌入測試：本次未修改這些入口。

## 舊有物件相容性

- 無持久化資料格式變動，定位標記於 SVG 繪製時建立，不需遷移。
- 缺少 explicit pointer 欄位的舊 trace 經載入、render、序列化儲存與重開通過。
- 原有值與樣式及關閉設定沿用；未對 document 新增預設設定或修改使用者儲存資料。
