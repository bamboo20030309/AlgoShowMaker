# alpha-automark：來源指令指定自動固定陣列

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：6660b4f2c017a7092fd5a5881eba33cdc5bd51d8
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows

## 問題與預期結果
- 情境與操作：使用者希望指定本幀哪些陣列顯示自動固定，不用只靠全域開關。
- 目前行為：沒有來源指令限制對象。
- 使用者希望的結果：採用先前設計，改名為@automark，單／多陣列與none可用，preset可重用。
- 本次範圍與必要限制：只限制自動固定呈現；不改最後存取分析或手動@style mark，不強制啟用全域／幀開關已關閉的標記。

## 需求確認
- 已確認：指令名稱@automark，照先前設計實作；小驗證後commit與push alpha分支。
- 最新確認：每次alpha程式更新完成後需重啟自身3101服務，不以臨時隨機埠驗證替代；使用者本次明確授權重啟3101。
- 尚待使用者回答：無。
- 代理採用的合理假設：附屬最近@frame；defaults、preset、來源本地依序覆寫，最後指令生效；未寫時沿用目前設定。只接受現有自動固定支援的一維陣列／sequence、stack、queue、set，非法／不可見／重複名稱報錯；不新增範圍或when語法。

## 重現與調查
- 最小操作步驟或fixture：兩個陣列各有最後存取，跨幀切換指定單陣列、多陣列、none及未指定。
- 重現狀態：功能新增不適用。
- 已確認事實：自動固定由事件重建，renderer與tween共享累積highlights；新欄位只過濾此呈現結果。
- 尚待調查：無；主代理整合驗收待核實。

## 修改邊界與依賴
- 預計修改檔案或模組：trace-instrumenter、server映射、model、renderer、directive-assist、入口cache、專項測試及文件。
- 共用檔案／介面與協調結果：autoMarkVariableIds為null（沿用）或陣列（白名單，空陣列表示none）；以當幀runtime identity處理別名。選擇未顯示陣列時只捕捉，不增加顯示物件。
- 依賴任務：同分支alpha-auto-fixed共享highlights修正。

## 驗收條件
- [x] @automark單陣列／多陣列／none有效，未寫保持既有行为，defaults／preset／本地按順序覆寫。
- [x] 最後存取分析與事件記錄保留；只改可見固定標記，runtime別名匹配。
- [x] 前進／後退／JSON重載與Studio符合目前幀的白名單，手動mark仍獨立可見。
- [x] 無效格式／不可見變數／不支援型別明確报錯；舊trace缺欄位保持相容。

## 驗證計畫
- 子代理小驗證：V2 E/H/J，專項解析／呈現與實際SVG，選必要入口／提示小測試。
- 主代理整合驗收：核實新增欄位各介面還原與使用者線篩preset的演算法投影片呈現。
- 測試隔離方式：本worktree隨機埠服務與獨立headless Edge，不操作主要服務或使用者deck。

## 變更紀錄
- 2026-09-18：使用者確認採用設計並改名@automark，建立初始定義。
- 2026-09-18：11個直接相關案例、8個JS語法與差異檢查通過；隔離RUN與SVG確認兩陣列各幀顯示符合白名單，none不延遲手動mark、舊固定切幀修正保持；未跑完整regression。
- 2026-09-18：3101前端已是alpha新版但常駐Node仍載入舊parser，使用者兩行@text分析回400。核對來源前端hash與PID後重啟3101，兩行及@automark分析回200，加入後續每次程式更新重啟3101的指示。
