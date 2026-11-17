# 引用容器跨呼叫不重播入場

## 重現與根因

使用者指定堆積排序第 4→5 幀整棵 arr 重新入場。公開教材將 `declare:heapify:arr` 設為 false，因此原設定不會淡入；在隔離副本啟用該宣告，立即重現整棵容器有效透明度降至 0。前後 runtime 儲存身分相同，型別為 vector<int>&，但 heap_sort／heapify 的參數宣告 lifetime 不同。

轉場本身已能依 runtime identity 找到前一物件；漏接的是宣告生命週期。既有 recursiveRoleContinuations 只處理同函式祖先／子呼叫與角色延續，跨函式引用沒有加入 continuingKeys，宣告入場遮罩因此蓋過原本連續呈現。

## 修正與漏接核對

- 加入共用 referenceContainerContinuations，以同一 runtime 儲存身分、scene、作者別名及 layout 節點核對可見引用容器；涵蓋跨函式、返回原擁有者與遞迴。
- 容器與其格子／標籤接入既有 continuingKeys，所以宣告排程及巢狀遮罩都不再重播入場；自然引用 scope-exit 原已保留容器，核對後沿用原規則。
- 容器延續與指標角色延續使用不同 map。呼叫內部的新 i／largest 等指標仍按自己的 lifetime 判定，不因 arr 連續就視為舊指標。
- 不只比物件 ID／名稱。新儲存身分、值容器、隱藏前物件、明確視覺入退場、已結束的擁有者、keep／新 scene、不同作者別名及新 layout 節點都不套用引用交接。
- 未改 Trace 資料格式、生成依賴、賦值或交換路徑，不重跑所有公開 Trace。

## 驗證

獨立服務與隔離 Edge，不操作使用者分頁。

- `reference-container-continuity.test.js` 三項：跨呼叫／返回、身分與 scene 負例、明確退場／別名／新 layout 節點邊界。
- `heap-reference-continuity.browser.test.js` 一項：實際保存的 heap Trace，啟用參數宣告設定後，1／4 倍速取樣第 4→5、5→6、8→9 幀；同一 runtime identity 的 live arr 及值格全程存在，有效透明度保持 1。使用序列化重開的舊 Trace，不需要新增欄位。固定答案不是播放計畫產生的值。
- `recursion-declaration-clock.test.js` 三項與對應 browser 一項：新遞迴節點／連線仍依自己的宣告入場，包含舊 metadata 及明確關閉設定。
- 合計 8 項通過；分開容器與指標角色 map 後定向重驗 heap 瀏覽器案例亦通過。語法與差異檢查通過，未執行完整 V3／所有 render 的逐幀驗收。

提交推送 intergration、重啟並核對 3100。main／3000、Release 與公開部署不變。
