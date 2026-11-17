# gamma-auth-center：登入區塊螢幕置中

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b3b9d9f51af858adf1ed40d8c0ea284755dc3982
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境與操作：訪客首頁左側演算法投影片列表拉長。
- 目前行為：auth-panel align-self:center 以整個 grid 高度置中，登入表單落在下方。
- 希望結果：登入表單對齊目前螢幕內容區的垂直中間。
- 範圍：首頁 CSS；不改認證或動畫。

## 需求確認
- 已確認：螢幕置中，修正後 push，僅小驗證。
- 尚待使用者回答：無。
- 合理假設：扣除頂部導覽列的可視區置中；桌面捲动時保持可見；短螢幕表單獨立捲動，窄螢幕先呈現登入再呈現範例，避免先捲完整個範例列表才能登入。

## 重現與調查
- 重現狀態：静態確認 align-self:center 問題。
- 已確認：guest-view 是兩欄 grid，左側資料夾列表決定整列高度。
- 尚待調查：無；桌面、短螢幕與手機合成案例均通過。

## 修改邊界與依賴
- home.css auth-panel 與 900px breakpoint；index.html／entrypoints.test.js 快取版本；專屬版面案例。
- 共用介面：不修改登入流程；examples-view 仍隱藏登入欄位。
- 依賴：無。

## 驗收條件
- [x] 長範例列表下，桌面登入區塊於可視內容區置中；頁面捲動後仍可見。
- [x] 短螢幕註冊／登入可以捲到所有欄位與按鈕，沒有內容被置中裁切。
- [x] 窄螢幕登入首先可見；範例獨立模式不產生空白登入區。

## 驗證計畫
- 子代理：V1/A 最小版面瀏覽器案例與入口檢查。
- 主代理：整合後完整回歸與實機登入。
- 隔離：隨機埠、獨立 Edge、空 mock 範例目錄與合成長列表高度，不跑演算法。

## 變更紀錄
- 2026-09-18：初始定義。
