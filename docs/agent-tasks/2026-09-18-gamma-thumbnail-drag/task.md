# gamma-thumbnail-drag：縮圖也能拖曳整張投影片

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：ad72d6aa22675681f6e3d71283c58d85a45ea489
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 情境：我的投影片從縮圖開始拖曳。
- 目前：會觸發原生圖片拖曳。
- 預期：移動整張投影片卡片，支援排序及既有資料夾分類。
- 範圍：前端縮圖建立流程，維持點擊開啟與整卡拖曳邏輯。

## 需求確認
- 已確認：縮圖區域應能拖曳整張卡片；不跑大規模驗證。
- 尚待回答：無。
- 合理假設：無。

## 重現與調查
- 重現：缺少封面時由非同步流程稍後生成img，預設draggable為true。
- 已確認：organizer只在同步建立卡片時停用現有圖片拖曳，無法處理稍後加入圖片。
- 重現狀態：已重現非同步圖片未停用拖曳；修正後瀏覽器實際拖曳排序通過。
- 尚待調查：無。

## 修改邊界與依賴
- public/home.js：建立img時設定draggable=false。
- public/index.html：home.js快取更新。
- tests/library-folders.browser.test.js、tests/entrypoints.test.js。
- 共用介面：無修改，主代理協調快取版本。
- 依賴：無。

## 驗收條件
- [x] 非同步生成縮圖的draggable=false。
- [x] 從縮圖開始的實際滑鼠拖曳可改變卡片排序，且不開啟投影片。
- [x] 既有資料夾拖曳與儲存流程通過相关小驗證。

## 驗證計畫
- 小驗證：非同步生成fixture加實際滑鼠拖曳，以及既有資料夾瀏覽器測試。
- 主代理：整合後驗收與完整回歸。
- 隔離：隨機埠、ASM_REGRESSION服務、獨立無頭Edge、mock資料。

## 變更紀錄
- 2026-09-18：初始定義與修正。
