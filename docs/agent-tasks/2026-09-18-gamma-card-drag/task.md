# gamma-card-drag：整張投影片卡片拖曳

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：d355a25bbcd5d464aafd16064d947c6d65524d61
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境：我的投影片整理卡片。
- 目前行為：pointer 拖曳只監聽把手，其餘依賴 native drag，體驗不一致。
- 希望結果：整張卡片範圍皆能拖動整份投影片，不限縮圖。
- 範圍：工作區卡片拖曳；不改編輯器內頁面。

## 需求確認
- 已確認：完整卡片範圍拖曳、小驗證後 push。
- 尚待使用者回答：無。
- 合理假設：正常單击保留開啟／設定；資料夾 select 保留原生選取，不劫持輸入。

## 重現與調查
- 已確認：原 pointerdown 僅接受 library-drag-handle。
- 重現狀態：静態確認與真實滑鼠小驗證。
- 尚待調查：無。

## 修改邊界與依賴
- library-organizer.js：全卡片 pointer 起點、6px 門檻、捕捉、取消與誤點防止、圖片 native drag 避免。
- home.css：抓取游標／來源樣式；index.html／entrypoints 版本；現有工作區瀏覽器測試。
- 共用介面：不改資料格式與 API。
- 依賴：既有工作區整理模組。

## 驗收條件
- [x] 標題、資訊、卡片空白、縮圖、設定按鈕及把手可按住拖曳排序。
- [x] 拖曳結束不誤開啟投影片或設定，正常單击仍保留操作。
- [x] 既有資料夾選單、跨資料夾整理及其他工作區小驗證通過。

## 驗證計畫
- V1/B，獨立 Edge 與隨機埠、合成卡片與 mock API，真實滑鼠重點操作。
- 主代理整合後完整回歸與實機觸控；不跑大型 regression。

## 變更紀錄
- 2026-09-18：初始定義。
