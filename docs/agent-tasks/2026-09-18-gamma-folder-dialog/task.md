# gamma-folder-dialog：新增資料夾彈出視窗

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：396ecc9cf9375d2eda4e0849a4eb77527f2b2b5a
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境：我的投影片點新增資料夾。
- 目前行為：瀏覽器原生 prompt，風格與網頁不一致。
- 希望結果：網頁風格的名稱輸入、取消、建立彈出視窗。
- 範圍：新增資料夾；資料夾重新命名与移除沿用原操作。

## 需求確認
- 已確認：沿用當前設計，小驗證後 push。
- 尚待回答：無。
- 合理假設：使用既有 deck-dialog 樣式、native dialog 焦點管理；可 Enter 建立、Esc 關閉，建立中防重複送出，失敗保留名稱供重試。

## 重現與調查
- 功能調整不適用重現；原 createButton 使用 prompt 已確認。
- 尚待調查：無。

## 修改邊界與依賴
- index.html：新增 dialog，沿用既有 deck-dialog、dialog-heading/actions 與按鈕樣式。
- library-organizer.js：開關、驗證與非同步提交；快取版本、entrypoints 与既有專屬測試。
- 共用介面：change 回傳成功狀態，不改 API 或資料格式。
- 依賴：此分支既有工作區資料夾。

## 驗收條件
- [x] 新增資料夾使用站內彈出視窗，開啟後聚焦名稱。
- [x] 取消与 Esc 不建立；空白名稱不得建立。
- [x] Enter 可建立、成功關閉；儲存失敗保留名稱與視窗並顯示錯誤，能重試。
- [x] 既有拖曳與資料夾整理小驗證維持通過。

## 驗證計畫
- V1/B，重跑工作區專屬瀏覽器測試與入口、語法檢查；獨立服務與 Edge，合成資料。
- 主代理整合後補完整回歸與實機操作；不跑大型回歸。

## 變更紀錄
- 2026-09-18：初始定義。
