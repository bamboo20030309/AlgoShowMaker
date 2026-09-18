# 自動標記與文字陣列整合核實

- 日期：2026-09-18；intergration 前次773dbc4；Alpha交付4fa38f4，Beta／Gamma無新提交。
- 完整受測程式與主代理嵌入驗證：58c15f71c5408400489b1a0c7186599825741fa4。
- main保留ddfe5b6081261a05b437a61a546861151d4618e5，不合併main、不發布release／部署。

## 本次具體改動

- @automark 依每幀指定自動標記目標，支援列表／none與preset/defaults，保留手動mark及全域關閉優先序；parser/server/model欄位映射一致。
- 自動固定／標記納入完整幀樣式與tween呈現，避免切幀後消失或要靠Studio重畫才出現。一般@events animate off不關閉持久fixed狀態，明確fixed來源規則相容保留。
- 批次箭頭呈現子ID按繪圖角色配對，跨實際迴圈instance仍能位移；箭頭出入與動畫不依賴runtime事件開關。
- @text可插值整個、巢狀、空、字串陣列及包含兩端的切片，依當幀快照求值；JSON/TTS/Studio使用一致格式，非文字expression模式不開放範圍。
- 普通文字、分段與Studio未指定字級時fallback14px，保留明確自訂字級。
- 新helper與舊trace相容；入口快取與model／rules／renderer／tween／studio／助手同步。合併無衝突，既有元件與功能保留。

## 驗證

在intergration/algo-vis-backend以ASM_TEST_BASE_URL指向隔離服務：

```powershell
node --test --test-concurrency=1 tests/automark.test.js tests/automark.browser.test.js tests/auto-fixed-playback.browser.test.js tests/events-fixed-state.test.js tests/events-fixed-state.browser.test.js tests/drawing-arrow-animation.browser.test.js tests/text-arrays.test.js tests/text-arrays.browser.test.js tests/drawing-loops.test.js tests/arrow-identity.test.js tests/event-defaults.test.js tests/style-layer.test.js tests/text-object-bindings.test.js tests/object-inspector-font-size.test.js tests/entrypoints.test.js tests/directive-assist.test.js
```

- 第一批49案例：47pass、2fail，約63秒；兩個失敗均屬主代理新增嵌入fixture，沒有修改產品行為或放寬斷言。
- automark獨立頁最後的全域off驗證把關閉狀態帶入iframe；恢復fixture的全域on後只重跑automark.browser.test.js，1pass/0fail/0skip、exit0，約19秒。
- text-arrays嵌入使用不存在的code變數，改用trace.sourceCode；只重跑text-arrays.browser.test.js，1pass/0fail/0skip、exit0，約4秒。
- 合計49個不同案例均通過；原批其他47案例不受fixture修訂影響，未機械重跑全套。相關JS語法／git diff --check通過。
- 隔離埠63219、60468、57132；ASM_REGRESSION=1、獨立JWT、不可連線隔離Mongo URI、独立headless Edge，finally停止服務。沒有讀寫私人deck或操作使用者分頁。
- 最小C++/SVG核實自動標記前後切頁、全域off與手動mark、Studio重畫、JSON重載；fixed狀態不受一般事件off影響；箭頭配對中間位置與出入；文字整體／切片／巢狀陣列、迴圈快照、JSON字級及TTS內容；既有字級／文字binding／style／preset契約通過。
- 主代理新增真正slides.html algorithm-animation runtime iframe：標記各幀／前進／重載及手動mark與獨立頁一致；文字內容、字級、TTS與迴圈切片結果一致。
- V2/E/F/H/J及必要A字級／入口；不執行完整regression／大演算法集。未驗證所有演算法／幀／速度、完整自動播放、公開Docker、真實資料庫、實機、asmdeck匯出重匯入或音訊朗讀品質。
- 索引87檔，新8檔按E與H列入，逐檔比對無缺漏；test-results、runner、TAP/log不提交。

## 服務與交付

- 3100重啟PID15136；九個入口／修改模組HTTP200與SHA-256一致。
- 3000、3101、3102、3103均HTTP200，未停止其他代理或main／Docker。
- 預覽http://localhost:3100；依持续授權push到GitHub bamboo20030309/AlgoShowMaker 的origin/intergration，成功與否以最終遠端SHA核對為準。
