# alpha-events-arrows：每幀事件控制與批次箭頭

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：ddfe5b6081261a05b437a61a546861151d4618e5
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows

## 問題與預期結果
- 情境與操作：使用者自行編寫 i<=7 的詳細幀，i>7 只擷取濃縮幀。
- 目前行為：缺少每幀條件式事件控制與箭頭繪圖迴圈。
- 使用者希望的結果：濃縮幀不播放細節事件動畫，一條箭頭指令可按使用者指定範圍或實際迴圈值展開多支箭頭；濃縮幀可放在內層迴圈之前。
- 範圍：不提供自動摘要、fast/faston 或新的演算法執行迴圈；維持既有 trace、資料結果與箭頭模型。

## 需求確認
- 已確認：使用者授權實作事件控制與批次箭頭；完成必要小驗證後 commit、push alpha 分支。
- 尚待使用者回答：無。
- 已確認的新語法：明確範圍改為 [start:end]，包含兩端；for j 自動對應唯一迴圈，for j in "loop_name" 明確指名 @loop as 命名的迴圈。有歧義時報錯，不按距離猜測。
- 合理假設：@events [種類列表] animate on/off [when 條件] 附屬最近的 @frame；條件用該幀擷取狀態求值。三種批次箭頭均支援單行／多行、局部繪圖索引與條件。
- 本輪已確認：使用者採用共用 @for／@endfor 繪圖區塊，讓 style、arrow、text 共用迴圈資料；不新增完整 C++ for 語法。既有 @arrow for 保留。

## 重現與調查
- 功能新增不適用；已確認 parser、server trace 映射、model 正規化、event 開關與共用 Arrow Model 路徑。
- iteration.last(...) 沿用既有衍生值。直接使用迴圈值時新增內部本體入口紀錄，保留每次入口與重複值；不播放為事件、不重跑演算法、不引入系統摘要集合。

## 修改邊界與依賴
- trace-instrumenter.js、lib/ASMTrace.hpp、server.js、trace-model.js、trace-rules.js、trace-events.js、trace-arrow-model.js、trace-renderer.js；指令提示與入口快取按實際需要更新。
- 共用介面：新增 frame.eventControls、arrow.batch、drawLoops；呈現展開使用 drawLocals；舊 trace 未包含欄位時保持原行為。
- 依賴任務：無。

## 驗收條件
- [x] 每幀事件控制不洩漏至其他幀；條件不成立保留原設定，資料結果與事件記錄仍存在。
- [x] 支援全部及選定種類事件；on/off 與 preset 可組合，無效語法有明確錯誤。
- [x] 批次箭頭支援動態範圍、步長、局部索引、條件、巢狀陣列與 iteration.last；穩定 ID、不新增 runtime 事件。
- [x] 空範圍正常；零步長、無法解析範圍與過大展開明確報錯。
- [x] 隔離瀏覽器實際 SVG 顯示多支箭頭，濃縮幀不排細節事件動畫且值正確。
- [x] [start:end] 動態端點與 step 可解析；舊 .. 明確提示新語法。
- [x] for j 只對應唯一候選，有歧義時要求具名；@loop 名稱不可重複，須緊接迴圈。
- [x] for／while／do 的入口值、break、continue、零次執行及重複值保留正確。
- [x] 迴圈前／內／後與外層回合、函式呼叫及遞迴 activation 分開，JSON 儲存重載仍能繪製同樣箭頭。
- [x] 實際 SVG 確認內層迴圈前的線篩濃縮幀 i=8／9 箭頭數為 1／2，目標為 16／18、27，不播放細節事件。
- [x] 共用區塊的 style、arrow、text 使用同一個實際入口值；手動範圍、唯一自動對應及具名對應均可使用。
- [x] 區塊索引不洩漏、不改 C++；preset 及巢狀不同索引可用，邊界／非法指令／組合超量有明確錯誤。
- [x] 實際 SVG 確認 i=9 的 prime[0,1] 高亮、合數18/27背景色、文字 j=0/j=1 綁定格子0/1，重載一致且不排事件動畫。

## 驗證計畫
- V2：E（指令／箭頭）、J（事件設定）、F（迴圈衍生值）。
- 語法與差異檢查、新增專項測試、直接相關 arrow/event/preset 測試；使用独立隨機埠與瀏覽器，不執行完整 regression 或廣泛排序。
- 主代理整合驗收：核實差異與最小線篩幀前後定點驗證；不機械式擴大範圍。

## 變更紀錄
- 2026-09-18：依使用者自行編寫濃縮幀的設計建立初始定義。
- 2026-09-18：最小線篩揭露疏幀時 iteration.last(j) 沿用較早生命週期的問題；補充只對沒有狀態幀的 scalar 生命週期從既有事件求值，仍由使用者自行定義繪圖範圍。
- 2026-09-18：49 個直接相關案例與真實 SVG 小驗證通過。主工作目錄目前由使用者／主代理置於 main，本任務保留獨立 worktree，交付後由主代理合併並重啟主要服務。
- 2026-09-18：使用者確認改用 [:] 並實作兩種直接迴圈寫法；沿用本任務分支，補充入口紀錄、回合隔離、前置濃縮幀與範圍遷移驗證。
- 2026-09-18：新版 54 個針對性案例通過；前置線篩濃縮幀已實際 RUN／SVG／事件排程與 JSON 重載驗證。
- 2026-09-18：使用者確認共用繪圖迴圈區塊；沿用本分支補充 scope 解析、style/text/arrow 局部值及最小真實 SVG 驗證。
- 2026-09-18：共用區塊 44 個針對性案例與真實 SVG 通過，保留 V2 小驗證範圍；主代理整合驗收仍待核實。
