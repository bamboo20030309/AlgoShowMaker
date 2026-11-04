# 目前排程搭配原始比較視覺

## 需求與實作

使用者最新指示：先使用目前事件排程，恢復原本比較動畫。以已討論的改版前 504d51c 為基準，恢復 compareContactTargets、createComparisonExpression、createSelfCompareSplit、createCompareEffect、createTruthyCompareEffect 的視覺實作，保留不影響畫面的條件結果除錯屬性。

- 大小比較：兩格共同上抬 15px，原欄位放大較大值、縮小較小值，指標跟隨格子，標籤不縮放。
- 相等／不等比較：先對齊 150ms，再靠近 150ms；不相等時恢復左右各 -5／+5px 的錯開。自我比較沿用原版兩份暫時呈現與共同上抬。
- 保留原始運算符，假條件在符號上畫斜線，不附加 true／false。二元比較第 580ms 起隨動作漸顯結果，880ms 完全顯示；單值條件框恢復進場時機。
- 比較總時長維持 1560ms。目前事件身分、排程、狀態提交、讀取設定、事件間隔、倍速、暫停續播、指令與儲存行為不退回舊版。一般賦值與陣列階段沒有修改。

## 驗證

V2 局部驗證，獨立服務與瀏覽器，不操作使用者分頁，未跑完整 regression。

- restored-comparison.browser.test.js：<、!=、==、同格比較，新 Trace／保存重開且缺 semantics 的舊 Trace，1 倍／2 倍共 16 組實際 SVG。固定核對 15px 共同上抬、1.14／0.86 縮放、730ms 對齊後才靠近、5px 錯開、自我比較複本位置、579／580／581／880ms 的結果淡入與假條件斜線、自訂色、復原與清理。另以實際播放按鈕核對 1 倍／2 倍自動播放順序，並核對明確關閉的舊比較經保存重開仍關閉。通過。
- 固定案例 E15、E16、E16_EQUAL、P09：資料與 SVG 通過。手寫答案按使用者新決定更新，不由畫面結果反推或放寬時間／像素斷言。
- E17、E19：1 倍／2 倍固定時鐘，選值後賦值仍在 2220ms 抵達提交，暫存複本清理通過。
- truthy-compare.integration.test.js：單值條件及線篩兩項通過。
- event-motion-policy.test.js：3 項通過，確認事件作用時間與一般賦值規格維持。
- 修改 JavaScript 語法與 git diff --check 通過；更新頁面與內嵌 runtime 快取版本。

## 交付

推送 intergration，核對來源後只重啟 3100，驗證 HTTP、腳本雜湊與作用時間。main／3000 不動，不發布 release，不提交測試產物或 log。
