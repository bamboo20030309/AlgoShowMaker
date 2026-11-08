# 核心繪圖語法

以下為 C++ 普通註解，不需要引入 `AV.hpp`。變數必須在註解執行位置有效；先完成資料更新再建立幀，該幀才會顯示更新後狀態。

```cpp
pre[i] = pre[i - 1] + a[i];
// @frame a,pre
// @pointer i at a
// @pointer i at pre
// @style a[i] highlight AV_red
// @style pre[i] highlight AV_green
// @text "pre[${i}] = pre[${i-1}] + a[${i}]" at pre.bottom
```

`@frame a[i]` 與 `@object a[i]` 只顯示該元素的值，不建立指標。要顯示整個陣列與游標，使用 `@frame a` 加上 `@pointer i at a`。`a[i,j]` 不再是多指標語法；每個指標獨立寫一條 `@pointer`。

## 物件、文字與位置

```cpp
// @frame a,key
// @pointer i at a
// @pointer j at a
// @text "比較位置 ${i} 和 ${j}" at a.bottom
// @style a[i] highlight AV_red
// @style a[0:i] focus
```

`[start:end]` 範圍含兩端。使用範圍前確認合法索引；陣列從 0 或 1 開始都須依實作說明。`${...}` 是畫面文字中的運算式插值。

```cpp
// @frame a
// @object pre with labels(value,index)
// @place a.left-bottom at pre.left-top offset(0,-70)
```

`@object` 要緊接 `@frame` 或其他 `@object`，中間不能插入 C++ 敘述。`@text`、`@style`、`@place`、`@segment`、`@arrow`、`@events` 等附屬指令歸屬原始碼上方最近的 `@frame`。需要新狀態就建立新 frame，不用同一段註解描述不同執行時刻。

## 重複版面

```cpp
// @preset sum_view
// @object a with labels(value,index)
// @object pre with labels(value,index)
// @place a.left-bottom at pre.left-top offset(0,-70)
// @endpreset

// @frame use sum_view
// @style pre[i] highlight AV_green
```

preset 定義版面，不建立播放幀；在變數存在的作用域用 `@frame use` 展開。全域共同附屬設定用 `@defaults`／`@enddefaults`；流程指令不要塞進 defaults。`as` 用來建立穩定視覺 ID，與程式變數名稱的意義不同。

## 保留與箭頭

```cpp
// @keep a as "original"
// @frame a
// @arrow from a[0] to a[1] as "next" color AV_green
```

`@keep` 保存當時的資料快照，持續留在後續畫布；它不等於 live 物件，也不自行建立時間線幀。`@keep last` 保存當時完整畫面。要清除、分組、遞迴排版或套用進階樣式，先查完整手冊。

批次箭頭目前使用方括號與冒號，不用舊 `start..end`：

```cpp
// @frame source,target
// @arrow for k in [0:n-1] step 2 from source[k].bottom to target[k].top as "links" color AV_green
```

畫面端點須存在，範圍與步長須有效。從簡單的單箭頭開始，確認語法與版面後才增加批次規則。

## 查證來源

repo 根目錄 `docs/reference/algorithm-visualization-directives.md`；parser 位於 `algo-vis-backend/trace-instrumenter.js`。本包未列出的選項，查手冊後才能使用；無法查證就交付核心語法版本。


## 共用索引與區段：`[l:r]`

繪圖指令以 `[:]` 表示**包含兩端**的資料區段，保留原始索引，不改動 C++ 變數內容。

| 寫法 | 意義 |
|---|---|
| `num[i]` | 單格取值，不建立指標 |
| `num[l:r]` | 索引 l～r，包含兩端 |
| `num[:r]` | 從索引 0 到 r |
| `num[l:]` | 從 l 到最後一格 |
| `num[:]` | 全部資料 |
| `grid[r1:r2][c1:c2]` | 矩陣的矩形區段；可混用單列／單欄與區間 |
| `char(s)[l:r]`、`s[l:r]` | 字串的字元區段，沿用 s 的名稱與索引 |

```cpp
// @frame num[1:n-1]
// @object char(s)[1:]
// @object dp[1:n][1:m]
// @pointer i at num[1:n-1]
// @style num[:] focus
// @style dp[1:n][1:m] highlight
// @text "這一段" at num[1:3].bottom
// @arrow from num[1:3].bottom to dp[1:2][1:2].top
// @place dp[1:2][1:2].top-left at num[1:3].bottom-left offset(0,80)
// @camera focus num[1:3]
// @keep num[1:3] as "part"
```

- `@frame`／`@object` 顯示指定區段；矩陣區段緊密排版，但事件、標籤、樣式與箭頭仍以原始索引定位。`@object` 依既有規則緊接在 `@frame`／另一個 `@object` 後面。
- `@arrow`、`@text at`、`@camera focus`、`@place` 將整段可見格子的聯集視為一個端點，取該區段的 top／bottom／center 等錨點，**不展開為多支箭頭**。若區段沒有可見格子，就沒有可用端點。
- `@place` 來源指定區段時，以該區段的錨點對齊，移動的仍是其所屬物件，不會拆開 C++ 陣列。
- `@pointer i at num[l:r]` 仍以 i 的原始索引定位；只在 i 位於 l～r 時顯示，不把 l 當成新的索引 0。
- `@keep num[l:r]` 保存指定區段的視圖；`@keep last` 仍保存上一幀。
- 區段超出資料邊界時，只顯示有效格子；l > r 為空區段，不會反向排序，也不建立不存在的格子。負索引不表示倒數。
- `with range(l,r)` 保留相容性；同一個物件不要同時使用它與 `[:]`，避免兩組範圍互相覆蓋。
- 這是繪圖的資料選取語法，不是 C++ expression。`when`、`@let` 等純量運算仍用 C++ 風格運算式；`@exit` 目前以整個物件退場，沒有另定部分格子退場語意。
