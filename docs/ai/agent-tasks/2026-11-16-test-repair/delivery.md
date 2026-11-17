# 失敗驗證核對與更新

日期：2026-11-16。分支：intergration；基準：4a1d40e。這是失敗案例續驗，不是完整 release 驗收。

## 結果

- 原先失敗的 18 份測試檔：17 份通過，unresolved-markers.test.js 仍有 8 項失敗。
- 合併本輪各檔最後一次結果：202 項，193 通過、8 失敗、1 跳過；跳過的是 Windows 無法核實的 Linux MLE 隔離檢查。
- 事件契約只續驗 18 個受影響案例：10 個時鐘案例與 8 個控制案例；C12 保留失敗。其他既有案例未重跑，不宣稱整份驗證集已在本次全通過。
- 函式呼叫實際動畫單獨續驗：85 個樣本通過。先前其他 19 個動畫結果保留原日期，不冒充本次重跑。

## 18 份測試的原因與修訂

| 測試檔（tests/） | 失敗原因與修訂 | 最後結果 |
|---|---|---|
| assignment-indices.integration.test.js | 不可見來源仍可賦值給可見目標；runtime 已捕捉運算元。保留只求值一次及索引正確斷言 | 通過 |
| code-presentation.integration.test.js | 加入 pointer 後原始行號已改變；初始化語意仍可檢視；舊 timer mock 未驅動目前 rAF 時鐘 | 通過 |
| compile-recovery.integration.test.js | 回應讀取完成早於伺服器 close 回呼；改成限時 1 秒輪詢，仍要求所有活動數歸零，不接受殘留工作 | 通過，MLE 跳過 |
| event-defaults.test.js | 未納入已確認的取大、取小事件 | 通過 |
| function-call-event.integration.test.js | 舊答案要求執行中灰色；改為執行中黃色、完成灰色 | 通過 |
| heap-marker-assignment.integration.test.js | 舊答案要求常數指標先停放；目前應直接在解析出的目標入場。保留底層初始化事件可檢視 | 通過 |
| http-payload-limits.test.js | 匯出預期仍要求 materialize 完整 Trace；改核對 recipe project 與禁止內嵌 Trace | 通過 |
| matrix-renderer.test.js | 開放端點 [0:] 已合法；仍拒絕雙冒號 | 通過 |
| playback-parity.integration.test.js | 舊手動 studio.cameraRules/positions 不再是指令模式的權威來源；改用幀內 camera，補齊 DOM mock | 通過 |
| prefix-sum.test.js | 矩陣使用獨立 row/column pointer，舊字串斷言未更新 | 通過 |
| sample-trace-publish.test.js | 尚期待舊 Trace catalog；改核對 executable-only、快取 HIT 與 Trace cache DISABLED，同時修正實際部分發布問題 | 通過 |
| segment-tree-samples.test.js | 舊內嵌指標語法斷言未遷移到獨立 pointer | 通過 |
| sorting.integration.test.js | 將底層初始化語意事件可檢視，誤認為畫面必須分開播放 | 通過 |
| style-list.test.js | 錯誤訊息空白改變；保留拒絕 a,,b 的語法斷言 | 通過 |
| trace-bundle-compatibility.test.js | 引用已移除的官方 Trace 檔；改用記憶體內 legacy fixture，驗證解碼、來源/內容雜湊拒絕及禁止永久 cache | 通過 |
| trace-cache-generation.test.js | 舊答案要求 IndexedDB 保留 Trace；改為重開重新執行，保留來源及明確關閉設定 | 通過 |
| trace-player-navigation.test.js | 舊答案要求離頁取消/直接提交；改核對暫停、保持計畫、回頁續播 | 通過 |
| unresolved-markers.test.js | 修正 500ms 傳送、200ms 提示、220ms 退場、目前 gapMs 欄位與初始化合併呈現；補 DOM hasAttribute mock | 59/67 |

