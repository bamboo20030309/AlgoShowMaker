# 巢狀操作共用流程與外層語意修正（2026-11-17）

## 原因

renderNestedMutation 處理副作用後直接回傳，原本只由獨立複合賦值分支補上的 bitShift／bitwise 資料因此遺失。number <<= amount++ 的數值正確，卻少了一個可播放的位移事件。

## 共用規則

- 所有複合賦值（+=、-=、*=、/=、%=、&=、|=、^=、<<=、>>=）使用同一個 mutation 求值與寫回流程，不再另走 standalone 的重複解析分支。
- C++17 賦值先求 RHS，再綁定 LHS 一次；保留原生操作與參考回傳。內層副作用先記錄，外層操作再接收其結果；後置遞增仍提供舊值，不能把遞增後的值拿來消費。
- 操作專屬資料組合到共用事件上：位移保留方向／已捕捉位移量，位元操作保留左右來源、前後值與中間結果旗標；產生描述不重新執行使用者程式。
- 保留位元事件既有 signature，避免既有開關鍵失配。純賦值的複製／計算／初始化專屬語意仍保留，沒有把所有事件改成同一種動畫。
- 修正左側本身含 mutation 的賦值重複求值；巢狀參考目標共用已求得的下標，外層也記錄正確格子。
- 外層 ++／-- 從自己的 AST UpdateOp 讀取，不掃整段文字，避免 a[i++]-- 被內層 ++ 干擾。
- 括號內位元來源正常解析，保留其索引及來源身分。

## 驗證與固定答案

新增 nested-compound-operations.integration.test.js：

1. a=12、rhs=2；result=(a OP (rhs+=1)) 的十種固定答案依序為 15、9、36、4、0、0、15、15、96、1。核對 RHS 只加一次、內外事件順序與完整操作資料。
2. a[i++] <<= k++ 取原 k、RHS 先於 LHS 下標副作用；反向位移、左側參考回傳、括號內陣列來源均核對實際格子索引。
3. a[i++]-- 與 ++a[i--] 核對相反方向內外操作，保留前後置結果與事件順序。

最後核心集合 10/10：新增三例、既有 nested-expressions 兩例、bit-shift 三例、bitwise-types 兩例。包含原生 bitset、窄化與 auto 型別、舊 Trace、明確關閉、視覺位移及像素合成。

另以原畫面答案確認 bitwise、compound-bitwise-replay、compound-assignment-signs、postfix-presentation。compound-bitwise-replay 的來源比較改用正式 sourceText，排除 RUN 同步的尾段 Studio 設定；全部可執行程式與繪圖指令仍比對，動畫答案未放寬。

## 產物與範圍

Trace 生成指紋自動涵蓋 trace-instrumenter.js 與 ASMTrace.hpp；新版重新執行會帶新指紋，不應沿用舊執行檔。既有 Trace 不改寫；要取得新增操作資料須重新 RUN。

沒有跑全量驗證、沒有更新所有公開教材、沒有合併 main 或發布 release。普通 C++ 不確定求值順序不因「從內到外」口號而強制改為左到右。

本機忽略證據：test-results/nested-reference-final-2026-11-17.tap、nested-visual-final-2026-11-17.tap。前期診斷與中途失敗檔保留，不提交 test-results。

## 最終結果

核心集合 10/10、畫面與消費順序集合 5/5，共 15 個不同案例通過。位元畫面驗證含舊資料重開及明確關閉；複合符號含 fresh/reopened 與 1／4 倍速；鏈式位元運算保留原始逐步答案。語法與差異檢查通過，未執行全量。
