# gamma-code-focus：切換投影片對齊 code 關注行

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：6168bd8b989632643c06c673a75d3f177f3634ac
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：code 物件已設定關注行數，切換至該投影片。
- 目前行為：一般切換不重新捲動；隱藏投影片初始化的幾何亦不足以正確對齊。
- 希望結果：使用原本動畫的 codeFocusScrollTop／scrollCodeWidgetToFocus 對齊關注範圍。
- 範圍：code 物件切頁與初始顯示，維持自動動畫既有捲動與資料格式。

## 需求確認
- 已確認：重用舊有動畫捲動對齊邏輯；小驗證與 push。
- 尚待使用者回答：無。
- 合理假設：對齊整個關注範圍中心；沒有關注設定時不強制捲動。

## 重現與調查
- 重現狀態：已重現；修正前切到 c2 後 scrollTop 為 0，專屬案例失敗。
- 已確認：highlightCodeWidget 初始化時呼叫對齊，但 slidechanged 未呼叫；動畫 finalScroll 使用 codeFocusScrollTop。
- 尚待調查：無；普通切換、配對動畫起點與結束後對齊均已小驗證。

## 修改邊界與依賴
- slides.js：新增當前投影片對齊排程，接 ready、slidechanged、slidetransitionend、overviewhidden。
- slides.html／entrypoints：快取版本；專屬瀏覽器案例。
- 共用介面：沿用既有對齊函式與 codeAutoAnimating 標記；不改動畫路徑、事件或存檔。
- 依賴：無。

## 驗收條件
- [x] 第一次／再次切到已設定關注行的 code 物件，關注範圍置中。
- [x] 初始顯示及快速切換後，僅對齊目前頁面。
- [x] 配對 code 自動動畫保留原對齊終點，不被新排程提前改變捲動。
- [x] 未設定關注行的 code 物件不因切頁回到頂部。
- [x] 編輯模式與觀賞模式切換投影片皆對齊，無瀏覽器錯誤。

## 驗證計畫
- 子代理：V2/C 最小合成 code 物件案例，測普通切換及 code 自動動畫事件前／結束後的定點；不跑動畫 suite 或演算法 RUN。
- 主代理：完整回歸與真實演算法投影片整合驗收。
- 隔離：隨機埠、獨立 Edge context、80 行合成程式碼。

## 變更紀錄
- 2026-09-18：初始定義。
