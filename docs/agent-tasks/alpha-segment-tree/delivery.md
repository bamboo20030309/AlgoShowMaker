# alpha-segment-tree 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-19-alpha-segment-tree
- 共同基準 commit：61a4baade9b06b5e50d0c7a24683e937db9c7112
- 程式修正 commit：34f734a2489336ef359064b696cacb124d8239b9
- 驗證時的 HEAD 與未提交修改：34f734a2489336ef359064b696cacb124d8239b9；程式驗證完成時工作目錄乾淨
- 驗證日期：2026-09-19

## 根因與修改
- 設計依據：既有 frame renderer options 只處理 range／columns／labels，trace model 尚未正規化 pair／tuple，heap renderer 每格只讀主要陣列；既有 @segment parser 只接受單層陣列範圍，轉場矩形也未插值格內色塊幾何。
- 修正方式與行為變化：新增 fields／hide／separator 解析、runtime 保存及 heap 同格組合；pair／tuple 以單格格式化；新增雙層 @segment 的局部座標、裁切、重疊、色彩及具名轉場；保留舊單層 @segment。兩個 Segment Tree 範例改用 render heap 與新指令。
- 修改檔案及用途：trace-instrumenter.js／server.js 定義與保存語法；ASMTrace.hpp／trace-model.js 處理 tuple；trace-renderer.js／trace-frame-tween.js 繪製與轉場；Segment_Tree_easy.cpp／Segment_Tree.cpp 改寫範例；HTML cache、指令提示、手冊、README 與直接相關測試同步更新。
- README／版本紀錄／使用說明更新：README 與 ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md 已加入新語法及行為；tests/README.md 記錄專項測試。
- 與 task.md 的差異：query 的預設參數改由呼叫端明確傳入，因目前變數分析不會把具有預設值的參數提供給幀指令；傳入值與原預設值相同，演算法結果不變。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| fields、separator、hide 與原變數事件 | parser/runtime 專項及 headless Edge 實際 SVG | 15／7,3／8,8／4,2,9 正確；自訂分隔與逐幀更新正確；lazy／sets 仍有各自 assign 事件與 style | 通過 |
| pair／tuple 單格與 pair 成員 hide | runtime 資料與實際 SVG | pair 顯示 5、0 / 5；tuple 顯示 1,0,3、0,0,0，未展開格數 | 通過 |
| heap 格內 segment 行為 | 根與子節點 SVG 幾何、裁切、空範圍、多色塊、具名轉場 | 根 8 段、子節點 4 段；完整／中段／右半段正確；反向範圍隱藏；as 身分與幾何插值正確 | 通過 |
| 舊 @segment 相容 | style-segments 與 fixture 單層範圍 | arr[1:2] 仍產生既有區段；原 style／segment 專項通過 | 通過 |
| 兩個範例移除舊繪圖且保留結果 | /trace/analyze、/compile 與 sample input | 無 AV.hpp、AV av、frame_draw、key_frame_draw、colored_text、_draw_*；輸出分別為 27/3/119/120/8/5/17 與 12 | 通過 |

## 小驗證與重跑方式
### Parser、runtime、renderer、瀏覽器與範例專項
- 目的與對應條件：覆蓋本任務全部最小驗收條件及直接相容面。
- 執行目錄與必要環境設定：algo-vis-backend；ASM_TEST_BASE_URL 指向 alpha worktree 的隔離服務 http://127.0.0.1:62191。
- 測試資料／fixture：tests/fixtures/heap-composite-segments.cpp、Segment_Tree_easy-sample_input.txt、Segment_Tree-sample_input.txt。
- 完整指令：`$env:ASM_TEST_BASE_URL='http://127.0.0.1:62191'; node --test tests/heap-composite-segments.test.js tests/heap-composite-segments.browser.test.js tests/segment-tree-samples.test.js tests/frame-renderer-options.integration.test.js tests/style-segments.integration.test.js tests/preset-directives.test.js tests/directive-assist.test.js tests/entrypoints.test.js`
- 預期結果：所有直接相關案例通過。
- 實際結果與 exit code：31/31 通過，exit code 0。
- 證據位置：測試檔與 fixture 已提交；執行輸出只保留於本次代理工作階段。

### 語法檢查與受影響編譯重跑
- 目的與對應條件：確認前後端 JavaScript 可解析，tuple header 修改後兩個範例仍能分析、編譯與產生 trace。
- 執行目錄與必要環境設定：algo-vis-backend；同一隔離服務。
- 測試資料／fixture：同上。
- 完整指令：`node --check trace-instrumenter.js; node --check server.js; node --check public/trace-renderer.js; node --check public/trace-frame-tween.js; node --check public/trace-model.js; node --test tests/heap-composite-segments.test.js tests/segment-tree-samples.test.js tests/entrypoints.test.js; git diff --check`
- 預期結果：語法與 6 項測試通過，diff 無空白錯誤。
- 實際結果與 exit code：6/6 通過，全部 exit code 0。
- 證據位置：執行輸出只保留於本次代理工作階段。

### Alpha 3101 預覽服務
- 目的與對應條件：確認更新後的 alpha 服務確實來自本任務 worktree，且新 parser 與前端檔案已載入。
- 執行目錄與必要環境設定：本任務 worktree 的 algo-vis-backend，PORT=3101。
- 完整操作：以 served trace-renderer.js 的 SHA-256 核對 worktree，POST /trace/analyze 分析 fields／hide／雙層 segment 最小程式，再讀取 algorithm.html cache 版本。
- 預期結果：來源 hash 相符；fields=tree,lazy,sets、cellRange=true、color=AV_green；新前端版本可見。
- 實際結果與 exit code：PID 56812；來源 hash 相符；analyze 通過；renderer trace-194、tween trace-213、model trace-33、directive assist directive-14。
- 證據位置：本機 http://localhost:3101；程序與端點核對輸出只保留於本次代理工作階段。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑完整 regression／全部 tests／大規模動畫驗證，依使用者及 V2 分級由主代理決定整合範圍。
- 已知問題或風險：hide 的 LM／INT_MAX 對應目前以 32 位 int 最大值格式化；若未來支援自訂巨集值，需在 trace metadata 加入常數求值。
- 相依與衝突注意：修改 parser、renderer、tween、入口 cache 與兩個範例；合併時需保留 integration 上這些共用檔案的後續版本號。heap.cpp 未修改。
- 主代理需補驗證的情境：合併後以 Segment_Tree_easy 與 Segment_Tree 各實際播放數個根／子節點幀，確認複合文字、樣式與局部色塊；再依動畫影響範圍執行整合驗證。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
