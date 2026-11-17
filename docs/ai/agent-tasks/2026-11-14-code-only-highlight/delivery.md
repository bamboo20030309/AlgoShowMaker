# 純程式碼事件反白統一

使用者確認：事件執行期間黃色、完成後灰色，只有程式碼動作也採同樣規則。

移除 trace-code-presenter 對 call 的 activeCall 特例，不再一開始就直接當完成。執行中的事件優先於舊完成記錄，避免同一片段同時帶 is-active 與 is-complete。保留明確關閉呼叫的設定、既有條件比較結果色與完成記錄持久性。

驗證：

- code-only-events.browser.test.js 使用與正式下一步相同的 Player.apply/render，檢查 visit(n)、cout、printf 在執行時的 is-active、呼叫完成後 is-complete，以及播放結束無殘留 active。
- code-highlight-state.test.js：既有穩定重繪、離開再返回、切換 Trace 的完成記錄測試通過；新增 call/output/function-enter/return 的執行優先與明確關閉呼叫檢查。
- code-presentation.integration.test.js 只選相關條件反白規格，確保比較結果色與關閉規則不變。
- 語法與差異檢查；V2 局部驗證，不執行大型動畫驗證。

前端 code presenter 更新 code-39，投影片 iframe trace-runtime-118。此修正不改 Trace 資料，不需要重新 RUN 動畫。
