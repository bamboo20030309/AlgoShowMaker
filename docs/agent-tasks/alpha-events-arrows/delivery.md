# alpha-events-arrows 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows
- 共同基準 commit：ddfe5b6081261a05b437a61a546861151d4618e5
- 程式修正 commit：初版 a3a3da918e5db7d15ac36231ab00fbd5bded24e2；冒號／迴圈值 32ead62f5897bd59abcc7086e77ba14107042a85；共用區塊 0829ad1ac7adf19197b22a96a5a6b9248b466346；逗號樣式 00a3cc61586eda2227f5f57030d541e537a54277；回放樣式 a8b91a207ca259fd279653a0fb74b668c3bbf4ad；最新箭頭 identity 1a8742aaf4ca9f21e8a1464823f317a6ff4f8b22。
- 驗證版本：基準加本次程式差異；該差異完整提交至上述程式 commit，後續只修改交付文件，沒有額外程式修改。
- 驗證日期：2026-09-18
- Push：最新程式 commit 1a8742aaf4ca9f21e8a1464823f317a6ff4f8b22 已推送 origin/codex/2026-09-18-alpha-events-arrows，git ls-remote 核對 SHA 完全相同；本交付文件另行提交並推送。

## 初版根因與修改（a3a3da9 的歷史紀錄，.. 語法由本輪取代）
- 功能新增依據：使用者自行編寫詳細／濃縮幀，不要求系統自動摘要，也不要求 fast/faston。
- @events [種類列表] animate on/off [when 條件]：附屬最近的 @frame，按該幀狀態求值；控制該幀涵蓋的事件呈現，不刪除事件、資料或計算結果。來源規則優先於已保存的 Studio 開關，同類最後符合條件的規則生效。
- @arrow for k in start..end [step expression] from ... to ...：使用局部繪圖索引，不改 C++ 狀態；支援單行及連續註解多行、包含兩端的範圍、負步長、巢狀陣列索引、每支箭頭 when 與穩定子 ID。2048 候選上限與無效範圍明確報錯，不截斷。
- preset/defaults 均可包含兩種指令；server 分析及編譯映射、model 正規化保留 eventControls 與 batch 欄位。舊 trace 缺少新欄位時保持原行為。
- 最小線篩揭露疏幀依賴：當 i>7 不再建立內層詳細幀，原 iteration.last(j) 使用较早生命週期的值，原測試得到箭頭數 [2,2,2]，預期 [1,2,1]。補修只對沒有 state 幀的 scalar 生命週期從既有宣告／賦值事件取得最後值；正常結束的 terminal update 使用 before，保留原有 snapshot 生命週期值。
- Studio 對來源規則控制的事件標示 @events 原因並停用直接切換；指令助手提供新語法。
- 快取：algorithm.html 更新 events=46、model=28、arrow=5、renderer=187、studio=118、directive=9；slides.html model=28；入口精確斷言與 renderer build 同步。
- 修改檔案用途：trace-instrumenter.js（解析／依賴）、server.js（trace 映射）、trace-model.js（欄位及疏幀衍生值）、trace-events.js（每幀事件控制）、trace-arrow-model.js（批次展開）、trace-renderer.js（共用箭頭繪製）、trace-studio.js（來源控制提示）、trace-directive-assist.js（語法提示）、兩個入口 HTML（快取）、專項測試及 fixture（證據）。
- README／使用手冊／tests README 已更新；task.md 的相依調整已記錄，沒有新增自動摘要功能。

## 初版驗收條件對照
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

## 初版驗證分級與選擇
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

