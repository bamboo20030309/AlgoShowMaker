# gamma-list-backspace：編號文字的 Backspace

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b78d4a1ec93fa138c3a4aaa44de82fbdbe5f04ed
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：文字編輯中切換清單編號，再按 Backspace。
- 目前行為：編號被舊輸入欄位內容覆蓋而消失。
- 使用者希望的結果：刪除內文保留編號，刪到編號才移除。
- 範圍：文字編輯與清單切換；不變更演算法或動畫。

## 需求確認
- 已確認：只做必要小驗證，修正後 commit 與 push。
- 尚待使用者回答：無。
- 合理假設：編號沿用既有文字前綴，保留一般選取刪除行為。

## 重現與調查
- 步驟：雙擊文字，選取內文，點清單兩次切換成編號，移至末尾按 Backspace。
- 已確認事實：cycleTextList 更新 object.text，未更新 hiddenTextarea.value。
- 重現狀態：已重現；修正前原生輸入欄位仍為 Alpha，而畫面已切換編號。

## 修改邊界與依賴
- slides.js 清單切換、slides.html 與 entrypoints.test.js 快取版本、相關小驗證。
- 共用介面：沿用 Fabric hiddenTextarea 與 _updateTextarea，不改資料格式。
- 依賴：無。

## 驗收條件
- [x] 切換編號後 Backspace 只刪游標前的內文字元。
- [x] 刪除內文選取區域保留編號。
- [x] 游標刪到編號前綴時可刪除該字元。
- [x] 項目符號及取消清單不回復舊內容，儲存重新開啟保留結果。

## 驗證計畫
- 子代理：V1/B 專屬瀏覽器案例、語法與 entrypoints。
- 主代理：整合後完整回歸及演算法投影片驗收。
- 隔離：隨機埠、獨立 Edge context、合成文字投影片。

## 變更紀錄
- 2026-09-18：初始定義。
