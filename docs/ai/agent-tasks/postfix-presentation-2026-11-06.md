# 後置遞增／遞減：先使用舊值，再播放更新

## 需求與分工

`push_back(num[j++])` 的結果取自舊 j。動畫先完成舊格子的複製，等待設定的事件間隔，再播放 j 位移 520ms；出界時接 220ms 退場。前置 `++j`／`--j` 維持先更新、再使用新值。一般賦值與複合賦值沒有這項後置規則。

Trace 仍保存真實事件順序及 before／after，不把 C++ 的副作用推遲到函式返回後。共用 presentationOrdered 將符合條件的後置更新放在舊值消費操作之後。播放槽位、replay 值提交、指標邏輯與程式反白完成通知共用這個順序；原始 event.order 與事件陣列不變。

## 邊界

插樁器保存前置／後置類型及可延後至哪些外層運算式的來源範圍。逗點左側、短路左側及三元條件為求值邊界；若下一個操作需要更新後的狀態，更新不能延到它後面。也不把更新越過已追蹤函式的進入點與函式本體。多個可延後的後置操作仍依實際記錄次序播放。

自動 fixed 狀態跟隨所屬更新，不因 raw order 較小就提早提交，也不誤認為消費新值的另一個操作。明確關閉的更新仍不播放位移，且不覆寫使用者的開關。

## 相容

引擎與格式維持 15/1。新欄位是來源分析的選用中繼資料，不需要改投影片格式。engine-15 公開合併排序雖沒有新欄位，仍可透過既有 expressionPath 與來源碼安全判斷其簡單後置寫法；本輪不重跑或改寫這些 Trace。

複雜舊 Trace 若缺少必要邊界，保守沿用原序，除錯紀錄明確提示重新 RUN；同一事件不反覆提示。重新 RUN 可取得完整 AST 邊界。不能從最終值猜造缺少的操作。

## 驗證

- postfix-presentation.integration.test.js：15 段固定答案，涵蓋前／後置 ++／--、普通賦值、複合賦值、逗點、短路、三元條件、兩個後置操作、初始化、比較、獨立更新、格子後置更新與函式邊界；核對原始紀錄不變、舊資料、警告與明確關閉設定。
- nested-pointer.browser.test.js：新編譯與已儲存的舊 Trace、1／2 倍、0／500ms 間隔，共 8 組；實際 SVG 核對複製時指標停在原位、複製完後再移動、目標格子持續可見、反白不提早完成及出界退場。
- merge-push-handoff.browser.test.js：原本分開寫 i++／j++ 的 16 組交接驗證通過。
- initializer-visibility.browser.test.js：初始化與指標位移通過。
- nested-expressions.integration.test.js、event-semantics.integration.test.js、event-gap-default.test.js：原執行結果、巢狀追蹤、短路及 0／自訂間隔通過。
- JS 語法與差異檢查；未執行全量 regression。先前已記錄的河內塔時序問題仍不列為已修正。

## 交付

events trace-70、tween trace-320、slides-314、runtime-70。推送 intergration 並重啟核對 3100；不合併 main、不發布 release。
