# draw 視覺化指令
首先一定要引入標頭檔 `#include "AV.hpp"` 並宣告 `AV av;` 這個演算法視覺化物件。

## 腳本控制

### 腳本起始
在撰寫一個新腳本時要先呼叫 `av.start_draw();` 告訴物件從這裡開始，放的位置只要提前所有繪圖指令就好。
撰寫完腳本後則要呼叫 `av.end_draw();` 告訴物件到此為止，放的位置也是比所有繪圖指令晚就好。

### 

## 演算法追蹤文字

可以把說明文字放在 `@frame` 附近，文字會隨著該幀一起保存。最簡單的寫法是：

```cpp
// @frame arr,i
// @text "這是第 ${i} 個元素" at arr.bottom
```

`${i}` 會在每一幀用當下的變數值取代。`at` 後面是定位目標與九宮格位置，支援
`top-left`、`top`、`top-right`、`left`、`center`、`right`、`bottom-left`、
`bottom`、`bottom-right`；也可以定位到特定格子：

```cpp
// @text "目前檢查 ${arr[i]}" at arr[i].top
```

若需要讓物件在 Trace Studio 中有固定名稱，可以加上 `as`；需要微調位置則加上
`offset(x, y)`：

```cpp
// @text "比較中" at arr[j].top offset(0, -8) as compare-note
```

`@text` 的定位是語意定位，不是把座標寫死。當索引超出陣列範圍或目標尚未出現在
該幀時，文字會在動畫中隱藏；目標恢復有效後會自動回到對應位置。文字中的
`${...}` 只會捕捉該運算式需要的變數，不必再把變數重複寫進 `@frame`。

## 演算法追蹤樣式

`@style` 會套用到寫在它上方的 `@frame`。例如將 `[0, i)` 內比 `key` 大的格子塗紅、
比 `key` 小的格子塗綠：

```cpp
// @frame arr[j,j+1],key
// @style arr[0:i) background AV_red when value > key
// @style arr[0:i) background AV_green when value < key
```

`value` 是目前格子的值，`index` 是目前格子的索引。目標可寫成整個物件 `arr`、
單格 `arr[i]`、左閉右開範圍 `arr[0:i)`，或包含右端點的範圍 `arr[0:i]`。
樣式支援 `highlight`、`focus`、`mark`、`point`、`background`；顏色可使用
`AV_red` 等既有顏色、CSS 色碼或 `rgba(...)`。需要命名規則時可以再加 `as rule-name`。

## 繪製資料結構
核心函數 `av.draw` 支援多載，可根據傳入的參數繪製不同類型的資料結構。
1. 一維陣列 (array)
最簡單的
一維陣列總共有4種模式，分別為 `normal` , `heap` , `segment_tree` , `BIT`。
