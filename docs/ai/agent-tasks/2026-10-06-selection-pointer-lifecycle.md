# 選擇排序指標與完成幀退場修正

## 任務與規格

- 使用者程式包含 `@frame arr[i,min_idx]`、`@frame arr[min_idx,i]`、`@exit min_idx,i` 與 `@keep last`。
- 輸入：`10`；陣列：`1 8 7 4 2 6 3 9 10 12`。
- 使用者最新指定：同格指標依 `arr[...]` 中書寫順序排列，不改為全域固定順序。
- 工作分支：`intergration`；不合併 main、不發布 release。

## 原因及修正

1. captureOnly 隱藏獨立數字時，忽略該變數仍由索引指標顯示，錯誤合成 min_idx 的 visual-exit。同一生命週期、同一目標且前後皆有指標 binding 時不合成此退場。
2. markerLifetimeActiveAtEvent 將 visual-exit 當成 C++ 生命週期結束，阻擋同一 lifetime 後面的 i++。只有 scope-exit 結束變數 lifetime。
3. canonical ENTER 必須清除可能繼承的父物件 continuing 狀態，讓新 loop-local 指標由自己的宣告控制入場。
4. 最後 authored capture 後的自然 scope cleanup 不再預設清空完成畫面；事件 metadata 保留。既有明確的全域、指令、幀及來源開關仍優先。
5. 正規化保留 captureOrder；舊 Trace 缺少 afterCapture 時，由最後 manual frame 與 cleanup 的來源行判斷，無需重新編譯。

前端快取：tween trace-297、events trace-64、model trace-41。

## 驗證與獨立答案

- `selection-pointer-lifecycle.browser.test.js`：新 Trace 1x／4x、缺少 captureOrder 與 afterCapture 的舊 Trace 4x；第 2→3、11→12、12→13、13→14、最後一幀；前進、倒退、重播、JSON 儲存重開。
- 固定答案：第二輪 i=1、min_idx 初值=1；前一輪為 0；同格順序依指令書寫；最終 arr 可見。
- 指標位置、實際文字所在容器的有效透明度、label 矩形取自瀏覽器實際 SVG，不由播放計畫提供答案。
- 重疊僅檢查事件完成及幀定點；不檢查動畫交叉。像素容許值未放寬。
- 診斷期間發現外層 marker 座標存在但內層 motion wrapper 透明，改以文字實際可見性排除透明節點。暫時的產品診斷欄位已刪除。
- `selection-lifecycle.test.js`：視覺退場後的 i++、真正 scope-exit、舊清理事件、明確開啟／關閉設定與手動退場。
- 相鄰覆蓋：插入排序 relative-index、pointer-model browser、trace-boundary-events、visual-lifecycle-events。

局部驗證通過不等同完整 V3 通過；本輪不重跑完整驗證集。測試紀錄、Trace 及診斷檔放在被忽略的 test-results，不提交。

## 本輪結果

- 最後相關局部測試共 11 個具名案例通過（7 個指標／生命週期案例、4 個邊界／可見性案例）；選擇排序案例內含三種新舊 Trace／速度組合。
- 補驗實際 label 與 arr rect 的有效透明度、事件完成定點、倒退、重播後，選擇排序專項再次通過。
- JavaScript 語法及 git diff --check 通過。
- 3100 重啟成功，PID 50912，MongoDB 連線成功；algorithm.html 與 tween 腳本確認為整合 worktree 的 trace-297／trace-64／trace-41。
- 本次不提交、不推送，不合併 main，不發布。完整 V3 的舊失敗清單尚未重新核實。

> 語法遷移註記（引擎 14）：以上為當時的錯誤重現紀錄，保留原始寫法供追溯。現行教材已改成完整 `@frame arr` 加各自的 `@pointer`；`arr[i,j]` 舊多指標語法不再接受，單索引 `arr[i]` 現在代表只呈現該元素。詳見 `docs/indexed-value-migration.md`。
