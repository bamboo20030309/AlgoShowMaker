# 展示動畫的本機編輯入口

- 基準 intergration 03ab256。使用者要求展示頁能修改程式碼、輸入、Run 與編輯動畫，但不寫回伺服器。
- runtime 標籤列下新增「本機編輯」。展開原有程式碼面板，提供 RUN、強制重編譯、編輯動畫與事件設定；Studio 使用既有「返回程式碼」退出。
- 本機編輯只影響展示 iframe，編譯仍需後端服務。沒有提供修改原投影片／伺服器儲存的按鈕。
- 以 IndexedDB asm-runtime-local-edits-v1 / animations 保存程式碼、輸入與已編輯的動畫快照，按原投影片 ID 與原來源／輸入指紋隔離。重開、iframe 被回收後再載入會還原本機版本；「還原原版」刪除這份本機覆寫。
- parent 的重複原動畫訊息不覆蓋正在編輯的本機內容；切換不同動畫前保存待處理文字修改。
- runtime 編譯結果不向父頁送出 asm-animation-compiled / asm-save-animation；本機覆寫存在時也不送出原投影片 camera 更新；runtime 的事件偏好不 PUT 到帳號 API。
- snapshot 尊重明確 traceDocument=null，載入無 Trace 的動畫也清除舊播放器，不透過 fallback 復活舊動畫。
- 儲存失敗會顯示本機狀態提示；不宣稱頁面記憶體內容已持久化。
- 沒有新增投影片持久化欄位，原有缺少新欄位的投影片直接可用；既有正式編輯器仍可按其原流程儲存投影片。

## 驗證

- runtime-local-editor.browser.test.js：1 pass / 0 fail。獨立伺服器、Edge context、真正 slides.html 與 runtime iframe。
- 舊結構投影片、沒有本機編輯欄位：載入、自訂 codePanelFontSize=19 與明確 autoFixedEnabled=false 保留；本機修改後重開保留字級21與false。
- 修改程式碼與输入23、Run 輸出24；能進入 Studio、返回程式碼、收起編輯，重整仍讀取本機code/input/Trace。
- 第二張投影片有相同原始碼，仍不繼承第一張的本機修改；回第一張能讀回本機版本。
- 還原原版後，再重整回原程式碼、輸入7、自訂字級19；實際 IndexedDB 原投影片資料未更動。
- 監看所有請求：除了編譯與唯讀的 /trace/analyze、/syntax-tree，沒有投影片、Trace 上傳或帳號偏好寫回。模擬已登入偏好讀取，仍不產生 PUT。
- algorithm-editor-history.browser.test.js：1 pass / 0 fail；既有正式動畫編輯器的 undo/redo、儲存與重開不受影響。
- entrypoints.test.js：1 pass / 0 fail；語法與差異檢查通過；pageerror為空。沒有大型動畫驗證。
- 畫面截圖於被忽略的 test-results/runtime-local-edit.png 與 runtime-local-studio.png，已目視核對。
- 初次失敗定位到編輯列固定 flex-basis 造成播放列遮擋，已修正；後續測試改用真正 Studio 返回按鈕，以及 IndexedDB 草稿讀取介面。沒有強制點擊或放寬結果。
- 僅推送 intergration，重啟3100；未合併 main／發布 release。
