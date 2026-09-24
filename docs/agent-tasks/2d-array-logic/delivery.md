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
