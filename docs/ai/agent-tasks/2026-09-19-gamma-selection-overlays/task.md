# 2026-09-19-gamma-selection-overlays：頂層選取框與空白取消選取

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：a400d2d5a8d39bd4c32fbf2d8fd57079bc12888f
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：投影片編輯模式中框選物件、選取陣列格子，或選取後單擊旁邊空白處。
- 目前行為：空白單擊未穩定清除 DOM widget 選取；Fabric 框線可能被 DOM 物件覆蓋；陣列格子選取框位於 structure SVG 內，會被上層一般物件遮住。
- 使用者希望的結果：空白單擊取消選取；滑鼠框選與格子選取框顯示在獨立頂層；選取框使用半透明淺藍色。
- 本次範圍與必要限制：一般投影片編輯器選取視覺與聚焦前端驗證；不執行大規模 regression。

## 需求確認
- 已從使用者或上下文確認：三項行為及半透明淺藍色均為必要結果。
- 尚待使用者回答：無。
- 代理採用的合理假設：頂層只在編輯模式顯示；框選命中與資料選取沿用前一任務邏輯。

## 重現與調查
- 最小操作步驟或 fixture：框選 LaTeX／Code／Fabric 文字；單擊空白；點選 Array 格子並與高層物件比較 z-index。
- 重現狀態：已重現。
- 已確認事實：Fabric 原生框線畫在 canvas 內；格子選取原本只改 SVG rect stroke，兩者都受物件堆疊限制。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.js`、`slides.css`、`slides.html`、框選瀏覽器測試及入口測試。
- 共用檔案／介面與協調結果：不改 deck 格式；新增純顯示用 overlay DOM。
- 依賴任務：2026-09-19-gamma-widget-marquee 的 widget 框選座標與狀態。

## 驗收條件
- [x] 選取後單擊投影片空白處會清除 widget 與格子選取。
- [x] 拖曳中的框選矩形位於獨立頂層，放開後隱藏。
- [x] Array 格子選取外框位於獨立頂層，高於 Fabric 與一般 widget。
- [x] 兩種選取框皆使用半透明淺藍色，觀賞模式與投影片總覽不顯示。

## 驗證計畫
- 子代理小驗證：框選與格子 overlay 瀏覽器測試、既有 structure 註標測試、入口與語法檢查。
- 主代理整合驗收：實際以不同物件層級覆蓋框選範圍與 Array 格子，確認外框仍清楚可見；單擊空白確認取消。
- 測試隔離方式：測試使用隨機本機埠、獨立瀏覽器與測試 deck。

## 變更紀錄
- 2026-09-19：依使用者需求建立並完成初始任務定義。
