# 前端完成前的分階段驗證

## 基準與範圍

日期：2026-11-16（Asia/Taipei）。使用者授權先執行大部分驗證，前端尚有少量修改，因此本輪不做最終發布驗收。

程式基準：5502fd934e4e8d3ca4dfa268fffc05965210198b（intergration）。執行期間未修改產品程式、手寫答案或放寬容許值；使用隔離服務、資料與瀏覽器，不操作使用者分頁或 3000／3100。小測試採單一檔案逐一執行；事件與動畫僅使用 runtime 一種環境，主要動畫使用兩個錄製 worker。

## 已完成結果

| 驗證 | 結果 | 說明 |
| --- | --- | --- |
| 後端／解析／事件 model 等非瀏覽器測試 | 135 檔：117 通過、18 未通過 | Node TAP 共 715 項，655 通過、59 未通過、1 略過；父子測試依 Node 報表計數 |
| 事件手寫標準答案 | 71 項：53 完整通過、18 未通過 | 資料答案 71/71；畫面 63/71；10 項提交時鐘探針皆未通過 |
| 後端 JavaScript 語法 | 17 檔通過 | git diff --check 通過 |
| 主要演算法 runtime 動畫 | 20 項：19 通過、1 未通過 | 唯一失敗為 function-call-runtime 舊灰色反白斷言；原結果仍列失敗 |

主要動畫包括排序、遞迴、BIT、線段樹、LCS 與八皇后，僅使用 runtime 環境。八皇后以 N=4 核對最終答案 2 組，陣列／位元版本分別錄製前 12／16 幀，不宣稱已驗證所有八皇后幀。動畫來源與依賴執行前後指紋一致，19 項通過紀錄已匯入續跑狀態；其餘 1 項與 3 個延後的編輯前置契約仍未通過／未驗。

135 檔中的通過紀錄與依賴／環境指紋已存回 regression-state.json，檔案未改變時可續用。其餘 248 個測試檔不屬於本輪選取範圍，包含前端／編輯互動；這是延後範圍，不表示後續必須不分影響範圍全跑。

Windows 略過的 MLE 子案例需要在 Linux 核實，不能以這輪結果宣稱記憶體硬限制已驗證。

## 失敗分類與初步核實

### 已識別的舊規格與測試替身問題

- function-call-event.integration 及大型 function-call-runtime 仍要求函式呼叫期間程式碼一律灰色，與使用者後續指定的執行中黃色規則不一致；原驗證結果仍記為失敗，不直接改為通過。
- event-defaults 仍期待沒有取大／取小事件及舊顯示順序。
- http-payload-limits、sample-trace-publish、trace-bundle-compatibility、trace-cache-generation，以及事件控制 C08/C09 仍部分依賴完整 Trace 保存／舊 Trace ID，與新執行檔保存、每次重新產生 Trace 的規格不同。
- segment-tree-samples、prefix-sum 仍有舊 `@object arr[index]` 作整體與指標的字串比對；目前使用完整物件加獨立 pointer。
- playback-parity 等含缺少 document.querySelectorAll 的測試替身；unresolved-markers 含缺少 hasAttribute 的替身。這類失敗本身不足以判定真實瀏覽器有同一錯誤。

上述需要依已確認規格修訂測試及補實際觀測，不是把輸出值複製成新答案。本輪未修改這些答案。

### 仍需追查的時序、樣式與事件呈現

- 時鐘探針：E02、E03、E04、E05、E06、E07、E08、E09、E17、E19。資料與一般視覺答案通過，但精確提交點／自訂填色未通過；觀測中事件 slot 有 200ms 前置段，手寫提交時間與目前排程存在差異，自訂顏色亦未呈現。需追查前置反白、樣式注入、實際提交，不能直接把所有失敗判為產品或測試單方問題。
- 控制案例：C01、C05、C06、C08、C09、C10、C11、C12。包含暫停續播、速度、步進、讀取 highlight 及儲存重開；C08/C09 的舊儲存規格另如上。
- assignment-indices、heap-marker-assignment、sorting 等仍有初始化事件呈現、來源可見性與初始化前指標狀態的預期差異。
- code-presentation 的關閉大括號／程式片段，以及 trace-player-navigation 的切頁中斷／恢復，需分別以目前產品規格與真實畫面核實。
- style-list 的空目標錯誤與 matrix-renderer 的範圍合法性，需核對目前通用逗點／區間語法，尚未擅自改答案。

### 結果傳輸收尾觀測

compile-recovery 的 CE／OLE 等檢查在下載結果後立即要求所有計數為零時失敗。獨立觀測結果：active/pending/running 均為零，resultStreams.active 在剛下載完為 1，50ms 與其後均為 0。支持非同步回應收尾的競態，尚無此觀測下的持續佔用證據；原測試仍列失敗，後續應明確定義「最終回收」的觀測時點與上限。

## 18 個未通過檔案

- assignment-indices.integration.test.js
- code-presentation.integration.test.js
- compile-recovery.integration.test.js
- event-defaults.test.js
- function-call-event.integration.test.js
- heap-marker-assignment.integration.test.js
- http-payload-limits.test.js
- matrix-renderer.test.js
- playback-parity.integration.test.js
- prefix-sum.test.js
- sample-trace-publish.test.js
- segment-tree-samples.test.js
- sorting.integration.test.js
- style-list.test.js
- trace-bundle-compatibility.test.js
- trace-cache-generation.test.js
- trace-player-navigation.test.js
- unresolved-markers.test.js

## 原始證據與續跑

以下相對於 algo-vis-backend，均為被 Git 忽略的本機驗證產物：

- test-results/preflight-2026-11-16/summary.json：每檔結果、耗時與 Node TAP 計數；同資料夾有各檔完整 TAP。
- test-results/preflight-2026-11-16/stream-release-probe.json：傳輸收尾定時觀測。
- test-results/event-contracts/summary.json、records.json：逐項手寫答案、畫面與時鐘結果。
- test-results/animation/2026-11-15T18-42-00-568Z-e3949592/：本輪主要動畫逐幀紀錄、失敗視窗與 summary；資料夾使用 UTC 時間，對應台灣 2026-11-16。
- test-results/regression-state.json：沿用／失敗／延後清單及依賴指紋。

前端完成後只補驗受影響介面、尚未通過或依賴已改變的項目。三個編輯／儲存動畫前置契約本輪略過；不將這輪標成完整 regression 或 release 通過，也不 merge main 或發布版本。