## 本輪擴充：冒號區間與實際迴圈值
- 驗證版本：32ead62f5897bd59abcc7086e77ba14107042a85 的程式差異；驗證時為 f6fe2a176a59d4d2fa7595637992a53795c29eb1 加上已提交的修改，後續只有 task/delivery 狀態文件修訂。驗證日期 2026-09-18。
- 狀態：小驗證通過，待主代理核實；沒有宣稱整合驗收完成。
- 需求依據：使用者確認將 .. 改成 [:]，新增 for j 與 for j in "loop_name"；有歧義時直接命名，不使用距離猜測。
- 明確範圍為 [start:end]，包含兩端、可加 step；舊 .. 與缺少冒號會明確報新語法錯誤。
- @loop as "名稱" 緊接 for／while／do，名稱唯一；具名批次指定它，自動寫法只接受同區塊及包含此幀的唯一候選。
- lib/ASMTrace.hpp 的 LoopScope 以 RAII 隔離實際呼叫，在本體入口記值，支援外層迴圈回合、函式／遞迴 activation。只為引用的迴圈及其祖先插入紀錄；額外 loop records 不是可播放事件、不重跑 C++。
- server 保留 loopRecords；model 與 renderer 在完整 trace 上對應前／內／後的實際回合。入口值不推算為連續區間，重複值使用回合／序號區分 ID，JSON 重載仍一致。
- for／while 終止的假條件不產生入口，do 至少一次；break／continue 的入口保留，空迴圈零支。安全整數與 2048 候選限制沿用，不截斷。
- 端點與條件除繪圖索引外，仍採幀當下的狀態；變數需在本體入口可見，幀須位於相同外層回合。無法匹配時報錯。
- 文件：README、指令手冊、測試說明及 task 更新；助手新增 @loop 與兩種實際迴圈寫法。快取 model=29、arrow=6、renderer=188、directive=10，入口同步。
- 與 task.md 差異：無。

| 本輪驗收條件 | 驗證方式與實際結果 | 判定 |
|---|---|---|
| [:] 區間與動態步長／端點 | parser 與既有展開案例，含 prime[0]、降序、空區間與無效舊語法 | 通過 |
| 自動與具名消歧義 | 上下兩個 j 報歧義；second 指名唯一，未知／重複名稱與入口不可見報錯 | 通過 |
| for／while／do 入口值 | 實際 C++：break 包含 4,5,6；continue 保留入口；while 重複 3,3,3；do false 一次；while false 零次 | 通過 |
| 前／內／後與回合隔離 | 外層 i=1,2,3 的前後結果分別 1,2,3 支；active loop 全部入口；遞迴及重複函式呼叫結果 3,2,1,2,1 支 | 通過 |
| 迴圈前的線篩濃縮幀 | 編譯及真實 Edge SVG：i=8 目標16一支，i=9 目標18/27兩支；濃縮 events steps=0，JSON 重載一致；最終質數正確 | 通過 |
| 既有箭頭／事件／preset 與稀疏幀 | 同一直接相關測試清單，既有契約與實際明確區間 SVG 未退化 | 通過 |

### 本輪小驗證與重跑
- 分級：V2，E/F/J 及 A 的直接相關項目；未執行完整 regression 或大規模演算法驗證。
- 執行目錄與重跑：同上小驗證命令及相同 8 個測試檔，設定 ASM_TEST_BASE_URL 指向隔離服務。新增輸入 tests/fixtures/loop-batch-sieve.cpp；原明確區間 fixture 已改為冒號語法。
- 本機 runner：node test-results/alpha-events-validation.cjs；隔離隨機埠51409、獨立 headless Edge、測試 JWT secret、故意不可連的獨立 Mongo URI。runner finally 停止服務、測試 finally 關閉瀏覽器。
- 實際結果：54 tests／54 pass／0 fail／0 skip，36.18秒，exit 0；11 個 JS 語法檢查與 git diff --check 均 exit 0。
- 證據：可提交測試／兩個 fixture；本機 test-results/alpha-loop-validation.output、alpha-events-validation.tap 與 server.log 未提交，可能被本機清理或之後重跑覆蓋。
- 初期失敗：C++ ADL 選到 std::quoted 造成編譯失敗，已明確限定 asm_trace::quoted；第二個瀏覽器 RUN 時編輯器收起，改為重新開啟測試頁再實際 RUN。保留原 SVG／資料斷言並重跑通過。
- 未驗證：公開 Docker、遠端 DB、投影片嵌入介面。主代理需核實整合差異，補投影片嵌入的線篩詳／濃縮幀定點，合併後重啟主要服務；本代理未 merge 或操作主要服務。
- 合併注意：新增內部欄位 loopRecords、source.loopContext／tracePosition 與 batch.kind=loop；舊 trace 無新欄位可正常播放。共用 trace 模組及入口快取需要協調其他分支差異。

