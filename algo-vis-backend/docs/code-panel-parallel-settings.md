# 程式碼片段：獨立滾動與尺寸

在 Trace Studio 點選畫面上的程式碼片段，右側「程式碼片段」可調整字級、
最大寬度、最大高度與片段滾動時間。放大字級的上限由 32px 增為 64px。
寬高為畫布的百分比，控制可用上限而非強制把短片段拉寬。

變更沿用設定保存與 undo/redo 流程，寫入程式碼底部 `@asm-view` 的 studio：

```json
{
  "codePanelFontSize": 48,
  "codePanelWidthPercent": 80,
  "codePanelHeightPercent": 90,
  "codePanelScrollMs": 1200
}
```

滾動時間 0～2000ms，0 代表直接換頁而不是停用事件動畫。寬高 20～95%。
缺少新尺寸欄位時仍使用原 CSS 的寬高上限；缺少滾動時間使用原 460ms。
保留既有字級、位置與明確 0，不需遷移舊 trace／例子。

## 排程

片段滾動不再作為 canvas 的 initialDelay，程式碼事件高亮也不再插入
400ms 前置等待。片段與事件共用開始時刻，但分別依自己的時長播放；
事件 gapMs 繼續只管理事件之間的間隔。Player 等待兩個 Promise 都完成，
因此整段取兩者最晚完成時間，而不是把滾動時長加到事件時長。
穩定幀／快速跳幀直接換頁；取消或重新 render 會結束前一個片段轉場。

## 局部驗證

V2／D、G、J；獨立 31992，headless Edge，不操作使用者分頁。
`code-panel-settings.browser.test.js` 使用真正介面調整、寫入 source、RUN、
JSON 重開，驗證新設定、舊資料缺少欄位及明確 0。長片段幾何 fixture 配合
真正編譯的 compare／assign 事件，驗證 1x／4x 手動與 Play 的实际重疊；
滾動 0 時事件仍播放，沒有殘留 expanded page。
`retained-compare.browser.test.js` 保留 keep 格子與 pointer 的實際運動斷言。
`pointer-model.browser.test.js` 僅選倍增進退場與 11→12 置中兩個案例。
`code-presentation.integration.test.js` 僅選字級、滾動焦點及局部轉場案例。
`entrypoints.test.js` 核對 Tween trace-289／Presenter code-34／Player trace-27／
Studio trace-138／CSS trace-37。未執行完整 regression。
