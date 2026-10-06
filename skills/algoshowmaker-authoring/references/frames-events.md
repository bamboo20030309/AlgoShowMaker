# 幀與事件設計

frame 是程式執行到指定位置時的狀態；事件是狀態演進中的比較、寫入、交換等動作。迴圈每次執行同一 `@frame` 都能產生一幀。不要只在演算法結束後建立幀，卻期待觀眾看懂所有中間推理。

## 分鏡表

| 階段 | 程式位置 | 畫面 | 說明重點 |
| --- | --- | --- | --- |
| 初始 | 變數初始化後 | 陣列及初值 | 變數代表什麼 |
| 判斷 | 比較附近 | 比較位置及有效範圍 | 下一分支為何成立 |
| 更新 | 賦值完成後 | 新舊值關係 | 更新維持什麼不變量 |
| 完成 | 結果形成後 | 最終資料與答案 | 如何核對正確性 |

附屬文字依捕捉狀態求值。要同時展示更新前後，建立兩個幀或保留快照，避免把更新後變數值描述成更新前值。一幀包含太多事件時，優先拆分有意義的狀態。

## 事件動畫控制

```cpp
// @frame a[i],pre[i]
// @events compare,read animate off
// @events write animate on
```

```cpp
// @frame a[i]
// @events compare,read animate off when i > 7
```

可用名稱包括 `declare`、`scope-exit`、`visual-exit`、`read`、`write`、`assign`、`sequence-operation`、`compare`、`swap`、`fixed`、`call`、`function-enter`、`function-exit`。不要發明 `condition` 等事件開關。

- `@events` 控制本幀呈現，`when` 使用該幀捕捉狀態，不是逐事件的當下狀態。
- 關閉動畫不刪除 trace，也不改變演算法答案；版面／鏡頭轉場與使用者樣式仍可能播放。
- `@events animate off` 不會一併關閉 fixed；需要時明寫 `@events fixed animate off`。
- 規則依 defaults、使用的 presets、幀本身套用；同類型最後符合的規則優先。
- 原始碼規則會覆寫 Studio 相應手動設定，修改後要重新分析。沒有 `@events` 時沿用手動設定。

## 驗證

使用小輸入核對答案和關鍵分支，特別檢查第一幀、最後一幀、索引邊界、失配／回溯與重複幀。核對畫面的值、標記和文字是否指向同一執行時刻。只做過靜態檢查時，不宣稱事件播放、過渡動畫或效能已通過測試。
