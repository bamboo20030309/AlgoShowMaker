# 共用索引格子定位端點

## 任務與原因

KMP 的 `s[p[j-1]].index-label.bottom` 在 arrow 解析階段失敗，整次執行回落為普通 C++。原本 style 支援 index-label，但定位 parser 不支援，且不同轉接入口挑選欄位會遺失子目標資訊。

## 共用設計與範圍

index-label 放在 parseAtBinding 的共用解析中，不在 parseArrowTarget 補專屬正則。arrow、place、text、camera 都取得 indexLabel=true、來源名稱／ID、安全索引運算式、anchor、offset。同一 renderer targetPlacement 解析到 `${objectKey}#${index}:index`，semanticBindingTarget 保留完整 descriptor，統一物件／layout／文字轉接。箭頭模型正規化保留子目標，key 區分值格與索引格；不存在的索引格不退回值格。

缺少新欄位的舊 Trace 維持值格端點；有新欄位的 Trace 序列化重開保持索引定位。明確關閉索引的設定仍保留。

### 現有架構尚未完全統一

- parseStyleTarget 仍有獨立集合選取語法，包括 ranges、矩陣列／欄與 inner-label。
- layout 選取仍有專屬展開入口，最後共用 targetPlacement 與 anchorPoint。
- 指標的列／欄定位有專屬語意，不等同一般 arrow 端點。

後續應建立目標種類與能力表，讓各指令只決定自身行為，端點識別與幾何交給同一 resolver。集合目標須明定 union 或批次展開，不能默默取第一個格子。不得宣稱本次已把全部子物件定位統一。

## 驗證紀錄

V2 最小分類，獨立伺服器／瀏覽器，不操作使用者頁面。

- 新增 arrow-directives 的 index-label 解析／巢狀 p[j-1]／center 預設／非法副作用運算式／舊端點正規化案例。
- arrow-index-label.browser：abababca 完整 KMP 答案 0 0 1 2 3 4 0 1；兩次失配箭頭精確命中 s[2] 與 s[0] 的索引格 bottom（測試用 head none 避免箭頭頭部預留距離）。from-index 也命中索引格 top；普通端點仍指向值格。place 物件與 text 使用相同 key；camera 保留同一 descriptor。
- 保存／重開、舊欄位缺少、索引明確關閉，均核實。
- entrypoints、camera-directives、text-object-bindings 的相關十三案例核實。一個 trace generation 案例初次因沒有 ASM_TEST_BASE_URL 失敗；使用隔離服務只重跑該失敗案例，通過，未改答案。
- JS 語法與 git diff --check 通過。

前端 renderer trace-272、arrow model arrow-12；重啟 3100 後核對 HTTP 與腳本來源。不合併 main、不發布 release。
