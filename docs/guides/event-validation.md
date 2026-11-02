# 事件與動畫驗證手冊

## 這份驗證要確認什麼

本驗證將使用者確認的事件規則整理為小型 C++ 與手寫答案，用來區分「程式追蹤錯誤」「動作分類錯誤」「時間安排錯誤」與「實際畫面錯誤」。

- 規格說明：[事件與動畫固定規格](../reference/event-contracts.md)。
- 測資與答案：`algo-vis-backend/tests/fixtures/event-contracts/`。
- 共用判定器：`algo-vis-backend/tests/helpers/event-contract-oracle.js`。
- 執行入口：`algo-vis-backend/scripts/validation/event-contracts.js`。

**答案檔是要求，執行報告才是結果。** 某個 ID 出現在清單，只表示已有範例與標準答案；沒有實際採樣證據時，必須列為未驗證，不能算通過。

## 最常用的指令

以下在 `algo-vis-backend` 資料夾執行；入口使用隔離服務與瀏覽器，不應操作你的 3000／3100 分頁或覆蓋私人投影片。直接執行而不帶選項只顯示說明，不自動啟動整套。

```powershell
node scripts/validation/event-contracts.js --list
```

只列出案例、分組與內容，不執行編譯或瀏覽器。

```powershell
node scripts/validation/event-contracts.js --case E03
```

只驗證「a=b 整格複製」；錯誤回報須列出來源、目標、預期值、實際值與第一個違規位置。

```powershell
node scripts/validation/event-contracts.js --group assignment
```

驗證同一份賦值測資的相關案例，避免同一份 C++ 為每條答案重複編譯。

```powershell
node scripts/validation/event-contracts.js --case E05 --data-only
```

只檢查 Trace 的來源、目標、執行順序與固定數值，不代表已驗證搬移、顏色、highlight 或提交時機。

```powershell
node scripts/validation/event-contracts.js --failed
```

續跑上次失敗案例。依賴內容已變更的案例，必須重新驗證，不能沿用失效的成功證據。

```powershell
node scripts/validation/event-contracts.js --all
```

執行這份事件規格的全部案例；不是啟動 repo 全部 regression。仍由主代理集中驗收，子代理只選相關的小範圍。

```powershell
node scripts/validation/event-contracts.js --case E03 --fresh
```

要求該案例重新產生證據，用於確認引擎更新或快取疑慮；一般修正先續跑失敗、新增或依賴改變的案例。

## 分組與可手算結果

| 分組 | 測資檔 | 最後標準輸出 |
| --- | --- | --- |
| assignment | assignment.cpp | `6 3 4 4\n` |
| visibility | visibility.cpp | `11 3 3\n` |
| selection | selection.cpp | `3 3 8 2 1\n` |
| containers | containers.cpp | `3 8 5 \n` |
| functions | functions.cpp | `8 2\n` |
| pointers | pointers.cpp | `2 3 1\n` |
| layout | layout.cpp | `5 9\n` |

固定輸出只能證明最後計算結果，不能單獨證明中間動畫正確。例如 E05 即使最後是 11，如果 300 ms 前已顯示 11，仍是失敗。

## 三層對答案

### 1. 事件資料

由 CASE 標記定位原始碼，再檢查事件類型、實際順序、來源、目標及前後值。以 E05 為例，a 原本是 3、b=3、c=8，因此更新後必須為 11；這些數字已寫在 manifest，不從 Trace 算出標準答案。

重複來源 b+b 必須保留兩個來源角色；未執行的短路分支不得因為分析器看得見就產生求值動畫。

### 2. 動作與時間

對 E05，1 倍速的固定要求為兩份數字同時搬移 300 ms，抵達前 a 仍為 3，抵達後一次更新為 11；不另顯示運算式區域，也不增加讀取步驟。

標準時刻來自答案檔的 300 ms，不能把產品自己的 commitMs 當唯一答案。產品計畫只用於追查與一致性比較，不能用來證明自己正確。

### 3. 實際畫面

