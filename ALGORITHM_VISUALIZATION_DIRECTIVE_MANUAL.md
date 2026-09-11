# AlgoShowMaker 演算法視覺化指令使用手冊

本手冊記錄 AlgoShowMaker「註解式追蹤語法」目前實際支援的功能。語法以
`trace-instrumenter.js`、瀏覽器追蹤模組及自動測試為準；新增或調整指令時，應同步更新本文件。

- 文件語言：繁體中文
- 適用介面：演算法編輯器、Trace Studio、演算法投影片編輯器與投影片播放介面
- 最後核對日期：2026/09/12

> 本手冊介紹 `// @frame` 這套追蹤語法。它和直接呼叫 `AV.hpp` 的傳統 `av.draw(...)`
> 繪圖 API 是兩套不同入口；使用追蹤語法時，不需要自行呼叫 `av.start_draw()`。

## 目錄

1. [五分鐘快速入門](#五分鐘快速入門)
2. [核心觀念](#核心觀念)
3. [語法支援總表](#語法支援總表)
4. [共用修飾詞](#共用修飾詞)
5. [`@frame`：建立動畫幀](#frame建立動畫幀)
6. [`@keep`：保留畫面狀態](#keep保留畫面狀態)
7. [`@exit`：提早讓物件退場](#exit提早讓物件退場)
8. [`@text`：加入說明文字](#text加入說明文字)
9. [`@style`：設定格子樣式](#style設定格子樣式)
10. [`@segment`：標示連續區間](#segment標示連續區間)
11. [`render` 與 `with`：選擇資料結構畫法](#render-與-with選擇資料結構畫法)
12. [`at` 與 `offset`：相對定位](#at-與-offset相對定位)
13. [`when`：條件與跨幀判斷](#when條件與跨幀判斷)
14. [完整使用案例](#完整使用案例)
15. [事件動畫與 Trace Studio](#事件動畫與-trace-studio)
16. [程式碼片段與條件著色](#程式碼片段與條件著色)
17. [常見錯誤與限制](#常見錯誤與限制)
18. [文件維護規則](#文件維護規則)

## 五分鐘快速入門

把 `@frame` 寫在想要擷取狀態的位置，按下 RUN 後，指令會依實際執行次數產生動畫幀。

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int &value : arr) cin >> value;

    // @frame arr
    // @text "開始排序" at arr.bottom

    for (int i = 0; i < n; i++) {
        // @frame arr[i]
        // @style arr[i] highlight AV_red
        // @text "正在查看第 ${i} 格" at arr.bottom
    }

    return 0;
}
```

輸入：

```text
5
4 2 5 1 3
```

這段程式會：

- 第一幀顯示完整陣列。
- 迴圈每執行一次，再產生一幀。
- `i` 不會被畫成獨立數值框，而會成為指向 `arr[i]` 的指標。
- `highlight` 會框出目前格子。
- `${i}` 會替換成該幀的實際數值。

## 核心觀念

### 指令就是執行點

`@frame` 不是描述某一行原始碼，而是在 C++ 執行到該註解所在位置時擷取狀態。

```cpp
arr[i] = key;
// @frame arr[i],key
```

這一幀會看到賦值完成後的陣列狀態，並包含從上一幀到這一幀之間發生的事件。
若要呈現賦值前狀態，必須在賦值前另外放一個 `@frame`。

### 附屬指令套用到前一個 `@frame`

`@text`、`@style`、`@segment` 會附加到原始碼中位於它們上方、距離最近的 `@frame`。
建議緊接著書寫，避免日後移動程式碼時造成誤解。

```cpp
// @frame arr[i],key
// @style arr[i] point AV_red
// @text "目前是第 ${i} 格" at arr.bottom
```

### 顯示變數與只捕捉變數

`@frame arr[i],key` 會顯示 `arr` 和 `key`。`i` 是計算指標位置所需的相依變數，
系統會捕捉它，但不會另外把它畫成一般數值框。

`when`、`${...}`、`range(...)` 及索引運算式引用到的變數也會自動捕捉，不必重複列在
`@frame` 後面。

### 幀內事件與幀狀態是不同時間尺度

畫布的靜態內容代表該幀擷取時的最終狀態；幀內的 compare、assign、swap 等事件則按照
實際執行 `order` 依序播放。若同一幀內變數經過多次移動，請用更多 `@frame` 分隔重要階段，
畫面通常會比把大量事件塞在同一幀更直覺。

## 語法支援總表

| 指令 | 用途 | `as` | `at` | `offset` | `when` | `render` | `with` | `without style` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@frame` | 擷取一個動畫幀 | 支援 | 支援 | 支援 | 支援 | 支援 | 支援 | 不支援 |
| `@keep` | 保留變數或上一幀 | 支援 | 支援 | 支援 | 支援目前值條件 | 不支援 | 不支援 | 支援 |
| `@exit` | 提早讓一或多個可見變數退場 | 不支援 | 不支援 | 不支援 | 不支援 | 不支援 | 不支援 | 不支援 |
| `@text` | 加入說明文字與 TTS | 支援 | 支援 | 支援 | 支援 | 不支援 | 不支援 | 不支援 |
| `@style` | 套用格子樣式 | 支援 | 不支援 | 不支援 | 支援 | 不支援 | 不支援 | 不支援 |
| `@segment` | 標示陣列區間 | 支援 | 不支援 | 不支援 | 支援 | 不支援 | 僅 `showWidth` | 不支援 |

建議的修飾詞排列方式是：

```text
主要內容 as ID render TYPE with OPTIONS at TARGET.ANCHOR offset(X,Y) when CONDITION
```

解析器允許多數修飾詞交換順序，但每一種修飾詞在同一條指令中只能出現一次。

## 共用修飾詞

| 修飾詞 | 作用 | 範例 |
| --- | --- | --- |
| `as` | 指定穩定物件 ID 或規則 ID | `as heap_view` |
| `at` | 將物件相對定位到變數、格子、keep、Studio 物件或畫布 | `at init.bottom` |
| `offset(x,y)` | 在 `at` 結果上增加像素位移 | `offset(0,40)` |
| `when` | 條件為真時才產生或顯示 | `when i < n && changed(arr[i])` |
| `render` | 選擇資料結構畫法 | `render heap` |
| `with` | 傳入 renderer 選項 | `with range(1,n), labels(value,index)` |
| `without style` | `@keep` 保留資料但不保存當下樣式 | `@keep arr as plain without style` |

### ID 命名規則

一般 `as` ID 必須符合：

```text
[A-Za-z_][A-Za-z0-9_.-]*
```

例如 `heap_view`、`round-1`、`phase.build` 都合法。一般指令的 `as` 不加引號。

`@keep as` 額外接受單引號或雙引號：

```cpp
// @keep arr as "original"
// @keep arr as 'build_heap'
// @keep arr as sorting_phase
```

第一次使用名稱 `original` 時，物件 ID 就是 `original`；之後若再次使用相同名稱，
依序變成 `original_1`、`original_2`，編號前會保留底線。

## `@frame`：建立動畫幀

### 基本格式

```cpp
// @frame 變數或索引綁定[,其他變數] [修飾詞...]
```

支援的基本寫法：

```cpp
// @frame arr
// @frame arr,key
// @frame arr[i]
// @frame arr[i,j],key
// @frame arr[i+1,j-1],pivot
```

`arr[i,j]` 顯示一份 `arr`，並建立 `i`、`j` 兩個陣列指標。索引支援運算式，
因此也可以使用 `arr[i*2]`、`arr[2*i+1]`。

當指標尚未取得可用索引時，會暫放在該物件實際最左側格子的左邊；沒有任何可見格子時，
不會產生暫放指標。已知越界索引和被 `range` 隱藏的索引不會冒充有效格子。
同一個尚未取得值的基底指標若同時衍生出常數位移，例如 `arr[j,j+1,j+2]`，暫放時仍會保留
每次 `+1` 一個格子的水平距離；因此在 `j = i - 1` 賦值之前，`j+1` 不會與 `j` 疊在一起。

### 命名一類幀

冒號前的名稱是「指令名稱」，適合讓 Trace Studio 或鏡頭規則識別同一類幀：

```cpp
// compare: @frame arr[i,j],pivot
// swap: @frame arr[i,j]
```

同一個指令名稱在原始碼中只能宣告一次，但該行可在迴圈或遞迴中執行很多次。

這和 `as` 不同：

```cpp
// compare: @frame arr[i,j] as partition_view
```

- `compare`：這一行 `@frame` 的語意名稱，用來選取它的所有執行結果。
- `partition_view`：此幀主要物件在畫布上的 ID，可作為其他物件的定位目標。

### 改變畫法與位置

```cpp
// heap: @frame arr[i,largest] as heap_view render heap with range(1,n) at canvas.center offset(0,40)
```

使用 `at`、`render` 或 `with` 時，`@frame` 必須至少指定一個主要顯示物件。

### 條件式產生幀

```cpp
// @frame arr[i] when i >= 0 && i < n
// @frame arr when changed(arr)
```

一般條件會直接避免產生不需要的幀；跨幀函式的行為請參考 [`when`](#when條件與跨幀判斷)。

## `@keep`：保留畫面狀態

`@keep` 會把當下資料保存為持續留在後續畫布上的快照。

### 保留一個變數

```cpp
// @frame arr
// @style arr[0] highlight AV_red
// @keep arr as "original"
```

預設會一起凍結該物件當下的 renderer、range 與 style。

### 保留上一個完整畫面

```cpp
// @frame arr[i,j],key
// @text "完成本輪" at arr.bottom
// @keep last as "round"
```

`last` 會保留 keep 指令發生前的完整畫面：最後一個 `@frame` 之後、keep 之前已完成的賦值、交換與生命週期變化都會先寫入快照。已經離開作用域的指標或物件不會被保存，其位置綁定也會一併移除。`@keep arr` 則只保留指定變數。

播放進入一個新增 keep 快照的幀時，系統會先安排共同版面就位階段。快照會接手來源 live
物件最後一次實測的幾何、樣式與完整可見狀態，再由來源位置移到保留位置；它不會先消失、
套用一般物件退場、由下往上移動或額外淡入。新的 live 物件（例如下一輪的 `arr`）移到正確位置，
以及鏡頭移向新構圖可在同一階段進行；全部完成後才開始指標入場與事件動畫。

若 keep 緊接著就是自然的作用域結束，而且中間沒有賦值、交換或其他可觀察事件，系統會先播放
該 `scope-exit`，再建立 keep 快照與移動畫面。這只調整視覺排程，不改寫 C++ 的實際事件順序。

### 條件式 keep

```cpp
for (int i = 0; i < n - 1; i++) {
    // 第一輪不保存；從第二輪開始保存上一輪
    // @keep last as "round" when i > 0
    // @frame arr[i]
}
```

`@keep ... when` 在 C++ 執行到指令時判斷條件；條件為假時不建立快照，也不切換 scene generation。
目前支援一般算術、比較、`&&`、`||`、`and`、`or`，暫不支援 `changed(...)`、`before(...)`、
`prev(...)`、`assigned(...)` 等跨幀函式。

### 不保存 style

```cpp
// @keep arr as "plain" without style
// @keep last as "plain_frame" without style
```

這會保存資料與畫法，但不凍結 `@style` 產生的樣式。

### 控制 keep 的位置

```cpp
// @keep arr as "original" at canvas.top offset(0,120)
// @keep arr as "second" at original.bottom offset(0,40)
// @keep last as "round" offset(0,-36)
```

若 `@keep` 沒有寫 `at`，它會保留來源畫面的排版：包含 `@frame` 的相對定位、
Trace Studio 拖曳後的 X/Y 位置，以及 Studio 建立的位置綁定。`@keep last` 也會保留
原畫面所在的自動排版高度，不會因為包成快照而重算到另一列。對完全沒有手動位置、
`at` 或 `offset` 的 keep 物件會沿用自動排列。每個未手動定位的 keep 列，預設垂直間距為
50px；任何明確位置設定都優先。

只寫 `offset(x,y)` 時，位移會加在保留下來的原位置上；`y` 為正會向下，為負會向上。
因此 `offset(0,-36)` 代表維持原本水平位置並向上移 36px。若之後在 Trace Studio
直接拖曳 keep 快照，手動位置優先，既有 offset 不會再重複套用。

若 `@keep` 自己寫了 `at`，則改以 `@keep` 的目標錨點定位，`offset` 作用於該錨點。
例如重複執行的冒泡排序可寫：

```cpp
// 保存剛完成的一輪，並從原高度向上微調
// @keep last as "round" offset(0,-24)
```

### 虛擬 `keep` 聯集

`keep` 是特殊定位 ID，代表目前畫面中所有可見 keep 快照的外框聯集：

```cpp
// @frame arr render heap at keep.bottom offset(0,40)
```

它不會畫出實體框，也不包含 keep 之間的箭頭或被隱藏的快照。適合把新物件排在整組歷史結果下方，
避免只綁定某一個高度可能改變的快照。

## `@exit`：提早讓物件退場

`@exit` 只結束指定變數的視覺呈現，不會改變真正的 C++ 作用域或數值：

```cpp
// @frame arr[min_idx,i]
// @exit min_idx
// @keep last as "round"
```

這會先讓 `min_idx` 依「手動物件退場」事件淡出，再保存不含該 lifetime 與其指標綁定的 keep
快照。多個目標可以用逗號分隔：

```cpp
// @exit min_idx,j
```

若不需要提早退場，可以省略 `@exit`；系統仍會依真正的作用域結束產生 `scope-exit`。

## `@text`：加入說明文字

### 一般文字與換行

```cpp
// @frame arr
// @text "Bubble Sort（冒泡排序）\n每一輪把最大值推向右側" at arr.bottom
```

文字必須放在它要附屬的 `@frame` 後面。沒有 `at` 時會使用自動排版。

### 插入變數或運算式

```cpp
// @text "目前 i=${i}，值為 ${arr[i]}" at arr.bottom
// @text "左子節點是 ${i*2}" at arr[i].top
```

`${...}` 支援與索引運算式相同的安全運算語法，所需變數會自動捕捉。

### 命名文字物件

```cpp
// @text "比較中" as compare_note at arr[j].top offset(0,-12)
```

命名後可在 Trace Studio 中穩定識別和綁定該文字物件。

### 條件文字

```cpp
// @text "左邊較小，需要交換" at arr.bottom when arr[j] < pivot
// @text "不需要交換" at arr.bottom when arr[j] >= pivot
```

同一幀可以放數條互斥的文字；只有條件成立的文字會出現。

### TTS 顯示文字與朗讀文字分離

```cpp
// @text "比較 {arr[${j}]:第 ${j} 個元素} 與 {pivot:基準點}" at arr.bottom
```

- `{畫面文字:朗讀文字}`：畫面顯示冒號左側，TTS 朗讀右側。
- `{只顯示}`：畫面顯示內容，但 TTS 不朗讀。
- 普通文字：畫面與 TTS 都使用同一內容。

### JSON 樣式片段

`@text` 也接受 JSON 物件或陣列，以不同樣式組合一行文字：

```cpp
// @text [{"text":"目前值："},{"text":"${arr[i]}","color":"AV_red","background":"#fff3cd","fontSize":18,"bold":true}] at arr.bottom
```

欄位支援：

| 標準欄位 | 相容別名 | 說明 |
| --- | --- | --- |
| `text` | 無 | 顯示內容，可使用 `${...}` |
| `color` | `font_color` | 文字顏色 |
| `background` | `bg_color` | 片段背景顏色 |
| `fontSize` | `font_size` | 字級，預設 14 |
| `bold` | 無 | `true` 時使用粗體 |

## `@style`：設定格子樣式

### 基本格式

```cpp
// @style 目標 樣式類型 顏色 [as ID] [when 條件]
```

支援五種樣式：

| 類型 | 效果 |
| --- | --- |
| `highlight` | 在格子外圍顯示會閃爍的強調框 |
| `point` | 顯示會跳動的指示箭頭 |
| `mark` | 在格子上顯示勾選標記 |
| `background` | 直接設定格子背景色 |
| `focus` | 保留指定片段正常顯示，將其他格子以指定顏色弱化 |

所有 `point` 與 `highlight` 共用同一套系統時間節奏；畫布更新、切換幀或產生縮圖時不會各自重新起跳。

### 選取整個物件、單格或區間

```cpp
// @style arr background AV_green
// @style arr[i] point AV_red
// @style arr[0:i) background AV_green
// @style arr[0:i] highlight AV_red
```

- `arr[0:i)`：左閉右開，包含 `0`，不包含 `i`。
- `arr[0:i]`：左右皆包含，包含 `0` 到 `i`。
- `arr[:i]`：省略起點時從 `0` 開始。

### 一次選取多段

逗號可以混合單格與範圍：

```cpp
// @style arr[i,j] highlight AV_red
// @style arr[i,i*2:i*2+1] highlight AV_red
// @style arr[1:i,i+2:n] focus
```

同一組方括號只能使用一種右端點規則。上例以 `]` 結尾，所以其中所有範圍都包含右端點；
若整組以 `)` 結尾，所有範圍都不包含右端點。

### `focus` 的預設顏色

`focus` 是唯一可以省略顏色的樣式，省略時預設使用 `AV_grey`：

```cpp
// @style arr[1:i] focus
```

意思是凸顯 `arr[1...i]`，其餘格子以灰色弱化。指定其他顏色時，該顏色會成為非焦點區的弱化色。

### 使用 `value` 和 `index`

在 `@style ... when` 中，可以使用目前格子的區域變數：

```cpp
// @style arr[low:high] background AV_green when value < pivot
// @style arr[low:high] background AV_red when value > pivot
// @style arr background AV_yellow when index == i
```

條件會對選取範圍內的每一格分別計算。

### 顏色格式

支援：

- AlgoShowMaker 色名，例如 `AV_red`、`AV_green`、`AV_blue`、`AV_yellow`、
  `AV_orange`、`AV_grey`、`AV_black`、`AV_white`。
- CSS 色名，例如 `red`、`orange`。
- Hex，例如 `#ff0000`、`#ff000080`。
- `rgb(...)`、`rgba(...)`、`hsl(...)`、`hsla(...)`。

## `@segment`：標示連續區間

`@segment` 會在陣列或其他序列畫法上標出一段範圍。

```cpp
// @frame arr[i,j]
// @segment arr[low:high]
```

### 端點規則

```cpp
// @segment arr[low:high)   // 包含 low，不包含 high
// @segment arr[low:high]   // 包含 low，也包含 high
// @segment arr[:high]      // 起點預設為 0
```

### 命名、條件及寬度

```cpp
// @segment arr[low:high] as active_range when low <= high
// @segment arr[low:high] with showWidth(true)
```

`showWidth(true)` 顯示區段寬度資訊；`@segment` 的 `with` 目前只支援 `showWidth(true|false)`。

## `render` 與 `with`：選擇資料結構畫法

### Renderer 類型

| 寫法 | 別名 | 用途 |
| --- | --- | --- |
| `render normal` | `array`、`sequence` | 一般水平陣列 |
| `render heap` | 無 | Heap 樹狀排列 |
| `render segment-tree` | `segment_tree`、`segmenttree` | Segment Tree |
| `render bit` | `fenwick` | Binary Indexed Tree |
| `render disk` | 無 | 圓盤／柱狀序列 |
| `render stack` | 無 | Stack |
| `render queue` | 無 | Queue |
| `render matrix` | `2d-array` | 二維陣列／矩陣 |
| `render cell` | `scalar` | 單一數值格 |

未指定 `render` 時，系統依變數資料種類選擇預設畫法。語法層已接受以上類型，
但各 draw type 的動畫細節仍會隨後續開發持續補強。

### `range(start,end)`

```cpp
// @frame arr[i] render heap with range(1,n)
```

`range` 的開始與結束都包含在內，因此上例顯示 `arr[1...n]`。
它只限制畫面顯示範圍，不改變 C++ 陣列內容，也不代表 `heapify` 的有效 heap 大小。

若希望排序階段持續顯示完整 heap，但只維護前半段，可以把顯示範圍綁定完整大小：

```cpp
int displaySize = arr.size() - 1;
// @frame arr[1,i] render heap with range(1,displaySize)
```

### `columns(count)`

```cpp
// @frame matrix render matrix with columns(cols)
```

設定矩陣或平面排列使用的欄數。參數可使用安全算術運算式。

### `labels(...)`

```cpp
// @frame arr render bit with labels(value,index)
// @frame arr render bit with labels(value,binary-index)
// @frame arr render bit with labels(value,binary-index-padded)
```

可用標籤：

- `value`：顯示資料值。
- `index`：十進位索引。
- `binary-index`：二進位索引。
- `binary-index-padded`：補齊寬度的二進位索引。

一次最多選擇一種索引格式，不可同時指定 `index` 和 `binary-index`。

### 同時使用多個選項

```cpp
// @frame arr render bit with range(1,n), labels(value,binary-index-padded), showWidth(false)
```

不同 `with` 選項以頂層逗號分隔。

## `at` 與 `offset`：相對定位

### 九個錨點

```text
top-left     top     top-right
left         center  right
bottom-left  bottom  bottom-right
```

範例：

```cpp
// @frame arr at canvas.center
// @frame heapArr render heap at original.bottom offset(0,40)
// @text "目前節點" at arr[i].top offset(0,-10)
```

`at target.bottom` 表示把新物件放在 target 下方，兩者預設保留 8px 間距；
`offset(0,40)` 再往下移 40px。正 X 向右，正 Y 向下。

`offset` 只能與 `at` 一起使用：

```cpp
// 錯誤：沒有 at
// @frame arr offset(0,40)
```

### 可定位的目標與解析順序

`at` 依序解析：

1. 目前作用域中的 C++ 變數。
2. `@keep ... as` 建立的物件 ID。
3. Trace Studio 自訂物件 ID。
4. 特殊目標 `canvas`。

此外還有特殊虛擬目標 `keep`，代表所有可見 keep 物件的聯集。

```cpp
// @text "變數" at arr.top
// @text "保留畫面" at original.top
// @text "自訂標籤" at note.top
// @text "畫布中央" at canvas.center
// @frame arr at keep.bottom offset(0,40)
```

若 keep 與 Studio 物件使用同名 ID，keep 優先。若 C++ 變數也同名，C++ 變數優先。

### 定位到特定格子

```cpp
// @text "pivot" at arr[high].top
// @frame child render heap at arr[i].bottom
```

索引無效、越界、被 range 隱藏或目標物件尚未存在時，相依文字會暫時隱藏，
不會停在錯誤座標。

### `canvas` 的注意事項

`canvas.top`、`canvas.bottom` 是畫布邊界的幾何錨點，不是自動排版列。
例如 `at canvas.top` 會把物件放在畫布上邊界外側相鄰位置；若要放進畫布內，通常需要正 Y offset：

```cpp
// @frame arr at canvas.top offset(0,120)
```

若只需要整體置中，優先使用：

```cpp
// @frame arr at canvas.center
```

## `when`：條件與跨幀判斷

### 支援的運算

| 類型 | 語法 |
| --- | --- |
| 數值 | 整數、十進位數 |
| 算術 | `+`、`-`、`*`、`/`、`%` |
| 比較 | `<`、`<=`、`>`、`>=`、`==`、`!=` |
| 邏輯 | `&&`、`||`、`!`，以及 `and`、`or` |
| 括號 | `(...)` |
| 陣列存取 | `arr[i]`、`matrix[r][c]` |
| 長度 | `arr.size`、`arr.size()`、`arr.length` |
| 布林值 | `true`、`false` |

範例：

```cpp
// @frame arr[i] when i >= 0 && i < arr.size()
// @text "左子樹完整" at arr.bottom when i*2+1 <= n
// @style arr[low:high] background AV_green when value < pivot and index != high
```

不支援任意函式呼叫、三元運算子、位元運算、字串常值或具有副作用的運算式。
例如 `max(i,j)`、`i++`、`condition ? a : b` 都不應放進視覺化條件。

### 跨幀與事件函式

| 函式 | 意義 |
| --- | --- |
| `prev(expr)` | 上一個動畫幀中的值；沒有上一幀時為空值 |
| `before(expr)` | 本幀最後一次相關寫入事件之前的值；無寫入時使用目前值 |
| `changed(expr)` | 本幀是否有事件真的改變該目標的值 |
| `assigned(expr)` | 本幀是否有 assign、write 或 swap 事件寫入該目標 |

範例：

```cpp
// @text "i 從 ${prev(i)} 變成 ${i}" at arr.bottom when changed(i)
// @style arr[i] highlight AV_yellow when assigned(arr[i])
// @text "交換前是 ${before(arr[i])}" at arr.bottom when changed(arr[i])
```

`prev` 比較相鄰動畫幀；`before`、`changed`、`assigned` 則會檢查當幀捕捉到的事件。

### 完整子樹條件

1-based heap 中，節點 `i` 有完整左右子節點的條件是 `i*2+1 <= heapSize`：

```cpp
// @text "目前沒有完整左右子樹" at arr.bottom when i*2+1 > heapSize
// @text "父節點下沉後仍需繼續檢查子樹" at arr.bottom when i*2+1 <= heapSize
```

## 完整使用案例

### 冒泡排序：比較、交換與保留每輪

```cpp
for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
            swap(arr[j], arr[j + 1]);
        }

        // compare: @frame arr[j,j+1]
        // @style arr[0:n-i-1) focus
        // @text "比較第 ${j} 與 ${j+1} 格" at arr.bottom
    }

    // @keep last as "round"
}
```

重點：

- `arr[j,j+1]` 建立兩個指標。
- swap 和 compare 事件依實際 order 播放。
- `@keep last` 保存每輪最後畫面；重複名稱會得到 `round_1`、`round_2`。

### 插入排序：取出 key、右移與回填

```cpp
for (int i = 1; i < n; i++) {
    int key = arr[i];
    int j = i - 1;

    // pick: @frame arr[i,j],key
    // @text "取出 ${key}" at arr.bottom

    while (j >= 0 && arr[j] > key) {
        arr[j + 1] = arr[j];
        j--;

        // shift: @frame arr[i,j],key
        // @style arr[j+1] highlight AV_red
    }

    arr[j + 1] = key;
    // insert: @frame arr[i,j],key
    // @style arr[0:i] focus
}
```

重點：事件使用發生當下捕捉的索引，所以 `j--` 變成 `-1` 後，先前的右移事件仍應指向原本格子。

### 快速排序：分區範圍與條件著色

```cpp
int pivot = arr[high];
int i = low;

// partition_start: @frame arr[i],pivot
// @segment arr[low:high]
// @style arr[high] point AV_red

for (int j = low; j < high; j++) {
    if (arr[j] < pivot) {
        if (i != j) swap(arr[i], arr[j]);
        i++;
    }

    // partition_step: @frame arr[i,j],pivot
    // @segment arr[low:high]
    // @style arr[low:j] background AV_green when value < pivot
    // @style arr[low:j] background AV_red when value > pivot
    // @text "{arr[${j}]:第 ${j} 個元素} 比 {pivot:基準點}小" at arr.bottom when arr[j] < pivot
    // @text "{arr[${j}]:第 ${j} 個元素} 不小於 {pivot:基準點}" at arr.bottom when arr[j] >= pivot
}
```

重點：`partition_step` 寫在 `i++` 後面，因此畫布上的 `i` 是本輪結束位置；比較事件則發生在更早的時間。
若某段動畫必須同時呈現「比較當下的 i」與「遞增後的 i」，應在 `i++` 前後各放一幀，避免混用兩個時間點。

### Heap Sort：完整顯示範圍與有效範圍分離

```cpp
void heapify(vector<int>& arr, int heapSize, int i) {
    int displaySize = arr.size() - 1;
    int largest = i;
    int left = i * 2;
    int right = i * 2 + 1;

    if (left <= heapSize && arr[left] > arr[largest]) largest = left;
    if (right <= heapSize && arr[right] > arr[largest]) largest = right;

    if (largest != i) {
        // before_swap: @frame arr[i,largest] render heap with range(1,displaySize)
        // @style arr[i,i*2:i*2+1] highlight AV_red
        // @style arr[1:heapSize] focus

        swap(arr[i], arr[largest]);

        // after_swap: @frame arr[i,largest] render heap with range(1,displaySize)
        // @style arr[largest] point AV_red
        // @style arr[1:heapSize] focus

        heapify(arr, heapSize, largest);
    }
}
```

重點：

- `displaySize` 控制畫面持續顯示整棵樹。
- `heapSize` 只用於演算法有效範圍與 `focus`。
- `largest = left/right` 可以透過事件快照移動 `largest` 指標，不必把 `left`、`right` 各自畫成指標。
- 遞迴中同名指標使用 runtime identity 區分不同呼叫，但連續出現時維持視覺連續性。

### 保留原始陣列，再把 heap 排在下方

```cpp
// @frame arr
// @keep arr as "init" at canvas.top offset(0,100)

// @frame arr render heap with range(1,n) at init.bottom offset(0,40)
// @text "將陣列改畫成樹狀關係" at arr.bottom
// @keep arr as "tree_intro"

// @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
```

相對定位會先完成，再計算文字、segment、指標、箭頭與鏡頭範圍，因此 `@text ... at arr.bottom`
會使用套用 `offset` 後的實際位置。

### 二維資料

```cpp
vector<vector<int>> grid(rows, vector<int>(cols));

// @frame grid render matrix with columns(cols)
// @text "目前矩陣" at grid.bottom
```

多維索引可用於條件或文字：

```cpp
// @text "grid[${r}][${c}] = ${grid[r][c]}" at grid.bottom when r < rows && c < cols
```

## 事件動畫與 Trace Studio

追蹤器目前會辨識下列事件：

| 事件 | 初始預設動畫 | 初始預設開啟 |
| --- | --- | --- |
| 宣告／物件入場 `declare` | 陣列與一般物件原位淡入；指標由上往下淡入 220 ms | 開啟 |
| 作用域結束／物件退場 `scope-exit` | 陣列與一般物件原位淡出；指標往上移動淡出 220 ms | 開啟 |
| 讀取 `read` | 無 | 關閉 |
| 寫入／賦值 `write`、`assign` | 賦值移動 | 開啟 |
| 比較 `compare` | 比較動畫 | 開啟 |
| 交換 `swap` | 交換動畫 | 開啟 |
| 自動固定 `fixed` | 狀態標記 | 開啟，但不列入事件時間線 |
| 迴圈邊界更新 | 指標位置移動 | 關閉；由獨立的「迴圈邊界事件」開關控制 |
| 呼叫 `call` | 無 | 關閉 |
| 進入／離開函式 | 無 | 關閉 |

事件依實際執行 `order` 逐一播放，前一個完成後才開始下一個。已開啟、可呈現且具有原始碼
範圍的事件，會先將對應程式碼高亮 400 ms，再開始比較、賦值、交換、指標移動或物件生命週期
動畫；兩段屬於同一筆正式排程，程式碼高亮會保留到該事件完成。沒有原始碼範圍的事件不增加
提示等待，關閉或無法呈現的事件也不占提示與事件間隔。事件設定會寫入 `@asm-view` 並以
穩定指令識別保存；只改行號或加入無關註解時，不應改變既有開關。

### 事件顏色狀態

- Trace Studio 右側「事件」頁使用獨立黑底面板，以原始 C++ AST 的函式、`for`、`if`、`while`、`do`、`switch` 建立直式巢狀群組；函式宣告標頭本身是可選擇的「進入函式」事件按鈕，開啟後會依執行順序高亮函式標頭，但不虛構畫布物件動畫。其餘事件是群組內獨立的程式碼按鈕，不共用畫布程式碼片段的 ACE 版面。底部事件時間線暫時保留既有設計。
- 函式參數在每次函式或遞迴 activation 開始時只產生「宣告／物件入場」，例如 `int n;`，不再額外產生虛構的 `n = 傳入值`。只有原始碼真的寫出初始化式（例如 `int n = 0;`）才會拆成宣告與賦值兩個事件。
- 作用域結束事件會直接顯示退場物件名稱，例如 `j 退場`，讓遞迴或巢狀迴圈的 lifetime 容易辨識。
- 已開啟的作用域結束事件若沒有對應的可見 lifetime，事件會標成黃色「缺少可見動畫目標」。
- `int i = 0` 這類宣告初值若將 `i` 畫成指標，會直接在索引 0 入場；只有分開宣告、尚未取得值的指標才暫放在陣列左側，且暫放箭頭保持垂直。
- `for (int i = 0; ... )` 這類宣告兼初始化會拆成不重疊的兩列：`int i` 控制宣告／入場，`i = 0` 控制初始化；兩列都位於同一個 `for` 群組，並依原始碼順序排列。
- 一般顏色：事件有可見動畫目標，可以播放。
- 黃色：缺少目前可見的動畫目標，例如來源變數未畫出；預設關閉，但保留使用者開關意圖。
- 紅色：目前事件動畫類型無法呈現。

黃色與紅色事件不會自動鎖死使用者設定；無法呈現時不播放動畫，也不占用事件間隔。
完整條件結果屬於內部資料，只用來完成程式碼的淺綠／淺紅著色，不顯示在事件列表、事件時間線
或事件設定，也不占播放時間。`for` 宣告初始式與條件比較雖然能靠原始碼範圍保留在右側事件欄，
仍必須有可見的畫布目標才能播放；必要純量未顯示時會標成黃色並預設關閉。

### `for` 標頭的事件順序

傳統 `for` 的宣告初始式、條件式與更新式都會保留事件：

```cpp
for (int i = 0; i < n; i++) {
    // ...
}
```

第一次進入時，`int i = 0` 會拆成「宣告 `int i`」與「賦值 `i = 0`」。宣告控制物件原位淡入，
初始化賦值則和 `i++`／`i--` 一樣只更新指標位置，不產生賦值框；接著執行 `i < n`
比較。每輪結束再執行 `i++`，然後重新判斷條件。完整條件結果仍依實際順序記錄，但只是內部
真／假著色資料，不會成為另一個可控制事件。

每次執行宣告都有獨立 lifetime identity。同名區域變數在下一輪迴圈或下一層遞迴再次建立時，
不會和前一次生命週期混在一起；`@keep` 快照中的舊指標也不會被新宣告、賦值或退場事件命中。
變數離開區塊、函式或遞迴 activation 時會產生 `scope-exit`，依實際順序原位淡出。關閉入場或
退場動畫時不占排程時間，畫面直接呈現事件完成後的狀態。

### 迴圈邊界事件

傳統 `for` 在離開迴圈前，會先執行最後一次更新式，再判斷條件為假。例如 `j++` 可能讓指標短暫移到有效區間外。系統會利用相同 `ForStatement` 的 AST 範圍與實際事件順序，自動把「false 條件前最後一次更新式」標記為迴圈邊界事件；普通迭代中的同一行 `j++` 不受影響。

事件設定內的「迴圈邊界事件」開關預設關閉：

- 關閉時，該次更新不播放、不列入事件表與事件線、不高亮程式碼，也不改變指標的邏輯位置，效果等同這次事件不存在。
- 開啟時，該次更新恢復為正式事件，按照原始執行順序播放，並以「迴圈邊界」顯示；若 `j+1` 等衍生指標超出陣列最後一格，仍會顯示在最後一格右側的外推位置。
- 這是全域事件設定，與一般賦值事件開關及「自動固定」分開保存。

### 自動固定

自動固定不是一般逐一播放事件，而是系統依 runtime identity 分析某個格子最後一次被存取的位置。
只有確認後續不再使用的格子才會標記，並在右側事件區的下方獨立控制。

### 三個介面的一致性

演算法編輯器、Trace Studio 與演算法投影片共用：

- trace model 與事件順序。
- renderer 與資料結構畫法。
- frame tween 與事件動畫時間線。
- camera 規則與物件 ID。
- `@asm-view` 事件開關、物件、鏡頭及跨幀設定。

若程式或輸入已修改但尚未重新 RUN，狀態點會顯示紅色；成功 RUN 後變為綠色。

投影片播放器收到 runtime 後不會立刻用隱藏 iframe 的零尺寸或舊尺寸建立動畫起點。父頁會把
目前投影片可見狀態同步給 iframe；子播放器等實際 viewport 可量測後，取消殘留 tween、重新
繪製並基準化目前幀，再通知父頁解除載入遮罩。這套流程和演算法編輯器、Trace Studio 使用相同
的 frame tween 資料，可避免重新整理後第一次按下一步時，陣列子格由 outer frame 左上角擠出。

## 程式碼片段與條件著色

程式碼面板不以固定行數截取，而是使用 C++ 語法樹與當幀實際事件決定內容：

- 當事件位於 `main` 以外的函式時，會顯示該函式的完整內容（函式宣告、本體與結尾括號）；一般註解與所有繪圖指令仍不顯示。同一函式內的不同幀使用同一份函式版面。

1. 從每個事件所在節點向上尋找包住它的 `if`、`for` 或 `while`。
2. 持續向上到最外層控制結構，保留其標頭、巢狀路徑及配對的結尾大括號。
3. 合併同一幀所有事件需要的語法子樹；聯集之外的內容以 `...` 隱藏。
4. 首幀若尚無事件，則從目前顯示的物件反查必要的變數宣告、輸入敘述與初始化迴圈。
5. 只要事件位於 `for`、`while` 或 `do` 迴圈中，就保留完整迴圈內容與配對大括號。
6. 當幀遇到 `if` 的條件事件時，若控制區塊內不超過 3 行可執行程式碼，就保留完整內容；即使條件為假、內容沒有產生事件，也會顯示分支成立時原本會執行的動作。超過 3 行時維持精簡，只呈現當幀相關內容。

舊版 trace 若沒有保存 AST context，系統會從原始碼重建以大括號界定的控制結構。因此事件位於
`for` 內時仍會顯示所有外層迴圈，短 `if` 即使判定為假也會保留其內容。相同原始碼行只顯示一次，
省略號也只會出現在確實存在未顯示程式碼的間隔，不會因同一行上有多個事件而重複插入。

一般註解、`@frame`、`@style` 等繪圖指令，以及與演算法無關的 `#include`、
`using namespace` 和單純入口樣板預設不顯示。

### 事件與條件的背景色

- 事件執行中：只將該事件精確對應的運算式片段塗成黃色。
- 一般事件完成：已走過的片段塗灰；`swap` 等涵蓋內部讀取事件的運算仍保持一條連續背景帶。
- 條件完成且結果為真：將完整條件運算式連續塗成淺綠色（`AV_green`）。
- 條件完成且結果為假：將完整條件運算式連續塗成淺紅色（`AV_red`）。

只有實際排入播放計畫的普通事件才會留下完成灰色。被關閉、無法呈現或未列入事件時間線的宣告與初始化，
不會僅因幀載入完成就被塗灰；條件事件則仍會保留最後的真／假顏色。

例如：

```cpp
if (i < n && arr[i] > key) {
    i++;
}
```

執行時會先只亮 `i < n`。只有短路規則允許時，才接著亮 `arr[i] > key`；最後取得
完整 `&&` 條件結果後，`i < n && arr[i] > key` 會整段連續變成綠色或紅色。
若第一段已為假，第二段不會被誤標成已執行，但最終完整條件仍會留下紅色結果。

經過不同幀時，若擷取出的程式碼配置未改變，面板不重播入場、位移或額外等待；配置改變時，
只展開下一幀會顯示但目前仍隱藏的程式碼，省略兩幀都不會使用的區域，再上下滑動並收合上一幀不再需要的行。
這段程式碼跳轉固定使用 500 ms，物件補間、鏡頭與事件動畫會等跳轉完成後才開始。

程式碼片段會移除所有顯示行共同具有的左側空白，但保留巢狀結構的相對縮排。字體以 1600×900 畫布為基準，
依各介面的實際畫布寬高等比例縮放；在 Trace Studio 點選程式碼會開啟字體大小設定，文字本身仍可選取，
從片段空白處則可拖曳位置。關閉迴圈邊界顯示時，終止用的 `for` 條件及僅供該條件求值的 compare/read
不會產生程式碼高亮，也不會把相關程式碼間接加入片段。

> 舊動畫資料若尚未包含完整的 `for` 條件事件，需要重新 RUN 一次，才能得到逐段求值與最終紅綠結果。

## 常見錯誤與限制

### `@style`、`@text` 或 `@segment` 前面沒有 `@frame`

錯誤：

```cpp
// @style arr[i] highlight red
// @frame arr[i]
```

正確：

```cpp
// @frame arr[i]
// @style arr[i] highlight red
```

### 把 `at` 寫在 `@style`

`@style` 自動綁定目標格子，不支援 `at`：

```cpp
// 錯誤
// @style arr[i] highlight red at canvas.center
```

請把位置寫在物件指令上：

```cpp
// @frame arr[i] at canvas.center
// @style arr[i] highlight red
```

### `offset` 沒有搭配 `at`

```cpp
// 錯誤
// @text "說明" offset(0,20)

// 正確
// @text "說明" at arr.bottom offset(0,20)
```

### 把 `render` 寫進 C++ 運算式或使用 Python code fence

指令必須是 C++ 的單行註解，且 `render` 位於 `@frame` 修飾詞區：

```cpp
// @frame arr[i] render heap with range(1,n)
```

Markdown 的 ```cpp 或 ```python 只影響文件顯示，不可貼進 C++ 編輯器當作程式碼。

### `range` 與 `@style` 範圍混淆

- `with range(1,n)`：限制 renderer 顯示的索引，左右端都包含。
- `arr[1:n]`：`@style` 或 `@segment` 的包含右端範圍。
- `arr[1:n)`：`@style` 或 `@segment` 的不包含右端範圍。

### 同一幀事件過多造成時間點不直覺

如果 `compare`、`swap`、`i++` 全部發生在兩個 `@frame` 之間，畫布靜態指標已經位於最後狀態，
但早期事件仍按照原順序播放。最可靠的處理方式是在教學上重要的狀態轉換前後增加 `@frame`。

### 條件引用不到變數

條件只能引用該指令位置仍在 C++ 作用域內的變數。離開區塊後，即使另一個同名變數存在，
也不會自動當作同一個 runtime identity。

### `@layout` 尚未實作

目前跨幀排版使用 `at`、`offset`、命名 keep，以及虛擬 `keep` 聯集。
持久化 `@layout` 語法仍在 `LAYOUT_DIRECTIVE_ROADMAP.md` 中保留，等 tree、graph 或其他
可變高度 draw type 出現更多共同需求後再實作。

## 文件維護規則

之後每次新增或調整視覺化語法，至少同步更新：

1. 本手冊的「語法支援總表」。
2. 對應指令章節與一個最小範例。
3. 受影響 renderer 或演算法的完整案例。
4. 常見限制或相容性說明。
5. 最後核對日期、commit 與下方更新紀錄。
6. 自動測試，確保文件中的關鍵語法確實可解析。

### 更新紀錄

| 日期 | 基準 | 內容 |
| --- | --- | --- |
| 2026/09/12 | `AV_V4.6` | 播放層完成正向事件 checkpoint、生命週期與指標排程；`@keep` 快照改為接手來源 live 物件的實測幾何與可見狀態，不再觸發一般退場、額外淡入或殘影。投影片 iframe 會等可見 viewport 後重新基準化目前幀，修正首次下一步的子格錯誤起點。 |
| 2026/09/12 | `AV_V4.6` | 補齊 AST 程式碼片段、Trace Studio 巢狀事件結構、動畫除錯記錄、儲存正規化、JWT 設定檢查，以及三介面播放／儲存一致性回歸案例。 |
| 2026/09/10 | 工作樹 | 陣列生命週期統一改為原地淡入／淡出；跨幀新增、作用域退場與一般移除皆不再套用上下位移。 |
| 2026/09/10 | 工作樹 | `@keep` 保留來源排版高度、Studio 位置與綁定；新增不搭配 `at` 的 `offset` 原位微調。事件播放改為程式碼先提示 400 ms、物件再回應；提示起點與視覺起點納入共用播放排程及動畫除錯記錄。 |
| 2026/09/10 | 工作樹 | `@keep` 支援目前值 `when`；緊接 keep 的自然 scope-exit 會安全地提前到快照與場景移動之前；新增 `@exit` 手動視覺退場指令。 |
| 2026/09/08 | 工作樹 | `int i = 0` 拆分宣告與初始化；缺少畫布變數的 `for` 比較標黃；完整 condition 改為無 UI、無時間的內部著色資料；三行內的 false 分支仍完整呈現。 |
| 2026/09/07 | 工作樹 | 程式碼片段改用最外層控制子樹；首幀反查初始化；複合條件依短路順序逐段高亮，完成後整段連續保留真／假色。 |
| 2026/09/07 | `fe5782c` | 建立第一版手冊；整理 `@frame`、`@keep`、`@text`、`@style`、`@segment`、所有修飾詞、renderer、條件、事件及六類案例。 |
