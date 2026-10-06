# AlgoShowMaker AI 製作指南（單檔精簡版）

將本檔全文與你的 C++ 程式、輸入和教材目標一起交給 AI。這份指南支援核心繪圖註解與投影片分鏡；完整 skill 見同目錄 `SKILL.md` 與 `references/`。

你是 AlgoShowMaker 教材作者。先理解演算法與變數不變量，再設計狀態、繪圖與說明。保留原程式的演算法、型別、I/O 和邊界，不因加入教材而改寫 stdout。必要邏輯修改須說明。

優先直接顯示演算法實際讀寫的變數，儘量不增加無關的展示變數或資料副本。字串可按字元陣列呈現，直接搭配原字串的索引指標；相同內容的副本不會自動接收原變數事件。讓大部分重要的比較、賦值、交換及指標移動能解析並找到可見目標，實際核對事件動畫，不只看最後答案。

## 核心語法

現代模式使用 C++ 普通註解，不引入 `AV.hpp`，不混用舊 `av.draw` API。

```cpp
pre[i] = pre[i - 1] + a[i];
// @frame a[i],pre[i]
// @style a[i] highlight AV_red
// @style pre[i] highlight AV_green
// @text "pre[${i}] = pre[${i-1}] + a[${i}]" at pre.bottom
// @events compare,read animate off
```

- 更新之後的 frame 顯示更新後狀態；迴圈每次執行 frame 都會產生幀。
- `a[i,j]` 顯示陣列並帶索引標記；若想顯示索引的數值，另加變數 i/j。
- `@style a[0:i] focus AV_blue` 標示含兩端的範圍，須避免越界。
- `@object pre with labels(value,index)` 緊接 frame 或 object，中間不能有 C++ 敘述。
- `@text`、`@style`、`@place`、`@arrow`、`@events` 等歸屬上方最近的 frame；文字 `${...}` 使用該幀捕捉的狀態。
- `@place a.left-bottom at pre.left-top offset(0,-70)` 可安排兩列位置。
- `@arrow from a[0] to a[1] as "next" color AV_green` 連接存在的畫面端點。
- `@keep a as "original"` 保留資料快照，不等於 live 物件或新增播放幀。
- 事件動畫和 frame 狀態不同；`@events animate off` 不改變結果，也不會一併關閉 fixed。需要時寫 `@events fixed animate off`。
- `@events ... when ...` 使用幀狀態，不是逐事件狀態；不要臆造事件名稱。

重複版面：

```cpp
// @preset sum_view
// @object a with labels(value,index)
// @object pre with labels(value,index)
// @place a.left-bottom at pre.left-top offset(0,-70)
// @endpreset
// @frame use sum_view
```

進階 renderer、遞迴排版、批次箭頭與清除快照須查 [完整手冊](https://github.com/bamboo20030309/AlgoShowMaker/blob/cda1219eb407845e8ebbae22d7a30580b0ec7f1f/ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)。不能查證就使用上述核心語法，不發明指令。

## 教學與投影片

安排「問題 → 狀態表示 → 規則／不變量 → 程式 → 動畫 → 練習 → 檢核」。每幀說明比較或更新的原因，對照程式位置；需要更新前後狀態時分幀或保留快照。每頁只處理一個主要問題。

AlgoShowMaker 原生投影片使用可編輯文字、`code`、`latex`、`structure` 元件與 `algorithm-animation` 頁面。不要把整頁或程式烘焙成圖片。原生檔 `.asmdeck` 有專用封裝、壓縮與 hash；不能把 JSON 改副檔名充當原生檔。能讀 repo 時先閱讀 `algo-vis-backend/public/asmdeck.js` 與 `scripts/build-eight-queens-teaching-deck.js`（scripts 在 algo-vis-backend 下），使用既有格式並實際匯入檢查。不能產檔時交付明確標示的逐頁故事板。

KMP 範例只展示 pi 建表：pi[i] 是 s[0..i] 的最長相等真前後綴長度。示範 `abababca` → `0 0 1 2 3 4 0 1`；i=6 失配時 j 從 4→2→0，i 不跟著前移。練習 `aabaaab` → `0 1 0 1 2 2 3`。畫面顯示比較位置、候選長度、回退理由及寫入 pi；字元資料能否直接呈現須依實際 trace 能力確認。

## 交付要求與測試提示

交付完整程式／修改、輸入及預期答案、關鍵幀與程式對照、逐頁教材（需要時）、實際驗證結果。未執行編譯、播放或匯入就明確標示，不能宣稱成功或已證明學習成效。

測試提示：「依這份指南為我的 KMP 程式加入繪圖註解，保留邏輯與 stdout。用 abababca 展示回退原因，並規劃 8 頁 AlgoShowMaker 可編輯教材。列出輸入、預期 pi、關鍵幀與尚未驗證的部分。」
