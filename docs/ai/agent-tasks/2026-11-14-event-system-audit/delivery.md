# 新版事件系統核對（2026-11-14）

核對基準：intergration 44c12b0。本輪是檢查與驗證，不修改產品行為或正式答案，不合入 main、不發布 Release。

## 已確認的缺口

### 1. 括號正規化未統一（產品解析缺口）

以手算結果核對：a=b+c 與 a=(b+c) 都得到5，但前者記錄 binaryOperation=+ 並有 b/c 兩個來源，後者只保留 (b+c) 的整體來源，不能保證相同的多來源搬移動畫。

原因：部分 initializer 與位元解析會先呼叫 bitwiseOperand 剝除括號；一般 assignment 的 binaryOperationSources(sourceNode) 等路徑仍直接檢查 ParenthesizedExpression。應統一剝除不影響運算的括號，再建立操作數及事件，保留真正的分組依賴。

### 2. 巢狀運算事件樹未全面接通（已知功能缺口）

實測 a=b+c*d 得14、a=(b+c)*d 得20，均只有整體賦值，未拆出乘加或加乘的中間事件。a=L|(p<<1) 得7，a=(L|p)<<1 得6，亦只有整體賦值，沒有完整位移與 OR 子事件。

相對地 a=(L|p)&d 已可記錄內層 OR、外層 AND 與最後賦值；a=max(b,min(c,d)) 可依 min→max→賦值記錄。這證明目前是按操作類型分別處理，不能宣稱支援任意深度的所有運算。建議共用 expression operation tree 與中間結果身分，不再為每種組合加特例；不能自行強制 C++ 未規定的同層求值順序。

### 3. 正式驗證的時鐘規格漏接 200ms 反白等待（驗證工具缺口）

原始71例完整執行：58過、13未過；資料71/71通過、visual65/71、clock3/10。失敗並非最後計算結果錯誤。

- E02～E08：手寫提交時刻未計入 code prompt。E03 實際 slot.start=200、搬移提交仍在動作第660ms；絕對時刻應為860ms。E02 另有宣告220ms，絕對提交應為1080ms。
- C01/C05：暫停與速度切換仍使用舊絕對提交時間。
- C06/C10/C11/C12：在反白等待結束前便要求觀測活動中的副本或讀取 highlight。

使用獨立指定的200ms等待做一次診斷（只改記憶體中的取樣，不改正式manifest／紀錄）：上述13例中12例通過，僅C06另有規格不符，見下項。此診斷不能代替正式驗證通過，原始58/71結果保留。

### 4. 離頁控制的舊答案與新規格相反（驗證規格缺口）

C06 的 cancelOnLeave=true、離頁後無副本並顯示終態，與目前使用者指定的「離開暫停、回來續播」相反。即使取樣補上200ms，仍因保留暫停副本而失敗。應改驗同一播放計畫與副本暫停不動、回來接續、手動暫停不自動恢復；不應將產品改回離頁取消來迎合舊答案。

### 5. 標準答案的覆蓋與專項測試尚未集中（驗證覆蓋缺口）

71例分組為 assignment22、visibility4、selection14、containers10、functions8、pointers11、layout2。近期矩陣來源標籤、箭頭投影、遞迴容器整體移動、多欄format與輸入事件已有獨立專項測試，但71例不是這些特性的完整交叉表；不能用71例結果宣稱每一種render×事件均驗完。

## 實際執行

1. node scripts/validation/event-contracts.js --failed：依賴已變，實際重驗71例，未沿用舊成功；正式結果58過、13未過。紀錄位於 test-results/event-contracts/summary.json 與 records.json，未提交。
2. 五份相關integration檔（event-semantics、input-assignment、nested-expressions、postfix-presentation、selection-events）：8個具名案例全過，無skip。涵蓋輸入部分成功／EOF、短路、巢狀副作用、後置舊值與min/max child-first。
3. 八組運算式探針：最後數值8/8符合手算答案，同時記錄事件結構差異，不將數值正確當成動畫完整。
4. 13個失敗案例的時鐘診斷：12過、C06仍與舊離頁規格不符，正式答案未更改。
5. 作者指令跟隨與程式碼捲動兩個瀏覽器案例已通過；多欄位及導覽結果另附於下。

## 建議修正順序

先同步驗證的 code prompt／離頁規格並只重跑受影響案例；接著統一括號與來源解析，再處理混合算式／位移的操作依賴樹。新增標準答案須手寫中間值、依賴、來源及可見動作，不能從目前播放計畫生成答案。最後將新增專項測試與 render×事件覆蓋矩陣相互連結。

## 最後補充核對

- directive-follow.browser.test.js：2/2通過（指令跟隨、捲動時鐘）。
- multi-field-replay.browser.test.js：1/1通過（線段樹24→25幀多欄獨立提交）。
- trace-player-navigation.test.js：3/5通過，2例失敗，均仍期待離頁取消／穩定終態，與C06相同的舊規格。
- 依現行規格的獨立C06診斷通過：pagehide後同一播放計畫、搬移副本的位置凍結、正式值仍為舊值；pageshow後恢復同一計畫，最後值11且副本清空。診斷結果保存於忽略目錄的event-audit/page-resume-diagnosis.json；不取代原本未通過的C06紀錄。

因此這輪已確認的產品解析缺口是括號與混合巢狀操作；已觀察的正式驗證失敗目前可歸因於code prompt與離頁規格尚未同步。正式驗證仍不是全綠，需實際修正已過期的測試規格後重跑失敗部分，不能把診斷12/13直接改寫成71/71。

另須補強比較動畫的判定座標：event-contract-visual的verticalMotion使用相對owner的localY，owner與子格共同位移可能被抵銷。應同時核對root SVG座標與相對幾何，避免只證明格子和外框相對位置沒變，漏掉整體抬起／位移。近期專項瀏覽器測試已使用root座標，但尚未全部回接標準答案判定器。
