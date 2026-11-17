# 賦值來源副本幾何修正

## 修正
- 上一幀副本已脫離 SVG，其 getBBox 在 Edge 回傳 0×0，導致完整格子移動建立失敗。
- 換幀前只保存當幀賦值／write 引用的來源 local bounds，以 WeakMap 關聯副本；不量整棵樹所有格子、不增加儲存欄位。
- 外觀仍使用舊副本、文字仍使用事件捕捉的 source 值，保留提交時序。
- 缺少幾何時從 connected live source 取得尺寸，不取其新文字／樣式；都不可用才保留既有 fallback。
- 隱藏來源仍不可播放，沒有因存在副本而復活。
- 版本：tween trace-294、renderer trace-263；使用者既有修改保留，未提交／push。

## 驗證分級與結果
- V2，G/H/J；random-port 隔離服務與 headless Edge，未操作使用者分頁。
- `node --test tests/assignment-detached-source.browser.test.js tests/animation-effect-layer.test.js`：2/2 通過，0 fail、0 skip。
- 包含兩種播放速率、新目的物件、0→0、同幀連續 7/8、旧紅色外觀不被最終綠色覆蓋、移動至終點才提交、幾何 fallback、遞迴與 disabled declarations。
- 隱藏來源維持 autoAnimationDisabled，目的值仍正確。
- node --check 與 git diff --check 通過（僅 CRLF 提示）。
- 未跑完整 regression、全部 tests、Studio 全套或 autoplay；未修改播放驅動與設定保存。

## 舊資料相容性
- 無新持久化欄位、無遷移需求。Trace JSON 保存後以 ASMTracePlayer.apply 重載再播放，來源 7/8、舊紅色外觀、落地提交均通過。
- 缺少幾何快取（停用 capture hook）三筆零值移動仍通過。

## 服務
- 只重啟確認的 alpha 3101，保留既有 Mongo/JWT；MongoDB 連線成功。
- 3000/3100 與其他代理服務未操作。

## 後續：一般陣列賦值背景提交（trace-295）
- 問題：nextR[1] 的數字依事件維持 0，但 value 條件背景用目的幀最終值而提前紅色。
- 只對普通 indexed assign/write 的 value 條件 background 使用 currentValue/presentedValues；交換與 bitwise/bitShift key 排除，固定 style 與 key 條件不變。
- 索引標籤背景同步；display 隱藏數值變化時仍更新資料值。賦值目的格沿用其 display 模板，不在完成時覆蓋成 raw 數字。
- 沒有新增 trace 儲存欄位；JSON 儲存重載、自訂紅色外觀、明確關閉 declaration 均保留。
- 最終檢查：assignment-detached-source.browser + animation-effect-layer 2/2；presented-style-values.integration + bitwise-commit-timing.integration 6/6，共 8/8，無 fail/skip。
- Browser 實際取樣：N=4 共 2 解、六筆 L/R 格子位移；nextR[1] 值 0 時 fill 與 computed fill 均白，值提交 1 後開始紅色過渡；labels(none)+display("x") 文字不變但背景正常提交。
- 只重啟 alpha 3101，保留 Mongo/JWT；未執行完整 regression、Studio/autoplay 全套，未提交／push。
