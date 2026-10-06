# 核心繪圖語法

以下為 C++ 普通註解，不需要引入 `AV.hpp`。變數必須在註解執行位置有效；先完成資料更新再建立幀，該幀才會顯示更新後狀態。

```cpp
pre[i] = pre[i - 1] + a[i];
// @frame a[i],pre[i]
// @style a[i] highlight AV_red
// @style pre[i] highlight AV_green
// @text "pre[${i}] = pre[${i-1}] + a[${i}]" at pre.bottom
```

`a[i]` 選擇陣列並使用 i 作為索引標記，不表示只剩一格。需要顯示 i 的數值時另外加入 i。

## 物件、文字與位置

```cpp
// @frame a[i,j],key
// @text "比較位置 ${i} 和 ${j}" at a.bottom
// @style a[i] highlight AV_red
// @style a[0:i] focus AV_blue
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

repo 根目錄 `ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md`；parser 位於 `algo-vis-backend/trace-instrumenter.js`。本包未列出的選項，查手冊後才能使用；無法查證就交付核心語法版本。
