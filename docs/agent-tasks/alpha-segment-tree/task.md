# alpha-segment-tree：Heap 複合欄位與格內區段

## 任務資訊
- 負責代理：alpha
- 狀態：待交付
- 共同基準 commit：61a4baade9b06b5e50d0c7a24683e937db9c7112
- 分支：codex/2026-09-19-alpha-segment-tree
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-19-alpha-segment-tree

## 問題與預期結果
- 情境與操作：新版指令目前只能讓heap呈現單一來源值，既有@segment只表示一般陣列範圍；兩個線段樹範例仍依賴AV.hpp及舊繪圖資料。
- 目前行為：原始功能無法直接合併tree／lazy／sets同索引，也無法在heap節點格內依局部範圍著色；後續實際播放另發現`sum += tree[now]`會令sum暫時變空，且全域sum跨遞迴幀反覆入退場。自動固定與迴圈邊界選項只保存為帳號偏好，`@asm-view`會丟棄它們，重新RUN後無法維持單一檔案的選擇。建樹的雙來源加法在演算法頁可播放，但投影片iframe剛顯示後立即切幀時會直接跳到結果。
- 使用者希望的結果：新增fields／hide／separator、pair／tuple單格格式及雙層@segment，並以新語法改寫兩個範例；`+=`應讓來源格內數字移至目的數字位置後提交結果；`target = a + b`應讓兩個可見來源數字同步移向目的格，抵達時消失並提交加總；建構與查詢要拆成兩個可獨立RUN的完整動畫；全域純量跨幀保持同一物件；自動固定與迴圈邊界設定應跟著程式設定檔保存。
- 本次範圍與必要限制：三種結構統一使用既有render heap；不新增標準線段樹renderer；保留特殊線段樹演算法、儲存與輸出；不修改已完成的heap.cpp；point／highlight使用預設樣式；遞迴下降時顯示目前與尚待處理的segment，命中後移除完成區段，回溯不建立幀；格內segment歸入style顯示層。

## 需求確認
- 已確認：fields保留各來源身分與事件；hide逐幀按欄位判斷；separator預設逗點；segment局部端點包含、裁切、L>R隱藏、後者在上；as提供穩定身分；when與既有單層@segment相容。
- 尚待使用者回答：無。
- 合理假設：fields第一個欄位為heap的幾何、索引與主要style目標；其他欄位作為同索引顯示來源，仍可由各自變數的@style命中對應格。

## 重現與調查
- fixture：tests/fixtures/heap-composite-segments.cpp及兩個既有Segment Tree sample input。
- 重現狀態：功能新增不適用。
- 已確認事實：frame rendererOptions可保存並重載複合選項；pair已有trace編碼，tuple需新增同類編碼；heap格內segment可沿用節點矩形幾何；具名segment需以data-av-key配對相鄰幀。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改：trace-instrumenter.js、server.js、trace-model.js、trace-renderer.js、trace-frame-tween.js（如既有繪圖配對需要）、入口cache、指令提示／手冊、兩個線段樹範例、直接相關測試。
- 共用介面：rendererOptions新增fields／hide／separator；segment新增cellExpression／cellRange／color欄位，舊欄位保留。
- 依賴：基準已包含目前intergration整合內容；heap.cpp新版參考位於beta分支，按使用者要求不修改。

## 驗收條件
- [x] fields同格顯示、預設／自訂separator及逐幀hide正確，更新事件仍屬各原變數。
- [x] pair／tuple每元素一格，預設保留零並支援pair成員hide。
- [x] heap根／子節點格內segment依局部範圍著色，裁切、空範圍、多層、重疊、when及as正常。
- [x] split(cursor)顯示目前遞迴節點與待處理右側前沿，split(cursor,after)排除已完成節點；point／highlight不指定自訂色。
- [x] Segment_Tree_easy只在下降與命中時建立幀；命中後以split(now,after)移除完成區段，回溯不再建立幀。
- [x] split產生的新segment由頂端向下淡入，完成segment由頂端向下淡出；事件動畫開關不會停用這些style動畫。
- [x] Segment_Tree_easy在tree下方顯示sum，完整命中時把tree[now]累加至sum，輸出與原演算法相同。
- [x] `sum += tree[now]`事件播放時sum維持舊值且不變空；只複製tree[now]的數字移向sum數字位置，抵達時提交新值並立即移除移動數字，不在目的地停留。
- [x] 全域sum跨main／query及不同遞迴activation沿用runtime身分，不重播整格入退場。
- [x] 格內segment位於style顯示層、跟隨綁定格子且保留具名幾何轉場，不受事件動畫層控制。
- [x] 一般播放套用同格highlight／point時不會清除segment；第三幀、倒退及重播皆維持正確顯示。
- [x] 既有@segment arr[L:R]與heap既有行為不變。
- [x] Segment_Tree_easy.cpp與Segment_Tree.cpp移除AV.hpp及舊繪圖資料，保留演算法及輸出，能以sample input編譯產生trace。
- [x] Segment_Tree_easy逐筆顯示葉節點輸入，之後每個父節點各以左右子節點、兩條箭頭、算式文字與預設point／highlight呈現由下往上的建樹過程。
- [x] `total = a + b`及`tree[parent] = tree[left] + tree[right]`記錄兩個可見來源；兩個數字同步移向目的格，抵達時立即消失並在同一更新提交加總。
- [x] `Segment_Tree_easy_build`只包含完整建構動畫；`Segment_Tree_easy`從完整樹開始只播放查詢，兩者各自具有可直接RUN的輸入與結束幀。
- [x] 建樹動畫放入投影片後，即使iframe剛完成顯示便切換父節點幀，左右來源數字仍完整移向目的格，不被延遲的畫面重排取消。
- [x] 自動固定與迴圈邊界事件寫入`@asm-view`，重新RUN及重載後維持；舊檔未設定時仍沿用帳號預設。
- [x] 完整`Segment_Tree.cpp`以新指令重寫：建樹不建立動畫幀；操作階段以fields／hide在tree格內顯示lazy與set，並呈現segment下降分裂、命中移除、query累加answer及回溯父節點加總。
- [x] 完整範例保留原本特殊葉節點配置、lazy優先規則、set覆蓋規則及sample輸出；回溯幀不重新顯示已完成segment。
- [x] 完整範例以`range(1,Tsize-1)`裁掉未使用的補零節點；modify segment為紫色，set segment為橘色。
- [x] lazy／sets只作為tree格子內的附加文字欄位，預設值以`hide(lazy=0,sets=LM)`隱藏；不由欄位狀態額外產生segment，紫色／橘色segment只呈現當次modify／set操作範圍。

