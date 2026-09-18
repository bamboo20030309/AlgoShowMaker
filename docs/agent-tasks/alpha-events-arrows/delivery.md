# alpha-events-arrows 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows
- 共同基準 commit：ddfe5b6081261a05b437a61a546861151d4618e5
- 程式修正 commit：初版 a3a3da918e5db7d15ac36231ab00fbd5bded24e2；冒號／迴圈值 32ead62f5897bd59abcc7086e77ba14107042a85；最新共用區塊 0829ad1ac7adf19197b22a96a5a6b9248b466346。
- 驗證版本：基準加本次程式差異；該差異完整提交至上述程式 commit，後續只修改交付文件，沒有額外程式修改。
- 驗證日期：2026-09-18
- Push：最新程式 commit 0829ad1ac7adf19197b22a96a5a6b9248b466346 已推送 origin/codex/2026-09-18-alpha-events-arrows，git ls-remote 核對 SHA 完全相同；本交付文件另行提交並推送。

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
