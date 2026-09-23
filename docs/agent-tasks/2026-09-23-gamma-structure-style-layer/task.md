# 2026-09-23-gamma-structure-style-layer：Structure 前景 style 圖層

## 任務資訊
- 負責代理：gamma
- 狀態：開發中
- 共同基準 commit：32928e6389cc88a0f0b34b96ffa5cc5b555c3e6e
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：一般投影片的 Structure 物件同時顯示多個格子與 highlight、point、mark 或註標。
- 目前行為：Structure renderer 將一般格子與提示裝飾交錯放在相同 SVG group；後畫出的普通格子可能遮住先畫出的 highlight。
- 使用者希望的結果：Structure 採用與程式碼動畫相同的分層原則，至少將一般格子與 style 前景層分開，確保 highlight 不被普通格子遮住。
- 本次範圍與必要限制：只調整一般投影片 Structure SVG 內部圖層；Table 不含 Structure style，既有拖曳、選格、編輯、動畫與資料格式不變。

## 需求確認
- 已從使用者或上下文確認：Structure 本身需要 base 與 style 分層；highlight 必須位於普通格子上方；不跑大規模驗證。
- 尚待使用者回答：無。
- 代理採用的合理假設：依動畫 renderer 的做法，highlight、point、mark 與註標屬 foreground style layer；focus 與 background 仍是格子本身的底色狀態。

## 重現與調查
- 最小操作步驟或 fixture：建立多格或樹狀 Structure，替較早繪製的格子設定 highlight，檢查其 SVG DOM paint order。
- 重現狀態：已重現。
- 已確認事實：程式碼動畫 renderer 使用 `asm-trace-style-layer` 將提示裝飾移至物件之上；投影片 Structure 原先直接依各 renderer 的產生順序放置節點。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slide-structures.js`、`public/slides.html`、Structure 專用 browser test 與入口版本測試。
- 共用檔案／介面與協調結果：每個 Structure SVG 增加 `data-structure-base-layer` 與 `data-structure-style-layer="foreground"`；保留巢狀物件的 transform、opacity 與 visibility。
- 依賴任務：無。

## 驗收條件
- [ ] 每個 Structure SVG 的一般內容位於 base layer，highlight、point、mark 與註標位於其後的 foreground style layer。
- [ ] style layer 不接收滑鼠事件，原格子仍可選取與編輯。
- [ ] normal、matrix、binary tree、heap、segment tree、BIT、disk、stack、queue 均維持相同分層順序。
- [ ] 每格自訂 style 顏色、註標文字、保存與重新載入仍正常。

## 驗證計畫
- 子代理小驗證：JavaScript 語法；Structure style／註標 browser test；segment tree 局部 browser test；入口版本與差異檢查。
- 主代理整合驗收：整合預覽實際查看重疊情境的 highlight，並核實 Structure 各模式的分層與格子互動。
- 測試隔離方式：隨機埠服務、localStorage fixture 與獨立 headless Edge；不操作使用者投影片。

## 變更紀錄
- 2026-09-23：依使用者要求，將 Structure 一般內容與 foreground style 裝飾分層。
