# AlgoShowMaker

AlgoShowMaker 是以 C++ 程式執行結果為核心的演算法視覺化與投影片製作工具。使用者可以在原始碼中加入少量註解指令，將變數、資料結構、程式事件、鏡頭、文字與 TTS 整理成可播放、可編輯的動畫，再嵌入投影片。

- 預設介面與文件語言：繁體中文
- 目前開發基準：AV_V4.6，持續開發中
- 專案首頁：[GitHub](https://github.com/bamboo20030309/AlgoShowMaker)
- 最後整理日期：2026/09/12

## 版本日誌

### AV_V4.6 — 2026/09/12

- 播放層改用正向事件 checkpoint：依 runtime `order` 提交宣告、賦值、交換、指標移動與退場，關閉事件仍正確提交狀態，避免後段結果提前污染前段動畫。
- 補齊變數生命週期、迴圈標頭與邊界事件、指標入退場／讓位、未初始化空格、文字與陣列淡入淡出，以及程式碼先提示、視覺物件再回應的排程。
- `@keep` 新增 `when`、`at`、原位 `offset`、style 保存、穩定命名、虛擬 `keep` 聯集與獨立快照 identity；快照交接改為接手來源物件的實測位置，不再套用一般物件退場或額外淡入殘影。
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
| `@keep` | 依條件保留變數或上一幀畫面 | `// @keep last as round when i > 0` |
| `@exit` | 提早讓指定變數的視覺呈現退場 | `// @exit min_idx` |
| `@text` | 顯示動態說明文字與 TTS | `// @text "i = ${i}" at arr.bottom when i >= 0` |
| `@style` | 套用背景、框線、point、mark 或 focus | `// @style arr[i,i*2:i*2+1] highlight red` |
| `@segment` | 標示一段連續範圍 | `// @segment arr[low:high]` |

常用修飾詞：

- `as`：指定穩定 ID。
- `at`：定位到 C++ 變數、`@keep as` ID、Trace Studio 自訂物件或 `canvas`。
- `offset(x,y)`：在語意定位後加入像素位移。
- `when`：依目前或跨幀條件決定是否顯示。
- `render`：切換資料結構畫法，例如 `render heap`。
- `with`：傳入 `range(...)`、`columns(...)`、`labels(...)` 等 renderer 選項。
- `without style`：讓 `@keep` 保留資料但不保存當下樣式。

條件支援 `&&`、`||`、`and`、`or`，以及 `previous(...)`、`changed(...)` 等跨幀判斷。`@style` 可混合單點與區間，例如：

```cpp
// @style arr[i,i*2:i*2+1] highlight red
// @style arr[1:i-1,n:n] focus
```

`@keep as` 第一次使用名稱時不加編號；重複名稱依序使用 `_1`、`_2`。所有 keep 物件的外框可透過虛擬聯集 `keep.top`、`keep.bottom` 等錨點定位。keep 預設保留來源的相對定位、Studio 位置／綁定與自動排版高度；所有未手動定位的 keep 列，預設垂直間距為 50px。明確的 `offset` 或 Studio 拖曳位置仍優先。若只想從原位置調整，可寫 `// @keep last offset(0,-24)`，正 Y 向下、負 Y 向上。

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
- 擷取會由當幀事件向上找到最外層的 `for`、`while` 或 `if`；迴圈一律顯示完整內容與結尾大括號，聯集子樹之外的程式碼隱藏為省略號。省略區段若只剩一行可執行程式碼，會直接顯示該行，不再以 `…` 代替。
- 當事件位於 `main` 以外的函式時，程式碼片段會顯示該函式的完整內容，包括函式宣告、所有可執行程式與結尾大括號；註解與繪圖指令仍會隱藏。同一函式內的幀沿用相同函式子樹，不會因事件落在不同分支或遞迴層級而反覆切換片段。
- 首幀沒有事件時，會由畫面上的變數反查宣告、輸入和必要的初始化迴圈。一般註解、繪圖指令與非演算法樣板程式碼預設不顯示。
- `if`、`while`、`for` 條件式中的純讀取變數只用於當行判斷與著色，不會因間接依賴而把輸入、容器配置或無關宣告拉進程式碼片段。
- 事件會以背景色高亮精確對應的語法片段；複合條件依短路求值順序逐段亮黃，完整條件判定後整段連續保留淺綠（真）或淺紅（假）。同一幀共用一組程式碼片段。
- 舊 trace 缺少 AST context 時，會從原始碼重建大括號控制結構；位於 `for` 內的事件仍保留所有外層迴圈，短 `if` 為假時仍顯示其內容。
- 當幀遇到 `if`、`while` 或 `for` 的條件事件時，若區塊內不超過 3 行可執行程式碼，就連同內容完整顯示；超過 3 行則維持精簡。條件為假、區塊沒有實際執行時同樣適用。
- 沒有排入播放計畫的宣告或初始化事件不會留下灰色背景；已播放的 `swap` 等複合事件則以連續背景帶呈現，不會被內部讀取事件切斷。
- 無需移動時不重播入場或位移；需要切換區段時只展開下一幀將顯示的新行，再滾動並收合上一幀不再需要的行。
- Trace Studio 縮圖採可見區域優先、閒置預載與快取重用，避免一次同步繪製所有幀。
- 程式碼或輸入變更但尚未 RUN 時，狀態點為紅色；動畫與程式一致時為綠色。

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

## 測試與基本檢查

修改追蹤、事件、動畫、鏡頭、Trace Studio、投影片、TTS、驗證或分享功能後，在後端執行：

```powershell
cd algo-vis-backend
npm run regression
```

此命令統一執行 JavaScript 語法檢查、`git diff --check`、隔離的 localhost 伺服器與自動測試。涉及視覺或播放行為的修改，仍應實際確認：

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

功能完成不只包含程式碼，也包含對應文件。後續修改時依下列規則同步更新：

- 新增或改變對外功能、主要介面、啟動方式、架構或測試指令：更新本 README。
- 新增或改變 `@frame`、`@keep`、`@text`、`@style`、`@segment`、`at`、`as`、`when`、renderer 或條件語法：更新 [演算法視覺化指令使用手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)。
- 改變部署、環境變數、JWT、MongoDB、SMTP 或 Docker 流程：更新 [伺服器架設與維護手冊](SETUP_GUIDE.md)。
- 尚未實作但已確認的排版方向：記錄於 [排版指令規劃](LAYOUT_DIRECTIVE_ROADMAP.md)，不要在使用手冊中標示為可用。
- 每次文件變更更新「最後整理／核對日期」，並避免記錄容易失效的硬編碼快取版本或測試數量。

## 授權

授權內容請參考 [LICENSE](LICENSE)。
