# gamma-sample-math-load：範例觀賞入口與LaTeX首次載入

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：85342ee78f0c9cbe20ac40b67ff9e49fe8c2a51a
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 範例載入期間會先出現編輯介面，完成下載才進入觀賞模式。
- LaTeX引擎稍後由Reveal從CDN載入，初始公式可能先顯示文字；公式刷新另延遲1200ms。
- 預期：範例首次畫面即為觀賞；公式在物件首次插入畫面時已排版，不依賴外部CDN。
- 範圍：一般投影片載入、公式渲染，保留普通編輯入口、首頁與TTS；不修改演算法trace或播放。

## 需求確認
- 已確認：範例直接觀賞、改善LaTeX載入。
- 尚待回答：無。
- 合理假設：使用既有KaTeX元件，引擎與字型本機託管，不把公式轉為圖片。

## 重現與調查
- 已重現時序：body預設asm-edit-mode，applySharedAccessUi在archive下載後才執行。
- 公式引擎RevealMath預設從katex@latest載入；renderMathWidgets缺引擎會標記plain，之後刷新靠1200ms計時器。
- 本次固定官方KaTeX npm 0.16.22的browser資產（MIT），不修改共用node_modules。
- 尚待調查：無。

## 修改邊界與依賴
- slides.html：在頁首控制欄解析前同步設定範例觀賞；本機KaTeX CSS/JS、auto-render、常用字型預載；快取版本。
- slides.js：建立公式物件時同步KaTeX排版，本機Reveal數學plugin沿用auto-render；ready立即刷新，字型ready後重算尺寸。
- public/vendor/katex：原版資產、fonts、LICENSE與來源README。
- tests/sample-latex-load.browser.test.js、入口測試。
- 共用介面：未新增widget欄位；公式原始碼與可編輯性保留。
- 依賴：無；主代理協調slides.js及快取。

## 驗收條件
- [x] 刻意延遲範例目錄下載時，不顯示編輯側欄與模式切換。
- [x] 範例正常觀賞，首頁按鈕保留。
- [x] 封鎖外部網路仍首次插入即有KaTeX公式。
- [x] 既有LaTeX同ID匯入、編輯與undo/redo通過。

## 驗證計畫
- V1，A/B/C；讀取最新主根子代理驗證分級通知.md與整合分支與預覽設定.md。
- 隔離隨機埠ASM_REGRESSION、合成公式deck、獨立Edge，延遲catalog及封鎖https。
- 只跑本次載入專項、latex-refresh與入口測試，不啟動演算法集。
- gamma重啟並核實3103；不操作3000、3100及其他代理服務。
- 主代理整合到intergration後核實實际範例与多公式deck。

## 變更紀錄
- 2026-09-18：初始定義、定位及修正。