## 最新擴充：共用 @for／@endfor 繪圖區塊
- 狀態：小驗證通過，待主代理核實。
- 驗證版本：0829ad1ac7adf19197b22a96a5a6b9248b466346 的程式差異；驗證時 HEAD 為 822a9d6ef4b91a7ff83a5caddd643c5d2227c637 加上已完整提交的修改，之後只更新交付文件。驗證日期2026-09-18。
- 設計依據：使用者同意共用繪圖區塊，不加入完整 C++ for；style／arrow／text 共用入口值、具名對應或明確區間。現有 @arrow for 保留。
- 解析與捕捉：drawLoops 保留區塊描述，支援 preset／defaults 及巢狀不同索引。只為實際迴圈引用建立入口紀錄；手動範圍不插入 LoopScope。區塊局部索引不捕捉為 C++ 變數、不洩漏至區塊外。
- 展開與呈現：model 產生 drawLocals／穩定子 ID，Rules 評估樣式選擇器與 value/index 條件，renderer 共用原箭頭及文字元件，文字格子定位與運算式也使用局部值。重复樣式合併到相同格子，不產生多個樣式物件。
- 文字條件：區塊文字用本幀狀態與入口值；避免舊 compare 快照混入前一回合。區塊外原有文字条件行為保留。
- Studio 相容：展開 ID 不新增冒號分隔符，查找文字／片段與 binding 時使用展開描述；重綁／解除仍回寫原始共用指令，來源 ID 保留。真實 Studio 能選取第二個文字運算式並顯示格式控制。
- 邊界與限制：只支援連續的 // style／arrow／text／巢狀 for；其他指令與 C++ 敘述、未配對 endfor、重複／保留索引會報錯。巢狀及 inline @arrow for 組合候選限制2048，不截斷。
- 文件與快取：README、手冊、測試說明及 task 更新；指令助手新增 for／endfor。model=30、rules=17、arrow=7、renderer=189、directive=11、studio=119，入口斷言同步。
- 與 task.md 差異：無。

| 最新驗收條件 | 驗證方式與結果 | 判定 |
|---|---|---|
| 共用 style／arrow／text 資料 | 具名線篩編譯：同一 j=0,1 同時控制 prime[0,1]、合數18/27、文字格子0/1；最終質數保持正確 | 通過 |
| 手動範圍、局部值與巢狀 | 解析及真實 C++：k／q 外內層範圍、樣式 value/index、文字6個、箭頭3支；純範圍不插入 LoopScope；外層讀 C++ j 不受內層索引遮蔽影響 | 通過 |
| 重複入口與上限 | style-only while 保留3,3,3與不同子 ID；超過2048及組合展開超量報錯 | 通過 |
| 區塊邊界與非法內容 | 缺少／多餘 endfor、C++、frame/events/keep/camera、重複索引與同名 inline batch 報錯；區塊外文字沒有局部索引 | 通過 |
| 實際 SVG 與重載 | Edge RUN 的 i=9：兩支箭頭至18/27、兩個背景色 rgba(165,214,167,0.6)、prime0/1可見紅色高亮外框、j=0/j=1文字綁定0/1；events steps=0；JSON重載一致 | 通過 |
| Studio 文字元件 | 真實 open Studio：兩個文字的 getBinding 對應格子0/1；點選第二個運算式片段後文字格式控制顯示，無 pageerror | 通過 |

### 最新小驗證與重跑
- 分級：V2，E/F/J，加上 A 的入口／提示及最小文字選取確認；未執行完整 regression 或大規模演算法驗證。
- 執行目錄：本 worktree 的 algo-vis-backend；沿用上方隔離環境及 ASM_TEST_BASE_URL 設定。
- 測試資料：tests/fixtures/drawing-loop-sieve.cpp，另保留前兩輪的兩個線篩 fixture。
- 完整測試命令：

```powershell
node --test --test-concurrency=1 tests/drawing-loops.test.js tests/events-batch-arrows.test.js tests/events-batch-arrows.browser.test.js tests/preset-directives.test.js tests/style-layer.test.js tests/text-object-bindings.test.js tests/entrypoints.test.js tests/directive-assist.test.js
```

- 本機 runner：node test-results/alpha-events-validation.cjs，自動啟停獨立埠52851與 headless Edge。最終44 tests／44 pass／0 fail／0 skip，36.10秒，exit0；13個JS語法檢查與 git diff --check 均exit0，另核對最新 model/studio 語法exit0。
- 證據：提交的專項測試與 fixture；本機 test-results/alpha-drawing-validation.output、alpha-events-validation.tap 及 server.log 未提交，可能被重跑覆蓋或清理。debug trace 只留本機 test-results，不含私人素材。
- 初期失敗：區塊文字條件採到舊 compare 快照，修正為本幀局部值；高亮測試原本查舊附件屬性，改為查實際前景外框與所屬格子、紅色 stroke 及非零寬度；新增 Studio 查找支援後同步快取斷言。沒有降低背景色、文字內容、箭頭數、事件排程或可見高亮斷言。
- 未驗證：公開 Docker、遠端資料庫、投影片嵌入介面。主代理需補嵌入線篩共用区塊定點驗證；未合併、未重啟主要服務，隔離測試服務與瀏覽器已停止。
- 合併注意：此輪新增 drawLoops 描述與呈現時的 drawLocals／drawSourceId／drawCandidateCount；新 helper 不改原始 frame 指令，舊 trace 沒有 drawLoops 時保持原行為。需協調共用 model／rules／renderer／studio 及入口快取差異。

