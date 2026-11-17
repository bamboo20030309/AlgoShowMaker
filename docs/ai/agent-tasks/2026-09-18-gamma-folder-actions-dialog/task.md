# gamma-folder-actions-dialog：資料夾命名與移除視窗

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：2d338a23fa025ad9c1f6fcc7d6c2c8dedb4cae3b
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境：點資料夾命名／移除圖示。
- 目前行為：瀏覽器prompt／confirm。
- 希望結果：兩者皆使用自行編寫、符合網站風格的彈出視窗。
- 範圍：我的投影片資料夾，不改投影片本身的設定視窗。

## 需求確認
- 已確認：站內彈出介面、僅小驗證。
- 尚待回答：之前push授權確認仍待回覆。
- 合理假設：命名沿用新增資料夾dialog；移除顯示名稱、保留檔案與其他分類說明，預設聚焦取消。

## 重現與調查
- 原prompt與confirm已靜態確認；功能調整不適用錯誤重現。
- 尚待調查：無。

## 修改邊界與依賴
- library-organizer.js：共用命名dialog、新移除dialog生命週期與防重複操作。
- index.html：移除確認視窗、入口版號；entrypoints與專屬瀏覽器案例。
- 共用介面：不改資料格式／API，沿用removeFolder多分類保留邏輯。
- 依賴：既有資料夾站內新增視窗與多分類。

## 驗收條件
- [x] 命名顯示原名稱，可取消、編輯並保存，失敗保留輸入供重試。
- [x] 移除顯示資料夾名稱及檔案保留說明，取消／Esc不移除，失敗可重試。
- [x] 移除只處理分類、不刪檔案；整個流程不開瀏覽器prompt／confirm。

## 驗證計畫
- V1/B工作區專屬瀏覽器、入口、語法与diff檢查；隨機埠／Edge、合成資料与mock API。
- 主代理整合後完整回歸与實機操作；不跑大型回歸。

## 變更紀錄
- 2026-09-18：初始定義。
