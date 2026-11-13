# 八皇后第二個範例更新

將使用者完整程式碼套用至 algorithm_sample/Backtracking/8queen-array-teaching.cpp 與公開八皇后教材的第二個動畫。包含 L 相對棋盤 offset(40,-60)、每列攻擊／可放位置上色、回溯與無路可走的樣式、十個明確關閉的事件開關。第一個與第三個動畫逐份完整比對未變更。

## 驗證

V2 局部：隔離 /trace/analyze、/compile 重建第二份 Trace；input=4，54 幀、最後 ans=2。來源／引擎版本 current，程式碼座標核對通過；事件設定符合使用者程式碼。asmdeck 只保存新 Trace ID，完整結果另存獨立 JSON。保留舊不可變教材與 Trace，其他動畫引用不變。

隔離瀏覽器載入第1、8、9幀，確認 L/M/R 正常顯示，並可切至第54幀。未重新執行全套驗證；前一輪已通過的遞迴容器前進／返回驗證沿用。本次不修改播放器實作，不合併 main 或發布 release。
