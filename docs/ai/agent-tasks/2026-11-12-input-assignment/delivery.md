# 輸入賦值事件

使用者要求輸入命名為「輸入賦值事件」，沿用賦值動畫，包含scanf、getline、cin.get等。本輪新增input-assign，獨立預設開關與時間線項目，動畫仍映射assign；接入正向突變、操作語意、指標賦值、程式碼區段、Studio與設定保存，沒有新增第二套賦值動畫。

## 插樁與執行期

每個可識別目標先綁定參照並捕捉索引，再執行原生輸入；未初始化值不先讀取堆疊垃圾。成功時記錄before／after／source、目標與索引、來源範圍及inputKind。cin鏈逐項處理，scanf依成功轉換順位發送；EOF及失敗目標不記錄成功事件。移除原先只在敘述後標記初始化的cin特例。

支援cin>>、條件中的cin、scanf／fscanf／sscanf、std::getline、cin.get(c)、c=cin.get()及宣告初始化、cin.get(buf,n)與cin.getline(buf,n)。保留串流參照和scanf回傳值，不重複執行索引。scanf的%n計數及非標準位置參數、任意指標別名不猜造輸入目標，詳見使用手冊。

## 驗證

- input-assignment.integration：12個固定情境，包含cin鏈、陣列i++、scanf部分成功／抑制轉換／索引、while輸入、getline、字元與緩衝區get、get回傳接收與初始化、EOF。依固定輸入比對事件數值、順序、索引及初始化。
- input-assignment.browser：落入7前舊值2不改，提交7後才執行後續一般賦值9；獨立關閉input-assign不影響一般賦值，匯出重開保留關閉與自訂137ms間隔，無新欄位設定時預設開啟。
- uninitialized-values三項與output-event一項通過，確認既有未初始化／while輸入／cout／printf行為。
- event-defaults只執行預設與順序兩項，納入使用者新指定名稱與獨立開關。

共8項不同定向測試通過；未跑全部小測試或大型回歸。舊Trace需重新RUN才有輸入事件，沒有從舊狀態猜造事件。生成指紋涵蓋trace-instrumenter與ASMTrace.hpp，自動使舊生成快取過期；本輪不重跑全部公開範例。

前端快取events trace-71、model trace-46、code-model code-40、editor trace-42、Studio trace-142、tween trace-351、slides-354、runtime-109。提交整合分支並重啟3100，main與Release不變。整合基底已含先前挑入的首頁前端提交；本輪瀏覽器驗證在該基底上執行，不宣稱完成其全部獨立驗收。