## 最新擴充：逗號多樣式
- 狀態：小驗證通過，待主代理核實。
- 驗證版本：00a3cc61586eda2227f5f57030d541e537a54277 的完整程式差異；驗證時 HEAD 為 4d8551bf152880031b30f5bfbd60487ed5b0495e 加上已提交的修改，之後只有交付文件修訂。日期2026-09-18。
- 設計依據：使用者要求一行 @style isprime[i] highlight,point；不改既有繪圖元件。
- 修改：instrumenter 將列表展開為原有單樣式描述；同一目標的多種類型由原 Rules／renderer 合併。五種類型均可組合，共用顏色與 when；未指定顏色時保留每種預設色。preset／defaults 按類型保留原覆寫優先序。
- ID 與限制：多種類型追加 :樣式類型，單樣式 ID 保持原樣。空列表項、未知類型及重複類型報錯；rgba 等顏色內的逗號不視為樣式分隔。
- 修改檔案：trace-instrumenter.js、trace-directive-assist.js、algorithm.html（directive 快取12）；新增 style-list.test.js、style-list.browser.test.js。README、指令手冊、測試說明及 task 更新，版本／公開發布不適用。
- 與 task.md 差異：無。

| 最新驗收條件 | 驗證方式與實際結果 | 判定 |
|---|---|---|
| 五種類型、預設色、共用條件／顏色及 ID | parser 精確比對三種類型與 focus 灰色、rgba 顏色、混合選取及單樣式原 ID | 通過 |
| defaults／preset 分類覆寫 | 後續 highlight 改紅，point 藍色、background／focus 綠色仍保留，4 個 ID 各自獨立 | 通過 |
| 區塊與條件 | 真實 C++ 編譯 @for k in [0:2]，value<3 只讓格子0/1同時有 highlight／point，格子2沒有樣式；JSON重載一致 | 通過 |
| 錯誤格式 | 尾逗號、連續逗號、未知／重複名稱明確報錯 | 通過 |
| 實際 SVG | Edge 真實 RUN：isprime[1]及區塊條件選中的[2]同時有可見紅色高亮框及跳動 point，格子0/3皆沒有；JSON重載一致，無 pageerror | 通過 |

### 小驗證與重跑
- 分級：V2 E；必要 A 入口快取／提示。沒有執行完整 regression、全部 tests 或大規模動畫驗證。
- 執行目錄：本 worktree 的 algo-vis-backend。環境沿用隔離 runner：ASM_REGRESSION=1、獨立 JWT、MONGO_URI 指向本機不可用埠1，不連遠端資料庫；ASM_TEST_BASE_URL 指向獨立隨機埠。瀏覽器為 headless Edge，不使用使用者分頁。
- fixture：新增測試內嵌的最小 C++，沒有私人投影片或資料。
- 完整命令（先設定 ASM_TEST_BASE_URL 指向已啟動的隔離服務）：

```powershell
node --test --test-concurrency=1 tests/style-list.test.js tests/style-list.browser.test.js tests/style-segments.integration.test.js tests/preset-directives.test.js tests/entrypoints.test.js tests/directive-assist.test.js
```

- 實際 runner：node test-results/alpha-style-list-validation.cjs；獨立埠51193。最終26 tests／26 pass／0 fail／0 skip，16.89秒，exit0；4個 JS 語法檢查與 git diff --check exit0。測試服務及瀏覽器已停止。
- 證據：提交的測試；本機 test-results/alpha-style-list-validation.output、alpha-events-validation.tap、alpha-events-validation.server.log 未提交，會被後續重跑覆蓋或清理。
- 初期失敗：兩個新增 fixture 誤用了 style 的引號 ID 及 frame use 寫法，改為既有 as combined 與 preset 內 @object／@frame use；一次縮排整理差異檢查發現範圍過大，恢復無關縮排後重跑，最終完整差異僅本次功能。未放寬任何行為或可見性斷言。
- 未驗證／合併注意：公開 Docker、遠端資料庫、投影片嵌入介面未驗證；主代理需核實同格多樣式在嵌入投影片的呈現。未合併、未重啟主要服务；此輪沒有 model／runtime／renderer 契約變更，需協調 instrumenter 與指令助手快取差異。

