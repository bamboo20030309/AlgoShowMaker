# AlgoShowMaker

AlgoShowMaker 是以 C++ 程式執行結果為核心的演算法視覺化與投影片製作工具。使用者可以在原始碼中加入少量註解指令，將變數、資料結構、程式事件、鏡頭、文字與 TTS 整理成可播放、可編輯的動畫，再嵌入投影片。

- 預設介面與文件語言：繁體中文
- 目前開發基準：AV_V4.7，持續開發中
- 專案首頁：[GitHub](https://github.com/bamboo20030309/AlgoShowMaker)
- 最後整理日期：2026/09/17

## 版本日誌

### AV_V4.7 開發更新 — 2026/09/18

- 新增 `@events [種類列表] animate on/off [when 條件]`，可在使用者自行編寫的濃縮幀略過事件動畫，保留計算結果與 trace 記錄。
- `@arrow for k in [start:end] [step expression] from ... to ...` 支援單行／多行批次繪圖；`for j` 或 `for j in "loop_name"` 直接使用實際迴圈入口值，支援 `@loop as` 命名、for／while／do while、迴圈前後引用與重複值。語法與線篩案例見[使用手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)。
- `@for ... @endfor` 讓同幀的 style、arrow、text 共用實際迴圈值或手動範圍；支援 preset、巢狀不同索引與條件，不重跑演算法或新增幀。

### AV_V4.7 — 2026/09/16

- 新增多行 `@frame`／`@object`、`@place`、共用 `@arrow`、`@camera`、多個 `use` preset 與 `iteration.last(...)` 繪圖衍生值；完整語法與案例見使用手冊。
- 投影片新匯出使用精簡壓縮 `.asmdeck`，包含原始碼、輸入、編輯設定與去重素材，不包含可重建的 trace 結果；匯入優先使用本地快取，未命中才 RUN，舊 JSON 仍可匯入。
- 箭頭以穩定指令身分或 `as "ID"` 跨幀接續；改綁端點時位置、顏色與線寬平滑過渡，端點物件移動時即時跟隨。歧義配對不猜測，同幀重複 ID 報錯。
- 最左側模式／匯入匯出工具欄提供「調整投影片順序」圖示按鈕，切換至可拖曳排序的總覽；再按返回所選投影片。Esc 仍可切換，排序沿用既有自動儲存。
- 移除動畫快取設定／清除入口，既有快取與投影片資料保留。
- 修正相同投影片／元件 ID 的 JSON 匯入及 undo／redo 未刷新 LaTeX 內容；原地更新會先重建最新公式來源，再重新渲染，不需重新整理頁面。
- 完善手機介面與原生程式碼輸入、空陣列／未初始化數值、外框補間、索引標籤與背景色同步，以及 style／箭頭／指標的獨立呈現層。
- 修正 heap 指標賦值位移時間不足、keep 箭頭重播入退場，以及拖曳文字大小時整個文字物件誤取消選取的問題。
- 發布前自動檢查與瀏覽器驗收各自記錄；自動測試通過不等於所有介面與動畫均已目視驗收。

### AV_V4.6 — 2026/09/12

- 播放層改用正向事件 checkpoint：依 runtime `order` 提交宣告、賦值、交換、指標移動與退場，關閉事件仍正確提交狀態，避免後段結果提前污染前段動畫。
- 補齊變數生命週期、迴圈標頭與邊界事件、指標入退場／讓位、未初始化空格、文字與陣列淡入淡出，以及程式碼先提示、視覺物件再回應的排程。
- `@keep` 新增 `when`、`at`、原位 `offset`、style 保存、穩定命名、虛擬 `keep` 聯集與獨立快照 identity；快照交接改為接手來源物件的實測位置，不再套用一般物件退場或額外淡入殘影。
- 新增具名 `@layout recursion` 與 `@keep ... in`：可依實際遞迴 activation 自動建立父子樹，支援四向生長、六種樹排列、間距、對齊、分支度與父子箭頭設定。
- 程式碼片段改由 C++ AST 擷取，支援 ACE C++ 著色、事件片段背景高亮、複合條件短路結果、平滑捲動、拖曳與字級設定；Trace Studio 右欄改為黑底巢狀事件程式碼結構。
- 演算法編輯器、Trace Studio、投影片編輯器與投影片播放共用相同 trace／renderer／tween 設定；投影片內嵌播放器會等實際 viewport 幾何可用後重新基準化目前幀，修正首次下一步格子由外框左上角擠出的問題。
- 新增瀏覽器動畫除錯記錄、投影片儲存正規化、JWT secret 啟動檢查、GitHub 入口，以及冒泡、插入、heap、播放一致性與儲存再開啟等回歸案例。

### AV_V4.5 — 2026/08/20

- 發布追蹤語法與動畫系統更新，建立 `@frame`、`@keep`、事件順序、跨幀動畫、Trace Studio 與演算法投影片的共同基準。

## 主要介面

啟動後可使用下列入口：

| 介面 | 網址 | 用途 |
| --- | --- | --- |
| 首頁 | <http://localhost:3000/> | 登入、專案入口與功能導覽 |
| 演算法編輯器 | <http://localhost:3000/algorithm.html?asmEmbed=editor> | 編寫 C++、輸入測資、RUN 與預覽動畫 |
| Trace Studio | 從演算法編輯器開啟 | 編輯逐幀事件、物件、鏡頭、轉場與縮圖 |
| 投影片編輯器 | <http://localhost:3000/slides.html> | 編輯一般投影片並嵌入演算法動畫 |

演算法編輯器、Trace Studio 和演算法投影片共用相同的追蹤資料與播放規則。修改跨幀動畫、事件、鏡頭或儲存格式時，三個介面都必須維持一致。

登入後「我的投影片」可新增單層資料夾。拖曳縮圖或縮圖下方的拖曳把手至另一張縮圖前方可排序，拖到資料夾標題列或空白區可放入該資料夾；也可用分類複選視窗與前後按鈕整理。同一份投影片可屬於多個分類，各分類內排序獨立；拖曳只搬移目前分類中的項目，保留其他分類，拖至未分類則清除所有分類。資料夾和順序儲存於帳號，未分類會收納新增的檔案；移除資料夾會保留檔案的其他分類，沒有其他分類時才移回未分類，不會刪除投影片。範例頁面與個人工作區的資料夾皆以橫線分隔，點標題可展開或收合，點分類導覽可移至該區塊。

#公開範例目錄 public/guest-decks.json 可使用 categories 陣列設定多個演算法分類，同一案例會出現在對應區塊；既有 category 字串仍相容，總份數依案例數計算。

## 手機介面

- 寬度不超過 760px，或窄螢幕觸控裝置不超過 900px 時，會啟用獨立手機介面；桌面版配置不受影響。
- 演算法頁以畫布與精簡播放列為主，程式碼、輸入、輸出、語法樹、範例、動畫編輯和事件設定透過底部工作列切換。
- 手機版 C++ 編輯器在 ACE 上方使用同步的原生文字輸入層，讓 iOS／Android（包含內建 WebView）可長按選取、複製、剪下與貼上；內容即時寫回 ACE 與本機草稿，桌面版 ACE 操作維持不變。
- Trace Studio 在手機上改為單一畫布，幀列表與屬性檢查器使用全寬抽屜，不再強行顯示三欄。
- 投影片頁預設收起控制欄與元件欄；「元件」和「控制」由底部工作列開啟為 bottom sheet，播放模式仍由 Reveal.js 保持固定 1280×720 邏輯畫布並自動縮放。
- 所有手機按鈕至少保留約 40–44px 觸控範圍，並使用 `100dvh` 與 safe-area 避免瀏覽器網址列和 iPhone 底部區域遮住操作。

## 快速啟動

### 1. 安裝環境

需要：

- Node.js 與 npm
- 可使用的 C++ 編譯器
- MongoDB

進入後端並安裝依賴：

```powershell
cd algo-vis-backend
npm install
```

### 2. 設定環境變數

在 `algo-vis-backend/.env` 設定至少以下內容：

```dotenv
PORT=3000
MONGO_URI=mongodb://localhost:27017/algo_vis_db
JWT_SECRET=請替換成不可公開且足夠長的隨機密鑰
```

`JWT_SECRET` 沒有公開的固定預設值。缺少、仍使用範例值或公開值時，伺服器會拒絕啟動；建議使用至少 32 bytes 的隨機密鑰，例如：

```bash
openssl rand -base64 32
```

登入郵件、Docker 與正式環境設定請參考 [伺服器架設與維護手冊](SETUP_GUIDE.md)。`.env`、JWT secret、SMTP 密碼及其他憑證不得提交到 Git。

### 3. 啟動伺服器

```powershell
cd algo-vis-backend
npm start
```

預設網址為 <http://localhost:3000/>。

## 五分鐘建立一段動畫

目前建議使用註解式追蹤語法。這個入口不需要引入 `AV.hpp`，也不需要呼叫 `av.start_draw()` 或 `av.end_draw()`。

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int &value : arr) cin >> value;

    // @frame arr
    // @text "Bubble Sort（冒泡排序）" at arr.top

    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
            }

            // @frame arr[j,j+1] as bubble_step
            // @style arr[0:j] background AV_green when value < arr[j+1]
            // @text "比較第 ${j} 與 ${j+1} 格" at arr.bottom
        }

        // @keep last
    }

    return 0;
}
```

範例輸入：

```text
5
5 2 4 1 3
```

將程式與輸入貼入演算法編輯器並按下 RUN，即可產生逐幀動畫、事件時間線與 Trace Studio 資料。

## 視覺化指令速查

| 指令 | 用途 | 範例 |
| --- | --- | --- |
| `@frame` | 擷取執行狀態並建立一幀 | `// @frame arr[i,j],key` |
| `@preset`／`@frame use` | 壓縮並重用整組幀繪圖設定 | `// @frame use sieve_view, sieve_colors` |
| `@defaults`／`@enddefaults` | 每幀自動套用呈現預設，仍可由 preset 與當幀指令覆寫 | 區塊內寫 `// @camera auto` |
| `@keep` | 依條件保留變數或上一幀畫面 | `// @keep last as round when i > 0` |
| `@layout` | 宣告並設定具名遞迴排版 | `// @layout recursion as "quick_tree" at canvas.top offset(0,80)` |
| `@exit` | 提早讓指定變數的視覺呈現退場 | `// @exit min_idx` |
| `@text` | 顯示動態說明文字與 TTS | `// @text "i = ${i}" at arr.bottom when i >= 0` |
| `@style` | 套用背景、框線、point、mark 或 focus；逗號可組合樣式 | `// @style arr[i,i*2:i*2+1] highlight,point red` |
| `@segment` | 標示一段連續範圍 | `// @segment arr[low:high]` |
| `@place` | 將同幀已顯示物件綁到語意錨點 | `// @place pivot at arr.right offset(16,0)` |
| `@arrow` | 以語意錨點連接格子、變數、keep 或 Studio 物件 | `// @arrow from arr[i].bottom to arr[j].top as "move"` |
| `@camera` | 為目前幀設定自動鏡頭或相對目標 | `// @camera focus arr[i] zoom(1.6)` |

