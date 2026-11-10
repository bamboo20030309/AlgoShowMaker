# Heap 刪除前可見性與指標初始化

## 問題與修正

- 公開 Heap 教材第 40→41 幀：目的 SVG 已少了 heap[10]，但舊格子副本在 pop_back 動作開始時才建立。新增暫時保留副本，前置事件與程式提示期間保持可見，到刪除視覺開始交給既有退場動畫；結束與取消都清理。
- 第 42 幀：教材明確保存 `assign:heap_pop:largest = now: false`，所以不播放這個賦值。原本宣告回放仍因它存在而先建立空值，讓指標入場時無法綁到初始目標。現在明確關閉的初始化不再延後宣告初值；largest 直接在 now=1 處入場，後續 largest=left 才移到 2。保留既有 false 設定。

不修改 Trace 格式、教材內容或生成指紋；既有 Trace 載入新版播放器即可生效。同步獨立動畫頁、投影片 runtime／編輯器的快取版本。

## 驗證

- 新增 `heap-pop-initializer.browser.test.js`：實際載入並序列化重開公開 Heap Trace，1／4 倍速核對第 40→42 幀的 SVG。固定答案是刪除前尾值 100 仍存在、刪除後不存在，largest 首次出現在根節點旁、最後到左子節點；關閉的初始化不播放。另查中途取消後沒有保留副本。
- `initializer-visibility.browser.test.js`：新編譯與舊資料重開、一般初始化及指標位移通過。
- `sequence-outerframe-phases.browser.test.js`：曾因事件提示在 microtask 後才公布時鐘，採樣把零時刻與提示後的時間混用而失敗；改為先在零時間完成宣告同步，再採原本固定 300／220ms 與尺寸答案，沒有放寬容許值。

只執行相關 V2 小驗證，不執行完整 V3。測試產物與服務 log 不提交。完成後推送 intergration 並核對 3100；main／3000 與 Release 不變。
