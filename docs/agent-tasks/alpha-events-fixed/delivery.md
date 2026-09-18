# alpha-events-fixed 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-alpha-events-arrows
- 共同基準 commit：d43bd26fdbb6af3b190ac36cef7d3e1697682117
- 程式修正 commit：7ceda463f6ad3d67bc1969222b3820f99f6768de
- 測試換行相容 commit：6652650778445da7bd8a21d3d6119ac4e51b19fe
- 驗證版本：7ceda463f6ad3d67bc1969222b3820f99f6768de 加上隨後提交於6652650的測試換行相容修正；程式內容相同。交付前HEAD為6652650778445da7bd8a21d3d6119ac4e51b19fe，僅本任務文件待提交。
- 驗證日期：2026-09-18

## 根因與修改
- trace-events.js的source controls對all規則匹配fixed，覆寫先前依全域／當幀固定開關設定的enabled；從i=8起濃縮幀新產生的固定標記因此消失。fixed屬於state，沒有timed animation。
- 一般／all的animate on/off不再匹配fixed；明確fixed規則保留舊來源相容性。事件資料與最後存取判定不變，箭頭／style／文字／鏡頭的動畫排程沒有修改。
- trace-events.js：縮小all匹配範圍；algorithm.html／entrypoints.test.js：事件腳本cache版本trace-47。
- events-fixed-state.test.js：開關相容與真實編譯；events-fixed-state.browser.test.js：實際SVG與回放狀態；fixtures/automark-events-sieve.cpp：使用者post-loop濃縮幀的等價縮小驗證，非逐字原碼。
- README、指令手冊及tests/README：補充固定狀態邊界與專項重跑說明。
- 與task.md差異：無。瀏覽器讀fixture時統一換行以符合Ace正常化行為，避免Windows checkout影響sourceCode一致性斷言。

## 驗收條件對照
| task.md條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| all off保留fixed，all on不覆寫固定開關，明確fixed相容 | unit與真實compile | 全域／當幀false保留、明確規則生效 | 通過 |
| post-loop i=8／9新固定可見，事件steps=0 | 隔離服務RUN與實際SVG | 標記分別為1～8、1～9，當幀新增8／9 enabled=true，steps=0 | 通過 |
| 回看、重載、Studio一致及3101新版 | browser與live probe | 回看1～8、重載／Studio1～9；3101腳本與alpha內容相符 | 通過 |

## 小驗證與重跑方式
### V2 J/H相關最小驗證
- 目的：上述三項條件及使用者要求的非事件動畫保留。
- 目錄：本worktree的algo-vis-backend。使用Node、專案依賴、C++編譯器與headless Edge；ASM_TEST_BASE_URL必須指向代理隔離服務。
- fixture：tests/fixtures/automark-events-sieve.cpp，输入30；箭頭專項使用既有style-replay-sieve.cpp的i=8／9／10局部切換。
- 指令：`node --test --test-concurrency=1 tests/events-fixed-state.test.js tests/events-fixed-state.browser.test.js tests/drawing-arrow-animation.browser.test.js tests/entrypoints.test.js`
- 語法檢查：對public/trace-events.js、tests/events-fixed-state.test.js、tests/events-fixed-state.browser.test.js、tests/entrypoints.test.js分別執行`node --check <檔案>`，另執行`git diff --check`。
- 本機完整隔離重跑：`node test-results/alpha-events-fixed-validation.cjs`，自行啟動隨機埠隔離服務、建立隨機測試secret、使用無真實資料的測試Mongo設定、結束後停止服務。runner僅在本機，不隨Git交付；主代理可依上述四檔指令搭配自己的隔離服務重跑。
- 最後實際結果：隨機埠56078，6 pass、0 fail、0 skipped，exit code 0，約20.66秒；四項語法及差異檢查通過。
- 箭頭專項分別在事件on/off時取樣出入場透明度、既有箭頭端點位移；事件off時仍取樣到style填色過渡，JSON重載後位移保留。
- 調查中曾因fixture混合換行造成Ace的sourceCode等待逾時；統一並於讀檔時正常化換行後重跑原斷言通過，未略過或放寬驗證。
- 證據：可提交的上述測試及fixture；本機test-results/alpha-events-fixed-validation.tap、.server.log、.cjs。這些test-results未提交，僅保留於alpha worktree，刪除worktree後不保證保存。

### 3101重啟後確認
- 先核對3101 listener PID13504、node server.js及alpha renderer內容，僅停止該服務。以alpha algo-vis-backend為工作目錄、PORT=3101與既有環境設定啟動隱藏node server.js，重啟後PID39912。
- `node test-results/alpha-3101-events-fixed-probe.cjs`：實際GET入口cache=trace-47，model／rules／events內容均與alpha相同；使用live腳本執行all off，fixed=true、write=false，exit 0。
- `node test-results/alpha-3101-probe.cjs`：使用文字陣列範圍與automark的POST /trace/analyze，HTTP200、error=null、两個text及isprime policy，rendererMatchesAlpha=true，exit 0。
- 本機probe與alpha-3101-dev.stdout.log／stderr.log均未提交。只確認alpha 3101，未重啟主要服務／Docker。

## 剩餘事項與合併注意
- 未驗證：完整regression、大規模演算法集、投影片嵌入、公開Docker／遠端部署；依本輪分級未執行。
- 已知風險：明確fixed事件指令維持相容，仍可控制該幀新固定狀態；all則不覆寫全域或當幀固定設定。
- 相依：本alpha分支既有automark／文字範圍／fixed轉場修正；主代理需整合相依提交。
- 主代理補驗證：核對本diff與小驗證，在整合版本以使用者實際輸入檢查i=7→8→9及演算法投影片定點。
- Push：程式修正已push；交付與測試相容提交隨交付一併push。本分支未merge至main。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式commit與diff範圍：待填
- 差異審查與必要重跑：待填
- 合併commit：待填
- 整合回歸／演算法投影片：待填
- 未完成或環境阻塞：待填
- 本機服務：alpha 3101已重啟；主要服務待主代理處理
- Push／公開部署：alpha已push；未公開部署
