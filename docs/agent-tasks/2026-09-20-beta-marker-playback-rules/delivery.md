# 2026-09-20-beta-marker-playback-rules 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-18-beta
- 共同基準 commit：d411440cc479e6b6f71f7a3e520023f2197b943c
- 程式修正 commit：`6f7acdb49859b88d27528b9f06a432514976d53e`、`29aa32d92cf5768fdbc57d58035b513ee09f6ff5`、`bb428c4e6cf7e32bbfb07544cb473941975b038a`
- 驗證時的 HEAD 與未提交修改：`bb428c4e6cf7e32bbfb07544cb473941975b038a`；程式工作樹無未提交修改，僅本交付文件後續更新
- 驗證日期：2026-09-20

## 根因與修改
- 已確認根因與證據：上一幀仍把目的幀與來源幀送入 tween，因此會建構反向幾何；連續下一步沒有排隊與明確門檻；marker group 以名稱排序；assignment 讓來源與目的群組在整段 motion 同時重排；reference parameter 使用不同 variable id，導致同一實體被判定為新 visual；背景分頁恢復後會把隱藏時間計入動畫。後續 heap 案例另確認遞迴 `int i` 雖視為角色延續，仍套用宣告 marker 的 180ms 位移排程，且目的格讓位仍使用接近一個標籤寬度的舊 D04 規則。
- 修正方式與行為變化：新增穩定幀導覽入口；上一幀、時間線、快轉與隱藏期間導航皆取消動畫後直接重建；500ms 內第 3 次下一步切為逐次穩定幀快轉；按住按鈕或方向鍵使用語速間隔 repeat；marker 依宣告順序排列，來源立即回填，目的格從移動開始同步讓位；宣告事件延續 marker 且有實際位移時採 520ms，無位移維持 180ms；跨格箭頭從起步時即切換目的格方向，抵達後才提交邏輯歸屬；局部 reference alias 沿用 visual 並只改名，全域 alias 同幀保留兩個 marker；動畫與 TTS 隨分頁可見性一起暫停。
- 修改檔案及用途：`trace-renderer.js`（marker 排版、alias 與全域 alias）、`trace-frame-tween.js`（讓位時機、箭頭、opacity、隱藏暫停）、`trace-player.js`（穩定幀導覽）、`front.js`（連點與長按／方向鍵快轉）、`tts.js`（分頁暫停／恢復）、三個 focused test 檔與任務文件。
- README／版本紀錄／使用說明更新：不適用；本次為既有播放與 marker 規則修正，任務定義與交付紀錄已收錄操作語意。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 固定 marker 排列、寬格及虛擬格箭頭 | `unresolved-markers.test.js` | 宣告順序、8px 單排、alias、虛擬格與箭頭案例通過 | 通過 |
| 來源立即回填、目的從起步同步讓位、抵達切換 | `unresolved-markers.test.js` motion checkpoint | 來源立即回填；目的 peer 在移動開始後已進入重排，並與移動 marker 同時完成；邏輯歸屬於抵達後提交 | 通過 |
| 起步時切換目的箭頭方向 | `unresolved-markers.test.js` 的跨格目的群組案例 | 動畫時間 0 即採用目的排列的 13px 箭頭水平偏移，目的 peer 隨後與 marker 同步讓位 | 通過 |
| 宣告延續 marker 的位移時間 | `unresolved-markers.test.js` timeline 與 motion checkpoint；指定 heap 輸入的隔離 Edge | 有實際位移為 520ms；180ms 時仍在途中；原地宣告排程維持 180ms；第 17 幀 `event-405` 實際為 520ms | 通過 |
| resize 與事件順序 | `outerframe-tween.test.js`、`sequence-operations.integration.test.js` | outerframe、格子、文字與 sequence push/pop 局部案例通過 | 通過 |
| 上一步、時間線與返回後重播 | `trace-player-navigation.test.js`、隔離瀏覽器 | 上一步／goto 無 previous frame、動畫關閉；下一步仍傳入來源幀 | 通過 |
| 500ms／3 次與長按 repeat | `playback-navigation.browser.test.js` | 三次輸入恰好到第 3 幀；第三次為穩定幀；方向鍵長按產生穩定幀 repeat | 通過 |
| 分頁隱藏同步暫停與隱藏導航 | `trace-player-navigation.test.js`、程式檢查 | hidden navigation 強制穩定幀；tween 不累計 hidden wall time；TTS pause/resume | 通過 |
| 事件開關立即穩定重建 | `trace-studio.js` 既有入口差異審查與 renderer cancel 流程 | 開關以 animateEvents/animatePositions false 重畫同幀，render 起點取消目前 tween | 通過 |

