# alpha-events-arrows 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows
- 共同基準 commit：ddfe5b6081261a05b437a61a546861151d4618e5
- 程式修正 commit：a3a3da918e5db7d15ac36231ab00fbd5bded24e2
- 驗證版本：基準加本次程式差異；該差異完整提交至上述程式 commit，後續只修改交付文件，沒有額外程式修改。
- 驗證日期：2026-09-18
- Push：程式 commit 已推送 origin/codex/2026-09-18-alpha-events-arrows，git ls-remote 核對 SHA 完全相同；本交付文件另行提交並推送。

## 根因與修改
- 功能新增依據：使用者自行編寫詳細／濃縮幀，不要求系統自動摘要，也不要求 fast/faston。
- @events [種類列表] animate on/off [when 條件]：附屬最近的 @frame，按該幀狀態求值；控制該幀涵蓋的事件呈現，不刪除事件、資料或計算結果。來源規則優先於已保存的 Studio 開關，同類最後符合條件的規則生效。
- @arrow for k in start..end [step expression] from ... to ...：使用局部繪圖索引，不改 C++ 狀態；支援單行及連續註解多行、包含兩端的範圍、負步長、巢狀陣列索引、每支箭頭 when 與穩定子 ID。2048 候選上限與無效範圍明確報錯，不截斷。
- preset/defaults 均可包含兩種指令；server 分析及編譯映射、model 正規化保留 eventControls 與 batch 欄位。舊 trace 缺少新欄位時保持原行為。
- 最小線篩揭露疏幀依賴：當 i>7 不再建立內層詳細幀，原 iteration.last(j) 使用较早生命週期的值，原測試得到箭頭數 [2,2,2]，預期 [1,2,1]。補修只對沒有 state 幀的 scalar 生命週期從既有宣告／賦值事件取得最後值；正常結束的 terminal update 使用 before，保留原有 snapshot 生命週期值。
- Studio 對來源規則控制的事件標示 @events 原因並停用直接切換；指令助手提供新語法。
- 快取：algorithm.html 更新 events=46、model=28、arrow=5、renderer=187、studio=118、directive=9；slides.html model=28；入口精確斷言與 renderer build 同步。
- 修改檔案用途：trace-instrumenter.js（解析／依賴）、server.js（trace 映射）、trace-model.js（欄位及疏幀衍生值）、trace-events.js（每幀事件控制）、trace-arrow-model.js（批次展開）、trace-renderer.js（共用箭頭繪製）、trace-studio.js（來源控制提示）、trace-directive-assist.js（語法提示）、兩個入口 HTML（快取）、專項測試及 fixture（證據）。
- README／使用手冊／tests README 已更新；task.md 的相依調整已記錄，沒有新增自動摘要功能。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 每幀事件規則、条件及資料保留 | parser／model 狀態斷言 | i=7、8、9 條件與無規則幀互不洩漏，payload/state 保留，再套用一致 | 通過 |
| 全部／指定種類、on/off、preset | 類型與錯誤斷言、defaults/preset/local 次序 | 最後符合規則生效，內部 condition 不可開啟，無效語法／無 frame 報錯 | 通過 |
| 動態範圍、步長、局部索引及 identity | batch 展開與範圍、索引、條件斷言 | 巢狀 prime[k] 求值、動態步長與排除 k=1 正確，範圍改變仍保留子 ID | 通過 |
| 空範圍與錯誤 | 空／反向／零／小數／超量案例 | 空範圍零支、負步長正確，零／無法解析／超過 2048 明確報錯 | 通過 |
| iteration.last 與 break | 真實 C++ 線篩及沒有內層幀的正常迴圈 | i=8,9,10 批次數 1,2,1；正常迴圈最後值 1,2,3；既有兩項契約不變 | 通過 |
| 濃縮幀實際畫面與資料 | headless Edge 的 Ace 編輯器與 RUN、SVG、playback plan | i=8 一支、i=9 兩支箭頭到18/27，DOM 合數值皆0；詳細幀有事件，濃縮幀 trace-events steps=0，無 active event | 通過 |
| 回看與 JSON 重載 | 真實 render 前後定點與 JSON round trip | 子箭頭 ID、起終點完全相同，規則與展開描述保留 | 通過 |
| 舊箭頭／事件／preset | 直接相關既有測試 | 既有案例全部通過 | 通過 |

