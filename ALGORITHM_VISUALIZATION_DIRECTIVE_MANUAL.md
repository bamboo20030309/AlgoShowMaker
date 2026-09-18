# AlgoShowMaker 演算法視覺化指令使用手冊

本手冊記錄 AlgoShowMaker「註解式追蹤語法」目前實際支援的功能。語法以
`trace-instrumenter.js`、瀏覽器追蹤模組及自動測試為準；新增或調整指令時，應同步更新本文件。

- 文件語言：繁體中文
- 適用介面：演算法編輯器、Trace Studio、演算法投影片編輯器與投影片播放介面
- 最後核對日期：2026/09/18

> 本手冊介紹 `// @frame` 這套追蹤語法。它和直接呼叫 `AV.hpp` 的傳統 `av.draw(...)`
> 繪圖 API 是兩套不同入口；使用追蹤語法時，不需要自行呼叫 `av.start_draw()`。

## 目錄

1. [五分鐘快速入門](#五分鐘快速入門)
2. [核心觀念](#核心觀念)
3. [語法支援總表](#語法支援總表)
4. [共用修飾詞](#共用修飾詞)
5. [`@frame`：建立動畫幀](#frame建立動畫幀)
6. [`@defaults`：每幀自動套用](#defaults每幀自動套用的呈現預設)，[`@preset` 與 `@frame use`：重用視圖設定](#preset-與-frame-use重用視圖設定)
7. [`@keep`：保留畫面狀態](#keep保留畫面狀態)
8. [`@layout recursion`：遞迴樹排版](#layout-recursion遞迴樹排版)
9. [`@exit`：提早讓物件退場](#exit提早讓物件退場)
10. [`@text`：加入說明文字](#text加入說明文字)
11. [`@style`：設定格子樣式](#style設定格子樣式)
12. [`@segment`：標示連續區間](#segment標示連續區間)
13. [`@arrow`：連接視覺物件](#arrow連接視覺物件)
14. [`@place`：放置同幀物件](#place放置同幀物件)
15. [`render` 與 `with`：選擇資料結構畫法](#render-與-with選擇資料結構畫法)
16. [`at` 與 `offset`：相對定位](#at-與-offset相對定位)
17. [`when`：條件與跨幀判斷](#when條件與跨幀判斷)
18. [完整使用案例](#完整使用案例)
19. [事件動畫與 Trace Studio](#事件動畫與-trace-studio)
    - [`@events`：每幀事件動畫控制](#events每幀事件動畫控制)
20. [程式碼片段與條件著色](#程式碼片段與條件著色)
21. [常見錯誤與限制](#常見錯誤與限制)
22. [文件維護規則](#文件維護規則)

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

### 編輯器指令提示與範例

在演算法編輯器輸入 `// @`，會出現貼著游標的指令選單；在已有指令的那一行按 `Ctrl+Space`，可查看下一層可接的 `render`、`with`、`at`、`as`、`when` 等修飾詞，以及附屬的 `@object`、`@style`、`@text` 等指令。方向鍵選項、`Tab` 插入、`Esc` 關閉。選項旁會說明用途，選中後可預覽將插入的程式碼。

在指令行按桌面右鍵，可查看「最小／常用／完整」三種範例；切換範例只更新預覽，按「插入這個範例」才會替換該行。一般 C++ 行與手機長按仍使用原生複製、貼上選單。舊的 `av.start_frame_draw()` 等右鍵快捷項已移除，不要把它們和這份 `// @` 指令系統混用。

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

`@text`、`@style`、`@segment`、`@place`、`@arrow`、`@events` 會附加到原始碼中位於它們上方、距離最近的 `@frame`。
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
| `@frame use NAME[,NAME...]` | 擷取一幀並依序展開多個具名視圖預設 | 只支援幀語意名稱 | 透過後續 `@object` 覆寫 | 透過後續 `@object` 覆寫 | 支援 | 透過 `@object` | 透過 `@object` | 不支援 |
| `@preset`／`@endpreset` | 壓縮並重用同一組幀繪圖指令 | 不支援 | 透過內部指令 | 透過內部指令 | 透過內部繪圖指令 | 透過內部 `@object` | 透過內部 `@object` | 不支援 |
| `@defaults`／`@enddefaults` | 每幀自動套用呈現規則 | 不支援 | 透過內部指令 | 透過內部指令 | 透過內部呈現指令 | 透過內部 `@object` | 透過內部 `@object` | 不支援 |
| `@object` | 將另一個獨立設定的物件加入緊接的 `@frame` | 支援 | 支援 | 支援 | 不支援 | 支援 | 支援 | 不支援 |
| `@keep` | 保留變數或上一幀 | 支援 | 支援 | 支援 | 支援目前值條件 | 不支援 | 不支援 | 支援 |
| `@layout` | 宣告或設定具名遞迴樹排版 | 宣告時必須使用 | 宣告時支援 | 宣告時支援 | 不支援 | 不支援 | 專用設定語法 | 不支援 |
| `@exit` | 提早讓一或多個可見變數退場 | 不支援 | 不支援 | 不支援 | 不支援 | 不支援 | 不支援 | 不支援 |
| `@text` | 加入說明文字與 TTS | 支援 | 支援 | 支援 | 支援 | 不支援 | 不支援 | 不支援 |
| `@style` | 套用格子樣式 | 支援 | 不支援 | 不支援 | 支援 | 不支援 | 不支援 | 不支援 |
| `@segment` | 標示陣列區間 | 支援 | 不支援 | 不支援 | 支援 | 不支援 | 僅 `showWidth` | 不支援 |
| `@place` | 將已顯示物件綁到另一物件的錨點 | 不支援 | 必須指定 | 支援 | 支援 | 不支援 | 不支援 | 不支援 |
| `@arrow` | 連接兩個視覺目標 | 支援 | 端點各自指定 | 端點各自支援 | 支援 | 不支援 | 專用樣式修飾詞 | 不支援 |
| `@events` | 控制本幀全部或指定種類事件動畫 | 不支援 | 不支援 | 不支援 | 支援（幀擷取狀態） | 不支援 | 不支援 | 不支援 |

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
| `in` | 把 live `@frame` 或 `@keep` 快照加入具名遞迴排版 | `@frame arr in quick_tree`、`@keep last as part in quick_tree` |

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

### 同一幀顯示多個獨立設定的物件

需要讓同一幀的不同物件使用各自的畫法、範圍、標籤或位置時，可以先用空白
`@frame` 建立時間點，再以連續的 `@object` 加入物件：

```cpp
// @frame
// @object isprime with range(0,n-1), columns(10), labels(index) at canvas.top offset(0,80)
// @object prime with columns(10), labels(value) at isprime.bottom offset(0,60)
```

若整幀只在條件成立時出現，可以把 `when` 寫在空白 `@frame`，物件仍各自保留設定：

```cpp
// @frame when i%v==0
// @object isprime[i] with range(1,n), columns(10), labels(index)
// @object prime with columns(10), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
```

條件在執行到 `@frame` 時判斷；為假時不產生該幀，也不套用其附屬的物件、
樣式、文字或箭頭。`when` 中引用但未顯示的 C++ 變數會供條件判斷捕捉，
不會因此變成畫布上的物件。

所有緊接的 `@object` 只產生同一幀。每個物件的 `as`、`at`、`offset`、`render` 與
`with` 分別解析，不會套用到其他物件。`at` 所引用的同幀物件會在所有物件完成
繪製後依相依順序定位，因此後面的 `prime` 可以直接綁定前面的 `isprime`。

`@object` 和前一行之間只能有空白；若中間已有 C++ 敘述，必須重新建立 `@frame`。
空白 `@frame` 至少要緊接一個 `@object`。整幀的 `when` 寫在 `@frame`，
不能寫在 `@object`；`in` 也不能寫在 `@object`，需要遞迴排版時沿用單行主要
`@frame ... in ...`。

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

## `@defaults`：每幀自動套用的呈現預設

放在程式最上方，不需要每幀寫 `use`：

```cpp
// @defaults
// @camera focus arr offset(0,20) zoom(2.0)
// @enddefaults
```

或使用 `// @camera auto`，讓每幀自動捕捉。區塊支援 `@camera`、`@object`、`@place`、
`@style`、`@segment`、`@text`、`@arrow`、`@events`；不接受 `@frame`、`@keep`、`@exit`、`@layout` 等流程指令。
一份程式只定義一個 defaults 區塊，不可巢狀，必須以 `@enddefaults` 結束。

每幀在當前作用域重新解析變數與運算式；遞迴參數 `arr` 會指向該次呼叫的陣列，
不在定義 defaults 時凍結資料。找不到鏡頭目標時改用自動捕捉。
優先順序為：Studio 單幀覆寫 → 當幀直接指令 → `use` 的 preset（後者優先）→ defaults → 系統預設。
Studio 全域鏡頭規則仍是未指定幀鏡頭時的備援。

```cpp
// @frame arr
// @camera auto  // 只覆寫這幀；下一幀回到 defaults
```

defaults 與 preset 的同目標設定遵循下節的合併／覆寫規則；刪除 defaults 後重新 RUN，
新動畫不保留該區塊的設定。三個介面使用相同的幀展開結果。

## `@preset` 與 `@frame use`：重用視圖設定

反覆使用相同的物件畫法、範圍、標籤與相對位置時，可先定義具名視圖：

```cpp
// @preset sieve_view
// @object isprime with range(1,n), columns(10), labels(index)
// @object prime with columns(10), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
// @segment isprime[1:i] as active_range
// @style isprime[1:n] focus when value == 1
// @text "正在檢查第 ${i} 格" as sieve_note at isprime.top
// @arrow from prime[0] to isprime[i] as "sieve_link" color AV_green
// @camera focus isprime[i] zoom(1.6) offset(0,20)
// @endpreset

for (int i=2; i<=n; i++) {
    // @frame use sieve_view
    // @style isprime[i] highlight
}
```

`@preset` 只定義設定，不產生動畫幀。每次程式執行到 `@frame use sieve_view`，才在**該使用位置**
解析 `n`、`i` 等 C++ 變數並建立一幀；定義時不會把變數值凍結。若整幀只在條件成立時擷取，
可寫 `// @frame use sieve_view when i <= n`。

預設區塊必須以 `@endpreset` 結束，至少包含一個 `@` 指令。preset 定義層不再維護指令白名單，
而是原樣保存每一條設定，再由 `@object`、`@place`、`@style`、`@segment`、`@text`、`@arrow`、
`@camera` 等各自的解析器於 `@frame use` 位置展開。這讓之後新增的幀設定不必再次修改 preset
的允許清單。變數與 `when` 仍在使用位置解析，不會在 preset 定義時執行。

`@keep`、`@exit`、`@frame` 等流程型指令即使出現在 preset 中，也只會保留為該幀的附屬描述，
不會由 preset 擅自建立快照、退場或額外幀；需要流程效果時仍應寫在實際執行位置。`@layout`
仍建議在全域宣告一次。預設 ID 不可重複，使用不存在的 ID 會報錯。

一幀可用逗號依序套用多個預設；樣式或定位專用預設不必包含 `@object`，但所有預設展開後
該幀至少要有一個物件。後面的預設會覆寫前面相同主要物件的 `@object`、相同來源與錨點的
`@place`、相同目標／範圍／種類的 `@style`，以及使用相同 `as` ID 的 `@segment`、`@text`、
`@arrow`；其餘項目合併保留。當幀直接寫的具名指令再覆寫 preset 的同 ID 項目。逗號兩側
空白可省略，同一 preset ID 不可在一幀內重複套用：

```cpp
// @preset sieve_colors
// @style isprime[i] highlight AV_green
// @endpreset

// @frame use sieve_view, sieve_colors when i <= n
```

這一幀沿用 `sieve_view` 的物件與位置，並讓 `sieve_colors` 的強調色覆寫原樣式；`i`、`n`
仍在每次執行該幀時重新求值。

使用預設後，可在該幀下面追加單幀設定。針對**同一個主要物件**的 `@object` 會取代其預設物件設定；
來源物件與來源錨點相同的 `@place` 會取代預設定位；目標、選取範圍與樣式種類相同的 `@style`
會取代預設樣式。其他預設項目保留：

```cpp
// @frame use sieve_view
// @object prime with columns(5), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,80)
// @style isprime[i] highlight AV_green
```

這會只把 `prime` 改為每列五格、間距改成 80px，並覆蓋同目標的強調顏色；
`isprime` 的範圍與索引標籤仍沿用預設。`@object` 必須緊接 `@frame use` 或另一個 `@object`；
`@place`、`@style`、`@segment`、`@text`、`@arrow`、`@camera` 則沿用一般附屬指令規則。
此語法只保存「如何呈現」，不保存事件開關或主動執行動畫流程。

### `@camera`：幀附屬鏡頭

```cpp
// @camera auto
// @camera auto zoom(0.9) offset(0,20)
// @camera focus arr zoom(1.6)
// @camera focus arr[i].top zoom(2) offset(0,-30) when i >= 0
```

- `auto`：自動容納目前畫面物件。
- `focus TARGET`：將目標置於鏡頭中心；未寫錨點時預設 `center`。
- `zoom(...)`：設定倍率，範圍 `0.05`～`4`。
- `offset(x,y)`：在鏡頭中心加入像素位移。
- `when`：條件成立時才採用這條鏡頭設定。
- 優先序為「Trace Studio 的幀覆寫 → 本幀／preset 的 `@camera` → Studio 全域鏡頭 → 自動鏡頭」。

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

## `@layout recursion`：遞迴樹排版

`@layout recursion` 會宣告一個具名排版。`@frame ... in 排版ID` 先把尚未 keep 的 live 物件
綁到目前遞迴 activation 的節點；`@keep ... in 排版ID` 再把該次 activation 保存成正式節點。
系統依實際呼叫關係連接父節點、兄弟順序與父子箭頭。

### 最小寫法

```cpp
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree direction top-down
```

每一條設定都必須把目標 ID 寫清楚。正確寫法是 `// @layout quick_tree direction top-down`；
不能省略 ID 寫成 `// @layout direction top-down`，也不能靠上一行隱含指定。

在遞迴函式中用 `in` 加入節點：

```cpp
void quick_sort(vector<int>& arr, int low, int high) {
    if (low >= high) return;

    // @frame arr with range(low,high) in quick_tree
    // @keep last as "partition" in quick_tree

    // ...partition...
    quick_sort(arr, low, pivot - 1);
    quick_sort(arr, pivot + 1, high);
}
```

`@frame arr ... in quick_tree`、`@keep arr ... in quick_tree` 與 `@keep last ... in quick_tree` 都支援。
`@frame ... in` 不可和 `at` 同時使用：前者代表由遞迴排版決定位置，後者代表明確的個別定位。
相同 `as` 名稱仍使用
`partition`、`partition_1`、`partition_2` 的穩定命名規則。

### 預設設定

只寫宣告而沒有其他設定時，等同於：

```cpp
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree mode compact
// @layout quick_tree direction top-down
// @layout quick_tree align center
// @layout quick_tree sibling-gap 40
// @layout quick_tree level-gap 100
// @layout quick_tree degree 2
// @layout quick_tree edges on
```

若宣告時省略 `at`，根位置也預設為 `canvas.top offset(0,80)`。
`edges on` 會自動為每組 runtime 父子節點建立與 `AV.hpp` 樹排版一致的黑色 2px 箭頭。預設 `top-down` 時從父節點
`bottom` 指向子節點 `top`；其他方向會對稱改用 `top → bottom`、`right → left` 或
`left → right`，端點直接使用物件 outerframe 的語意錨點。

### 可用設定

| 設定 | 可用值 | 意義 |
| --- | --- | --- |
| `direction` | `top-down`、`bottom-up`、`left-right`、`right-left` | 子節點向下、向上、向右或向左生長 |
| `mode` / `order` | `compact`、`levelorder`、`binary`、`preorder`、`inorder`、`postorder` | 選擇樹節點在交叉軸上的排列方式 |
| `align` | `start`、`center`、`end` | 將整棵樹的起點、中心或終點對齊宣告的錨點 |
| `sibling-gap` | 正數像素 | 同層相鄰節點間距，預設 40 |
| `level-gap` | 正數像素 | 父子層之間的額外間距，預設 100 |
| `degree` | 正整數 | `binary` 模式的每個節點槽位數，預設 2 |
| `edges` | `on`、`off` | 顯示或隱藏黑色 2px 父子箭頭，預設開啟 |
| `reset` | 無值 | 將上述排列設定恢復預設，保留名稱與根錨點 |

六種 mode 沿用 `AV.hpp` 樹排版的概念：`compact` 依節點實際外框緊密排列；
`levelorder` 逐層排列；`binary` 保留完整 k 元樹槽位；`preorder`、`inorder`、`postorder`
依指定走訪順序配置節點，同時保留實際遞迴深度。

### 定位優先順序

排版會在 SVG 物件完成量測後、文字／箭頭／鏡頭與縮圖定位前執行，因此不同高度的 array、heap
或其他 draw type 會使用真實外框。位置優先順序為：

1. Trace Studio 對該快照的逐幀手動位置。
2. 該條 `@keep` 自己的 `at` 定位。
3. 所屬 `@layout recursion`。
4. 一般 keep 自動排列。

`@keep ... in quick_tree offset(x,y)` 可在自動樹位置上微調單一節點。若同時寫 `at`，則該節點
退出自動樹定位、改用自己的明確位置，但仍保留在同一排版的父子關係與連線中。

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

播放時，background／focus 的填色及 highlight／point／mark 的顏色以 180ms 平滑過渡；value 與 index 填色使用相同時機與速度，位移補間不另外覆寫 style 的顏色。
進入新幀時就以該幀最終狀態套用 style，不等待比較、賦值或交換動畫完成。
框與提示的位置沿用格子的同一段位移／縮放動畫，不另外延遲追趕，閃爍節奏不重啟。
自動播放等待最後的變色完成；Studio 手動拖曳維持即時更新。
系統偏好減少動態效果時，省略顏色過渡。

### 基本格式

```cpp
// @style 目標 樣式類型 [顏色] [as ID] [when 條件]
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

陣列同時顯示 value 與 index 時，`highlight` 框會包含兩格的完整高度；交換、移動或縮放期間仍跟隨當下顯示的格子，不會因交換暫用格子副本而消失。

比較事件的強調框與 `@style highlight` 分開處理：比較抬起／放大時只框住該數值格，不額外包含下方 index 格。

style 的索引、範圍或 `when` 若依賴尚未取得數值的變數，相關選取／條件暫不套用，不會將未知值視為 0；變數取得有效數值後立即重新求值。真正的 0 與 false 不受影響。

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

### 省略顏色時的預設值

五種樣式都能省略顏色：

```cpp
// @style arr[0] background
// @style arr[1] highlight
// @style arr[2] mark
// @style arr[3] point
// @style arr[1:i] focus
```

`highlight`、`point` 使用 draw 系統的紅色，`mark` 使用綠色，`focus` 使用 `AV_grey` 灰色。`background` 沿用當前畫法的預設背景色；一般陣列與 heap 為紫色，stack、queue 等畫法各自使用原本的預設色。指定顏色時仍完全採用指定值。`focus` 是凸顯指定片段、將其餘格子弱化的效果。

### 使用 `value` 和 `index`

在 `@style ... when` 中，可以使用目前格子的區域變數：

```cpp
// @style arr[low:high] background AV_green when value < pivot
// @style arr[low:high] background AV_red when value > pivot
// @style arr background AV_yellow when index == i
```

條件會對選取範圍內的每一格分別計算。

style 還原為入幀套用：background／focus／highlight／point／mark 在進入新幀時依該幀最終 `value`、`index` 與變數狀態求值，不等待事件提交或整幀結束，也不再依中途顯示數值重新求值。已開啟交換動畫的格子填色是例外：交換開始前維持來源格子的舊色，實際交換起跑才啟動 180ms 變色，顏色跟隨移動中的格子；固定的 index 框也在相同時點啟動變色。關閉交換動畫不等待。其他 style 仍可能先於賦值反映新幀結果。數值與事件仍按原本 runtime order 播放；style 跟隨格子移動與縮放，value／index 背景使用同一份幀規則。`highlight`、`point` 等提示沿用全域閃爍／跳動節奏，不因換幀重啟。Studio 靜態預覽與三個播放介面採相同規則。

C++ 範圍迴圈（`ForRangeLoop`）標頭宣告的變數也能在迴圈內的指令中使用，例如：

```cpp
for (auto& v : prime) {
    // @frame isprime
    // @style isprime[i*v] highlight red
    isprime[i*v] = 0;
}
```

`v` 會隨每次迭代取得當下的值；離開這個迴圈後就不能再用 `v` 作為指令運算式。

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

## `@arrow`：連接視覺物件

### 批次箭頭：使用者指定的繪圖迴圈

```cpp
// @frame source,target
// @arrow for k in [0:n-1] step 2
//   from source[k].bottom to target[k].top
//   as "links" color AV_green when k != 0
```

也可以整條寫在一行。多行延續需使用連續的普通 `//` 註解，開頭為
`from`、`to`、`as`、`color`、`width`、`head`、`line`、`dash` 或 `when`；
不能跨越 C++ 敘述或另一個 `@` 指令。`when` 仍位於指令最後。

- `[start:end]` 包含兩端，與樣式區間寫法一致；`step` 預設為 1，支援負步長。方向與範圍不合時產生零支箭頭。舊的 `start..end` 已移除，請改用方括號與冒號。
- 起點、終點、步長可用既有運算式、陣列長度及 `iteration.last(...)`，必須解析為安全整數，步長不可為零。
- `k` 是這條箭頭內的繪圖索引，在端點索引與 `when` 中使用，不修改同名 C++ 變數、不執行 C++ 迴圈、不新增 runtime 事件；範圍本身不可引用 `k`。
- 子箭頭 ID 如 `links[0]`、`links[2]`，依索引穩定對應；同幀展開後 ID 衝突會報錯。
- 每條批次指令最多展開 2048 個候選；超量、無法解析範圍或索引會明確報錯，不截斷。不存在的畫面端點仍依原箭頭規則隱藏。
- 可放在 `@preset`／`@defaults` 中，沿用具名箭頭覆寫規則。

使用者自行編寫線篩濃縮幀，可以放在內層 `j` 迴圈結束後：

```cpp
// @frame isprime[i],prime when i > 7
// @events animate off
// @arrow for k in [0:iteration.last(j)]
//   from prime[k].bottom to isprime[i*prime[k]].top
//   as "sieve_links" when i*prime[k] <= n
```

範圍由使用者指定；`iteration.last(j)` 提供這次迴圈最後位置，條件排除只觸發越界
`break` 的格子。詳細幀不再擷取時，既有 scalar 事件仍可供該衍生值求值，不需新增繪圖幀。
可執行完整範例：`algo-vis-backend/tests/fixtures/events-batch-sieve.cpp`。

#### 直接使用實際迴圈值

不必手動指定範圍，以下兩種寫法都使用指定變數在每次**進入本體**時的實際值：

```cpp
// @frame source,target
// @arrow for j from source[j].bottom to target[j].top
for(int j=0;j<n;j++){ /* 演算法 */ }
```

`for j` 在同一區塊及包住此幀的迴圈中尋找使用 `j` 的候選；只有一個時才自動對應。
若上下兩個迴圈都使用 `j`，會報歧義錯誤，使用 `@loop as` 命名並明確指名：

```cpp
// @frame isprime[i],prime when i > 7
// @events animate off
// @arrow for j in "sieve_loop"
//   from prime[j].bottom to isprime[i*prime[j]].top
//   as "sieve_links" when i*prime[j] <= n
// @loop as "sieve_loop"
for(int j=0;j<prime.size();j++){
  if(i*prime[j]>n) break;
  isprime[i*prime[j]]=0;
  // 詳細幀可在這裡加上 when i<=7
  if(i%prime[j]==0) break;
}
```

- `@loop as "名稱"` 必須緊接在 `for`、`while` 或 `do` 之前，名稱不可重複。
- 幀可放在迴圈前、本體內或迴圈後：前面引用接下來的執行回合，後面引用剛結束的回合；外層迴圈與函式／遞迴呼叫分開對應，不合併其他回合。
- trace 完成後才展開箭頭，演算法只執行一次。額外紀錄是內部入口資料，不是可播放事件，也不產生自動摘要。
- `for`／`while` 最後一次條件為假不記值；`do while` 至少記第一次入口。`break` 所在的入口會保留，`continue` 也不丟失入口。
- 保留重複值；子箭頭 ID 使用實際回合與入口序號，因此同一個 `j` 值出現多次不衝突。不是推算連續整數區間。
- 變數必須在本體入口可見，且入口值須為安全整數。本體裡才宣告的變數無法使用；空迴圈展開零支箭頭。
- 幀需位於該迴圈相同的外層回合中；無法對應目前回合時明確報錯。端點与條件除繪圖索引外，仍使用幀當下的狀態。
- 每條指令仍限制 2048 個候選，沿用條件、preset、多行與共用箭頭模型。

可執行線篩範例：`algo-vis-backend/tests/fixtures/loop-batch-sieve.cpp`，將 i>7 的濃縮幀放在內層迴圈前。

#### 共用繪圖迴圈：@for／@endfor

讓同一幀的 `@style`、`@arrow`、`@text` 共用繪圖索引，不需每條指令各自對應迴圈：

```cpp
// @frame use sieve_view_i,camera when i>7
// @events animate off
// @for j in "sieve_loop"
//   @style prime[j] highlight when i*prime[j]<=n
//   @style isprime[i*prime[j]] background AV_green when i*prime[j]<=n
//   @arrow from prime[j].bottom to isprime[i*prime[j]].top
//     as "links" when i*prime[j]<=n
//   @text "j=${j}" at prime[j].bottom offset(0,20) when i*prime[j]<=n
// @endfor
// @loop as "sieve_loop"
for(int j=0;j<prime.size();j++){ /* 原本的演算法 */ }
```

- 三種開頭：`@for j` 自動對應唯一迴圈；`@for j in "名稱"` 具名對應；`@for k in [start:end] [step expression]` 手動範圍。沿用前／內／後引用與實際入口值規則。
- 區塊附屬上方的幀，只接受連續的 `//` 繪圖指令及說明註解，不可穿插 C++、`@frame`、`@events`、`@keep`、`@camera` 等其他指令。用 `@endfor` 結束，不接受參數；缺少或多餘結束指令會報錯。
- 可以放在 preset／defaults；也可巢狀使用不同索引，內層手動範圍可讀取外層索引。不可重複索引名稱，`value`／`index` 保留給樣式條件；區塊外不保留繪圖索引。
- `@style` 的單點／範圍選擇器與條件、`@text` 的運算式／條件／格子定位、`@arrow` 的端點／條件都能使用索引。其餘變數讀取本幀狀態；區塊文字條件不套用先前 compare 事件的快照。
- 重複入口可產生多個不同 ID 的箭頭／文字；樣式對相同格子合併，沿用既有覆寫順序。重載仍保留區塊描述與相同子 ID。
- 不新增幀、不更改 C++ 變數、不重跑演算法。只有實際迴圈引用才使用內部入口紀錄；純手動範圍不插入 LoopScope。
- 每條指令的巢狀組合限制 2048 個候選，不截斷；區塊內另用 `@arrow for` 時也受組合限制，請使用不同索引並縮小範圍。空範圍／空迴圈產生零個子指令。

完整範例：`algo-vis-backend/tests/fixtures/drawing-loop-sieve.cpp`。

`@arrow` 把兩個語意目標連起來，並附屬到它上方最近的 `@frame`。它和 Trace Studio 箭頭、遞迴 layout 自動箭頭共用 Arrow Model，實際線段邊距與箭頭頭部沿用原本 `drawArrow` 的幾何邏輯。

```cpp
// @frame arr[i,j]
// @arrow from arr[i].bottom to arr[j].top as "compare_link"
```

### 端點與錨點

`from` 和 `to` 都必須指定。每個端點依序解析 C++ 變數、`@keep as` 物件 ID、Trace Studio 自訂物件 ID，最後也可使用 `canvas`。省略錨點時預設為 `center`；也可明寫 `top`、`bottom`、`left`、`right` 等錨點，以及個別 `offset(x,y)`：

```cpp
// @arrow from arr[i].bottom offset(0,8) to saved_heap.top offset(0,-8)
// @arrow from arr[1] to arr[12]  // 兩端都預設指向格子中心
// @arrow from grid[row][col].right to arr[i].left
// @arrow from note.right to canvas.left as "note_link"
```

一維陣列使用 `arr[index]`，二維陣列使用 C++ 習慣的 `grid[row][column]`。兩者都可使用
九個錨點：`top-left`、`top`、`top-right`、`left`、`center`、`right`、`bottom-left`、
`bottom`、`bottom-right`。索引端點會指向實際格子；未寫索引時指向物件外框。若當幀
找不到任一端點，該箭頭不會繪製，也不會把不存在的物件冒充成可見動畫目標。

每個可指向的格子都會向共用 Arrow Model 註冊目標資料，包括穩定 key、顯示標籤、
物件 ID、維度索引與種類。例如 `arr[3]` 的標籤是 `arr[3]`，`grid[1][2]` 的標籤是
`grid[1][2]`。Trace Studio 或之後新增的 renderer 可直接列舉這份目標資料；新的畫法只要
註冊它的可指向節點，不需要在箭頭系統中新增一批物件類型特例。

### 樣式選項

```cpp
// @arrow from arr[i].bottom to arr[j].top as "move_link" color AV_red width 3 head both line curve dash 6,4 when i != j
```

| 修飾詞 | 預設值 | 支援內容 |
| --- | --- | --- |
| `as` | 穩定指令 ID，顯示名稱如 `arrow_1` | 箭頭身分與端點分離；跨不同指令延續時建議明確命名 |
| `color` | `black` | `AV_*`、CSS 色名、Hex、`rgb/rgba/hsl/hsla` |
| `width` | `2` | 大於 0 的線寬 |
| `head` | `end` | `start`、`end`、`both`、`none` |
| `line` | `straight` | `straight`、`curve` |
| `dash` | 無 | 例如 `6,4` |
| `when` | 無 | 條件為真才顯示；請放在整條指令最後 |

同 ID 的箭頭可由播放層穩定對應；layout 自動產生的父子箭頭預設使用 AV.hpp／`drawArrow` 的黑色、線寬與單向箭頭樣式，不需要另外撰寫 `@arrow`。

跨幀延續可寫相同 `as`，端點則每幀重新求值：

```cpp
// 第一幀
// @arrow from arr[i] to arr[j] as "compare_arrow" color AV_red width 2
// 下一幀：同一支箭頭改綁另一格，不重播入場
// @arrow from arr[i] to arr[j+1] as "compare_arrow" color AV_green width 3
```

未寫 `as` 時，內部 ID 依穩定指令身分產生，不隨空白行或 `when` 隱藏而重新編號；preset 內的指令也保有自己的身分。相鄰幀使用不同指令時，只在端點物件、箭頭種類相容且雙方都只有一個候選時自動配對；多支箭頭有歧義就不猜測，請用 `as`。同一幀重複 ID 會報錯，不會合併。

先套用既有設定優先順序：當幀同名指令可覆寫 preset，後面的 preset 可覆寫前面的同名預設；這種覆寫只產生一支箭頭，不是 ID 衝突。同一層級的當幀指令重複 ID 才會報錯。

改綁端點時，以幀轉場時間平滑移到新端點，顏色與線寬一起過渡；端點綁定未變時，直接跟隨格子當下 SVG 位置，不另外延遲補間。退場／入場只用於未配對的箭頭，Studio 拖曳維持即時。遞迴的自動箭頭區分每次呼叫；明確相同 `as` 才能跨呼叫接續。舊 trace 若沒有新版身分資訊仍可讀取，重新 RUN 後取得新的自動配對資訊。

## `@place`：放置同幀物件

`@place` 將最近一個 `@frame` 已經顯示的來源物件，綁到另一個物件的語意錨點。它只改變位置，不會建立 keep 快照，也不會把來源加入 recursion layout 的父子節點。

```cpp
// @frame arr[i],pivot with range(low,high) in quick_tree
// @place pivot at arr.right
// @place pivot.left at arr.right offset(16,0)
```

第一種寫法會依目標方向自動選擇相對的來源錨點，因此 `at arr.right` 會以 `pivot.left` 貼向 `arr.right`，兩者預設保留 8px 間距。第二種寫法明確指定來源錨點，使用外框對外框的精確定位；`offset(16,0)` 代表兩個外框相距 16px，不再額外加 8px。

若要將兩個陣列上下排列，讓外框左界對齊、外框間距為 60px：

```cpp
// @frame
// @object isprime with range(0,n-1), columns(10), labels(index)
// @object prime with columns(10), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
```

完整格式：

```text
// @place SOURCE[.ANCHOR] at TARGET.ANCHOR [offset(X,Y)] [when CONDITION]
```

- `SOURCE` 必須是前一個 `@frame` 已顯示的 C++ 物件，或可解析的 keep／Trace Studio 物件 ID。
- `TARGET` 依序解析 C++ 變數、keep ID、Trace Studio ID 與 `canvas`；亦可定位到 `arr[i].right` 之類的格子錨點。
- `ANCHOR` 支援 `top-left`、`top`、`top-right`、`left`、`center`、`right`、`bottom-left`、`bottom`、`bottom-right`。
- `when` 為假時只略過該位置綁定，不會隱藏來源物件。
- Trace Studio 的明確位置／綁定仍具有較高優先權。

多物件的 `@frame arr[i],pivot ... in quick_tree` 只以第一個主要物件 `arr` 代表遞迴節點；`i` 是 `arr` 的指標，`pivot` 是可由 `@place` 獨立安排的次要物件。

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

若主物件沒有 `at`、Trace Studio 自訂位置／綁定或具名 layout，系統預設將它視為：

```cpp
// @frame arr at canvas.top offset(0,80)
```

因此主物件會水平置中在畫布頂部基準；同一幀其餘自動排列物件仍保留原本相對間距。任何明確定位都優先於此預設值。

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
| `iteration.last(name)` | 目前函式／遞迴執行個體中，對應變數這次生命週期最後實際走到的值 |

範例：

```cpp
// @text "i 從 ${prev(i)} 變成 ${i}" at arr.bottom when changed(i)
// @style arr[i] highlight AV_yellow when assigned(arr[i])
// @text "交換前是 ${before(arr[i])}" at arr.bottom when changed(arr[i])
```

`iteration.last(name)` 是播放前由完整 trace 建立的繪圖衍生值，不會重新 RUN、產生事件、建立畫布物件或修改 C++ 狀態。若目前幀位於區域變數宣告之前，系統會使用同一函式／遞迴執行個體中緊接著的那次生命週期；進入變數作用域後則固定使用當次生命週期，避免下一輪同名變數互相污染。

例如線性篩在進入內層迴圈前，尚不知道 `j` 最後走到哪裡，但仍可標出本輪實際能相乘的 `prime` 區段：

```cpp
// @style prime[0:iteration.last(j)] focus when i * value <= n
```

`iteration.last(j)` 包含實際執行過的最後一次 `j`；搭配 `i * value <= n` 可排除只用來觸發乘積越界 `break` 的最後一格。

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
- 若承載 swap 的陣列／資料結構在前後幀之間同時改變畫布位置，會先完成整個物件的位置補間，再開始第一個 swap；格子的交換軌跡只處理物件內部的相對位移。
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
- 遞迴變數使用 runtime identity 區分不同呼叫；只有相同函式、相同宣告位置、父子／祖先遞迴關係且連續顯示的視覺角色才接續，不重播入場。外層同名變數及兄弟呼叫不按名稱接續。

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

### `@events`：每幀事件動畫控制

```cpp
// @frame arr
// @events animate off

// @frame arr
// @events compare,read animate off when i > 7
// @events write animate on when i <= 7
```

語法為 `@events [種類列表] animate on|off [when 條件]`。省略種類等同 `all`。
支援 `declare`、`scope-exit`、`visual-exit`、`read`、`write`、`assign`、
`sequence-operation`、`compare`、`swap`、`fixed`、`call`、`function-enter`、
`function-exit`。內部 `condition` 不提供控制，`all animate on` 也不開啟它。

規則只附屬上方最近的 `@frame`，影響該幀所涵蓋的事件，**不是從此切換全域播放模式**。
略過詳細幀而累積到此幀的事件，也在此幀套用規則。`when` 使用該幀擷取的狀態求值，
不成立保持原設定；若需要事件發生當下的條件，應在對應位置擷取另一幀。
条件無法解析會報錯，不默認通過或關閉。

`off` 不刪除事件、執行資料或修改演算法結果；只是直接呈現結果，不排該類事件動畫。
框架的換幀、版面、鏡頭及使用者箭頭呈現仍沿用原設定。`fixed` 關閉時該幀不顯示自動固定標記。

支援 `@preset`／`@defaults`：預設先套用，再由所用 preset 由左至右套用，最後套用當幀規則。
同一事件以最後符合條件的規則為準，來源指令優先於 Studio 已保存的事件開關。
Studio 對受來源控制的事件標示 `@events` 原因並停用直接切換；修改來源指令後 RUN。
未寫 `@events` 的幀維持原本事件設定與操作。

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
| 呼叫函式 `call` | 呼叫片段塗灰，不移動畫布物件 | 關閉 |
| 進入／離開函式 | 無 | 關閉 |

「呼叫函式」依實際執行順序，在呼叫發生時將該段程式碼塗灰，並保留灰色痕跡；
不播放黃色提示、放大、位移或入退場動畫。可從事件設定或 Studio 呼叫按鈕關閉，
關閉後不塗灰；保留原本預設關閉與已儲存的設定，Studio 右欄仍提供呼叫按鈕。

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

遞迴往深處或返回上層時，仍連續顯示的同一宣告角色保留在畫布上：宣告事件仍留在事件欄，
但不重新淡入；指標在對應事件時更新位置，一般數值仍依事件提交更新。返回時恢復父層資料，
不修改各層 runtime identity 或 C++ 狀態。自然作用域退場若只是交接這個角色，不另畫舊角色退場殘影；
真正消失的角色照常退場。`@exit` 與 `@keep` 分界優先，不會被遞迴接續略過。

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

程式碼內容能放進顯示區時，完整顯示，不為了對齊事件而向上捲動；內容過長才捲到事件位置，且捲動終點限制在內容上下界，避免函式頭被不必要地裁切或尾端出現空白。

程式碼面板不以固定行數截取，而是使用 C++ 語法樹與當幀實際事件決定內容：

- 當事件位於 `main` 以外的函式時，會顯示該函式的完整內容（函式宣告、本體與結尾括號）；一般註解與所有繪圖指令仍不顯示。同一函式內的不同幀使用同一份函式版面。
- 只為保留函式／遞迴呼叫上下文的片段，僅顯示呼叫所在行（多行呼叫保留完整呼叫範圍），不展開呼叫者的宣告、迴圈或結尾括號；若同一函式也有實際執行事件，仍合併為完整函式，不重複顯示呼叫行。

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

### 在 Trace Studio 調整文字大小

選取文字物件外框後，在右側「物件與樣式 → 文字大小」拖曳滑桿，可等比例調整整個文字框。
選取文字內的片段時，則使用片段的字體與格式控制。拖曳時即時預覽，放開後儲存；
同一幀重畫不會取消文字物件或片段的選取，也不會因此關閉物件設定面板。
切換到不含該文字物件／片段的幀時，才會清除該選取。

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

匯入投影片時，即使 C++ 指令分析或執行失敗，也會保留原始碼、輸入及編輯設定，不中止整份匯入。請開啟該張「編輯演算法動畫」，修正後再 RUN；未修正前仍可儲存並重新開啟。這不表示錯誤語法已被接受，也不會以空畫布當成成功動畫。

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

## 文件維護規則

之後每次新增或調整視覺化語法，至少同步更新：

1. 本手冊的「語法支援總表」。
2. 對應指令章節與一個最小範例。
3. 受影響 renderer 或演算法的完整案例。
4. 常見限制或相容性說明。
5. 最後核對日期、commit 與下方更新紀錄。
6. 自動測試，確保文件中的關鍵語法確實可解析。

### 更新紀錄

自動儲存與匯出不同：自動儲存保留完整可播放結果，以 `traceRef` 共用相同內容；每張投影片的 Studio 設定仍獨立保存。重開不需要 RUN，亦不會改變任何繪圖指令的意義。`.asmdeck` 仍只匯出精簡可重建資料。

| 日期 | 基準 | 內容 |
| --- | --- | --- |
| 2026/09/16 | `AV_V4.7` | 整理多行物件、preset、camera、arrow、iteration 摘要與 `.asmdeck` 使用說明；補充文字物件大小與片段格式的分工，以及同幀預覽保留選取的操作規則。 |
| 2026/09/14 | 工作樹 | 新增 `@place` 同幀物件定位；多物件 recursion frame 僅由第一個主要物件建立節點，次要物件可用來源／目標錨點獨立貼附。 |
| 2026/09/13 | 工作樹 | `@frame ... in` 可將 keep 前的 live 物件綁定到目前遞迴節點；父子箭頭改用實際 outerframe 錨點並對齊 `AV.hpp` 的黑色 2px 樣式。 |
| 2026/09/12 | 工作樹 | 實作具名 `@layout recursion`、明確目標設定與 `@keep ... in`；加入遞迴 activation 父子 identity、四向生長、六種樹排列、真實 SVG 外框間距及父子箭頭。 |
| 2026/09/12 | `AV_V4.6` | 播放層完成正向事件 checkpoint、生命週期與指標排程；`@keep` 快照改為接手來源 live 物件的實測幾何與可見狀態，不再觸發一般退場、額外淡入或殘影。投影片 iframe 會等可見 viewport 後重新基準化目前幀，修正首次下一步的子格錯誤起點。 |
| 2026/09/12 | `AV_V4.6` | 補齊 AST 程式碼片段、Trace Studio 巢狀事件結構、動畫除錯記錄、儲存正規化、JWT 設定檢查，以及三介面播放／儲存一致性回歸案例。 |
| 2026/09/10 | 工作樹 | 陣列生命週期統一改為原地淡入／淡出；跨幀新增、作用域退場與一般移除皆不再套用上下位移。 |
| 2026/09/10 | 工作樹 | `@keep` 保留來源排版高度、Studio 位置與綁定；新增不搭配 `at` 的 `offset` 原位微調。事件播放改為程式碼先提示 400 ms、物件再回應；提示起點與視覺起點納入共用播放排程及動畫除錯記錄。 |
| 2026/09/10 | 工作樹 | `@keep` 支援目前值 `when`；緊接 keep 的自然 scope-exit 會安全地提前到快照與場景移動之前；新增 `@exit` 手動視覺退場指令。 |
| 2026/09/08 | 工作樹 | `int i = 0` 拆分宣告與初始化；缺少畫布變數的 `for` 比較標黃；完整 condition 改為無 UI、無時間的內部著色資料；三行內的 false 分支仍完整呈現。 |
| 2026/09/07 | 工作樹 | 程式碼片段改用最外層控制子樹；首幀反查初始化；複合條件依短路順序逐段高亮，完成後整段連續保留真／假色。 |
| 2026/09/07 | `fe5782c` | 建立第一版手冊；整理 `@frame`、`@keep`、`@text`、`@style`、`@segment`、所有修飾詞、renderer、條件、事件及六類案例。 |
