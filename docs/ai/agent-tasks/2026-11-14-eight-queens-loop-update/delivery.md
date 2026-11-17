# 八皇后第一個迴圈範例更新

依使用者提供的完整程式碼，更新 algorithm_sample/Backtracking/8queen-loop-teaching.cpp 與公開八皇后教材第一個動畫。r/c 在 while 內宣告、比較使用 pos[c]/pos[r]，preset 新增 r/c 指標；最後一幀獨立宣告棋盤與 pos，不再引用含指標的 preset。事件設定沿用使用者指定的三個指令開關、autoFixedEnabled=false、autoLoopBoundaryEnabled=false、讀取強調 false／red。

僅重建第一份 Trace，保留另外兩份動畫的完整設定、來源及 ID；不將教材標記為三份 Trace 已全數更新。Trace 保存在獨立 JSON，asmdeck 只保存新引用。

## V2 局部驗證

使用獨立服務透過 /trace/analyze 與 /compile 重建。N=4 共有 257 幀（256 組配置與最後總結），最後 ans=2、attempt=256。Trace 來源與引擎指紋為 current，程式碼座標核對通過；三個事件開關及讀取設定符合使用者原碼。其餘兩個動畫逐份完整比對，未變更。

隔離瀏覽器確認第一幀 r/c 指標可見、最後一幀無指標，無 pageerror。未執行完整演算法驗證，未合入 main。
