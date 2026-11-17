# 程式碼片段圖示與 Heap 範例更新

## 修改

- 「專注檢視」改為透明底放大鏡按鈕，提示與無障礙名稱為「放大」；展開後顯示減號放大鏡、名稱「縮小」，Escape 與原本展開邏輯保留。
- 「恢復自動篩選」改為圓形箭頭圖示，保留提示、無障礙名稱、恢復、undo／redo 與停用狀態。
- Heap 教材第一份、含 heap_push／heap_top／heap_pop 的完整操作動畫改用使用者附件，另同步 algorithm_sample/Tree/heap.cpp。其餘兩份的程式碼、三份輸入與既有事件自訂值保留；鏡頭使用新附件的預設 focus heap zoom(1.2)。

## 附件的長度問題

使用者移除了 heapSize--，認為 heapSize 不必遞減。實際 C++ 的 int heapSize 是舊長度的複本，不會隨 pop_back 更新。原附件實測輸入 4／1 2 3 4，輸出 4 3 4 4；原10元素測資也重複輸出已刪除的 100。已向使用者說明實測結果，保留不用 -- 的寫法，改為 pop_back 後重新取得 heapSize = heap.size() - 1，避免後續下沉讀取已刪除的格子。

## 驗證與出版資料

- 兩組 native 執行的固定答案為輸入值由大到小輸出，皆通過。
- 隔離服務 staged rebuild Heap 教材，3份 Trace 分別為108／36／34幀。重建過程核對生成版本、內容雜湊與來源座標，成功才切換公開清單。第一份末幀 heap 僅餘不使用的 heap[0]；其餘兩份程式碼及所有輸入核對不變。
- trace-code-snippet.browser.test.js：新圖示、透明底、放大／縮小／Escape、自動篩選恢復、行選取與 undo／redo 通過。
- heap-pop-initializer.browser.test.js 的 saved Heap 案例：更新後 Trace 在1／4倍速、pop_back→重新取得長度、指標不退場且垂直箭頭、初始化、重開及取消檢查通過。
- prebuild --verify-only：36份公開動畫的引用／雜湊／版本／來源座標通過。此為靜態核對，不是重跑所有演算法；初次因受限網路無法讀本機生成版本而中止，允許本機讀取後核對成功。
- JavaScript 語法與差異檢查通過。沒有執行完整 V3。

新的不可變 archive 為 heap-teaching-014695b477c84dc1caf97044a06f80ebf5a8aff657f98774fe1b0836e3c04a0c.asmdeck；舊 archive 與 Trace 保留以支援既有引用。未將測試結果、暫存重建目錄或 log 加入提交。

提交推送 intergration，重啟並核對3100。main／3000、Release 與公開部署不變。
