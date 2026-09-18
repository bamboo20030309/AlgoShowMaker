# gamma-sample-math-load 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：85342ee78f0c9cbe20ac40b67ff9e49fe8c2a51a
- 程式修正 commit：7e7cca526ba392a8a9bdc475b1aa3c02f3da604e
- 驗證版本：上述commit相同程式diff，測試時尚未提交。
- 日期：2026-09-18

## 根因與修改
- 範例HTML原body初始編輯模式，等下載archive後才切觀賞。現在在控制欄解析前同步套用shared-view-only並移除asm-edit-mode。
- 原Reveal KaTeX plugin在initialize後從CDN latest載入，初始公式缺引擎會plain；刷新另延遲1200ms。
- KaTeX 0.16.22官方原版browser引擎、auto-render、CSS及fonts本機託管，包含MIT LICENSE及來源README；不修改共用node_modules。
- slides.html先載入KaTeX，預載常用字型；paintWidgetElement建立LaTeX時立即排版；ready立即刷新、字型ready後重算尺寸。
- Reveal數學plugin使用已載入本機auto-render，跳過latex-content避免重複排版，保留原inline delimiters。
- 修改：slides.html、slides.js、vendor/katex與來源文件、載入專項及入口測試。
- README／版本紀錄：vendor來源README與授權更新，沒有額外使用者操作。
- 與task.md差異：無。

## 驗收條件對照
| 條件 | 方式 | 實際结果 | 判定 |
|---|---|---|---|
| 延遲範例不閃編輯介面 | catalog gate延遲、逐RAF觀察 | editorPaints=[]、側欄/模式鈕不可見 | 通過 |
| 正常觀賞入口 | 載入合成archive | viewer維持、首頁可見 | 通過 |
| 首次公式立即排版且不依賴CDN | 封鎖https、MutationObserver首次插入 | katex元素已存在、engine=katex、無外部請求 | 通過 |
| 原LaTeX編輯/匯入/history | 既有latex-refresh專項 | 同ID、編輯、undo/redo通過 | 通過 |

## 小驗證與重跑方式
- 執行目錄：本worktree/algo-vis-backend。
- 指令：node --test tests/sample-latex-load.browser.test.js tests/latex-refresh.browser.test.js tests/entrypoints.test.js
- fixture：單頁合成公式archive、延遲範例目錄；latex-refresh使用合成JSON。
- 環境：各測試自建隨機埠ASM_REGRESSION服務，獨立無頭Edge，不用主服務或私人資料；sample測試封鎖所有https。
- 實際：3通過、0失敗、0skip，exit code 0。
- 首次失敗：Node合成archive缺少ASMTraceProvenance；補入既有真實版本模組後重跑，未修改產品驗證或放寬斷言。
- node --check public/slides.js、tests/sample-latex-load.browser.test.js，及git diff --check：皆exit code 0。
- 證據：提交測試；test-results/sample-latex-load.png已視覺檢視，僅本機保存、不提交。

## 驗證分級與選擇
- V1，分類A/B/C，普通投影片模式與公式元件。
- 未執行演算法驗證集、完整regression及全部tests：不修改動畫資料流，依最新通知限縮。
- 未作跨裝置量化效能benchmark，不宣稱固定加速倍數；驗證的是首次插入排版與消除延遲刷新/CDN依賴。
- 主代理補：實際範例與大量公式deck、手機字型布局、分享viewer入口（本次提前模式僅sample）。

## 剩餘事項與合併注意
- 新增固定版browser資產約1.38MB，主代理需完整合併fonts/授權，避免只合併腳本引用。
- 共用slides.js與快取版本需協調。
- 此版本未merge main/intergration；由主代理先整合intergration。
- 依既有明確授權push本分支程式、測試與任務／交付文件。

## gamma開發預覽服務核實
- 預覽：http://localhost:3103。
- 重啟前3103 PID36332、命令node server.js；HTTP slides.js SHA256與gamma worktree完全一致，確認來源後只停止該PID。
- 新PID41452、命令使用gamma worktree的完整server.js路徑、隱藏背景啟動。
- HTTP /slides.html=200且含sample-math-load-192；/slides.js及/vendor/katex/katex.min.js=200、內容與gamma檔案一致。
- logs在系統Temp asm-gamma-3103-*.log，不提交；未讀取或記錄憑證。
- 未操作3000、3100、3101、3102或Docker。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式commit與diff範圍：待填
- 差異審查與必要重跑結果：待填
- 合併commit：待填
- 完整regression：未執行
- 演算法投影片實際驗證：未執行
- 未完成或環境阻塞：無，待整合核實
- 本機服務重啟：gamma3103已核實；主代理3100待整合驗收後重啟
- Push／公開部署：依授權推送gamma分支，未部署
