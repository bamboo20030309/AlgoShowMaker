# Linear keep 歷史資料與樣式修正

## 原因與實作

- 原 renderer 只比較函式 activation，倍增範例所有 keep 與當前幀都在同一次 mergesort 呼叫，歷史資料及樣式被誤當成 live recursion 節點更新。
- 最後一幀已沒有 width，歷史快照的 @for step width*2 卻用當前狀態重算，拋出安全整數錯誤，排版中斷而留下重疊物件。
- 現在僅 recursion layout、非空且相同 activation 的最新對應節點能更新。Linear／無 layout 快照一律沿用捕捉的資料、renderer options及樣式狀態。
- 未新增持久化欄位或 Merge Sort 專用特例；保留原本樣式及指令語意。
- 前端 renderer 與入口版本同步 trace-264。

## 驗證分級與結果

- V2，分類E/G/H/J，僅相關 keep/樣式/layout 局部檢查。
- 獨立31992服務、headless Edge，不操作使用者分頁。
- 使用輸入 `10 / 5 7 2 1 9 3 6 8 10 4`；倍增樣本加入六處 camera focus num 與字級16。
- `node --test tests/linear-keep-frozen.browser.test.js tests/merge-focus-layout.browser.test.js tests/entrypoints.test.js`：3 passed，0 failed，0 skipped。
- 原始keep值保持輸入順序及白底，四輪keep分别保持width=1/2/4/8藍黃分段與捕捉的排序值。
- 最後幀五個keep加當前num均存在，六列相距自身高度+70；1x/4x手動與autoplay皆驗證終點。旁白等待不屬本案，測試將texts清空，未驗證TTS。
- 新建、JSON保存重載、刪除快照activation欄位的舊資料皆通過；快照模型無變異，明確autoFixedEnabled=false未被改寫。
- 遞迴focus案例、正常畫面/Studio/縮圖與第13→15幀座標回歸仍通過；瀏覽器無pageerror。
- node --check與git diff --check通過；未跑完整regression、大規模排序或投影片asmdeck匯出重匯入。
- 更新自己的3102並關閉31992測試服务，不修改3000/3100/其他代理服務；未推送或合併main。

## 後續：keep 增量重用完整性

- 使用同一 registerObjectSnapshot 登錄新建與重用節點的 placements、elements、子節點及 keepNodes，避免早退漏掉箭頭。
- 比較模型、名稱、skin、快照樣式狀態與当幀 Studio 樣式／visibility／positions／bindings；改變時重建外觀，仍保留原語意 object/arrow ID。
- 快取僅存放在 DOM 私有欄位，不增加已儲存 trace 的必填欄位。缺少快取時正常重建。
- 使用繪製時的局部 contentBox/box/height 做幾何登錄，不把動畫後的 DOM 邊界當作新模型幾何。
- unchanged、顏色移除、名稱修改、gridlines(0)、子格隱藏移除、子格位置移除六種情境的連續播放與穩定跳幀結果相同。
- 直接跳幀／連續播放皆保留5條 keep 箭頭，端點座標與語意 ID 相同；unchanged 實際走到 DOM 重用分支，不是停用重用來通過。
- 同一局部命令現在共4個案例：4 passed，0 failed，0 skipped；1x/4x手動與autoplay、新建/重開/legacy快照仍通過，遞迴鏡頭/Studio/縮圖回歸通過，無pageerror。
- 最終 renderer/入口版本 trace-265；未執行完整 regression、TTS 或大型快照效能測試。
