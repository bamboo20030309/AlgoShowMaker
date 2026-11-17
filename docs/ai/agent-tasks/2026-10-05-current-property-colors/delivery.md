# 一般選色按鈕顯示目前值

## 任務與結果

依使用者要求，text、文字背景、形狀填色／框線、table、structure tree 箭頭與外框背景等一般屬性按鈕顯示目前選取物件的顏色。切換物件立即同步；開啟一般選色器不套用上次顏色。只有格子 style 按鈕顯示各 style 上次選色，未選過時沿用預設。自訂顏色歷史仍可明確點選套用。

沒有新增儲存欄位或修改既有物件資料；保留原有自訂色、透明背景及明確關閉的設定。

## V1 驗證

- `node --check public/slides.js` 與相關 browser test：通過。
- `git diff --check`：通過，只有既有 CRLF 轉換提示。
- `node --test tests/slides-av-color-palette.browser.test.js`：通過。
- 隔離瀏覽器測試：舊紅／藍 text 切換、透明背景、形狀填色與框線、共用歷史更新不覆蓋目前按鈕、一般選色器開啟不改色、新 text 選色、table／tree、每個 style 的獨立記憶、自訂色歷史、實際儲存與 reload、console 無錯誤。
- 不執行演算法驗證集。

## 預覽

已停止本代理先前的 3100 session 並從 intergration/algo-vis-backend 重啟，main 與其他代理服務未操作。HTTP 核對 `slides-265`，下載的 slides.js 與整合 worktree 原檔完全一致。

一般屬性按鈕現在點擊開啟目前顏色的選色器；若要重用歷史色，明確點選下方自訂色方塊。
