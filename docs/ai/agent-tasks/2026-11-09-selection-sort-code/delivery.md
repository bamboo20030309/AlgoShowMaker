# 選擇排序程式碼與 Trace 更新

## 更新內容

將使用者提供的完整 C++／繪圖指令／@asm-view 設定套入選擇排序投影片的一般、最壞兩個動畫，保留各自測資及投影片其他內容。min_idx 使用獨立 @pointer 與 color AV_red；保留手動退場、keep、程式碼面板位置及事件開關。

執行 `prebuild:guest-decks -- --only selection-sort --rerun`，重新產生兩份各 65 幀的 Trace，核對來源、輸入、引擎指紋、內容雜湊及來源座標後切換不可變 archive 與引用。投影片檔僅保存 Trace ID，不內嵌完整 Trace；舊已發布資源保留，未發布的中間產物已清理。

## 驗證

- 兩份動畫程式碼與使用者版本一致；最終 arr 皆為 `[1,2,3,4,6,7,8,9,10,12]`。
- 獨立服務／隔離 Edge 載入實際新 Trace：min_idx 背景為 AV_red 的 `rgba(239,154,154,0.6)`，外框及箭頭為 #333；讀取強調保持關閉。
- `guest-gallery-assets.test.js` 的公開資源完整性案例通過，核對 archive、Trace ID、來源及輸入一致性。
- 未執行完整 V3，不修改初始化動畫規則，也未改寫舊式原生 AV 教材 `algorithm_sample/Sorting/selection_sort.cpp`。

提交推送 intergration，重啟及核對 3100；main 與 Release 不變。
