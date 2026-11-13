# 複合賦值搬移的運算符號

## 原因與修正

使用者二維前綴和範例第31→32幀，事件為 pre[2][3] -= pre[1][2]，payload 正確保存 before=22、source=3、after=19。前端 assignmentTransferOperator 已辨識減法，但建立可見來源 transfer 時的 operatorPrefix 只允許 += 的 +，因此 - 遺失。

共用 createAssignEffect 改用已辨識的複合賦值運算子作前綴，沿用 formatAssignmentTransferValue 處理負數與括號。普通 = 不增加符號，不改常數來源、數值格式與值提交時序。

## V2 驗證

附件原碼與完整指定測資存為 prefix-2d-compound-signs fixture。隔離 analyze/compile 確認第32幀 before/source/after 為22/3/19；實際 SVG 搬移文字包含 -3；相鄰加法包含 +16。小例子確認 *= 顯示 *3、/= 顯示 /3、普通 = 顯示 3。新載入、JSON 儲存重開、1x/4x 均通過且無 pageerror。JS 語法與 diff 檢查通過，未啟動完整動畫驗證。

本次為前端修正，不變更使用者範例或 Trace 指紋，不需重新生成 Trace。tween trace-366、iframe trace-runtime-126。
