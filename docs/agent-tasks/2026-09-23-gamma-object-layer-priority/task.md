# 2026-09-23-gamma-object-layer-priority：投影片物件圖層優先級

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：7f6e886674171bd22334e6f884783f64d2ce5dc8
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：投影片已有 structure，新增箭頭後按「移到最上面」。
- 目前行為：新箭頭不是最高層；移到最上層會重新編號全部物件，使所有 structure 的層級被降低並可能看不到。
- 使用者希望的結果：新建立的物件自動位於目前最高層；調整單一物件圖層不應重設其他 structure 的層級。
- 本次範圍與必要限制：一般投影片的 Fabric 物件、structure／code／LaTeX widget、新增與圖層排序；不執行大規模驗證。

## 需求確認
- 已從使用者或上下文確認：新物件應有最高顯示優先級，箭頭移到最上層不能讓所有 structure 被整批調低。
- 尚待使用者回答：無。
- 代理採用的合理假設：圖片、TTS 載體與貼上產生的新物件也遵循相同最高層規則。

## 重現與調查
- 最小操作步驟或 fixture：建立兩個 layerIndex 2000／2010 的 structure，新增箭頭，再將箭頭移到底層及頂層。
- 重現狀態：已重現。
- 已確認事實：新 Fabric 物件預設 1000、widget 預設 2000；排序後 `applyUnifiedLayerEntries` 會把所有項目從 100 起重新編號。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.js`、入口版本及圖層局部瀏覽器測試。
- 共用檔案／介面與協調結果：沿用現有 `layerIndex` 欄位，不改 deck 格式。
- 依賴任務：無。

## 驗收條件
- [x] 新增箭頭的 layerIndex 高於投影片中所有既有 Fabric 與 widget。
- [x] 箭頭移到底層再移到頂層時，既有 structure 的 layerIndex 不變且仍顯示。
- [x] 箭頭之後新增的 structure 自動成為新的最高層物件。

## 驗證計畫
- 子代理小驗證：JavaScript 語法、入口測試及單一物件圖層瀏覽器測試。
- 主代理整合驗收：整合後以重疊的箭頭與 structure 人工切換上下層並確認顯示及點選。
- 測試隔離方式：隨機埠、獨立無頭瀏覽器及測試 deck，不操作使用者投影片。

## 變更紀錄
- 2026-09-23：依使用者回報，修正新增物件與跨 Fabric／widget 的圖層排序。