常用修飾詞：

- `as`：指定穩定 ID。
- `at`：定位到 C++ 變數、`@keep as` ID、Trace Studio 自訂物件或 `canvas`。
- `offset(x,y)`：在語意定位後加入像素位移。
- `when`：依目前或跨幀條件決定是否顯示。
- `render`：切換資料結構畫法，例如 `render heap`。
- `with`：傳入 `range(...)`、`columns(...)`、`labels(...)` 等 renderer 選項。
- `without style`：讓 `@keep` 保留資料但不保存當下樣式。
- `in`：把 live `@frame` 或 `@keep` 快照加入已宣告的具名排版，例如 `@frame arr in quick_tree`、`@keep last in quick_tree`。

`@preset` 會原樣保存所有 `@` 設定，並由各指令解析器在 `@frame use` 的位置展開；目前包含
`@object`、`@place`、`@style`、`@segment`、`@text`、`@arrow`、`@camera`。它只壓縮幀設定，
不主動執行 `@keep`、`@exit`、`@frame` 等流程動作；這些仍寫在實際執行位置。

箭頭使用共用 Arrow Model；`@arrow`、Trace Studio 箭頭及遞迴 layout 箭頭共享同一套端點、邊距、箭頭頭部與顏色邏輯，底層沿用原本 `drawArrow` 的幾何比例。完整選項請參考[演算法視覺化指令使用手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md#arrow連接視覺物件)。

條件支援 `&&`、`||`、`and`、`or`，以及 `previous(...)`、`changed(...)` 等跨幀判斷。繪圖運算式也可使用 `iteration.last(j)`，從已完成的 trace 取得目前函式／遞迴執行個體中，這次 `j` 生命週期最後走到的值；它不會產生事件、物件或重新執行 C++。`@style` 可混合單點與區間，例如：

```cpp
// @style arr[i,i*2:i*2+1] highlight red
// @style arr[1:i-1,n:n] focus
// @style prime[0:iteration.last(j)] focus when i * value <= n
```

`@keep as` 第一次使用名稱時不加編號；重複名稱依序使用 `_1`、`_2`。所有 keep 物件的外框可透過虛擬聯集 `keep.top`、`keep.bottom` 等錨點定位。keep 預設保留來源的相對定位、Studio 位置／綁定與自動排版高度；所有未手動定位的 keep 列，預設垂直間距為 50px。明確的 `offset` 或 Studio 拖曳位置仍優先。若只想從原位置調整，可寫 `// @keep last offset(0,-24)`，正 Y 向下、負 Y 向上。

遞迴分裂畫面可先宣告具名排版，再把每次遞迴要留下的快照加入該排版：

```cpp
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree direction top-down

// 寫在遞迴函式內
// @frame arr in quick_tree
// @keep last as "partition" in quick_tree
```

`@frame ... in quick_tree` 會先把尚未 keep 的目前 `arr` 綁到這次遞迴 activation 的節點位置；隨後的 `@keep ... in quick_tree` 會在相同位置接手。未另外設定時採 `compact`、`top-down`、置中、兄弟間距 40px、層級間距 100px、二分支，以及與 `AV.hpp` 樹排版一致的黑色 2px 父子箭頭。預設箭頭由父節點 `bottom` 指向子節點實際 outerframe 的 `top`。每條設定都必須明確寫出排版 ID，例如 `// @layout quick_tree mode inorder`，避免設定誤套到其他排版。

同一個 `@frame` 顯示多個物件時，只有第一個主要物件會成為 recursion layout 節點。例如 `// @frame arr[i],pivot with range(low,high) in quick_tree` 由 `arr` 代表該節點，`i` 是附著在陣列上的指標，`pivot` 是獨立物件。可在下一行寫 `// @place pivot at arr.right offset(16,0)`，把 `pivot` 左側貼到 `arr` 右側；若要明確指定來源錨點可寫 `// @place pivot.left at arr.right offset(16,0)`。

完整語法、條件、定位、renderer 選項、冒泡／插入／快速／堆積排序案例與常見錯誤，請閱讀 [演算法視覺化指令使用手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)。

## 追蹤與播放流程

```text
C++ 原始碼
  → Lezer C++ AST
  → trace-instrumenter.js 插入追蹤程式
  → ASMTrace.hpp 捕捉狀態與事件
  → trace-model.js 建立 frames、state、events、bindings
  → trace-renderer.js 繪製 SVG 與資料結構
  → trace-frame-tween.js 排程幀間動畫與事件時間線
  → trace-player.js 統一上一步、下一步與自動播放
  → trace-studio.js 提供跨幀編輯並寫回 @asm-view
```

重要播放原則：

- 事件依實際執行順序逐一播放，前一事件完成後才開始下一事件。
- 共用播放層會為每幀建立正向重播 checkpoint：從第一筆事件的 `before` 狀態開始，依 runtime `order` 將 assign、write、swap、宣告與退場提交到各自的 `commitMs`，不再從幀最終 DOM 倒推早期畫面。指標位置與格子數值共用這份 checkpoint；除錯記錄也會保存同一份狀態轉移表。
- 關閉或缺少動畫目標的事件仍保留 runtime 狀態變化，但以零動畫時間在原執行順序提交；關閉的宣告／退場直接呈現其完成狀態。被關閉的迴圈邊界則是 `ignored`，完全不進入播放或後續邏輯狀態。
- swap 的邏輯格子與承載數值的視覺節點分開追蹤：數值會跟著節點移動，不會在交換前後被目的格 ID 重寫。宣告初始化會先播放物件入場，初始化值直到配對的賦值 checkpoint 才出現；尚未取得索引值的新指標則先加入物件左側的 unresolved 群組並觸發既有指標讓位，再於賦值事件移到實際索引。
- 未使用 `at`、Trace Studio 位置或 layout 的主物件，預設以 `canvas.top offset(0,80)` 為放置基準；同一幀的其他自動排列物件會保留原本相對間距。若 swap 所在物件在幀間改變位置，播放層會先完成物件位置補間，再依 runtime order 播放交換，避免格子一邊換畫布位置一邊交換。
- 尚未賦值的 scalar 仍會建立物件外框，但格子內容保持空白，不讀取未初始化的 C++ 記憶體；一般賦值、`++`／`--` 或 `cin >> variable` 後才顯示實際值。
- 每個已開啟、可呈現且具有原始碼範圍的事件，會先高亮對應程式碼 400 ms，再開始物件動畫；程式碼提示與物件回應屬於同一筆正式排程。沒有程式碼範圍的事件不額外等待，關閉或無法播放的事件不占提示時間。
- 按下下一步時，上一幀不再使用的文字會立即在原位淡出，不等待程式碼跳轉、keep 或版面移動完成；新一幀文字仍依自己的呈現階段淡入。
- 自動播放會等待幀間動畫、事件動畫與 TTS。
- 新增 `@keep` 快照時，播放層會把來源 live 物件的實測幾何與完整可見狀態交接給快照；快照由來源位置移到 keep 位置，不套用一般物件退場、由下往上或額外淡入動畫。新的 live 物件與鏡頭在版面階段移到新構圖，全部就位後才開始指標入場與一般事件動畫。
- 程式碼片段在普通播放與 Trace Studio 都能選取並從空白處拖曳；Studio 選取後會切到「物件 → 程式碼片段」，可直接調整字體大小，位置與字體設定會隨 `@asm-view` 儲存。
- 程式碼片段會依實際畫布的 1600×900 基準等比例縮放；在 Studio 點選片段會切到字體設定，程式文字可選取，從片段空白處仍可拖曳位置。選取狀態與一般畫布物件共用：點畫布空白、改選其他物件或離開 Studio 都會清除程式碼片段的選取框。
- compare、assign、swap 使用事件發生當下的快照，不提前顯示結果。
- 宣告初始式（例如 `int i = 0`）會拆成「宣告 `int i`」與「賦值 `i = 0`」；若 `i` 被畫成指標，它會直接在初始化後的目標格入場，不先停在 unresolved 區，也不顯示賦值框。傳統 `for` 的初始化賦值和 `++`／`--` 一樣只排程指標位置。條件比較會在每次判斷時產生。這些 `for` 標頭事件會固定保留在 Trace Studio 右側事件欄；完整條件結果僅作為程式碼真／假著色資料，不顯示成事件，也沒有事件設定開關。系統會另外辨識終止條件前最後一次 `i++`／`j++` 為「迴圈邊界事件」；專用開關預設關閉，關閉時播放、事件表、事件線、終止條件的程式碼高亮與指標狀態都視為沒有這次更新。開啟後若 `j+1` 超出最後一格，指標仍會停在陣列右側的外推位置。
- 投影片內的 trace 若使用舊追蹤引擎產生，開啟「編輯演算法動畫」時會以已儲存的程式碼與輸入自動重新 RUN，並依原始碼選擇器將鏡頭、物件、位置與事件開關映射到新幀；投影片播放介面不會在背景自行編譯。
- `@keep last` 保存指令發生前已完成的完整畫面狀態，包括最後一個可見幀之後、keep 之前完成的賦值與交換；已離開作用域的指標或物件及其綁定不會進入快照。若 keep 後緊接自然 `scope-exit` 且中間沒有可觀察事件，播放層會先讓物件退場再保存快照。`@keep ... when` 可依目前值條件決定是否建立快照；條件為假不切換場景。快照使用獨立視覺 identity，下一輪重新宣告同名迴圈變數時，新指標會鎖定目前的 live 陣列，不會綁到快照。
- `@exit min_idx` 會產生可控制的「手動物件退場」事件，只結束該 runtime lifetime 的視覺呈現，不改變 C++ 變數；緊接 `@keep` 時，退場會排在快照建立、keep／live 物件與鏡頭移動之前，而且同一 lifetime 不會再被複製到新 keep 快照中造成退場殘影。同一條多目標指令（例如 `@exit min_idx,i`）會視為一批同步退場，全部完成後 keep 才開始淡入。
- 新指標入場時，既有指標讓位與 220 ms 入場動畫可並行，但兩者都必須完成後才開始本幀事件。
- 「宣告／物件入場」與「作用域結束／物件退場」預設開啟，形成完整的變數生命週期。宣告事件會讓整個物件（包含 scalar 的外框、值與標籤）在更早的同幀事件期間保持隱藏；有初值的 scalar 會先讓外框與空格子淡入，值到配對賦值事件才出現。文字與陣列物件以 220 ms 原地淡入／淡出，指標則從上方往下淡入、退場時往上移動並淡出，其他宣告物件維持原地淡入／淡出。同格指標退場採「先提出、再讓位」：剩餘指標在退場期間維持原位置與斜向箭頭，之後移回中心時箭頭才連續偏轉並始終指向格子中心。區域變數離開區塊、函式或遞迴 activation 時，退場事件會以「`物件名稱` 退場」標示；若目前畫面已包含該 lifetime，就直接讓目前指標退場，不再複製上一幀 ghost，避免迴圈末幀短暫出現兩組相同指標。關閉任一動畫時不占排程時間，直接呈現該事件完成後的結果。
- 宣告與初值寫在同一陳述式（例如 `int i = 0`）且 `i` 被畫成指標時，宣告入場直接發生在索引 0；分開寫成 `int i; i = 0;` 時，才會先在未知區垂直指向暫放位置，再於賦值事件移動。
- 已開啟的退場事件若找不到該 lifetime 的可見物件，會維持黃色「缺少可見動畫目標」，不會因為只有程式碼來源就顯示綠色。
- 函式參數在每次函式或遞迴 activation 進入時只建立一筆宣告／入場事件（例如 `int n;`），不虛構「傳入值賦值」。只有原始碼實際包含初始化式（例如 `int n = 0;`）時，才拆成宣告 `int n` 與賦值 `n = 0` 兩筆事件。
- 事件缺少必要的可見來源或目標時不播放動畫，但 Trace Studio 仍保留事件與可控制性。
- 程式碼來源範圍可讓 `for` 宣告初始式與條件比較保留在右側事件欄，但不能冒充畫布動畫目標；必要純量未顯示時事件標為黃色、預設不播放，也不占事件間隔。
- 同 ID 物件預設自動補間；Trace Studio 手動拖曳時不加入會造成卡頓的動畫。
- 程式碼片段需要切換時，先保留固定 500 ms 的跳轉階段；畫面會以 460 ms 的連續緩動像滾輪一樣平滑捲到新位置，再開始物件、鏡頭與事件動畫。片段未改變時不增加等待。
- 投影片內嵌動畫在收到並套用完整 runtime 資料前保持隱藏；父頁會同步目前投影片的可見狀態，播放器只在 iframe 具有實際 viewport 後量測 SVG，取消殘留 tween 並重新基準化目前幀。父物件套用相對定位後也會更新每個可動畫子格的實測 `bounds`，首個下一步不會再從外框左上角 `(0,0)` 起跑。
- 換幀時，上一幀的 `@text` 會在原位淡出，下一幀新文字會等程式碼跳轉階段結束後於原位淡入；兩者不套用上下位移。

## 程式碼片段與 Trace Studio

- Trace Studio 右側「事件」頁使用獨立的黑底事件結構，不共用畫布程式碼片段的 ACE 版面。函式、`for`、`if`、`while`、`do`、`switch` 依原始 C++ AST 形成直式巢狀群組；函式宣告標頭本身是「進入函式」事件按鈕，開啟後會依執行順序高亮該函式標頭但不虛構畫布物件動畫；其餘事件則是群組內可直接點擊的獨立程式碼列。開啟且可播放時使用綠色背景，缺少可見目標時為黃色，沒有可呈現動畫時為紅色；關閉後恢復深色背景。當前幀包含的指令另以左側藍色光帶標示，播放中的單一事件再加橘色外光。右欄不再顯示容易與指令綁定混淆的「作用時間線」選單；底部事件時間線維持原樣。

- 自動鏡頭只計算 SVG 視覺物件，不替獨立的 HTML 程式碼面板預留左側安全區。遞迴或別名共用陣列仍以 runtime identity 維持動畫連續性，但 DOM 使用穩定的不透明 token，不把陣列內容或原始位址當成物件 ID。
- 宣告兼初始化會拆成相鄰但不重疊的事件列，例如 `for (int i = 0; ... )` 會在 `for` 群組內依序顯示「宣告 `int i`」與「賦值 `i = 0`」，各自控制所綁定指令的所有執行次數。
- 動畫畫布左側會依 C++ 語法樹選取目前相關的程式片段。
- 隱藏區段僅一行時，只在已選取的相關程式碼行之間補齊；片段開頭與結尾不補入無關程式（例如尚未執行的輸出迴圈）。完整迴圈與非 `main` 函式的顯示規則不變。
- 比較動畫的指標跟隨使用該事件前的正向重播索引，包含 `j+1` 等衍生指標；不使用後續 `j--` 或賦值後的整幀最終位置判定抬起對象。
- 條件 style 依目前顯示數值與已提交的變數狀態即時重算，移動中的格子也適用；交換完成前不讀目的地索引或未來數值。value 與其當下位置的 index 格同步塗色，提示元件沿用全域閃爍／跳動節奏。
- 往回切幀時，指令 style 使用目前顯示的目的幀，事件仍按原來源倒播；濃縮幀的批次高亮與 focus 不會被離開幀的樣式覆蓋。
- 共用 @for 的批次箭頭以來源迴圈與入口序號維持繪圖 identity，跨回合可移動至新端點，新增／移除的箭頭保留淡入／淡出。@events animate off 只控制 runtime 事件，仍保留箭頭及 style 的繪圖動畫。
- @text 的純文字與 JSON 片段預設字級統一14px，Studio文字設定同步；來源或Studio明確指定的字級保持原值，氣泡依字形同步計算尺寸。
- @text 支援直接以 `${prime}` 展開整個陣列，或 `${prime[0:iteration.last(j)]}` 展開包含兩端的範圍；JSON文字／TTS及巢狀陣列同樣可用，不需額外編寫C++組字串。
- 修正含style的幀切換時自動固定勾勾消失、開啟編輯動畫才恢復；切幀與靜態繪圖共用累積固定狀態，新固定標記仍等轉場完成後顯示。
- 新增 `@automark isprime`／`@automark isprime,prime`／`@automark none`，指定本幀自動固定標記的顯示對象；preset／defaults可共用，未指定沿用既有設定，最後存取分析與手動mark保持獨立。
- 修正濃縮幀的 `@events animate off` 誤關自動固定；一般事件動畫開關保留固定狀態與其他繪圖動畫，`all animate on` 也不覆寫固定設定。
- 「自動固定」與「迴圈邊界事件」會寫入目前程式的 `@asm-view`，重新 RUN 與投影片重載後仍保留；事件間隔及一般事件類型偏好維持帳號設定。
- 複合賦值的可見來源數字抵達目的值時會立即消失並提交結果，不在目的地額外停留。
- `render heap` 新增 `fields(...)`、逐幀 `hide(field=value)`、`separator(...)`、pair／tuple單格格式，以及style顯示層中的 `@segment tree[node][L:R] color ...` 格內區段；`with split(now)`可保留遞迴分裂後尚待處理的另一側。線段樹範例已移除AV.hpp舊繪圖程式並保留原演算法，`Segment_Tree_easy`另逐筆呈現葉節點輸入與由下往上的父節點相加過程。
- 擷取會由當幀事件向上找到最外層的 `for`、`while` 或 `if`；迴圈一律顯示完整內容與結尾大括號，聯集子樹之外的程式碼隱藏為省略號。省略區段若只剩一行可執行程式碼，會直接顯示該行，不再以 `…` 代替。
- 當事件位於 `main` 以外的函式時，程式碼片段會顯示該函式的完整內容，包括函式宣告、所有可執行程式與結尾大括號；註解與繪圖指令仍會隱藏。同一函式內的幀沿用相同函式子樹，不會因事件落在不同分支或遞迴層級而反覆切換片段。
- 首幀沒有事件時，會由畫面上的變數反查宣告、輸入和必要的初始化迴圈。一般註解、繪圖指令與非演算法樣板程式碼預設不顯示。
- `if`、`while`、`for` 條件式中的純讀取變數只用於當行判斷與著色，不會因間接依賴而把輸入、容器配置或無關宣告拉進程式碼片段。
- 畫布程式碼片段的底色完全透明，預設字體為 20px（已儲存的自訂字體大小優先），保留 ACE 語法著色與事件背景高亮；右欄事件面板仍使用黑底。
- 事件會以背景色高亮精確對應的語法片段；複合條件依短路求值順序逐段亮黃，完整條件判定後整段連續保留淺綠（真）或淺紅（假）。同一幀共用一組程式碼片段。
- 舊 trace 缺少 AST context 時，會從原始碼重建大括號控制結構；位於 `for` 內的事件仍保留所有外層迴圈，短 `if` 為假時仍顯示其內容。
- 當幀遇到 `if`、`while` 或 `for` 的條件事件時，若區塊內不超過 3 行可執行程式碼，就連同內容完整顯示；超過 3 行則維持精簡。條件為假、區塊沒有實際執行時同樣適用。
- 沒有排入播放計畫的宣告或初始化事件不會留下灰色背景；已播放的 `swap` 等複合事件則以連續背景帶呈現，不會被內部讀取事件切斷。
- 無需移動時不重播入場或位移；需要切換區段時只展開下一幀將顯示的新行，再滾動並收合上一幀不再需要的行。
- Trace Studio 縮圖採可見區域優先、閒置預載與快取重用，避免一次同步繪製所有幀。
- 程式碼或輸入變更但尚未 RUN 時，狀態點為紅色；動畫與程式一致時為綠色。
- 手動刪除或清空原始碼底部的 `@asm-view` 後，下一次 RUN 會以目前原始碼重建規則、皮膚、事件開關、物件位置與鏡頭，不沿用上一份動畫的設定；儲存或離開 Studio 也不會把被刪除的舊設定偷偷寫回。帳號層級的事件預設偏好仍獨立保留。

## 傳統 `AV.hpp` 繪圖 API

專案仍保留直接呼叫 `AV.hpp` 的低階繪圖方式，既有範例位於 `algo-vis-backend/algorithm_sample/`。這套 API 與 `// @frame` 註解式追蹤是不同入口。

```cpp
#include "AV.hpp"

AV av;

int main() {
    av.start_draw();
    // av.draw(...)
    av.end_draw();
}
```

新演算法若需要自動事件、Trace Studio、條件樣式與投影片一致性，優先使用註解式追蹤語法。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| `algo-vis-backend/server.js` | Express 伺服器、驗證、編譯與資料 API |
| `algo-vis-backend/trace-instrumenter.js` | C++ AST 分析與追蹤改寫 |
| `algo-vis-backend/lib/ASMTrace.hpp` | C++ 執行時狀態與事件捕捉 |
| `algo-vis-backend/lib/AV.hpp` | 傳統低階繪圖 API |
| `algo-vis-backend/public/trace-*.js` | 模型、渲染、動畫、播放器、Studio、鏡頭與程式碼片段 |
| `algo-vis-backend/public/slides.*` | 投影片編輯與演算法動畫嵌入 |
| `algo-vis-backend/tests/` | 單元、整合與介面一致性測試 |
| `algo-vis-backend/scripts/regression.js` | 統一回歸檢查入口 |

Linux Docker 執行使用者 C++ 時，同時套用 5 秒應用層 TLE 與同 UID 的 GNU `timeout` 硬性 watchdog；即使容器未授予 `CAP_KILL`，逾時程序仍會被回收。終止訊號失敗會寫入 debug log，不再靜默忽略。

投影片雲端儲存的單次 HTTP JSON 請求上限為 8 MB；Docker 部署的 Nginx 與 Node.js／Express 使用相同上限。接近上限時應先移除未使用的媒體與重複動畫資料，而不是繼續放大請求限制。

匯出／匯入直接使用新版 `.asmdeck` 流程，不再顯示確認或錯誤彈窗；失敗原因顯示於狀態欄，可再次按匯入選檔重試。公開 HTTP 網址使用 SHA-256 備援實作，與 HTTPS／localhost 的 Web Crypto 產生相同雜湊，仍驗證內容與素材完整性。
新匯出一律是精簡壓縮的 `.asmdeck`：它只從獨立快照保存投影片、按雜湊去重的畫布圖片、C++ 原始碼／輸入、`@asm-view` 與額外播放設定，不包含可重建的逐幀 trace。匯出不會修改編輯中的 deck、已載入動畫或日常本機／雲端儲存。舊 `.json` 檔仍可匯入，但不再提供完整 JSON 匯出。

匯入 `.asmdeck` 會驗證版本、內容與素材雜湊，先讀 IndexedDB trace 快取；完整命中不 RUN，同程式／輸入的基礎 trace 命中只重套 Studio 設定，否則每張動畫 RUN 一次。快取由系統管理，不提供設定／清除動畫快取按鈕。換電腦、離線或清除網站資料後可能需要重新 RUN，隨機、時間及外部資料可能無法重現上次結果。程式／輸入尚未 RUN，或舊動畫缺少可重建原始碼時，必須先 RUN／遷移，否則匯出會拒絕。

動畫分析、編譯或連線失敗不會阻止投影片匯入：原始碼、輸入及待還原的編輯／播放設定仍保留，其他投影片照常匯入。失敗的動畫顯示「請編輯程式並 RUN」，可儲存、重開後修正；第一次成功 RUN 才清除待重建狀態並還原設定。檔案損毀、格式或雜湊驗證失敗仍拒絕匯入。

### 縮小投影片資料的建議順序

1. 儲存前顯示整份投影片與各頁的序列化大小，先找出最大的頁面與物件。
2. 縮圖只作為快取，不存入每張投影片；封面優先使用 WebP 並限制解析度。
3. 日常儲存的圖片與音訊外部資產化仍是後續工作；本次僅在 `.asmdeck` 匯出快照中去重畫布圖片。
4. 本機草稿存於獨立 IndexedDB 資料庫，完整 trace 與 Studio 設定分開保存；交易成功才顯示已儲存，舊 localStorage 草稿在遷移成功後才移除。雲端仍保存完整 deck。清除動畫快取不會刪除草稿；瀏覽器清除網站資料則會影響兩者。
5. 延伸既有儲存前正規化，清除預設值、失效規則、未引用物件及重複的跨幀設定。

Gzip/Brotli 可以縮短傳輸時間，但不會降低 MongoDB 文件與瀏覽器本機儲存實際占用，因此應在資料去重與外部資產化之後再加入。

## 測試與基本檢查

修改追蹤、事件、動畫、鏡頭、Trace Studio、投影片、TTS、驗證或分享功能後，在後端執行：

```powershell
cd algo-vis-backend
npm run regression
```

此命令統一執行 JavaScript 語法檢查、`git diff --check`、隔離的 localhost 伺服器、自動測試與無頭瀏覽器實際動畫驗證。每次更新後執行；失敗時追查、修正並重跑，不跳過失敗檢查。Windows 使用已安裝的 Edge；其他環境先執行 `npx playwright install chromium`。

實際動畫驗證使用冒泡、插入、選擇、Heap 與遞迴 Quick Sort，檢查 keep 可見性、指標標籤框重疊、正向提交前的數值，以及 algorithm／投影片 editor／runtime iframe 的完成狀態一致性。報告與截圖保存在 `algo-vis-backend/test-results/`（不提交 Git）；`npm run regression:animation` 可單獨重跑瀏覽器部分。這不是所有視覺規則的完整驗證，完整 slides.html 儲存／匯入、手機和拖曳仍應實際確認：

- RUN 後的資料與畫面。
- 上一步、下一步與不同速度的自動播放。
- Trace Studio 事件表、畫布與縮圖同步。
- 演算法編輯器、Trace Studio、投影片編輯器／播放介面結果一致。
- 瀏覽器 console 沒有新增錯誤。

不要提交 `.server.stdout.log`、`.server.stderr.log`、`.env` 或其他本機憑證檔案。

### 瀏覽器動畫實錄

「除錯記錄」頁籤提供只在除錯時啟用的動畫記錄器。它會同時保存程式與輸入、完整 trace、播放排程、事件實際開始／結束時間、SVG 物件與指標的畫面座標、可見性、繪圖屬性、動畫特效、鏡頭、TTS 狀態、程式碼片段及其高亮狀態。可以手動開始後重現問題，也可以按「記錄全部幀」從首幀逐幀實際播放，最後下載 JSON 完整報告或 CSV 對照表。未開始記錄時不會逐幀量測 DOM。

瀏覽器 Console 也可使用：

```js
ASMTraceDebugRecorder.start({ label: 'bubble', sampleIntervalMs: 50 });
// 重現問題後：
const report = ASMTraceDebugRecorder.stop();
ASMTraceDebugRecorder.downloadJSON();

// 自動實際播放所有幀並取得報告：
const fullReport = await ASMTraceDebugRecorder.recordAllFrames({ label: 'bubble' });

// 與先前基準比較；幾何與實際時間使用容許誤差：
ASMTraceDebugRecorder.compare(baseline, fullReport, {
  positionTolerancePx: 1.5,
  timingToleranceMs: 80
});
```

JSON 是診斷與回歸基準的主要格式；CSV 是依「時間點 × 畫面物件」攤平的人工檢查表。報告不會寫入 `@asm-view`，也不會成為投影片資料的一部分。

## 文件維護規則

### 自動儲存的動畫結果

投影片保留原始碼、輸入與編輯設定，執行結果以 SHA-256 `traceRef` 分離保存。本機 IndexedDB 的 `traces` 可跨投影片／草稿共用相同結果；鏡頭、樣式與事件設定仍逐張保存。雲端結果、data URI 素材與獨立設定快照放在 `SlideResourceChunk` 集合，單筆 deck 只持有 `cloud_snapshot` 與 `resource_keys`。同一 deck 內按內容去重，256 Ki 字元分塊，成功的分塊可續傳；單次請求仍限制 8 MB，整份 deck 不再受該單次限制。完整結果是持久資料，不依賴可清除的執行快取；重開與分享播放不會重新 RUN。

新結果與素材全部上傳、雜湊驗證成功後，才原子切換 deck 快照；失敗不改原本保存版本。成功後刪除失去最後參照的舊結果與舊快照，不保存歷史版本。中斷上傳／回收失敗的未引用資源在閒置 48 小時後由每小時清理回收；目前引用的結果永不按時間淘汰。本機在同一交易內更新參照與結果，雲端單一 backend 程序按 deck 序列化提交／回收並以 updated_at 檢查衝突；擴充多 backend replica 前須將此鎖改為分散式協調。舊資料讀取相容、再次儲存時遷移。這不改變 `.asmdeck` 精簡匯出或目前記憶體內的 `traceDocument`。

儲存保護上限：每份資源 128 MB、整份 deck 512 MB；暫存容許兩倍容量，供新舊版本切換。這些是總容量保護，不是原本 8 MB 的單次請求限制。雲端讀取仍一次還原完整 deck；按目前投影片懶載入可另行優化。

功能完成不只包含程式碼，也包含對應文件。後續修改時依下列規則同步更新：

- 新增或改變對外功能、主要介面、啟動方式、架構或測試指令：更新本 README。
- 新增或改變 `@frame`、`@keep`、`@text`、`@style`、`@segment`、`@arrow`、`at`、`as`、`when`、renderer 或條件語法：更新 [演算法視覺化指令使用手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)。
- 改變部署、環境變數、JWT、MongoDB、SMTP 或 Docker 流程：更新 [伺服器架設與維護手冊](SETUP_GUIDE.md)。
- 遞迴排版的已實作範圍與後續一般化方向記錄於 [排版指令規劃](LAYOUT_DIRECTIVE_ROADMAP.md)。
- 每次文件變更更新「最後整理／核對日期」，並避免記錄容易失效的硬編碼快取版本或測試數量。

## 授權

授權內容請參考 [LICENSE](LICENSE)。
