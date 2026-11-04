# 陣列外框與入退場階段

日期：2026-11-04。分支：intergration。

## 行為

- insert：前 300 ms 外框擴大、後方格子挪位同步完成；接著 180 ms 新格子及 index 入場，外框不再伸縮。
- push_back：同樣先擴框 300 ms，再入場 180 ms；不增加無關的既有格子挪位。
- erase、pop_back：前 180 ms 保持外框、格子與 index 退場；接著 300 ms 補位與縮框同步完成。
- resize、clear、整體 assign 保留原本各自的批次規則。
- 保留原本每列欄數政策，修正刪除後以剩餘格數重建舊外框，誤把單列換成多列的問題。此資料只寫在重新繪製的 SVG，不新增投影片持久化欄位。

## 驗證

- sequence-outerframe-phases.browser.test.js：4 種操作 × 1／2 倍速，共 8 組固定時鐘幾何檢查通過；外框尺寸取自實際 SVG，不以產品計畫生成答案。
- 固定事件案例 E24、E25、E26、E27、C08、C09 共 6 案通過；涵蓋插入、刪除、resize、clear、缺新欄位的舊資料、自訂設定與保存重開。
- 既有瀏覽器測試 4 項通過：push_back 整格複製、空陣列首次新增保留名稱、空陣列外框、完成提交後再移動指標。
- JavaScript 語法與 git diff --check 通過。

## 已存在的失敗

merge-push-lifecycle.browser.test.js 的 recursive merge push lifecycle 案例仍在教材第 10 幀失敗：預期保留來源整格飛入，但沒有觀察到複本。隔離瀏覽器攔截腳本，載入修改前 HEAD 的 tween 與 draw_array_normal，再跑同一案例，也在同一斷言失敗。這是既有失敗，未放寬答案，未在這次外框變更中宣稱修復。診斷證據保存在被忽略的 test-results/sequence-baseline.json；其餘測試產物同樣不提交。

## 範圍

目前新增的精確幾何測試針對 normal；不宣稱所有 render × 事件組合均已覆蓋。未合併 main、未發布 release。
