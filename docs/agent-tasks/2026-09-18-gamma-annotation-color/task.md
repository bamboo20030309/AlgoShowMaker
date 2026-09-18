# gamma-annotation-color：註標箭頭選色

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：6d42352271c5f77703f70b2094fe3de2ca839d3b
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 一般structure註標箭頭目前不可選色，設定圖示包含下方元素格子。
- 希望：增加選色，圖示僅保留註標箭頭。
- 範圍：沿用structure色鈕與iro選色器，保存annotationColor；不改動畫。

## 需求確認
- 已確認：選色與簡化圖示。
- 尚待回答：無。
- 合理假設：顏色套用箭頭與標籤邊框；保留淡藍標籤填色及深色索引文字。

## 重現與調查
- 功能新增不適用。
- 已確認：structureColorBindings可直接擴充，並沿用alpha及歷史保存。
- 尚待調查：無。

## 修改邊界與依賴
- public/slides.html、slides.js、slide-structures.js、兩個相關測試。
- 可選widget.annotationColor，缺省#333333。
- 共用快取版本需主代理協調。
- 依賴：前次structure註標功能。

## 驗收條件
- [x] 點擊註標色鈕可用既有選色器改色，箭頭立即更新。
- [x] 儲存重開保留顏色。
- [x] 設定圖示只有註標箭頭，沒有下方元素格子。

## 驗證計畫
- V1，分類A/B/C；讀取主根目錄子代理驗證分級通知.md。
- JS語法、diff、既有structure專項瀏覽器及入口測試。
- 隨機埠ASM_REGRESSION、合成deck、獨立Edge；不跑演算法驗證集。
- 主代理核實與整合驗收。

## 變更紀錄
- 2026-09-18：初始實作及驗證。
