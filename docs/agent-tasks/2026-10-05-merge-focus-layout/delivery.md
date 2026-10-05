# Merge Sort focus 排版累積修正

## 原因與修正

- 輸入 `10 / 5 7 2 1 9 3 6 8 10 4`，合併幀加入 `@camera focus merged offset(0,-40)`。
- 連續向前播放重用 `keep last` 整幀 SVG；內部場景已套用 layout/binding 位移，外層重新量測排版時再次納入舊位移。
- 第13→14幀 merge 葉節點 y=1050 變為1814，合併節點 y=1202 變為1966。穩定跳幀不累加，auto 鏡頭也可重現；focus 不是語法錯誤。
- 整幀快照從凍結模型重建內部場景，保留 snapshot key/動畫身分。單物件快照仍使用增量重用；沒有加入 Merge Sort/focus 專用座標特例。
- renderer與入口快取版本同步為 trace-263。

## 驗證分級與結果

- V2，分類 E/G/J；隔離31992服務與 headless Edge，不操作使用者分頁。
- `node --test tests/merge-focus-layout.browser.test.js tests/sequence-layout-timing.browser.test.js tests/entrypoints.test.js`：3 passed，0 failed，0 skipped。
- 比較有／無 focus 的前15幀世界座標；採樣13→14與14→15動畫，1x/4x手動／autoplay終點與穩定跳幀一致，既有節點動畫期間不偏移。
- Studio及縮圖第15幀座標與正常畫面一致；瀏覽器無 pageerror。
- 原有30→31幀 push_back 延後排版時序專項仍通過。
- compile helper核對每幀事件order皆為數值且按執行順序排序。
- renderer、新測試語法及 git diff --check通過；未執行完整regression或廣泛排序整合。
- 3102重啟後PID11772；HTTP200，入口trace-263與renderer內容完全符合本worktree。31992測試服务已關閉，3000/3100/其他代理未動。

## 相容性

- 未改儲存格式或新增必填欄位，既有整幀快照亦使用同一重建路徑。
- focus/offset及既有事件明確關閉設定未改寫；未修改範例或使用者投影片。
- 未驗證投影片匯出重匯入；修正僅涉及非持久化 SVG 增量重用。
