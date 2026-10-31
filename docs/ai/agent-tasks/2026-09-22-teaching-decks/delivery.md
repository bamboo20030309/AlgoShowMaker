# 三份演算法教學投影片交付紀錄

## 任務與來源

- 基準：`intergration`，原提交 `8a8c60e`。
- 來源：使用者提供的 `heap.asmdeck`、`Binary Indexed Tree.asmdeck`、`Segment Tree.asmdeck`。
- 版型參照：既有 `public/guest-decks/quick-sort.asmdeck`，維持 1280×720、薄荷綠／淡橘卡片、章節標籤及頁尾。
- 產出：`heap-teaching.asmdeck`（12 頁、1 段動畫）、`binary-indexed-tree-teaching.asmdeck`（14 頁、2 段動畫）、`segment-tree-teaching.asmdeck`（23 頁、4 段動畫）。三份皆加入公開範例目錄的「資料結構」分類。

## 內容

- Heap：要解決的反覆取極值問題、Williams 的 heapsort 由來、完整二元樹與最大堆不變量、插入上浮／取出下沉的例子、取自附件的程式碼元件、原始動畫、逐一插入與 bottom-up 建堆的複雜度差異。
- BIT：動態前綴和問題、Fenwick 1994 年累積頻率表的背景、lowbit 責任區段、單點更新與前綴路徑、兩個前綴相減的區間查詢、兩段原始動畫，以及哪些題型需差分／雙 BIT／線段樹。
- Segment Tree：區間摘要與查詢分解、標準遞迴與使用者的固定葉層迭代建樹差異、四段原始動畫、各種 merge 摘要、單點與區間更新、lazy add/set 合成次序、題型選型與邊界檢查。特別說明使用者的查詢與複合更新仍為遞迴走訪。
- 程式碼與公式使用既有 `code`／`latex` 元件，保留動畫頁供編輯。

## 來源動畫必要修正

- 三段使用者固定葉層線段樹動畫原來寫 `32-__builtin_clzll(X)`，在 64 位元 intrinsic 下會算出負數；產出中改為可處理 `n=1` 的 64 位元版本。
- 複合 add/set 範例下推 lazy 時，原程式把子節點已累積的 lazy 全量再次加到摘要，特定操作次序會重複計數。產出中改為只加本次從父節點傳下的增量。
- 其餘動畫輸入、逐幀指令與視覺設定沿用附件。

## 驗證

- 三份 `.asmdeck` 全部通過專案 `ASMDeck.decode()` 與內容雜湊檢查；`tests/asmdeck.test.js`、`tests/slide-library.test.js` 共 15 案通過。
- 七段動畫 C++ 程式均以附件輸入編譯執行成功；迭代與標準線段樹的複合 add/set/query 用 500 組固定種子隨機案例與直接陣列計算核對一致。
- 在隔離 Edge／Playwright 分頁確認三份封面、代表性的卡片／LaTeX／code 頁，以及線段樹建樹動畫首幀可載入；瀏覽器未出現 page error。
- `git diff --check` 通過；完整動畫回歸集未執行，本次變更沒有修改追蹤引擎或播放邏輯。
