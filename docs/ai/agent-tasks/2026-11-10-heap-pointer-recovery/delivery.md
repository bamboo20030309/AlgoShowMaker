# 暫時失去格子的指標保留

## 問題

Heap 第 40→41 幀的 heapSize 在 pop_back 後暫時指向不存在的第 10 格，接著 heapSize-- 應移到第 9 格。目的幀沒有 authored binding，舊流程把它當離場副本：雖等到遞減才移動，仍使用舊幾何校正而未落到第 9 格，最後退場。

## 修正

共用 pointer model 從前一幀綁定及按 order 排序的 runtime 事件推導「刪除後暫時越界、稍後同幀回到有效格子」的綁定。renderer 用這份暫時綁定建立正常指標，繼續使用同一套事件位移、避讓與幾何；不另外重播入場或建立第二套移動路徑。

保留至該幀結束；之後各幀仍按自己的綁定與事件處理。明確 retarget、declare／scope-exit／visual-exit、不同來源生命週期／目標身分、缺少後續有效移動與最後仍越界都不補綁定。明確關閉的動畫仍提交資料狀態，不擅自打開。推導不修改 frame.bindings、投影片或 Trace 格式／生成指紋，穩定跳幀及序列化重開可重建。

## 驗證

- `pointer-recovery.test.js`：順序、顏色保留、唯讀資料、沒有有效恢復、早於刪除的移動、越界、明確退場／重新宣告／retarget、來源或目標身分變更、關閉動畫與常數指標。
- `pointer-model.test.js`：既有 canonical 狀態、六種差異與群組避讓。
- `heap-pop-initializer.browser.test.js`：公開儲存的 Heap 第 40→41 幀，1／4 倍速逐格採樣 SVG；heapSize 始終不淡出，含連續移動中間點，終點與 heap[9] 的中心 x 誤差小於 1；重開後穩定跳第 41 幀仍可見，原始 bindings 維持空陣列。保留既有 pop／初始化與取消檢查。
- 定向核對 `pointer-exit-arrow.browser.test.js` 的 Heap 真正退場案例，避免把正常退出一起保留。
- 新編譯 normal 陣列的 pop_back／i-- 案例驗證保留與顏色，並序列化重開後跳回恢復幀。最初 fixture 將恢復幀放在 main 結尾，實際還包含 scope-exit，依規則不能保留；已把觀察幀與最後函式離場幀分開，不更動產品的生命週期排除規則。

上述 14 個測試案例通過（11 個模型單元、2 個 Heap 瀏覽器案例、1 個新建 normal 瀏覽器案例），語法及差異檢查通過。V2 定向驗證，不跑完整 V3。前端版本一併更新，完成後提交推送 intergration 並重啟核對 3100。main／3000、Release 不變。
