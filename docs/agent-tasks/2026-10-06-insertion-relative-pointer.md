# 插入排序第 11 幀 j+1 指標修正

使用者測資：`10`，陣列 `1 8 7 2 6 5 3 9 10 12`。使用者提供的程式與正式插入排序教材的第一個動畫程式一致，包含 `@frame arr[j,j+1],key` 與自訂 Studio 設定。

## 原因與修正

第 10→11 幀中，j 從 2 減為 1。動畫將事件數值轉成顯示字串，再代入指標算式，使 `j+1` 被求成 `"1" + 1 = "11"`。動畫後的 binding 指向 arr#11；靜態重畫使用數值，則正確指向 arr#2。

在 trace-frame-tween 的指標求值路徑保留原始 scalar 型別；舊快照中的非空數值字串轉回 Number。缺少值仍維持 unresolved，非數值字串不強制轉數字。套用於一般指標賦值、比較事件的 checkpoint 以及退場前移動，不改動文字插值的字串運算。

前端 tween build／script query 更新為 trace-296，3100 整合服務重啟並核對 HTTP 與來源一致。main 與其他代理服務未操作。本輪修改尚未提交或推送。

## 驗證

- 新增 `tests/insertion-relative-index.browser.test.js`：新編譯 Trace、舊正式教材預建 Trace，分別在 1x 與 4x 測試第 10→11 幀、倒退、JSON 保存重開及實際動畫取樣。j+1 正確指向第 2 格，移動不超出相鄰格。
- 位置驗證以實際 SVG 的 screen CTM 轉回同一畫布座標。初次 1x 檢查使用不同時刻的螢幕座標，受到約 2px 相機 easing 影響；改為畫布座標後通過，沒有放寬 1px 容許值。
- pointer-model.test.js：8 個子案例通過。
- pointer-model.browser.test.js 與 pointer-children.browser.test.js：5 個子案例通過，涵蓋未知指標、進退場、同格避讓、遞迴子 layout 與舊 Trace 重開。
- 新增瀏覽器回歸：1 個子案例、4 種新舊 Trace／速度組合通過。以上合計 14 個子案例通過。
- 修正後再重載 15 套正式教材的全部 36 個動畫，36／36 通過，沒有編譯請求或 pageerror。報告仍為 `algo-vis-backend/test-results/guest-animations-reload.json`。
- JS 語法與 git diff --check 通過。

這是 V2 局部驗收，沒有重跑完整 V3，也沒有把先前 release 阻擋標為已解。完整 V3 的通過證據須依新的前端內容指紋續跑核實。
