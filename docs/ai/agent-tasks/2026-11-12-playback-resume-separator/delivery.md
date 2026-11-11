# 切回續播與逗號同步退場

## 原因與修正

trace-player在visibilitychange／pagehide時呼叫renderStable，取消當前事件並直接呈現目的幀。因此切回後已沒有原事件可接續。現在隱藏狀態按document／page／canvas原因共同管理，首次隱藏時記錄文件、幀、播放計畫及原本暫停／自動播放狀態，僅暫停時鐘與導覽；所有隱藏原因解除後才接續原計畫。手動暫停不自動解除，文件或幀／計畫已換掉時不恢復舊事件。

front的畫布分頁切換接入相同流程；導覽提供play與isPlaying供恢復原自動播放。切回時不重建SVG，也不跳過剩餘事件。

64→65幀的0原本只有數字淡出，分隔符直到效果清理才移除。現在捕捉欄位原逗號，使用與0相同的淡出透明度，清理時還原原屬性並依可見欄位移除分隔符，不影響後續重用。

## 驗證

- event-playback-control新增隔離瀏覽器案例：事件傳遞中切輸入／畫布、模擬document hidden／visible、原本手動暫停，以及自動播放；隱藏時transform不動，播放計畫ID不換，返回後結果7，手動暫停必須按播放才續播。
- 既有manual frame pause案例仍通過。
- multi-field-replay在新編譯與既有Trace的64→65幀、1倍／4倍速逐tick核對0與逗號的實際透明度相同；保留60→61原位覆蓋、24→25與其他多欄位驗證。

三項V2定向測試通過，語法與差異檢查通過；未跑完整回歸。快取tween trace-348、player trace-33、front frame-endpoints-62、slides-351、runtime-106；推送整合分支並重啟3100。
