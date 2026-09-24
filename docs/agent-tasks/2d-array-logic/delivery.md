# 交付紀錄

## 完成內容

- `original-matrix` renderer 改為直接復用原本 `draw_2Darray`，保留原有 40px 格子、藍色索引格、綠色 outerframe、`draw_block` 排版與 HintWidgets，並支援 `vector<vector<T>>`、`T[R][C]` 與 ragged rows。
- 新增 `labels(none)`、`index-labels`、`row-labels`、`column-labels`、`inner-labels`。
- 標籤來源支援 literal、多個一維陣列／數值／字元、`blank` 與 `blank(n)`。
- 新增 `gridlines(width)`、`outerframe(true|false)`、`marker-layout(axis|inner)`。
- `grid[i][j]` 固定將 `i` 視為 row、`j` 視為 column；二維寫入事件保留完整 `i,j`。
- `@style grid[i][j]` 只套用資料格與 inner label，不套用 row／column label。
- `range` 維持既有一維語意，未擴充。
- 更新指令手冊與儲存／重開相容測試。

## 驗證

- Node 靜態語法檢查與 `git diff --check`：通過。
- 二維 renderer、編譯、固定陣列、ragged rows、label、pointer、highlight、save/reopen：通過。
- 真實瀏覽器 SVG 渲染：通過。
- 真實瀏覽器確認原版藍色 label、綠色 outerframe、inner label 12px、包含 inner label 的 highlight，以及隱藏 label 時仍可移動的 row/column 指標。
- 相關既有測試（frame renderer options、arrow、index label、view source）：40/40 通過。
- 索引賦值與事件相容測試：14/14 通過。
- 依 V2 分級未執行完整 regression。

## 預覽

- Beta：http://localhost:3102
- 已確認 HTTP 200、`/trace/analyze` 新語法與新版 `trace-renderer.js`。

## 2026-09-25 修正

- inner label/index 改為白底；`background` 不會染色 inner label，`highlight` 外框仍包含完整 12px inner label。
- highlight 的播放中高度改由「資料格 40px + 當前 inner label 12px」每次重算，不再從前一個 highlight 高度累加。
- 二維寫入事件新增 `resolvedIndices`，在執行 `grid[row][column] = 99` 當下捕捉 `[1,0]`；後續即使 `row,column` 變成 `2,1`，動畫也不會把 99 寫到 `grid[2][1]`。
- 保留舊 trace 相容：沒有 `resolvedIndices` 的既有資料仍回退使用 `indexExpression`。
- V2 最小驗證：`matrix-renderer.test.js`、`matrix-renderer.browser.test.js`、`assignment-indices.integration.test.js`，共 12/12 通過；使用隔離服務 `3197`，未執行完整 regression。
- 真實瀏覽器以使用者提供的 ragged matrix 案例實際執行下一步與上一步：highlight 全程維持 52px、垂直位置差 0px，前進後 `grid[1][0] = 99`、`grid[2][1] = 8`。

## 2026-09-25 二維前綴和範例移轉

- 將 `algorithm_sample/Basic/prefix_sum_2D.cpp` 從 `AV.hpp`／`frame_draw` 舊 API 改為純 C++ 搭配新版 `@defaults`、`@preset`、`@object`、`@frame`、`@style`、`@arrow`、`@text` 與巢狀 `@for` 指令。
- `num` 與 `pre` 使用新版 `original-matrix` 呈現，示範 row／column／inner labels、`gridlines(1)`、`outerframe(true)` 與 `marker-layout(inner)`。
- 建表過程逐格顯示四項容斥來源；查詢過程用二維 drawing loops 標示子矩陣，並顯示四角公式與答案。
- 新增專項測試，檢查範例不再依賴舊 AV API、指令解析結果、24 個 runtime frames、最終前綴矩陣、兩筆查詢答案及最後一筆查詢的二維樣式範圍。

### 驗證分級與選擇

- 層級：V2。
- 分類：E（frame／preset／drawing loops）、H（matrix style／labels）。
- 選擇依據：範例改用新版指令並產生動畫 trace，但未修改 parser、runtime 或 renderer 實作。
- 執行：隔離服務 `http://localhost:3197`；`ASM_TEST_BASE_URL=http://localhost:3197 node --test tests/prefix-sum.test.js`，4/4 通過、0 skip；`matrix-renderer.browser.test.js` 真實瀏覽器 SVG 驗證 1/1 通過。
- 未執行完整 regression：本次只改範例及其專項測試，依分級採最小相關驗證。
- 需要主代理做的 V3 驗證：無。

### 舊有物件相容性