## 驗證計畫
- 開發代理小驗證：V2 E/F/H/J，新增parser／model／renderer局部專項；隔離服務與headless瀏覽器只跑最小fixture及兩個範例sample input；C++原輸出對照改寫前版本。
- 主代理整合驗收：核對diff與兩範例定點，視合併範圍決定相關V2或V3；不機械式跑全部測試。
- 隔離方式：alpha worktree、隨機埠測試服務與獨立headless Edge；完成後只重啟alpha 3101。

## 變更紀錄
- 2026-09-19：依使用者完整規格建立初始任務定義，基準為intergration 61a4baa。
- 2026-09-19：完成parser、trace model、renderer、轉場與兩個範例改寫；31項直接相關小驗證通過，待主代理核實。
- 2026-09-19：依使用者補充新增with split(cursor[,after])遞迴前沿，並將Segment Tree範例的point／highlight改回預設樣式；相關31項小驗證通過。
- 2026-09-19：依使用者補充將格內segment移至style顯示層；實際SVG確認不再嵌在cell內，圖層位於物件與前景箭頭之間，具名區段插值仍通過。
- 2026-09-19：依實際Segment Tree播放回報修正整段命中幀誤用split(now,after)造成單一路徑segment消失；命中幀改用split(now)，after只保留於回溯／合併幀。
- 2026-09-19：重現第三幀僅在一般播放消失；根因是presented hint更新會隱藏同格所有attached視覺，誤包含style layer segment。清理範圍改為highlight／point／mark並新增實際動畫路徑驗證。
- 2026-09-20：依使用者修正展示流程：Segment_Tree_easy移除所有回溯幀，完整命中後直接移除該segment並累加tree下方的sum；split segment新增由上往下淡入／淡出動畫。
- 2026-09-20：修正複合賦值缺少before／after與來源target造成sum空白；可見來源到目的改為純數字移動。純量加入runtime identity，避免全域sum跨函式／遞迴幀反覆入退場；具副作用目的索引維持單次求值路徑。
- 2026-09-20：依使用者要求將自動固定與迴圈邊界事件改為檔案級設定；`@asm-view`只保存這兩個選項，其餘事件偏好仍由帳號設定提供，舊檔維持相容。
- 2026-09-20：依使用者回饋移除複合賦值數字抵達目的地後的停留；抵達、結果提交與轉場複本移除改為同一動畫更新。
- 2026-09-20：依使用者要求補齊Segment_Tree_easy建樹教學；新增15個逐筆輸入幀與15個父節點相加幀，建樹畫面包含補零容量節點，查詢畫面仍維持原特殊範圍。
- 2026-09-20：依使用者要求新增二元加法賦值動畫；純量或安全索引格的左右來源同步移向目的格，落地時移除並提交結果，easy建樹改用直接加法呈現此動畫。
- 2026-09-20：依使用者要求將easy建構與查詢拆成兩個獨立動畫；建構版完整呈現32幀，查詢版在第一幀直接使用靜態完成的樹，不包含建構箭頭或建構教學幀。
- 2026-09-20：依使用者在3101投影片介面的實際回報，修正runtime iframe顯示後的延遲尺寸重算取消首個播放轉場；尺寸重排改為等待目前幀動畫完成。
- 2026-09-20：依使用者再次以第16幀回報，確認新開iframe不存在格內segment且補零來源動畫正常；將投影片主程式與runtime/editor iframe快取版本一併更新，避免既有頁面繼續載入修正前播放器。
- 2026-09-20：使用者重整後仍看到舊結果；確認投影片保存的是修正前trace，且新增二元加法事件時漏增trace引擎版本。引擎版本提升至5，讓編輯動畫時自動重新RUN並在儲存後替換舊trace。
- 2026-09-20：依使用者要求再次完整改寫既有Segment_Tree範例；建樹沿用easy版的逐筆輸入與雙來源相加，操作階段使用完整heap、複合欄位、lazy／set顏色、下降split、命中after移除及query answer，回溯只保留父節點加總動畫。
- 2026-09-20：依使用者修正完整範例展示：移除建樹動畫，tree／lazy／sets仍融合顯示；範圍改為1至Tsize-1以裁去多餘零節點，modify／set segment分別使用紫色／橘色。
- 2026-09-20：依使用者確認融合定義：lazy／sets只進入tree格子文字，不額外生成色塊；移除誤加的欄位狀態segment，保留當次modify／set操作範圍segment。
- 2026-09-20：重現lazy／sets仍以獨立陣列顯示；原因是欄位上的`@style`解除capture-only。改為複合欄位style只合併到主要tree格子，不建立獨立物件。