## 仍未通過：不可把目前畫面直接當答案

### 已確認的產品缺口：C12

可見來源加不可見來源的混合運算，數值仍從上方落入。手寫標準是不可見項顯示在目標格中央；觀測 hiddenOperandAtTargetCenter=false。必須修改共用賦值的來源分類與中間數字呈現，不能把答案改回「上方」。

### 指標單元測試：8 項仍為失敗

| 案例序號 | 證據與後續核實方向 |
|---|---|
| 40 | 空值賦值 fixture 仍期待左側停放，實際解析成第一格；需分開核實未初始化值與直接初始化的事件狀態，不能將 null 默認成 0 |
| 44 | motion 結束仍取得 targetMissing 與 x=143，而手寫目的格為 x=180；需核對 mock 的可見目標和事件位置解析 |
| 45 | 測試尋找舊 preEvent frame-transition phase，目前不存在；應遷移為事件執行期間的占位／讓位畫面契約 |
| 46 | 舊幀級 caller 入口 barrier 預期 740ms，實際沒有該 barrier；需以 outgoing 指標退場後的事件狀態核實 caller 入場 |
| 47 | 同上，另需核實隱藏 caller 不推擠可見參數 |
| 56 | 舊答案要求幀事件前先讓位；目前應由實際事件占位驅動，需改成逐事件畫面驗證，不能恢復提前讓位 |
| 58 | continuation fixture 未產生預期 arrow state；需補齊目前指標生命週期／事件狀態資料再判定產品是否有錯 |
| 66 | 第一支指標的手寫終點 x=180，實際 x=143；需核對同時停放的第二支指標是否誤參與目的格占位 |

40、44、58、66 尚不能僅憑簡化 VM mock 判定為真實瀏覽器產品錯誤；全部保留紅燈。45、46、47、56 已確認仍依賴舊的幀級排程假設，但替代畫面契約完成前也不標通過。

## 實際產品修正

scripts/build/prebuild-guest-decks.js 改為先準備所有檔案；全部編譯、投影、解碼成功後才寫入，catalog 最後寫。歷史 URL 若已是乾淨的 executable recipe，保持原始位元組不重新編碼。新增失敗時來源檔未被改寫、無新公開 archive、catalog 不變與歷史 archive 不變的斷言。

這不是多檔案磁碟交易；若最後寫入階段發生磁碟故障，仍可能部分寫入。此輪解決的是準備／編譯失敗不應提前修改公開檔案。

## 如何驗證與看答案

從 algo-vis-backend 執行：

```powershell
node --test tests/unresolved-markers.test.js
node scripts/validation/event-contracts.js --case C12
node scripts/validation/event-contracts.js --case E02,E03,E04,E05,E06,E07,E08,E09,E17,E19
```

第一個驗證指標的手寫座標、時序與生命週期；第二個只重現混合運算缺口；第三個檢查手寫抵達時間的前後 1ms、暫停與倍速，不從播放計畫產生答案。指令會使用測試專用服務／瀏覽器；不操作使用者分頁。

標準答案在 tests/fixtures/event-contracts/manifest.json；觀測及時鐘 helper 在 tests/helpers/event-contract-*.js。錯誤紀錄必須保留 expected、actual 與第一個失敗時間，不因為程式目前輸出某個值就修改答案。

## 本機證據（不提交 Git）

- test-results/test-repair-final.tap：18 份原失敗檔的重驗。
- test-results/test-repair-markers-final.tap：後續指標修訂的最後結果，取代前一檔中的同名案例。
- test-results/test-repair-publish-final.tap：補強來源檔保護後的最後結果。
- test-results/test-repair-event-final.log：18 個事件契約。
- test-results/animation/2026-11-16T10-08-22-847Z-b8726661/：函式呼叫實際動畫、85 樣本。

未 merge main，未發布 release；仍有失敗，不代表可發布。

3100 已重啟並確認 HTTP 200；未操作 main 的 3000。
