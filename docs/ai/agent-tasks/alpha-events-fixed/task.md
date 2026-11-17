# alpha-events-fixed：濃縮幀事件開關保留固定狀態

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：d43bd26fdbb6af3b190ac36cef7d3e1697682117
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows

## 問題與預期結果
- 情境與操作：使用者線篩將濃縮幀放在內層迴圈後，i>7使用@events animate off，defaults為@automark isprime。
- 目前行為：all規則把fixed.enabled設為false，從i=8起的新固定狀態不顯示。
- 使用者希望的結果：濃縮幀略過事件動畫，但保留自動固定、箭頭出入場／位移、style過渡與其他繪圖動畫。
- 本次範圍與必要限制：all animate on/off不改fixed狀態；保留明確@events fixed規則、全域與幀固定開關；不改last-access判定、資料、箭頭或style動畫。

## 需求確認
- 已確認：依既有「事件off不關閉style」意圖修正；完成後push並重啟alpha 3101。
- 尚待使用者回答：無。
- 合理假設：fixed是既有state類別而非timeline动画，廣泛all控制只改動畫；明確指定fixed仍相容。

## 重現與調查
- fixture：tests/fixtures/automark-events-sieve.cpp，依使用者程式保留defaults／post-loop濃縮幀／文字範圍與asm-view，輸入30縮小驗證。
- 重現狀態：已重現。新專項修正前兩個測試失敗，all off關固定、all on覆蓋全域關閉。
- 已確認事實：source controls第二輪迴圈對fixed套用all，覆寫前一輪已設定的固定開關。
- 尚待調查：無。相關6項小驗證通過，3101重啟與新腳本確認通過。

## 修改邊界與依賴
- 修改模組：trace-events.js、algorithm cache／entrypoints、專項測試與文件。
- 共用介面：不新增schema，只改all與fixed的匹配規則。
- 依賴：alpha的automark與fixed轉場修正已在本分支。

## 驗收條件
- [x] all animate off保持固定狀態，all animate on不覆蓋全域／幀固定開關；明確fixed控制保持相容。
- [x] 使用者post-loop濃縮幀i=8／9新增固定標記仍可見，trace-events動畫steps為0。
- [x] 回看／JSON重載／Studio結果一致，3101重啟後載入新event腳本。

## 驗證計畫
- 小驗證：V2 J/H，專項unit／編譯／最小SVG，加直接相關event控制案例及入口cache。
- 主代理：核實後補使用者輸入與演算法投影片的相同定點，不機械式跑全套。
- 隔離：隨機埠服務、獨立headless Edge；驗證後重啟自己的3101，不操作主要服務或使用者deck。

## 變更紀錄
- 2026-09-18：確認all動畫開關誤關fixed；加入專項重現與相容修正。
- 2026-09-18：依使用者補充，animate off僅略過事件動畫，保留其他繪圖動畫；專項實際核對箭頭出入場／位移與style過渡，不修改它們的排程。
