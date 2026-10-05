# 八皇后初始 P=0 的返回說明幀

- 保留使用者既有修改，只在 P 計算與候選 while 之間加入 `@frame ... when P == 0`，沿用 p_masks、queen_scene_view、union_view、p_board_view。畫面說明目前列沒有可放位置，因此返回上一列嘗試其他欄位。
- 不新增 C++ 分支或 return，不改演算法。新幀位於 while 前，因此只有一開始候選集合為空會觸發，不會在候選迴圈耗盡後再觸發。
- V2／E、J：`node --test tests/queens-dead-end-frame.browser.test.js` 1/1 通過、0 skip。獨立服務與 headless Edge，實際 RUN N=4、CodeScript.next 顯示文字並恢復前幀定點，無 pageerror。
- 4 個初始 P=0 activation 都各有一幀，與前一幀相同 activation、P=0；非死路沒有返回幀。仍輸出 Total Solutions: 2，仍有 17 個 keep snapshots。
- 測試 JS 語法與 git diff --check 通過，未執行完整 regression。未修改動畫引擎或持久化欄位，因此無資料遷移。此次只修改範例，不重新生成既有投影片檔。
- alpha 3101 核對為未監聽後，使用原專案被忽略 .env 的 MongoDB／JWT 設定啟動，PORT/BASE_URL 為 3101。未操作其他服務或使用者分頁，未 commit 或 push。
# 陣列解法追加返回說明（2026-10-05）

- 依使用者最新程式保留左斜→直線→右斜的更新順序及原有事件開關。
- 用 code hide 包住 has_move 宣告與設定，既有迴圈找到可放位置即標記；迴圈結束後 @frame when !has_move，無額外掃描。
- 文字原意不變；變數及錨點改用本例的 row、board.top。
- V2：`node --test tests/queens-array-dead-end.browser.test.js` 1/1 通過，0 fail/skip。random-port server/headless Edge，不操作使用者分頁。
- N=4：四個返回幀（row 2,3,3,2）、全部欄位均受 L/M/R 攻擊、同 activation 不重複，四幀文字實際可見。
- 隱藏旗標事件 0、keep snapshots 17、解數仍為 2；沒有增建遞迴節點。
- 無新增持久化 schema；原 presets、style、位置、事件明確關閉設定保留。
- 只重啟 alpha 3101，未改投影片／未提交或 push，未跑完整 regression。