採樣實際 SVG／DOM 的數值、複本內容、矩形、位置、有效透明度與暫時強調。有效透明度需包含所有祖先；如果必要物件不存在、沒有位置或缺少標籤，直接失敗，不能當成不適用而跳過。

穩定定點需檢查物件、指標與標籤是否重疊。交換中的合法交叉不算失敗。

## 如何手動查看一個案例

1. 從 manifest 找到 ID、fixture 與 CASE 標記。
2. 在隔離的演算法工作區貼上對應 C++ 與 input；不要用私人投影片做測試。
3. RUN 後先檢查輸出，再切到該操作之前的一幀。
4. 設為 1 倍速、按下一幀，依規格核對來源、動作與提交後狀態。
5. 以 E03 為例：來源 b 的框與數字一起複製、b 留在原處、a 抵達前保留舊值、最後為 3，飛行複本消失。
6. 暫停、繼續、上一幀、跨幀跳轉後確認沒有殘留複本或 highlight。
7. 對舊資料或設定案例，還要保存後重開，核對自訂值及明確 false／0。

肉眼查看可協助理解，但時刻判定應以可重複的瀏覽器採樣作證據，不用肉眼估計 300 ms。

## 如何讀驗證報告

每條案例至少應分開列出：

| 欄位 | 意義 |
| --- | --- |
| 案例 ID／測資 | 對應哪條固定規格 |
| 資料檢查 | 語意、來源、前後值與輸出是否正確 |
| 畫面檢查 | 是否真的取得 SVG／DOM 與導航證據 |
| 時序檢查 | 是否核對固定時間與提交先後 |
| 結果 | 通過、失敗或未驗證，不能把未驗證當通過 |
| 預期／實際／首次違規 | 便於定位第一個差異 |
| 速度／新舊資料／重開 | 清楚說明本次實際覆蓋模式 |
| 依賴指紋 | 判斷舊證據是否仍可沿用 |

原始產物放在被忽略的 `test-results/`。不提交錄影、截圖、暫存編譯檔或 server log。交付說明應清楚列出未驗證部分。

## 增加案例時的規則

先寫最小 C++、CASE 標記與獨立答案，再改產品。每個答案應能人工推導；不能執行目前程式後把輸出直接存為新標準答案。

涉及新語意或視覺設定時，同時包含新資料、缺少新欄位的舊資料、自訂值／明確關閉，以及保存重開。產品規格確實改變才更新答案，並記錄理由；不得為了讓失敗變通過而直接放寬數值、忽略缺失或刪除斷言。

## 本次覆蓋與邊界（2026-11-02）

目前共有 67 條手寫答案，分成 7 份 C++ 測資。每條包含資料檢查及實際 SVG 或播放控制檢查。E02、E03、E04、E05、E06、E07、E08、E09、E17、E19 另以固定時鐘在 1 倍、2 倍速檢查提交前一毫秒與提交時刻；不是每一條案例都具有完整逐毫秒檢查。E09 另核實 240 ms 強調完成後沒有多餘等待。

單一操作的時鐘測試只保留該操作的事件，避免把同幀其他物件退場算進該操作。真實幀若有鏡頭或排版移動，會另外安排時間。畫面採樣會檢查案例指定的項目；這 67 條並不等於涵蓋所有 C++ 語法、所有 style 組合與全部演算法。

報告位於 algo-vis-backend/test-results/event-contracts/summary.json；逐條預期值、實際值、畫面與時鐘證據在同目錄 records.json。pass 表示本案例要求的已實作檢查通過，clock.applicable=false 明確表示該案例沒有精確時鐘探針，不能據此宣稱時間全面通過。

舊 Trace 缺少 min/max 的兩個運算元時，保留可證明的選值複製，並在除錯紀錄提示重新 RUN，不憑空產生比較。舊容器 Trace 若無法從前後狀態確認插入／刪除內容，保留已儲存結果並警告重新 RUN，不猜造中間值。既有自訂設定與明確 false／0 仍保留。
