# gamma-cell-style-toolbar：格子樣式工具列與註標文字

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：9af33215bf941df3219f709d1066c6c5d3cb82d0
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 情境：一般structure物件點選格子。
- 希望：格子上方彈出style圖案可直接選用，註標指標可以輸入文字。
- 範圍：一般投影片編輯，保留双擊編輯值及右鍵結構操作；不改trace動畫。

## 需求確認
- 已確認：點格子顯示圖示工具列及可輸入指標文字。
- 尚待回答：無。
- 合理假設：樣式為切換按鈕，可複選；共用預設註標文字可留空顯示索引，單格文字可覆寫。

## 重現與調查
- 功能新增，不適用重現。
- 已確認：已有格子選取、右鍵menu及sidebar樣式圖示，沿用避免重複元件。
- 尚待調查：無。

## 修改邊界與依賴
- slides.js：格子單擊工具列、索引切換、側欄同步；annotationText/annotationLabels正規化與保存；選取/模式切換清理。
- slides.html：預設註標文字欄與快取。
- slides.css：工具列橫向外觀。
- slide-structures.js：標籤文字選擇與字體大小。
- structure專項與入口測試。
- 共用介面：新增可選annotationText字串、annotationLabels索引→文字物件。
- 依賴：前次註標箭頭；主代理需協調slides.js及快取。

## 驗收條件
- [x] 單擊格子上方顯示六種樣式圖示，能切換該格樣式。
- [x] 側欄索引與工具列按鈕狀態一致。
- [x] 個別指標可輸入left/right，預設文字與個別覆寫保存重開不丟失。
- [x] 工具列位於格子上方，離開編輯／切換投影片會關閉。

## 驗證計畫
- V1，A/B/C；最新主根目錄子代理驗證分級通知.md。
- JS語法及diff，最小structure專項與入口測試。
- 隔離：隨機埠ASM_REGRESSION、合成deck、獨立無頭Edge、既有CDN依賴。
- 主代理補驗：undo/redo、多結構實際選取、手機布局、雙擊值及右鍵操作。

## 變更紀錄
- 2026-09-18：初始定義、實作與小驗證。
