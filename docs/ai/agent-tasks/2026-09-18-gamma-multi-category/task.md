# gamma-multi-category：個人與範例多分類

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：53c53776ebeb627cfaf72353fcbc1a45043dc6fc
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境：分類個人投影片與公開範例。
- 目前行為：個人 Layout 拒絕跨資料夾重複檔案，範例只有單一 category。
- 希望結果：同一投影片可同時屬於多個分類，兩者都需要。
- 範圍：分類、排序與清單呈現，不改 deck 內容或演算法。

## 需求確認
- 已確認：使用者明確選擇個人與範例兩者。
- 尚待回答：無。
- 合理假設：個人使用勾選分類視窗；分類中的卡片共用同一檔案；拖曳只搬目前分類，保留其他分類；拖至未分類清除全部分類；刪資料夾只移除該分類，無分類檔案才回未分類；總份數不重複計算。

## 重現與調查
- 功能新增不適用重現；原 validator 全域去重、entry.category 單值已確認。
- 尚待調查：真實 MongoDB／實機，交主代理整合驗收。

## 修改邊界與依賴
- library-layout.js：單分類內去重，多分類 assign／指定來源 move／removeFolder，維持舊格式相容。
- library-organizer.js：複選視窗、分類計數，拖曳攜來源分類，移除保留其他分類。
- guest-gallery.js：categories 陣列並支援舊 category 字串；guest-decks.json 線篩維持數學分類。
- index.html/home.css／版本、README、最小測試。
- 共用介面：preferences.slideLibrary 既有結構，現在允許檔案在不同 folders.deckIds 出現；同分類內或未分類／已分類重複仍拒絕。API 所有權檢查保留，不新增複本。
- 依賴：本分支既有資料夾整理功能。

## 驗收條件
- [x] 個人複選多分類後同份檔案出現在多區，重開保留。
- [x] 各分類排序獨立，拖曳／移除資料夾保留其他分類。
- [x] 清空選取回未分類，儲存失敗保留視窗供取消或重試。
- [x] 範例可出現在多分類，舊 category 相容，總份數不重複。
- [x] API 接受跨分類同檔，拒絕同分類重複／其他帳號檔案。

## 驗證計畫
- 子代理 V1/B，既有工作區瀏覽器案例與 Layout／記憶體模型 API 小測、入口與語法。
- 主代理完整回歸與真實帳號跨裝置分類保存。
- 隔離：隨機埠／Edge、合成卡片与 mock 範例 metadata；不跑演算法 RUN。

## 變更紀錄
- 2026-09-18：範圍確認兩者都需要，初始定義。
