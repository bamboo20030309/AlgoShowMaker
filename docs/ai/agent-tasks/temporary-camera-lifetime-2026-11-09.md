# 鏡頭後偏移改為頁面暫時狀態

依使用者最新指示，移除「鏡頭偏移 110% · 重設」按鈕與其提示模組。

- 所有介面的後偏移只存在目前文件記憶體；同一次開啟期間仍按介面／動畫／Studio 分開保存。
- 重新整理或重新開啟頁面時丟棄偏移，不寫入 sessionStorage、投影片或雲端。
- 清除舊版 asm:temporary-camera:v1: 儲存項目，保留其他瀏覽器設定；不再從舊投影片 presentationCamera 欄位還原後偏移。正式 cameraRules 等設定不變。
- 原有重置視角功能仍可重置目前介面，沒有新增提示按鈕。

驗證：local-camera.test.js 的記憶體隔離／重新載入／舊快取清理與投影片投影兩案；trace-entry-recovery.browser.test.js 的 110% 偏移重整後第 21 幀恢復上下留白、無提示按鈕；tab-camera-syntax-tree.browser.test.js 的分頁切換與實際滾輪縮放重整。依相關局部範圍執行，不跑大型動畫驗證。