## 最新修正：回放 style 停在离開的幀
- 狀態：小驗證通過，待主代理核實；未宣稱整合完成。
- 驗證版本：a8b91a207ca259fd279653a0fb74b668c3bbf4ad 的完整程式差異；驗證時 HEAD 是 5066ca9fa892f3b655e3243ff843b5519e681fcb 加上已提交修改，之後只有交付文件修訂。日期2026-09-18。
- 已確認根因：renderFrame 在往回播放時，目的場景為 i=8，eventFrame 則是要倒播的 i=9。prepareForwardValues 卻用 eventFrame 更新 style，覆蓋了 renderer 已畫好的 i=8 樣式。解析、loopRecords 及箭頭本身正確，錯誤發生在動畫層更新裝飾。
- 最小重現：新增 fixture 的 n=30，先切至濃縮幀 i=8，再 CodeScript.next 到9，再 CodeScript.prev 回8。切換完成後箭頭已到16，但高亮仍在9/18/27，應為8/16。修正前 browser 專項精確重現此失敗，未放寬斷言。
- 修正方式：樣式變數集合及 Rules.evaluate 改用 options.frame（目的幀），沒有提供 frame 的獨立 helper 呼叫仍 fallback eventFrame；事件數值及 checkpoint 倒播來源維持原順序。沒有修改線篩演算法、箭頭路徑或條件語法。
- 修改檔案：public/trace-frame-tween.js、algorithm.html（tween build/cache211）、tests/style-replay.browser.test.js、tests/fixtures/style-replay-sieve.cpp；README、測試說明及 task 更新。未發布版本／Release。
- 與 task.md 差異：無。使用者沒有補充「回放」操作方向，已實際重現往回方向並涵蓋相關往前／再次播放；沒有把未回答當成同意。

| 最新驗收條件 | 驗證方式與實際結果 | 判定 |
|---|---|---|
| 目的幀高亮正確 | 真實 Edge SVG：i=8 為8/16，i=9為9/18/27；CodeScript 往前、往後、再次往前的所有可見格子高亮及 fill 都與目的幀靜態呈現完全相同 | 通過 |
| focus、箭頭與事件保留 | 比對全部 isprime／prime SVG 格子的 fill，包括 focus；往回箭頭目標16、往前18/27，關閉細節事件的 steps=0 | 通過 |
| JSON 重載 | 重載完整 trace 後從9回8，同樣全部格子／高亮／箭頭符合目的幀 | 通過 |
| 單次自動播放 | 隔離文件終點限定於i=9，從i=8按實際播放按鈕；speedSlider=500及1500均到9並停止，高亮／focus填色／箭頭與靜態幀一致 | 通過 |
| 既有樣式及入口 | presented-style-values 的4個直接相關案例、style-layer的3個及entrypoints的1個通過；沒有 pageerror | 通過 |

### 小驗證與重跑
- 分級：V2 H/J，加上 A 入口快取；只選4個直接相關檔案，未執行完整 regression 或整套演算法。
- 執行目錄：本 worktree 的 algo-vis-backend；沿用前節的独立服務／本機不可用 Mongo 埠／ASM_TEST_BASE_URL／headless Edge 設定，不操作使用者分頁或投影片。
- fixture：tests/fixtures/style-replay-sieve.cpp，沿用使用者 preset、@for、and 條件及 eventInstructionStates，僅縮排與程式空白不同；輸入30。全程只觀察8/9定點與兩次單步自動播放，不逐幀播放其他算法。
- 完整命令（先設定 ASM_TEST_BASE_URL 指向隔離服務）：

```powershell
node --test --test-concurrency=1 tests/style-replay.browser.test.js tests/presented-style-values.integration.test.js tests/style-layer.test.js tests/entrypoints.test.js
```

- 實際 runner：node test-results/alpha-style-replay-validation.cjs，独立埠51303；9 tests／9 pass／0 fail／0 skip，21.16秒，exit0。2個JS語法檢查及git diff --check exit0；測試服務與瀏覽器已停止。
- 證據：已提交 fixture／瀏覽器專項；本機 test-results/alpha-style-replay-validation.output、alpha-style-replay-validation.tap／server.log 未提交，可能被重跑覆蓋或清理。最早異常為往回 transition 完成後的高亮集合比對，沒有檢查或更改動畫交叉路徑。
- 未驗證與合併注意：嵌入投影片／Studio、公開 Docker、遠端資料庫未驗證；主代理按影響補同一線篩在嵌入介面的上一幀確認。主要 main 尚未整合 alpha，本次不 merge 或重啟主要服務；需協調共用 tween 與入口快取差異。