## 驗證分級與選擇
- 層級：V2。
- 分類：E（指令／箭頭）、F（iteration.last）、J（事件設定）；入口及指令助手使用 A 直接相關檢查。
- 選擇依據：只驗證此次改動的解析、展開、事件開關、疏幀衍生值及最小線篩畫面；沒有执行全部測試或廣泛排序。
- 執行測試檔：events-batch-arrows.test.js、events-batch-arrows.browser.test.js、arrow-directives.test.js、event-defaults.test.js、preset-directives.test.js、iteration-summary.integration.test.js、entrypoints.test.js、directive-assist.test.js。
- 最終案例結果：49 tests／49 pass／0 fail／0 skip，exit 0。
- 靜態檢查：11 個本次修改 JS 的 node --check 及 git diff --check 全部 exit 0。
- 隔離服務：本 worktree、隨機埠 55571、ASM_REGRESSION=1、隨機測試 JWT secret、獨立 headless Edge；沒有使用使用者的開發服務、分頁或 deck。node_modules junction 僅復用已安裝相依。
- 資料庫：故意指向本機不可連線的獨立測試 URI，這些 /trace/analyze 與 /compile 案例不依賴 MongoDB；預期連線失敗不代表真實 Mongo 已驗證。
- 未執行：完整 regression、大規模動畫、多種排序及三介面全套；依使用者驗證分級規則不執行。
- 需要主代理的 V3：不要求完整 V3；合併後核實最小線篩詳／濃縮幀與演算法投影片嵌入的定點即可，若整合差異擴大再決定範圍。

## 小驗證與重跑方式
執行目錄：本 worktree 的 algo-vis-backend。

在獨立終端選擇未佔用埠，設定 PORT、ASM_REGRESSION=1、隨機 JWT_SECRET，啟動 node server.js。
本次測試使用隔離 URI mongodb://127.0.0.1:1/alpha_events_isolated?serverSelectionTimeoutMS=1000，
不需真實 DB。另一終端設定 ASM_TEST_BASE_URL 為該測試服務，再執行：

```powershell
node --check trace-instrumenter.js
node --check server.js
node --check public/trace-arrow-model.js
node --check public/trace-events.js
node --check public/trace-model.js
node --check public/trace-renderer.js
node --check public/trace-studio.js
node --check public/trace-directive-assist.js
node --check tests/events-batch-arrows.test.js
node --check tests/events-batch-arrows.browser.test.js
node --check tests/entrypoints.test.js
git diff --check
node --test --test-concurrency=1 tests/events-batch-arrows.test.js tests/events-batch-arrows.browser.test.js tests/arrow-directives.test.js tests/event-defaults.test.js tests/preset-directives.test.js tests/iteration-summary.integration.test.js tests/entrypoints.test.js tests/directive-assist.test.js
```

- 瀏覽器案例使用 fixtures/events-batch-sieve.cpp，只檢查 i=7 詳細幀、i=8／9 濃縮幀及回看／重載定點，沒有逐幀全套驗證。
- 可提交證據為專項測試與 fixture；本機 TAP 在 algo-vis-backend/test-results/alpha-events-validation.tap，
  自動隔離 runner 在同目錄 alpha-events-validation.cjs。產物未提交，保存限制依本機清理而定。
- 本次本機 runner 指令 node test-results/alpha-events-validation.cjs，自动啟停随机埠服務，最後 exit 0。
- 早期失敗除疏幀衍生值外，含測試端點欄位使用錯誤、跨 VM Array prototype 比較、
  fixture 原本只執行至 i=10 卻斷言完整 n=30 結果、以及測試使用不支援的 frame/preset 寫法；
  已校正 fixture／測試契約並重跑，不降低正確箭頭數或結果斷言。

## 剩餘事項與合併注意
- 小驗證通過，沒有已知本次功能阻塞；尚未宣稱主代理整合驗收通過。
- 主工作目錄已由使用者／主代理置於 main，未切換它、未自行合併 main、未重啟主要服務；本次隔離測試服務與瀏覽器已停止。
- 合併後需重啟主開發服務；Docker backend 若整合此 parser/server 變更，需重建 backend image 再重啟，僅重啟不足以載入新 server／instrumenter。public 是既有 bind mount。
- 共用欄位 frame.eventControls、arrow.batch；多代理修改相同 trace 模組或快取版本時需核對行為與版本。
- 公開 Docker、遠端 DB、演算法投影片嵌入介面未驗證，不能用本次隔離 Windows SVG 結果代替。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：本次未執行；整合後由主代理按差異決定範圍。
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
