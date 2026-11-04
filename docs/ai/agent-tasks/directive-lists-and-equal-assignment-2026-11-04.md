# 指令逗點列表與同值賦值

## 需求與結果

- 同一參數位置可列多項；兩側皆多項時，依使用者最後決定採全部組合。
- 新增 pointer 指標／目標列表、arrow from／to 列表、place 多來源；沿用括號、索引、字串邊界解析，共享後綴。既有 frame、object、style、segment 等列表維持原語意，舊 arr[i,j] 不恢復為指標。
- 多支具名箭頭產生穩定且不同的 ID，preset 內保留全部展開項目。place 每個物件仍只能有一個目的地，衝突明確警告。
- 提示清單與兩份指令手冊補上範例；前端及投影片內嵌介面更新快取版本。
- 讀取強調預設關閉，開啟後預設純紅色 red；既有 AV_red、自訂色、明確關閉值保留。
- 移除「賦值前後相同就只畫深灰框」的捷徑。同值複製、計算與常數賦值均走一般流程；自我賦值也建立正常複本，複合賦值的舊目標不搬移規則保留。
- 初始化速度核實：新 j 指標入場 180 ms，初始化以零額外時間建立位置；key 空格入場 180 ms 後接整格複製 300 ms。這次未改此規則。

## 驗證與獨立答案

- V2 局部驗證，未執行大型動畫驗證。
- directive-lists.test.js、pointer-directives.test.js、directive-assist.test.js、event-defaults.test.js：30 項通過。
- directive-lists.browser.test.js：獨立服務實際分析／編譯，兩幀各四指標、四箭頭，IndexedDB 保存重開及瀏覽器錯誤檢查通過。
- arrow-directives.test.js、place-directives.test.js：30 項核實。首次有兩項失敗：不完整端點現在由列表解析先給更精確錯誤，更新行號與錯誤斷言；另一項舊測試用過期字串移除 pivot，實際沒有修改 fixture，改成移除現有 frame 中的 pivot，保留「隱藏來源應拒絕」要求。只續跑這兩項，均通過。
- read-highlight-defaults.browser.test.js：舊欄位缺失、新預設、自訂色、AV_red、明確關閉、實際雲端格式／IndexedDB 往返、讀取開關通過；另實際核對插入排序初始化時間，同值 key 賦值仍有格子及 8 的複本，讀取紅框且無原深灰目標框。
- event-motion-policy.test.js：3 項通過，固定核對同值 copy／compute／literal 仍為 300 ms。
- E09 按使用者新規格由「強調 240 ms」改為「整格複製 300 ms」，並更新固定手寫答案及公開規則。初次固定時鐘發現自我賦值仍被底層相同視覺 key 的保護擋掉，修正一般賦值允許自我複製後，1 倍／2 倍在提交前一毫秒、提交當下、來源樣式及暫存清理均通過；未降低容許值。
- 修改 JavaScript 語法與 git diff --check 通過；不提交測試產物。

## 分支與預覽

提交至 intergration 並推送；重啟時核對 3100 PID 與該 worktree 的 server.js，核對 HTTP、腳本內容及新增列表的 /trace/analyze 回應。main／3000 不動，不發布 release。
