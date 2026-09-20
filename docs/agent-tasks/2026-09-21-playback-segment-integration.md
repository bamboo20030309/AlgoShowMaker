# 2026-09-21 播放、線段樹與時間線整合紀錄

## 整合範圍

- 起點：`intergration` 的 `ca91cc99`。
- Gamma：`codex/2026-09-18-gamma` 至 `65164c4`，隱藏、停用或不可呈現事件不再產生時間線標籤。
- Alpha：`codex/2026-09-19-alpha-segment-tree` 至 `cfe74f0`，加入 Segment Tree 建樹／查詢拆分、完整範例複合欄位與背景、具名指標、segment 交接及二元加法投影片重建。
- Beta：`codex/2026-09-18-beta` 至 `0fd27db`，加入穩定幀導覽、連續下一步、reference alias 樣式延續、fixed mark 時序、marker 排版及隱藏分頁暫停。
- 合併 commit：`1e3b956`、`e7e78b2`、`d57bad5`。

## 衝突處理

- 共用入口保留各模組最新快取版：tween `trace-222`、renderer `trace-202`、Studio `trace-121`、front `random-id-34`。
- `trace-frame-tween.js` 同時保留 Alpha 的複合欄位 highlight 合併與 Beta 的 fixed mark／reference alias 行為。
- `trace-renderer.js` 保留 Beta 的 authored fixed hint 顯示時序，並同時匯出 frame highlight 與 fixed-style API。
- 二進位加法投影片測試改以當前 provenance 引擎版等待重建完成，並涵蓋完整事件轉場。
- Segment Tree 背景連續性測試依穩定物件鍵追蹤暫移到 animation effect layer 的可見格。

## 主代理驗證

- 語法與差異：受修改 JavaScript 的 `node --check` 及 `git diff --check` 通過。
- 聯合集合：16 個直接相關測試檔，共 123 個案例，123/123 通過。
- 覆蓋：舊投影片 trace 重建、二元加法來源動畫、三個 Segment Tree 範例、完整 lazy／set 背景與 segment、reference alias、heap swap fixed mark、連續播放、隱藏分頁、事件時間線、provenance、entrypoint、style replay、sequence 與 marker 排程。
- 初次發現的兩項失敗均已追查到測試觀測範圍：事件格在動畫效果層中的暫時位置，以及較長播放流程超出舊取樣上限；修正觀測後重新執行並通過，未放寬產品斷言。
- 未執行全部測試；依驗證分級，改以本次三分支影響範圍的聯合集合與限定動畫案例驗收。
- Heap 限定動畫回歸通過：algorithm 548 samples、editor 543 samples、runtime 548 samples；前置 cloud storage、slide order 與 deck import repair 亦通過。

## 新增驗證集索引

- `tests/binary-addition-slide.browser.test.js`：舊引擎投影片自動重建，並驗證 Segment Tree 父節點的兩來源加法動畫。
- `tests/playback-navigation.browser.test.js`：瀏覽器三連點、長按 repeat、上一步及穩定幀切換。
- `tests/reference-alias-style.browser.test.js`：reference alias 返回時的 focus／fixed mark，以及 heap swap 後固定標記位置。
- `tests/trace-player-navigation.test.js`：播放器上一幀、時間線、動畫中下一步與 hidden navigation 契約。
- `tests/event-defaults.test.js` 新案例：停用或不可呈現的事件不建立時間線標籤。
- `tests/heap-composite-segments.browser.test.js` 新案例：建樹、查詢、完整 Segment Tree 的複合欄位、背景與 segment 連續性。

## 服務與發布

- 本輪只更新 `intergration`，不合併 `main`。
- 驗證完成後重啟 3100，並核對 HTTP、trace 分析與前端快取版本。
- 推送 `origin/intergration`；不建立 release、不部署公開主機。
