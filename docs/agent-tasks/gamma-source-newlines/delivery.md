# gamma-source-newlines 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-22-gamma。
- 基準：4944586f065ba6c510b9afcc7662914d38f98b7f。
- 程式修正：ceb6a039320608c2cd9069757d37be8205af6735。
- 驗證版本：此commit的程式內容；browser驗證後額外加上9個獨立directive解析入口的同一正規化，並重跑直接解析／插樁及entrypoints測試。提交後只有文件修改。
- 日期：2026-10-07。

## 根因及修正
Lezer在CRLF的#include後將後續程式誤辨識為BlockComment。最小案例LF43節點0錯誤、CRLF8節點3錯誤。

- 新增source-normalization.js共用函式：實際CRLF／單獨CR轉LF，保留文字中的字面反斜線跳脫。
- trace-instrumenter：analyzeSource、buildSyntaxTree、instrumentSource與獨立公開directive解析入口，先正規化再解析、建立lineMap、切片及插樁。
- server：/trace/analyze、/syntax-tree、/compile均在型別與原始大小驗證後正規化。trace.sourceCode使用相同LF內容；stdin與stdout不做本次原始碼處理。
- Ace設定unix換行，從檔案、貼上、草稿或舊程式碼載入後getValue輸出LF。front資產版本升random-id-41。
- 未批次改寫私人程式或已儲存trace。舊trace的原有資料可載入；下次RUN才產生以LF為基準的新offset／變數ID。不能將LF分析offset拿來切原CRLF文字。
- 修改檔案：以上程式、algorithm資產版本、entrypoints、新換行小測試及KMP fixture。
- README不新增介面操作；使用與相容限制記錄於本文件。
- 與task差異：無；巨集／raw string只做解析位置與正規化比較，未宣稱另跑其執行結果。

## 驗收條件對照
| 條件 | 方式與實際結果 | 判定 |
|---|---|---|
| 四種換行一致 | LF、CRLF、混合、單獨CR的KMP tree、directive、變數及整份插樁結果deepEqual | 通過 |
| KMP語法樹 | 297節點、無Error，全部版本相同 | 通過 |
| API執行 | 直接送4種原始換行至3個API，均成功；29幀、輸入ababac輸出0 0 1 2 3 0 | 通過 |
| source offset | API的幀行號、event source.from/to/text及每幀p值一致；trace.sourceCode全部LF | 通過 |
| 實際RUN與高亮 | Ace載入CRLF、RUN成功，第二幀line23的marker也為23，對到@frame | 通過 |
| 舊程式碼／設定 | CRLF舊source及false、gapMs0、自訂color載入、使用、JSON存檔重開保留；編輯器LF | 通過 |
| 草稿重開 | 儲存頁面草稿並reload，原始碼LF與內容一致 | 通過 |
| 延續巨集／raw string／Unicode | 正規化與語法樹位置跨格式一致 | 通過 |

## 小驗證及重跑
目錄：本worktree的algo-vis-backend；Node、g++、Playwright Edge。browser測試自行隨機埠、獨立頁面，不操作使用者分頁。

- `node --test tests/source-newlines.test.js tests/entrypoints.test.js`：3/3，exit0。
- `node --test tests/source-newlines.browser.test.js`：1/1，exit0，含4次API編譯及一次介面RUN，沒有大規模演算法集合。
- server、trace-instrumenter、source-normalization、front與兩個新test檔的node --check、git diff --check：exit0。
- stdout初次測試誤假設Windows輸出LF，改按數值內容比對，保持KMP結果斷言；原始碼LF則仍做完整字串相等。
- 本機證據：test-results/culling-profile/source-newlines-unit.log、source-newlines-browser.log。未提交，保存限本機。可提交fixture與測試能獨立重跑。
- 未跑全regression／其他演算法集合或另行宏執行測試。

## 剩餘與合併注意
- LF正規化會改變CRLF的字元offset；所有新分析／執行結果對應LF，編輯器已同步。
- 舊trace不做全局source及offset遷移，載入、存檔設定保持，重新RUN重新解析。
- 共用解析入口影響範圍較廣，主代理整合時可按需要补相關preset／指令案例，勿以靜態檢查代替操作證據。
- 3103原本未運行，已從gamma絕對server.js路徑啟動PID74968；HTTP200、front random-id-41、CRLF /syntax-tree成功20節點及/trace/analyze成功1幀。
- 程式與文件將push origin/codex/2026-09-22-gamma，交付訊息確認結果；未merge main/intergration、未公開部署。

## 主代理核實與整合（由主代理填寫）
- 狀態：2026-10-07 主代理核實通過，整合至 intergration；來源 e3b08cf0e4ab5525fb36257a3a220f1a9c6fbdb5，整合前基準 56c0eb8。
- 衝突處理：保留整合版的 AsyncLocalStorage 除錯隔離、佇列、空程式保護及例外邊界；在現有 analyze／syntax-tree／compile 路徑驗證型別與大小後正規化。分析快取鍵也使用 LF；保留本機編輯功能及既有模組版本，front 版本升 random-id-50。
- 核實：換行單元與 entrypoints 3/3；隔離瀏覽器／後端的 source-newlines、no-drawing-transition、force-recompile、empty-compile、runtime-local-editor 共 6/6；preset 解析 9/9，編譯 3/3。合計 21 個不同案例通過，無略過；語法及差異檢查通過。
- 驗證準備修正：首次 preset 編譯 3 案因缺少 ASM_TEST_BASE_URL 被 helper 阻止；改以隨機埠隔離服務只續跑這 3 案，全部通過。未呼叫使用者 3000。新換行瀏覽器測試改用 startIsolatedServer，隔離暫存檔及執行檔快取；修改後只重跑該檔，通過。
- 舊資料／畫面：實際 CRLF 原始碼 RUN、29 幀 KMP 結果、第二幀行號 23 與 Ace 高亮一致；舊 trace 的自訂色、gapMs=0 與明確 false 設定保存重開正常，本機展示編輯保存重開通過。未操作使用者分頁或改寫範例投影片。
- 未執行完整 V3：此次為換行解析修正，採直接相關小驗證；無剩餘失敗或環境阻塞。
- 3100：核對原 PID 25696 與來源前端後，只停止該程序；新 PID 56924，HTTP 200，front random-id-50 與工作目錄一致，CRLF /trace/analyze 回傳 1 個繪圖幀。3000、其他代理與 Docker 未重啟。
- 推送：隨本次合併提交推送 origin/intergration；未合併 main、未發布 release 或公開部署。
