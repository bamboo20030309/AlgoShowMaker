# RUN 解析警告與重編譯控制移除

- 日期：2026-10-07；基準：intergration 32cfc18。
- 使用者要求：移除重編譯按鈕／快捷鍵；從語法樹到動畫解析的失敗需明確警告。

## 完成內容

- 移除重編譯按鈕、相關 CSS、前端 forceRecompile 請求參數，以及 Ctrl／Cmd＋Shift＋Enter 的執行綁定。Ctrl／Cmd＋Enter 的正常 RUN 保留。後端既有快取略過 API 保持相容，不再提供介面入口。
- 右側工作區新增 role=alert 警告區，可跨畫布／輸出／除錯分頁查看，下一次 RUN 清空並重新判定。
- 語法樹 HTTP／JSON／渲染失敗、缺少根節點，以及 Error 節點均有原因與可用行號；解析器不支援不直接判定 C++ 無法編譯。
- 追蹤分析降級到一般執行時明示動畫未建立；後端插樁、動畫檔／Trace 讀取警告直接呈現。空影格、缺少應回傳的動畫、來源不一致、前端 Trace 繪製或舊腳本執行失敗都有階段提示；失敗會清除舊动画。
- 後續幀中全部已開啟的主要畫布事件都不可播放、且有 missing-target 時，提示相關物件／指標，避免 KMP 類案例只改數值卻無聲略過全部事件動畫。正常關閉事件及第一幀初始化不因此警告；不更改事件的開關與可用性判定。
- 版本：front random-id-51、compile syntax-12、syntax-tree syntax-4、style brand-shared-12。

## 驗證與相容性

- V1／V2，只執行直接相關測試，未跑大型演算法驗證。
- 9 個不同案例通過：compile-pipeline-warnings.browser、force-recompile.browser、entrypoints、no-drawing-transition.browser、runtime-local-editor.browser、source-newlines.browser 各 1 案；empty-compile.integration 2 案；pipeline-read-failure.integration 1 案。無略過。
- 實際隔離瀏覽器核實解析失敗的可見警告、正常輸出保留、切換畫布仍可見、下一次成功 RUN 清除警告、舊動畫清除、KMP 無可見目標提示；fault fixture 僅載入隔離後端，確認檔案／Trace 讀取失敗都回傳警告，服務保持存活。
- 舊展示資料實際載入、使用、儲存、重開；自訂字體及明確 false 設定保留。本次未新增持久化欄位。正常 RUN 快取仍可用，已移除的快捷鍵不提交請求。
- 初次 runtime-local-editor 測試仍期待舊重編譯按鈕，依本次新規格改為 count=0，只續跑該失敗項目並通過。其餘通過項目僅在直接依賴有後續修改時續跑。
- JS 語法與 git diff --check 通過。畫面證據在忽略的 test-results/compile-pipeline-warning.png；未提交測試產物、log 或私人草稿。

## 服務與交付

- 核對 3100 原 PID 56924 與整合來源後重啟；新 PID 19808，HTTP 200，警告區存在、重編譯按鈕不存在，compile syntax-12。
- 交付提交推送 origin/intergration；未合併 main、未發布 release；3000、其他代理及 Docker 未重啟。
