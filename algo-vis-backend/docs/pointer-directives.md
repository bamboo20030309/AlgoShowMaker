# 獨立指標

舊寫法保持不變：`// @frame num[i,j]`。

新寫法將物件與指標分開，套用於前一條 `@frame`：

```cpp
// @frame num
// @pointer i at num
// @pointer j at num
```

已 keep 的遞迴子樹也可作為目標：

```cpp
// @frame merged in merge_tree
// @pointer i at merge_tree.children[0]
// @pointer j at merge_tree.children[1]
```

`children[0]`、`children[1]` 是目前遞迴呼叫的第一、第二個直接子節點，不是整棵樹的第零、一個葉節點。
選擇指定 layout 中該子節點最新的可見 keep 物件。省略位置時，直接使用指標變數值作為目標陣列的原始索引。

```cpp
// @frame num with range(L,R) in split_tree
// @keep last as "split" in split_tree
```

`range(L,R)` 仍只裁切實際陣列，不重新編號。畫面保留原始索引，keep 也保存該切片的資料、range、值與樣式。
合併完成寫回 num 後，使用 `@frame num with range(L,R) in merge_tree` 保存结果，下一層就能直接將 i/j 綁定到左右子節點。
範例不再建立只供繪圖的 part vector；合併過程仍以 merged 暫存結果。

既有明寫位置的語法維持原意，例如 `@pointer i at tree.children[0][i-L]` 或 `@pointer i at num[i]`，直接使用該運算式計算目標索引，不會額外扣除 range 起點。
如果目標是獨立的 part vector，其索引仍從 0 開始，不會猜測它與 num 的對應。

指標名稱取自 C++ 變數，沿用現有指標外觀、生命週期及移動排程。索引越界、目標不存在或目標被隱藏時不畫指標。
指令也可放在 preset；只影響當前幀，不會凍結到 keep 裡。keep 的值與樣式不會被指標修改。
目前新版支援一維陣列格子及上述遞迴 children 格子；二維指標仍可使用既有 `@frame grid[i][j]` 寫法。
舊 trace 不需要資料遷移，新 binding 的額外欄位會隨 trace 序列化保留。

Pointer 名稱框預設為不透明的 `#bfe8f7`（fill-opacity 1），水平及垂直指標一致。
明確儲存的自訂填色（包含 rgba 半透明或完全透明）仍保留；進退場動畫的群組淡入淡出不變。
2026-10-05 V2 局部驗證：pointer-opacity.browser（新／舊指標、二維兩軸、缺少 implicitIndex 的舊 binding、自訂 alpha 0.25／0、關閉 autoFixedEnabled、儲存重開）及 entrypoints 共 2 案例通過。
隔離工作樹 31992／headless Edge，未操作使用者頁面；JS 語法與 diff whitespace 通過，無 browser pageerror。未執行完整動畫／投影片驗證。
