# KMP 同一變數指向不同陣列的指標入場

## 原因與修正

abababca 的第 21→22 幀，新增 j at p，之前已有 j at s。兩者 canonical pointer instance ID 不同，配對計畫正確判為 ENTER；但 previousAliasKey 仍按來源 j 的 runtime lifetime 借用舊 marker（s 上的 j）的座標，造成 p 的 j 先出現在 s。

指標不再使用純量 runtime identity 的通用 alias 尋找上一視覺位置。canonical 指標配對／遞迴角色延續先決定 continuation，普通陣列與 reference alias 的通用位置流程維持原有入口。未改 C++、pointer 語法、指標交換路徑或現有容許值。tween 版本 trace-301。

## V2 驗證

- 新增 kmp-fallback-multitarget.cpp：與使用者例子相同的分幀、指標、arrow、before(j)、autoFixed=false；說明文字縮短，仍為 30 幀。
- 新增 pointer-multitarget-entrance.browser.test.js：修正前確認 p marker 相對 p 的偏移約 -196.5（落在 s 區域），修正後在 p 上入場；s 的 j 獨立移動。第 22 幀及下一幀定點正常。以 root 座標比較，排除相機 zoom 干擾。舊 Trace 移除 explicitPointer／implicitIndex 後重開同樣通過。
- pointer-model 八個單元案例、entrypoints 通過；pointer-model.browser 三個 canonical／Merge Sort 指標入場／移動及同格重排案例通過。
- 瀏覽器三案例首次缺少 ASM_TEST_BASE_URL 而未執行，補上隔離服務僅重跑該三案例，全部通過；未改答案。
- 全部使用獨立服務／瀏覽器，不操作使用者分頁或教材。JS 語法與 git diff --check 通過，不啟動大型驗證。

## 交付

重啟 3100 並核對 HTTP 200、trace-301 與整合來源一致。推送 intergration，不合併 main，不發布 release。