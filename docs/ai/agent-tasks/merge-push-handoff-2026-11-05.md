# 合併排序第 11 幀：複製交接空白與指標提前消失

## 重現與原因

公開合併排序第 10→11 幀，先比較 num[i] 與 num[j]，接 merged.push_back(num[i])，最後才是 i++。

1. 當畫面更新剛好落在或跨過最後事件終點，控制器直接呼叫 finish，跳過最後一次 update。複製特效移除後，正式格子的值雖已提交，透明度卻仍為前一個時間點的 0，直到整幀（含尾端間隔）收尾才顯示。
2. 下一幀的最終畫面已沒有該位置的 i 綁定，所以用前幀的指標複本維持呈現。其退場時間只看比較或指標賦值，漏掉後面的 num[i] 索引使用，因此比較完成 1560ms 後就退場，早於 push_back 的 2060ms 開始。這不代表 C++ 的 i 已離開作用域。

診斷逐時點記錄與透明度寫入來源保存在忽略的 test-results/merge-push-probe.json；不提交診斷產物。

## 修正

- 收尾前先將事件更新到精確的終點，再移除複製特效；完成後不再重複啟動特效。正式格子在同一個畫面更新接手，不等待尾端間隔。
- 舊指標退場依最後一個使用該索引的可見操作決定，包含 push／賦值及 i+1 等索引表達式。仍核對 runtime lifetime，不依演算法名稱、變數名或教材幀號寫特例。
- 不改 Trace／投影片格式、不改既有動作時間或事件間隔，不需重跑公開 Trace。

## 驗證結果

- 新增 merge-push-handoff.browser.test.js：兩組公開遞迴 Merge Sort 輸入，分別從 i／j 複製；1/2 倍、20/37ms 畫面更新共 8 組。以手寫標準比較 1560 + 間隔 500 + 騰位 300 + 入場 220，核對 2580ms 提交後整段尾端間隔可見、來源指標維持至複製完成。來源複本及正式目標皆檢查實際 SVG，不以播放計畫產生答案。通過。
- 正式目標限定目前的 merged 容器，排除保存快照；不同輸入中同名格子不應誤作目前目標。
- sequence-outerframe-phases.browser.test.js：一般插入、刪除、push/pop 及完整數字入場。通過。
- sequence-commit.browser.test.js：保存來源的整格複製、i++ 前提交。通過。
- initializer-visibility.browser.test.js：共用收尾改動後，初始化、指標位移、保存重開與取消重播仍通過。
- hanoi-hidden-sequence.browser.test.js：未通過，視覺起點 220ms 超過既有 180ms 門檻。使用 HEAD 修改前 tween 腳本以隔離路由重跑，同樣失敗；未放寬門檻，也不宣稱此案通過。記為既有待查缺口，本輪不擴大更改河內塔起始排程。
- JS 語法、Git 差異檢查；未執行全量 regression。

## 交付

tween trace-318、slides-311、runtime-67。推送 intergration 並重啟核實 3100，不合併 main、不發布 release。先前初始化審核列出的其他三個缺口不包含在本輪修正。
