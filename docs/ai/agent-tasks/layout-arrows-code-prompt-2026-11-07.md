# 樹箭頭方向與事件閱讀停留

## 行為

- recursion layout 新增 arrow-direction，支援 up／down／left／right／parent-to-child／child-to-parent。direction 仍負責節點位置，arrow-direction 只切換連線的箭頭端，不改邊 ID、端點錨點與幾何綁定。預設及舊 Trace 缺欄位時為 parent-to-child；reset 恢復此預設。edges off 繼續關閉箭頭。DFS flow-arrows 保留實際進入／返回語意，不受此設定改寫。
- 使用者確認「先黃色反白，稍等再播放格子／指標」。有有效程式來源範圍的畫布動作在 promptStart 反白，200ms 後才到 visualStart；速度 2 倍即約 100ms。動作本身時間與事件間隔不變。純反白事件已有停留時間、缺來源範圍的舊事件不追加無意義等待。
- 程式碼捲動仍用獨立時鐘，不累加整段捲動時間。新行為由前端播放時計算，舊 Trace 不必重 RUN 才有閱讀停留。新 arrow-direction 指令需 RUN 以保存解析結果。
- 此輪原先未變更遞迴節點宣告入場排程；後續已於 2026-11-08 完成，見 [遞迴節點宣告排程](recursion-declaration-clock-2026-11-08.md)。

## 驗證

- layout-directives.test.js 的 tree arrow direction：六種值、無效值、linear 拒絕及 reset。
- unresolved-markers.test.js 的 sourced prompt／code-only 兩項：200ms 提示與 220ms 宣告入場分開，純反白及無來源事件不追加提示。原測試仍期待早期 180ms 入場；核對現行 APPEAR_TIMING=220 後更正測試，沒有縮短產品動作。
- layout-arrow-prompt.browser.test.js：獨立服務與瀏覽器，實際 SVG 檢查上下兩種排版的 up／down／child-to-parent／舊資料缺欄位，JSON 儲存重開、edges 明確關閉，以及 1／2 倍速黃色提示期間無比較特效、之後特效啟動與 137ms 自訂事件間隔保留。
- code-panel-settings.browser.test.js 的捲動並行案例通過（手動／自動、1／4 倍速與零捲動時間）。原斷言把比較結果色塊當成整個比較動作的起點；新增 200ms 後色塊階段可能晚於捲動結束。記錄呼叫時刻確認捲動按原定時間正常結束，沒有被提前中止。驗證改為核對正式 visualStart 在捲動期間開始、比較色塊稍後確實出現、所有捲動完整結束；沒有修改捲動產品邏輯。
- 未跑全量 regression、未重建公開教材 Trace。新語法、前端腳本及文件一起交付 intergration，重啟 3100，不合併 main、不發布 release。