## 小驗證與重跑方式
### 語法與差異檢查
- 目的與對應條件：確認五個 runtime JS 無語法錯誤，提交差異無 whitespace error。
- 執行目錄與必要環境設定：worktree 根目錄。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check` 分別檢查 `public/front.js`、`trace-frame-tween.js`、`trace-player.js`、`trace-renderer.js`、`tts.js`；`git diff --check`。
- 預期結果：exit code 0，無 diff error。
- 實際結果與 exit code（適用時）：全部 exit code 0。
- 證據位置：本機命令輸出；未提交大型 log。

### marker、alias、讓位與生命週期
- 目的與對應條件：驗證 A～K、N 中本次改動的 marker 排版、alias、讓位門檻、opacity 與 unresolved 行為。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：測試內建 synthetic frame／marker geometry。
- 完整指令或操作步驟：`node --test tests/unresolved-markers.test.js`
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：60/60 通過，exit code 0。
- 證據位置：`algo-vis-backend/tests/unresolved-markers.test.js`。

### 指定 heap 第 16→17 幀
- 目的與對應條件：核實使用者提供程式與輸入中，遞迴參數 `int i` 從 `heap[2]` 延續至 `heap[4]` 的宣告位移時間。
- 執行目錄與必要環境設定：beta `3102` 服務、headless Edge，前端 build `trace-211`。
- 測試資料／fixture：使用者提供的 heap 程式；輸入 `10` 與 `5 7 2 1 9 4 11 15 8 6`。
- 完整指令或操作步驟：以 `/trace/analyze`、`/compile` 產生 trace，載入 `algorithm.html`，穩定跳至第 16 幀後執行下一步，讀取第 17 幀 playback plan 的 `event-405`。
- 預期結果：宣告延續 marker 有跨格位移，visual duration 為 520ms。
- 實際結果與 exit code（適用時）：`event-405` visual duration 520ms，總事件時間含 code prompt 為 920ms；exit code 0。
- 證據位置：本機命令摘要；未提交大型 trace 或瀏覽器產物。

## 驗證分級與選擇
- 層級：V2。
- 分類：G（指標／生命週期／排程），另以 A 的入口測試核對快取版本。
- 選擇依據：修改 marker 位移排程、目的格讓位起點與宣告延續時間。
- 執行的測試檔／名稱篩選：`tests/unresolved-markers.test.js` 全檔；`tests/entrypoints.test.js`。
- 驗證環境與隔離服務：beta worktree、3102、headless Edge；未操作使用者分頁；3102 已重啟為 PID 54940 並載入 `trace-212`。
- 驗證版本、完整指令、結果與證據：程式 commit `bb428c4e6cf7e32bbfb07544cb473941975b038a`；`node --check public/trace-frame-tween.js`、`node --test tests/unresolved-markers.test.js`（60/60）、`node --test tests/entrypoints.test.js`（1/1）、`git diff --check` 均通過。
- 未執行的驗證及原因：依驗證分級不執行完整 regression、全部 tests 或大規模演算法動畫。
- 需要主代理做的 V3 驗證：整合後實際播放 heap 第 16→17 幀，觀察 `i` 的 520ms 位移與目的格從起步同步讓位。

### sequence、outerframe 與穩定幀導覽
- 目的與對應條件：驗證 J、L、M 的 push/pop、outerframe 及穩定幀入口。
- 執行目錄與必要環境設定：`algo-vis-backend`；integration 使用 `ASM_TEST_BASE_URL=http://127.0.0.1:3102`。
- 測試資料／fixture：既有 sequence fixture 與 synthetic trace frames。
- 完整指令或操作步驟：`node --test tests/sequence-operations.integration.test.js tests/outerframe-tween.test.js tests/trace-player-navigation.test.js`
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：9/9 通過，exit code 0。
- 證據位置：對應測試檔；未提交 log。

### 隔離瀏覽器播放操作
- 目的與對應條件：實際操作三次快速下一步、上一步及按住右方向鍵。
- 執行目錄與必要環境設定：beta 3102 服務、headless Edge；`ASM_TEST_BASE_URL=http://127.0.0.1:3102`。
- 測試資料／fixture：瀏覽器注入六幀 synthetic trace。
- 完整指令或操作步驟：`node --test tests/playback-navigation.browser.test.js`
- 預期結果：每次輸入只移動一幀，第三次與 repeat 使用穩定幀，上一步直接穩定重建，無 page error。
- 實際結果與 exit code（適用時）：1/1 通過，exit code 0；服務最終重啟後再次通過。
- 證據位置：`algo-vis-backend/tests/playback-navigation.browser.test.js`。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression、全部 tests 或大規模演算法動畫驗證，依使用者與驗證分級要求由主代理整合後決定範圍。曾嘗試一次整份 `heap-marker-assignment.integration.test.js`，前 10 項通過後其餘請求被開發服務 rate limiter 拒絕；這是環境限流，不記為功能通過或失敗。
- 已知問題或風險：快轉狀態與 marker alias 牽涉共用播放器及 renderer；主代理合併時應留意同期修改衝突。全域 alias 的雙 marker 需要 global scalar 同時存在於 frame state；renderer 會依相同 runtime identity 自動補出。
- 相依與衝突注意：`front.js`、`trace-frame-tween.js`、`trace-renderer.js`、`trace-player.js` 為高重疊共用檔案；請以行為規則處理衝突，不只採文字版本。
- 主代理需補驗證的情境：實際 heap 範例逐幀檢查 push/pop、compare→assign、scope exit；局部 reference alias 進出函式；整合版 500ms 三連點、時間線跳轉與 hidden tab 恢復。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：beta 3102 已由開發代理重啟為 PID 55100，並確認 `/front.js` 與 `/trace-renderer.js` 含本次版本；整合服務仍由主代理處理。
- Push／公開部署狀態：待開發代理 push；未部署。
