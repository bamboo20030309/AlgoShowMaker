# 還原 Heap 長度遞減

依使用者針對前次長度更新寫法的回覆，把 heap.pop_back() 後的 heapSize = heap.size() - 1 改回 heapSize--。只還原這一行，其他附件內容、程式碼片段的新圖示、輸入與既有事件設定保留。同步教材第一份完整操作動畫與 algorithm_sample/Tree/heap.cpp。

隔離服務核對4元素及既有10元素輸入，輸出均為由大到小的正確序列。Heap 教材3份 Trace 重新產生並核對引用雜湊、版本與來源座標，108／36／34幀；第一份最後只剩 heap[0]。未修改其他兩份程式碼及三份輸入。

定向執行 heap-pop-initializer.browser.test.js 的 saved Heap 案例，核對還原遞減後的格子退場、heapSize 保留及移入第9格、無目標時向下箭頭、初始化與重開。測試結果與暫存產物不提交，不執行完整V3。

完成後推送 intergration，重啟核對3100。main／3000與Release不變。前次交付文件保留為歷史紀錄，本紀錄覆蓋該次的長度更新選擇。