## 最新修正：共用區塊箭頭動畫與事件開關
- 狀態：小驗證通過，待主代理核實。
- 驗證版本：1a8742aaf4ca9f21e8a1464823f317a6ff4f8b22；驗證時 HEAD 為 9c4d612fc28a772f3c672409393185be66446df3 加上已提交的完整程式差異，後續只修改交付文件。日期2026-09-18。
- 根因與證據：@events 本身只控制 runtime 事件，不會停用 frame tween。共用 @for 展開的箭頭子 ID 卻含 loop-instance，i=8與9的同一 j=0 得到不同 ID；1支改2支時，保守的 ArrowModel family 配對也不能選出唯一對象，因此失去端點位移。新增／移除箭頭原有淡入／淡出並未被事件開關直接取消。
- 修正方式：箭頭繪圖槽改以來源 scope／靜態 loop ID／入口序號識別，跨 runtime 回合保持角色；手動範圍仍按值區分。其他 style／text ID 保持原樣，loopRecords／drawLocals 仍依原 instance 隔離，不改演算法資料、runtime 或 ArrowModel 幾何與路徑。
- 修改檔案：trace-model.js、algorithm.html與slides.html（model cache31）、drawing-loops.test.js及entrypoints.test.js；新增 drawing-arrow-animation.browser.test.js。README、指令手冊、測試說明及task更新，Release／公開部署不適用。
- 與 task.md 差異：無。

| 最新驗收條件 | 實際驗證與結果 | 判定 |
|---|---|---|
| 跨回合角色配對 | 編譯具名線篩區塊：i=8／9的 j=0 ID 相同，j=1獨立；JSON重載ID一致 | 通過 |
| SVG端點位移 | headless Edge，i=8到9的j=0由16移至18，i=9到10由18移至20；配對存在、progress介於0和1，實際x2/y2有同時異於起點與終點的中間值 | 通過 |
| 出入場 | 新j=1箭頭有0與1之間的可見opacity；移除j=1有淡出ghost及中間opacity，切換完成後只剩j=0到20 | 通過 |
| 事件與style分開 | 同一trace分別設 all animate off/on，兩者都有上述動畫。off的事件steps=0，on的steps>0；off仍取樣到SVG內fill/stroke paint transition正在播放 | 通過 |
| 重載 | JSON重載後i=8到9仍配對位移，箭頭到18/27，steps=0 | 通過 |

### 小驗證與重跑
- 分級：V2 E/H/J與必要A快取；只挑4個直接相關檔案，未執行完整regression或整套動畫集。
- 目錄／環境：本worktree的algo-vis-backend；ASM_TEST_BASE_URL指向獨立服務，Mongo指本機不可用埠1，headless Edge不操作使用者分頁。fixture沿用 tests/fixtures/style-replay-sieve.cpp，輸入30；browser只取樣8/9/10之間局部切換。
- 完整命令（先設定 ASM_TEST_BASE_URL 指向已啟動隔離服務）：

```powershell
node --test --test-concurrency=1 tests/drawing-arrow-animation.browser.test.js tests/drawing-loops.test.js tests/arrow-identity.test.js tests/entrypoints.test.js
```

- 本機runner：node test-results/alpha-arrow-animation-validation.cjs，埠63700；9 tests／9 pass／0 fail／0 skip，15.99秒，exit0。4個JS語法與git diff --check exit0，測試服務與瀏覽器已停止。
- 證據：提交的專項與fixture；test-results/alpha-arrow-animation-validation.output／tap／server.log只留本機、未提交，可能被重跑覆蓋或清理。修正前失敗精確顯示 j=0 的 loop-instance-7／8 不同 ID，保留角色相等、中間座標、opacity及style paint所有斷言，未放寬行為。
- 未驗證與合併注意：嵌入投影片／Studio、公開Docker／遠端資料庫未驗證；主代理補同一組批次箭頭在投影片嵌入的單次切換。此輪僅改呈現時箭頭子ID，不增加runtime資料；需協調共用model與入口cache。main未整合alpha，未merge、未重啟主要服務。

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
