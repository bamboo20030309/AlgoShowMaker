# 目的幀樣式回放與代理預覽核實

- 日期：2026-09-18；前次 intergration c00e103；本輪 Alpha 9c4d612，Beta／Gamma 沒有新程式提交。
- 完整受測版本含主代理 iframe 驗證：0ff5287e511817ee3592aa725609d833018ac995。
- 改動：往回重播仍按原事件順序處理數值，但樣式變數與 Rules 評估改用目的幀，避免回上一幀後高亮／focus 色停留於離開幀；獨立 helper 沒有目的幀時保留 fallback。tween 快取與 build 更新 trace-211，未改箭頭路徑或演算法。
- 主代理新增真實 algorithm-animation slide runtime iframe：同一線篩 trace 前進／返回／JSON 重載返回，各格填色／高亮符合目的幀，返回箭頭指向16、事件 steps=0。
- 分級 V2/H/J，僅本次直接相關案例，不跑完整 regression／廣泛排序。

```powershell
node --test --test-concurrency=1 tests/style-replay.browser.test.js tests/presented-style-values.integration.test.js tests/style-layer.test.js tests/entrypoints.test.js
```

- 目錄 intergration/algo-vis-backend；ASM_TEST_BASE_URL 指向隔離服務埠62441，ASM_REGRESSION=1、獨立 JWT、隔離不可連線 Mongo URI、獨立 Edge context。
- 9 pass、0 fail、0 skip，exit0，約24秒；20個JS語法檢查及差異檢查通過（本機 runner 提示仍寫11）。
- 最小線篩 i=8/9 前後／再次播放／重載與 speedSlider=500/1500 的單次自動播放通過，實際 SVG 與靜態目的幀一致；既有 presented styles／style layer／入口通過。
- 不操作使用者分頁或私人 deck，不放寬斷言；未驗證全套 Studio、所有演算法／幀、公開 Docker、遠端 DB、實機操作。測試腳本／TAP/log 不提交。
- 驗證索引79檔，新 style-replay.browser.test.js 歸H。

## 服務

- 原3101／3102／3103無listener，按使用者要求啟動：Alpha events-arrows 3101 PID4420、Beta 3102 PID18288、Gamma 3103 PID36332。
- 各 worktree 使用被忽略的 .env（復用主專案本機設定，不提交），PORT 由程序指定，服務共享本機 Mongo／雲端deck；不做破壞性私人資料測試。
- 三埠 slides.html HTTP200，SHA-256 與各自 worktree 一致。端口對應已記入整合分支與預覽設定.md。
- 3100 重啟後 PID24068，algorithm.html／trace-frame-tween.js HTTP200 且SHA-256與受測內容一致。
- 3000／3101／3102／3103均HTTP200；main 保持ddfe5b6081261a05b437a61a546861151d4618e5。main及Docker未重啟／合併。
- 依持續授權將程式與紀錄push至GitHub bamboo20030309/AlgoShowMaker 的 origin/intergration；最終以遠端SHA核對為準，不發布release或部署。