- 不適用：本次只移轉隨附演算法範例，未修改任何持久化物件格式或載入／儲存路徑。

### 後續語法精簡

- 依目前案例移除 `inner-labels(index)`，矩陣只顯示預設的 row／column index。
- 省略 matrix renderer 已有的 `labels(value,index)`、`row-labels(index)`、`column-labels(index)`、`gridlines(1)` 與 `outerframe(true)`；一般物件改為 `@object ... render matrix`。
- 游標物件只保留非預設的 `with marker-layout(inner)`，讓 column 指標進入目前 row 水平移動，但不顯示 inner index。
- `prefix-sum.test.js` 4/4 通過，並新增斷言防止範例重新加入冗餘預設或 inner labels。
- 建表游標與矩陣索引由 `row`／`column` 統一簡化為 `r`／`c`，包含 C++ 迴圈、`pre[r][c]` preset、style、arrow 與插值公式；再次執行 `prefix-sum.test.js`，4/4 通過。

## 2026-09-25 二維前綴和四步教學

- 每個 `pre[r][c]` 恢復為四個實際計算與畫面：先放入上方前綴和（藍）、加上左方前綴和（黃）、扣掉左上重疊（紅）、加上目前 `num[r][c]`（綠）。
- 每一步在 `num` 上累積呈現完整區域；最後一步的藍色右欄、黃色下列、紅色重疊與綠色目前格共同覆蓋 `pre[r][c]` 所代表的完整前綴矩形。
- 公式文字改用新版 JSON 分段 `@text`，各項以相同的 `background` 顏色對應資料區塊。
- 前半列（範例的前兩列）文字放在右側 `num` 上方並以 `@camera focus num zoom(2.0)` 聚焦；後半列文字回到 `pre` 上方。
- 修正 compiled `vector<vector<T>>` 的單幀資料雖為 sequence、變數型別仍為 matrix 時的指標辨識；`pre[r][c]` 現在會在真實畫面顯示 r／c 指標，並將 `trace-renderer.js` cache 版本升為 `trace-210`。
- V2 最小驗證使用隔離服務 `3197`：`prefix-sum.test.js`、`matrix-renderer.test.js`、`matrix-renderer.browser.test.js`、`prefix-sum-2d.browser.test.js`，11/11 通過、0 skip。真實瀏覽器確認四區格色、四段文字底色、9 格完整覆蓋、前半列 `num` 鏡頭、後半列文字位置、無 inner labels 與 r／c 指標。
- 未執行完整 regression；本次依指令、trace 與 SVG matrix renderer 的 V2 範圍採專項驗證。

## 2026-09-25 二維 `@style` range

- 新增 `grid[r1:r2][c1:c2]` 矩形選取，row 與 column 都採包含右端點語意；同時支援 `grid[r1:r2][c]`、`grid[r][c1:c2]` 與省略起點的 `grid[:r][0:c]`。
- parser 新增 `matrix-region` selector，捕捉兩個維度的端點依賴；trace rules 逐列依實際 row 長度展開，因此 ragged matrix 不會生成不存在的資料格。
- 二維前綴和範例移除建表與查詢區域的巢狀 `@for`，改用 `num[0:r-1][0:c]`、`num[0:r][0:c-1]`、`num[0:r-1][0:c-1]` 與 `num[r1:r2][c1:c2]`。
- 更新指令手冊、README 與指令提示範例；`trace-rules.js` cache 版本升為 `trace-24`，directive assist 升為 `directive-22`。
- V2 隔離服務 `3197`：matrix parser／compile／ragged range、二維前綴和 trace、真實瀏覽器四區呈現、既有 matrix SVG 與指令提示共 15/15 通過、0 skip；靜態 JS 與 `git diff --check` 通過。
- 未執行完整 regression；本次採指令／style／matrix renderer 的最小相關驗證。

## 2026-09-25 多行 `@text` 片段

- `@text` 的 JSON 片段陣列可使用連續普通 `//` 註解換行，逗點後的每個片段能對齊縮排；結尾的 `as`、`at`、`when` 修飾詞接在 `]` 後。
- 二維前綴和範例的八組彩色公式已改為逐片段換行，顯示內容、顏色與放置條件保持不變。
- beta 3102 專項驗證：文字陣列 parser、前綴和 trace 與真實瀏覽器四色呈現共 11/11 通過、0 skip；未執行完整 regression。
- 左側前綴範圍的黃色恢復為範例先前使用的暖黃色 `AV_orange`；格子、箭頭與文字底色同步，前綴和 trace／真實瀏覽器專項測試 5/5 通過。
