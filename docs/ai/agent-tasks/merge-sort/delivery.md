# 交付紀錄

## 2026-10-05：範例定稿與分支推送

- 倍增範例更新為使用者最新貼上的版本，包含首幀介紹換行與區間發音替換；指令解析 8 個 frame、asm-view JSON 與明確關閉設定確認通過。
- 磁碟範例與 3102 sample API 回傳全文一致。僅重啟本分支 3102，現行 PID 47232。
- 推送前所有新增／修改 JavaScript 語法與 git diff --check 通過；本輪未重跑完整 regression，先前專項驗證結果見各節。
- 依使用者授權提交本分支累積修改與範例，不納入 test-results、編譯暫存、服務 log，不合併 main。

## 2026-10-05：箭頭端點 live／keep 身分延續

- V2 E/G：新增箭頭端點 owner 身分（layout ID、遞迴 activation、cell suffix）。同節點 live→keep 的物件 key 改變不再被視為換端點；不對已跟著呈現矩陣移動的端點再做第二次補間。不同 activation、錨點、offset 或 cell 仍視為真正換綁定；非主節點內的其他變數維持保守 key 配對。缺少 owner 的舊箭頭按原 key 比對，不破壞舊 trace。
- 根據使用者指定驗第25→26幀、activation-8 的 merged(3,9)，原始十筆輸入；獨立 headless Edge、速度1/4，先播放24→25再25→26，取樣所有箭頭（含圖層外 ghost）的實際 SVG CTM 與節點 outerframe 錨點。新分頁自然轉場原先已通過，不能宣稱此次自然重現了使用者畫面；額外以實際 merged(3,9) 箭頭建立 live-key→keep-key、同owner且舊起點相差152px的交接測試，驗證不發生額外補間。
- 新 tests/arrow-endpoint-continuity.test.js 與既有 arrow-identity.test.js 共4/4；merge-arrow-motion.browser.test.js 1/1。renderer trace-249；最後重啟3102並核對HTTP。未執行全部 regression、Studio 或 asmdeck 完整往返。owner為呈現時重建的DOM metadata，不新增持久化欄位。

## 2026-10-05：葉端生長、隱藏槽位預留與 layout 錨點定位

- 新語法：`@layout tree grow-from root|leaves`（預設 root）、`@layout tree reserve on|off`（預設 off）。reset 回到相同預設；linear 不接受 recursion 專屬設定。
- leaves 對每個可見子樹獨立計算高度，依實際父子關係保持精確 level-gap，四種方向皆支援。不將較短的森林根放到最深層，也不為未出現的祖先預留空列；不等深兄弟子樹仍須配合共同父節點調整較短分支的位置，並非宣稱所有葉節點永遠固定。
- reserve 從完整 trace/snapshot 取得結構，以實際 renderer 的外框尺寸預留槽位，不建立可見預覽或新幀。葉端生長只採用預留的橫軸位置，縱軸仍依目前实际父子排版，避免跨層放大 gap。
- 全域 `@place layout.top-left at other.bottom-left offset(...)` 可寫在首幀之前，移動完整 layout 成員與其子 layout；拒絕定位循環或定位到自己／自己的子排版。既有物件 @place 仍屬於前一幀，舊 align 設定不刪除。
- 遞迴 Merge Sort 範例改為 split/merge reserve on、merge grow-from leaves，並以 @place 將兩棵樹左邊界對齊、間隔40px；父子 level-gap 維持60px。保留使用者既有其他修改。
- V2 E/G/J 最小檢查：layout-growth.test.js 3/3（新指令、reset、四方向、短子樹、旧欄位預設）、layout-directives 的 defaults/explicit settings/coordinates 3/3；layout-growth.browser.test.js 1/1、merge-exact-frames.browser.test.js 1/1。後者以速度1/4確認指定轉場的預覽、空陣列與可見來源複製仍正常；沒有啟動全部排序或完整 regression。
- 隔離 headless Edge，以使用者原始十筆輸入編譯；實際 SVG 核對左分支槽位、所有對應 split/merge 水平中心、父子60px與雙樹40px。無 pageerror。前端 renderer trace-248、指令輔助 directive-29。
- 相容性：新 trace 實際套用、序列化並重新匯入後座標完全相同；移除 growFrom/reserve/placeBinding 的舊 trace 可載入並繪製；明確 reserve=false、growFrom=root、自訂73px經使用與序列化重開保持。未做 asmdeck 投影片完整往返、Studio 或全套演算法驗證。
- JS 語法與 git diff --check 通過；不提交測試產物、log，不合併 main。

## 2026-10-04：原始十筆輸入逐動畫畫面驗證

- 使用者輸入：`10 / 38 27 43 3 9 82 10 19 84 60`；上輪八筆驗證沒有涵蓋 sorted child merged 的 nested key 與新增目標格共存，因此未抓到 generic motion。
- branch-on：第 2 幀左子、第 3 幀右子從同一父節點中心長出。第 4 幀執行左側呼叫，已預覽兩子不重新進場。preview snapshot 延續到自身實際 source frame，防止 preview→live 的 ghost/re-growth。
- handoff 核對 layout/activation，不再只依 part 靜態 variable ID；缺少 activation 的舊 trace 維持舊交接行為，單元案例同時核對已知不同 activation 不得交接。
- 同一 snapshot DOM 的 live alias 不得建立第二份 motion；shiftPlacementTree 的 registry boxes 仍各自更新，但 DOM origin 只加一次。修復第 3/4 幀座標重複與下一幀錯位。
- 一般位移只有配對到上一幀 DOM owner 才能借用其座標。position map 中 keep 的 nested logical keys 不代表 live cell 延續，這是從頂層 part(82)看似滑入的額外位移來源，不是 C++ num 真的多讀一次。
- 新增 cell/index 一律由 sequence slot 控制，即使座標圖中有同 key 的歷史格；pending target 可接收完整 source clone，但真格/index 必須隱藏至交接。修復空 merged 宣告露出格子，以及 source transfer 與 generic motion 疊加。
- V2，E/G/J：新增 `merge-exact-frames.browser.test.js`，在独立 headless Edge 以速度 1/4 對 on 的 1→2、2→3、3→4 和 off 的 13→14、14→15 每個 rAF 取樣。新子起點還原中心與父中心差 <1px；第4幀全段三节点定點 <1px；merged 宣告无可見 cell/index；push 只有一份 27/38 clone，來源必為 merge_tree 的 activation-4；目的 cell/index 靜止且交接前隱藏。
- 最新 exact + empty/push lifecycle browser 3/3，outerframe unit 8/8，另 preview/source 專項通過。語法與差異檢查通過，無 pageerror；未執行全套 regression、Studio 或投影片持久化往返。無新增持久化欄位，on/off 由原設定保存。
- 前端 tween trace-282 / renderer trace-247；僅重啟本 worktree 3102，不操作使用者分頁或其他服務。

## 2026-10-04：branch-previews 來源與葉節點箭頭修正

- 預覽使用 snapshot.sourceFrameId，而不是執行 keep 時的 createdFrameId；後者可能是下一個 merge frame。預覽同時保留父 snapshot，避免父節點消失造成鏡頭跳動。分支預覽本身仍保留，不取消使用者明確開啟的設定。
- 保留箭頭去重加入遞迴 activation 核對。同一行 @arrow 的前一葉節點不再壓掉新葉節點的 live 箭頭；新目標可见時即連線。
- retained source 排除 tracePosition 尚未執行的預覽資料，優先當前 layout 的已完成 source，仍核對索引與值。飛行格增加非持久化來源標記供驗證。
- V2，分類 E/G/J：新增 merge-preview-source.browser.test.js。以 82 38 27 43 3 9 10 15 的 branch-on sample 編譯及 headless Edge 驗證：14→15 僅一份 82 clone，來源為 merge_tree；第二個 merge leaf 當幀實際 SVG 已有兩條 directive links。所有 preview frame layout 均與 frozen source 相同且父節點存在。
- 新專項與 empty/push lifecycle 3/3；preview/leaf handoff 篩選專項 3/3；最後含實際 SVG 雙箭頭斷言的新專項 1/1。node --check server.js、trace-frame-tween.js 與 git diff --check 通過（只有既有換行警告）。未做完整 regression、Studio／投影片持久化往返或全套相機驗收；無新持久化欄位。
- 3102 僅重啟核對過的本 worktree 服務，最終 PID 50208，HTTP 200；前端 tween trace-281。未操作使用者分頁、main 或其他代理服務。

## 2026-10-04：恢復 push_back 並驗證空陣列與分裂／合併交接

- 依最新要求恢復 `vector<int> merged;` 與 `merged.push_back(num[i++/j++])`，移除額外的 `k`；目前格使用 `merged[merged.size()-1] highlight`，維持預設顏色。
- 空陣列名稱消失的根因是 null value replay 將容器的第一個 text（outerframe name）當成資料值清空。數值文字解析現在排除 outerframe/object label。
- split 父節點定位只在上一幀 activation 與 layout 確實是該父節點時，使用上一幀的 live key；其餘使用正確 split snapshot 的位置。避免 `part` key 在下方 merge 葉節點重用時，把新 split child 從下方帶上來。
- 新增格及 index 由 sequence 事件統一掌管，不再另跑宣告／index 進場。空容器宣告時未來的格子與 index 保持不可見；可見來源轉移時保持目的格在固定槽位，完整 clone 抵達後才交接。
- normal array outerframe 依每筆 sequence 事件的 beforeSize/afterSize 插值，支援同幀多次操作與反向播放，不提前使用最終 frame 的尺寸。
- 來源解析可找到 keep 中的同物件或明確 iterator slice/copy 對應格。依來源索引、宣告的 offset 與事件擷取值一起核對，不能單憑值相同就配對；正式遞迴合併可以從已保留的下方子節點複製完整格，不再退回右側滑入。
- 驗證分級 V2，分類 F/G/J；正式 trace 為 55 幀、30 snapshots、24 筆 push_back，24 筆來源 resolvedIndex 均有效，highlight color 皆空字串。compile helper 同時檢查所有 event order 為數值且逐幀排序。
- 獨立 headless Edge 頁面專項 6/6 通過：空陣列穩定 render、空容器宣告、正式遞迴 source transfer/index/outerframe 時序、一般 source push、首次顯示名稱，以及既有 recursive growth/keep handoff。outerframe 局部契約 8/8 通過，無 pageerror；未執行完整 regression。
- 沒有新增必要的持久化欄位。瀏覽器載入的是序列化 trace；來源映射由既有 sourceCode/state/keep 資料恢復，既有關閉事件仍由原 timeline 開關決定。
- 3102 僅停止已核對的本 worktree PID 81716，重啟為 PID 52576；HTTP 200，cache 與 dataset 均為 trace-280。

## 已完成

- 新增 `@layout linear as ID`，支援 `direction`、`align`、`gap`、`background`；舊 `line`、`group` 語法保留相容。
- `@layout recursion as tree in scene` 可把既有 recursion layout 放入 linear；未寫 `in` 的舊語法保持原本 canvas 綁定。
- 新增 layout 箭頭端點：
  - `tree.current`
  - `tree.root`
  - `tree.nodes[k]`
  - `tree.leaves[k]`
  - `tree.level(depth)[k]`
  - `tree.side(left|right|top|bottom)[k]`
  - `tree.box`
- 新增 layout 集合批次箭頭：`@arrow for k in tree.leaves ...`。
- `@arrow ... in scene` 可標示跨 layout 箭頭所屬 linear。
- `@keep last` 會把 `current` 凍結成當次遞迴呼叫；外層畫面統一渲染保留箭頭，避免巢狀快照無法連到另一棵樹。
- 新增遞迴版 `merge_sort_recursive_layout.cpp`，以 split tree、merge tree 與葉節點連線呈現先分裂再合併。
- 新增非遞迴版 `merge_sort_bottom_up.cpp`，逐輪呈現相鄰有序區間合併及逆序對累積。
- 修正非遞迴版主合併迴圈的截幀時機：先顯示本次取值來源，再遞增 `left`／`right`，避免指標提前顯示下一格；範例型別統一改為 `int`。
- 依最新指定調整非遞迴版一般 frame 與 keep 位置；確認 `@frame` 後才寫 `@keep` 時，快照按執行順序從下一幀開始顯示。將 `@keep` 放到該 `@frame` 前方可讓本輪完成幀立即包含快照。
- 更新指令提示與 renderer cache build。
- linear 以每個子 layout 的完整邊界排列，上方 split tree 的底部會接到下方 merge tree 的頂部；最後 `num` 也進入同一 linear 的下一個 slot，不再蓋住兩棵樹交界。
- manual frame 的顯示集合改變時，會為仍在同一 C++ 生命週期內的物件衍生 `visual-enter`（由只擷取轉為顯示）與 `visual-exit`（由顯示轉為只擷取）。事件綁在造成顯示改變的 `@frame` 行，Trace Studio 可檢視與關閉；真正的宣告與離開作用域仍分別使用 `declare`、`scope-exit`。

## 既有 layout 範例檢查

正式範例中的 Fibonacci、Hanoi、Quick Sort recursive layout 都只使用一個 recursion layout，沒有跨 layout 配對需求，因此不需改寫。Hanoi 的普通物件箭頭行為已用既有測試重驗，保持相容。

## 驗證

- JS 靜態語法檢查通過。
- layout linear、layout endpoint、layout batch、整幀快照凍結箭頭與 Hanoi 相容性等局部測試通過。
- 遞迴 Merge Sort：69 幀、30 個快照、3 個 layout，編譯與 trace 產生成功。
- 非遞迴 Merge Sort：39 幀、3 個快照，編譯與 trace 產生成功。
- 非遞迴 Merge Sort 指標時機：逐一比對主合併幀的 `left`／`right` 狀態與 `temp.push_back(num[left/right])` 來源，確認 capture 發生於指標遞增之前；瀏覽器手動前進、回退與播放期間無 console error／warning。
- 瀏覽器冒煙測試：split tree 14 個節點、merge tree 13 個節點；兩樹上下排列且不重疊；最終畫面保留 4 支不透明綠色葉節點箭頭。
- 非遞迴 Merge Sort 的 `temp` 顯示生命週期：39 幀中產生 3 次 `visual-enter` 與 3 次 `visual-exit`，六次都保留同一個 `lifetime-5`；第 3 幀實際播放時作用中事件為 `visual-enter`，`temp` 由透明淡入，Trace Studio 顯示「畫面顯示進場」及對應的 `// @frame use merge_step`。
- 新增顯示生命週期專項測試，覆蓋事件產生、排序、正規化冪等、既有明確關閉設定、相同 C++ 生命週期以及 tween 進場排程。事件預設、場景進退場與既有宣告排程相關 20 個案例通過。

## 驗證分級與選擇

- 層級：V2。
- 分類：E、G、J；修改 layout 指令、複合排版、keep、箭頭位置與幀顯示生命週期事件。
- 執行方式：使用隔離的 3193 `/trace/analyze` 與 `/compile` 跑專項測試及正式非遞迴範例；重啟 3102 後以獨立瀏覽器分頁操作前進、回退、Trace Studio 與 0.6x／2.0x 自動播放。
- 結果：39 幀；事件 `order` 全為數值且逐幀排序；`temp` 的三組進退場事件與 Trace Studio 一致；手動前進、回退及兩種速度自動播放可運作；瀏覽器 console 無錯誤或警告。
- 未執行完整 regression：本次為單一範例的截幀順序與型別調整，依分級只做最小相關驗證。
- 需要主代理做的 V3 驗證：無。

## 舊有物件相容性

- 新語法：`linear` 產生正規化的 `type: "linear"` trace。
- 舊語法：`@layout line` 與 `@layout group` 仍可解析，並正規化為 linear。
- 舊已儲存 trace：renderer 仍接受 `type: "line"` 與 `type: "group"`，既有排版與明確 gap 不會失效。
- 舊已儲存 trace：缺少顯示生命週期事件時會在共用 normalize 路徑依相鄰幀的 `captureOnlyVariableIds` 重建；再次正規化不會重複事件，已儲存的明確關閉設定仍保留。

## 2026-10-02：line 更名為 linear

- 正式語法改為 `@layout linear as ID`；解析器將舊 `@layout line` 與更早的 `@layout group` 都正規化為 `type: "linear"`。
- renderer 同時接受已儲存的 `type: "linear"`、`type: "line"`、`type: "group"`，自動 keep 箭頭也沿用相同行為。
- 指令提示、遞迴／倍增 Merge Sort 範例及錯誤訊息都改用 `linear`。
- 驗證分級：V2，分類 E（layout 指令與位置）。
- 靜態檢查：`trace-instrumenter.js`、`trace-renderer.js`、`trace-directive-assist.js` 的 `node --check` 與 `git diff --check` 通過。
- 專項測試：`tests/layout-directives.test.js` 24/24 通過；`tests/directive-assist.test.js` 3/3 通過，無 skip。
- 正式範例：3102 的 `/trace/analyze` 與 `/compile` 成功產生非遞迴 39 幀、遞迴 69 幀，layout type 均為 `linear`。
- 瀏覽器冒煙測試：3102 載入 `trace-renderer.js?v=trace-237` 與 `trace-directive-assist.js?v=directive-28`；兩個 linear 成員垂直排列於 y=194、334，保留 1 支 keep 箭頭，console 無 error／warning。
- 服務：只重啟本 worktree 的 3102，PID 由 74980 更新為 67512，HTTP 200。
- 未執行完整 regression：依 V2 分級只執行 layout 與提示選單的最小相關測試；需要主代理做的 V3 驗證：無。

## 2026-10-02：倍增版 keep、指標與對齊

- 最上方先以 `@keep num as "original" in merge_passes` 保存未排序陣列。
- 每輪完成幀用 `@for block in [0:n-1] step width*2` 對整列交替套用藍、黃背景，再由放在該 frame 前方的 `@keep` 凍結資料與 style。
- 第一輪 keep 實際顯示藍黃藍黃藍黃藍黃；第二輪顯示藍藍黃黃藍藍黃黃。
- 一般合併幀只替當前 `[L:mid-1]` 與 `[mid:R-1]` 上色；補完左右剩餘元素的幀也維持相同區段背景。
- preset 改為 `num[left,right]`，比較幀實際顯示 `left`、`right` 一般指標標籤。
- `temp.top-left` 綁定到 `num.bottom-left offset(0,72)`，瀏覽器實測兩者 x 起點相同。
- 驗證分級：V2，分類 E、G、H；3102 `/trace/analyze` 與 `/compile` 產生 39 幀、4 個快照，事件 order 皆為數值且逐幀排序。
- 瀏覽器逐幀確認原始 keep 位於最上方、兩輪 keep 配色、目前區段配色、指標標籤與左緣對齊；console 無 error／warning。
- 3102 已由 PID 67512 重啟為 39920，HTTP 200。未執行完整 regression；需要主代理做的 V3 驗證：無。

## 2026-10-02：遞迴版成長方向與固定邊界

- 重複出現的 `part` 不是遞迴執行兩次，而是 recursion layout 預設的 branch preview（提前顯示尚未走到的分支）造成；遞迴範例加入 `@layout split_tree branch-previews off`，正式動畫由 69 幀降為 55 幀，移除 14 個預覽幀。
- 複合 layout 已有需要的固定邊界設定，不新增另一套語法：垂直 `linear` 的 `align start` 固定左側、`align end` 固定右側；水平 `linear` 則分別固定上側、下側。遞迴範例加入 `@layout merge_scene align start`，讓下方 merge tree 從左側開始成長。
- trace 檢查：前五幀的 split tree 節點數為 0、1、2、3、4，實際節點沿左側依序呈現長度 8、4、2、1；不存在 `branch-preview:*` 幀。
- 瀏覽器逐幀檢查第 6、8、11 幀：merge tree 與 split tree 的畫面左緣分別同為 707、709、720 px，新增合併節點時左緣保持一致，沒有重新置中。
- 驗證分級：V2，分類 E、G、J；`tests/layout-directives.test.js` 24/24 通過，正式範例 `/trace/analyze` 與 `/compile` 產生 55 幀且事件 order 皆為數值並逐幀排序。
- 3102 已從本 worktree 重啟為 PID 59412，`algorithm.html` 與 `/api/samples` 均回應 HTTP 200。未執行完整 regression；需要主代理做的 V3 驗證：無。

## 2026-10-02：倍增版首幀與 keep 出現時機

- 將 `@keep num as "original" in merge_passes` 從第一個 `@frame` 前方移到其後方；第 1 幀只顯示原始 live `num`，第 2 幀才顯示 `original` 快照與下一個 live `num`。
- 不新增 style 清除指令：style 本來就是逐幀資料。正式範例第 15 幀保留藍黃背景，第 16 幀的 `styles` 為空；歷史 keep 保留建立當幀的顏色，新的 live `num` 回到白底。
- 正式範例經 3102 `/trace/analyze` 與 `/compile` 仍產生 39 幀；第 1 幀快照數為 0，第 2 幀包含 `original`，事件 order 全為數值且逐幀排序。
- 瀏覽器最小畫面驗證：第 1 幀只有 `num`，第 2 幀為 `original + num`；彩色幀切到下一個無 style 幀後，live 陣列的格子填色由藍色恢復白色。
- 驗證分級：V2，分類 E、G、H；只修改正式範例指令順序，未執行完整 regression，需要主代理做的 V3 驗證：無。
- 3102 已從本 worktree 重啟為 PID 64396。

## 2026-10-02：畫面生命週期事件名稱

- Trace Studio 的 `visual-enter`／自動 `visual-exit` 不再以 `// @frame ...` 當事件摘要，改為顯示實際目標物件名稱。
- 事件程式碼清單與時間線圓點提示統一顯示 `畫面顯示進場：temp`、`畫面隱藏：temp`；手動退場與真正的作用域退場仍保留原本語意。
- 新增專項斷言，確認進場／隱藏摘要優先使用目標名稱，不受 frame directive 文字污染；`tests/studio-event-availability.test.js` 11/11 通過。
- 瀏覽器以 `num`／`temp` 三幀 fixture 驗證事件清單、事件類型與時間線提示皆顯示精確文字；載入 `trace-studio.js?v=trace-134`，console 無 error／warning。
- 驗證分級：V2，分類 G、J；未執行完整 regression，需要主代理做的 V3 驗證：無。
- 3102 已從本 worktree 重啟為 PID 85756，HTTP 200。

## 2026-10-02：遞迴範例空輸入 MLE

- 根因是 `cin >> n` 失敗後仍以未初始化的 `n` 建立 `vector<int> num(n)`；空白輸入可穩定重現後端 `Memory Limit Exceeded (> 256MB)`，不是遞迴或雙樹 layout 的記憶體用量。
- 將 `n` 初始化為 0，讀不到正整數時立即結束；每個陣列元素也改為讀取失敗即結束，避免不完整輸入進入動畫追蹤。
- 3102 `/trace/analyze`、`/compile` 驗證：正式 sample input 仍產生 55 幀、30 個快照；空白、`n=0` 與缺少元素皆正常結束為 0 幀，不再回報 MLE；正式動畫事件 order 仍為數值且逐幀排序。
- 瀏覽器驗證：空白輸入顯示「程式沒有任何輸出」，正式輸入顯示 1/55 且動畫已更新；console 無 error／warning。
- 驗證分級：V2，分類 E、L；只修改正式範例的輸入防護，未執行完整 regression，需要主代理做的 V3 驗證：無。
- 3102 已從本 worktree 重啟為 PID 23116，HTTP 200。

## 2026-10-02：temp 宣告與退場事件

- 根因：`temp` 在第一個 `@frame` 前宣告，runtime 原本不記錄第一幀以前的一般事件，所以 trace 中沒有 `declare temp`，不是 Trace Studio 單純隱藏了按鈕。
- 顯示生命週期正規化現在會辨識同一 C++ 物件生命週期：第一次從隱藏轉為顯示時，以原始碼來源補建 `declare`；後續重新顯示才用 `visual-enter`，不會重複宣告。
- 使用者可見名稱改為「宣告／物件入場」、「物件入場」與「物件退場」，不再顯示內部術語「畫面隱藏」。
- 驗證分級：V2，分類 G、J。`event-defaults` 與 `studio-event-availability` 22/22 通過；`visual-lifecycle-events.integration` 2/2 通過，包含 Trace Studio outline 必須產生 `vector<int> temp;` 宣告按鈕的斷言。
- 瀏覽器最小案例實際顯示：第 2 幀「宣告／物件入場：`vector<int> temp;`」，第 3 幀「物件退場：`temp`」；console 無 error／warning。
- 3102 已重啟為 PID 37000，HTTP 200，前端載入 `trace-events.js?v=trace-62` 與 `trace-studio.js?v=trace-135`。未執行完整 regression；依 V2 分級僅執行相關最小案例。

## 2026-10-02：恢復第一幀前與最後一幀後的事件

- runtime 改為從程式開始就記錄事件；第一次 `capture` 會把之前的宣告、初始化、呼叫等事件歸入第一幀。
- 程式正常結束時會輸出明確的 v2 `tail` 完成記錄；chunk reader 只會在這個記錄存在且事件數量吻合時，把最後一次 `capture` 後的事件附加到最後一幀。
- 沒有任何幀的程式仍不產生可播放事件；舊 v2 trace 缺少 `tail` 記錄時維持舊行為，不會把可能不完整的尾端區間誤附加到最後一幀。
- 最小案例單幀實際保留順序：`function-enter → declare → 初始化賦值 → 尾端賦值 → return → return-complete → scope-exit → function-exit`，order 為 0～7。
- 正式倍增 Merge Sort 仍產生 39 幀、4 個快照；第一幀可找到 `temp` 真實宣告，最後一幀保留輸出、回傳、作用域退場與函式退場，各幀 order 均為數值且排序正確。
- 驗證分級：V2，分類 F、G、J。`trace-chunk-store` 7/7、首尾事件、函式進場與顯示生命週期專項皆通過；Trace Studio 實際顯示第一幀前的 `int value`、`value = 1` 與最後一幀後的 `value = 2`、`return 0;`、`value 退場`，重播後 console 無 error／warning。
- 3102 已重啟為 PID 8740，HTTP 200。未執行完整 regression；依 V2 分級僅執行相關最小驗證。

## 2026-10-02：Studio 首幀事件狀態與顏色

- Studio 在建立事件面板前先對目前幀執行 availability preflight，首次開啟與後續切幀不再使用尚未計算的預設狀態。
- 指令的全域動畫開關與目前幀狀態分離：每列右側以「開／關」顯示全域開關；背景色只套用於目前幀的事件，其他指令保持中性。
- 一般事件的指令群組只要至少一個幀顯示相關物件，即判定為可用的綠色；若所有出現位置都不支援動畫，仍維持紅色。
- 比較事件維持較嚴格規則：任一出現位置少顯示一個比較變數，就判定為缺少目標的黃色。
- 驗證分級：V2，分類 G、J。`event-code-tree` 與 `studio-event-availability` 共 15/15 通過；`studio-availability-preflight.browser` 1/1 通過；JS 語法檢查與 `git diff --check` 通過。
- 既有 trace 不新增持久化欄位；缺少新欄位的舊資料、既有 `eventInstructionStates` 明確開關與 `@events` 控制仍沿用原模型。
- 3102 目前由既有 PID 8740 回應 HTTP 200，並已提供 `trace-event-code-tree.js?v=trace-6`、`trace-studio.js?v=trace-136`、`trace-studio.css?v=trace-59`。本輪重啟要求被主機的程序所有權保護拒絕，未停止該既有服務；靜態檔案更新後重新整理即可載入新版。
- 未執行完整 regression；依 V2 分級只執行事件樹、Studio availability 與局部瀏覽器驗證。入口整合測試另有既存的 `trace-model.js` cache 版本斷言過期，與本次事件修改無關。

## 2026-10-03：指標 canonical-only 驗證模式

- 暫時停止 renderer 的 legacy 排版 fallback；canonical model 發生錯誤時會明確標成 `canonical-error`，不再靜默切回舊結果。
- 暫時停止 Tween 依 `traceVisualContinuityKey` 尋找舊指標；跨幀延續只接受新模型產生的 `pointerId`。
- canonical 模式下停用既有的遞迴角色轉場、延遲進場與同格避讓排程特例；相同 `pointerId` 先加入 `continuingKeys`，不再因 C++ 內層變數重新宣告而被當成全新指標。
- 舊函式與舊呼叫範例仍留在原檔註解旁，尚未刪除，便於使用者實際驗證後恢復或移除。
- 驗證分級：V2，分類 G、J。pointer model 單元與 browser renderer、一般 matrix browser 均通過；正式倍增 Merge Sort 第 3～4 幀維持兩支穩定 `pointerId`，無 console error。
- 已刻意暴露的缺口：`a consecutive recursive marker with a different render ID skips entrance` 失敗。該舊 fixture 沒有 `pointerId`，停用 legacy continuity 後無法把父／子遞迴畫面的 marker 配成同一支；這對應尚未接入新模型的遞迴／layout 節點案例，未宣稱驗證通過。
- 3102 已啟動 canonical-only 版本，載入 `pointer-2`、`trace-264`、`trace-239`。未執行完整 regression；本輪目的為暴露新模型缺口，不應合併到整合分支。

## 2026-10-03：倍增 Merge Sort 內層指標重新宣告順序

- canonical pointer model 將穩定角色 `pointerId` 與 C++ 生命週期專屬的 `pointerInstanceId` 分開；跨幀只延續同一 instance，名稱相同但重新宣告的 `left/right` 不再被誤認為舊指標。
- 初始化宣告不再提前採用 assignment 的 after value。新指標先在 unresolved 宣告位置進場，後續 `left = L`、`right = mid` 才分別執行位置動畫。
- unresolved 宣告位置不套用最終資料格的對齊 bias；新增 declaration hold，使目的幀雖已渲染最終 DOM，指標仍會在宣告位置停留到 assignment motion 開始，不會先閃到最終格再跳回。
- 第 5→6 幀的實際順序驗證為：舊 `left/right` scope-exit 完成 → 新 `left` declare → `left = L` 移至 `num[2]` → 新 `right` declare → `right = mid` 移至 `num[3]`。ghost 可見性以外層 wrapper 與內層 motion 的合成 opacity 判定，避免將已淡出的 clone 誤報成重疊。
- 驗證分級：V2；分類 G、J。`pointer-model.browser.test.js` 2/2、初始化指標專項 1/1、pointer model 與入口 7/7 通過；`node --check public/trace-frame-tween.js` 與 `git diff --check` 通過。
- 新增正式倍增範例瀏覽器回歸案例，逐動畫 tick 驗證舊 instance 先消失、新 instance 的宣告位置、賦值移動與最終索引；瀏覽器無 page error。
- 舊有物件相容性：不新增或修改持久化欄位；舊 trace 缺少 `pointerInstanceId` 時仍由共用 pointer normalize 依既有 runtime/lifetime identity 衍生。既有明確事件開關未變更。本輪不涉及儲存／匯出資料往返。
- 3102 已由 PID 8740 重啟為 PID 46132，HTTP 200，載入 `pointer-3`、`trace-266`、`trace-240`。未執行完整 regression；canonical-only 尚未接入的遞迴/layout 指標缺口仍保留，不宣稱 V3 完整回歸通過。

## 2026-10-03：倍增 Merge Sort `l/r` 與跨生命週期避讓

- 正式倍增範例將 `left/right` 全面改名為 `l/r`，包含 preset、比較、取值、逆序對計算及三段遞增邏輯。
- 第 5→6 幀中舊 `l` 的 `0→1` 與舊 `r=2` 並不同格。錯誤讓位來自 exit reflow 把尚未宣告的新生命週期 `l` 當成舊 `r` 的可見 peer，並錯把舊 `l++` 當作新 `l` 的 arrival。exit reflow 現在排除本幀稍後才重新宣告的 marker keys。
- 新 `l` 原先從索引 0 進場、新 `r` 從 unresolved -1 進場，是因 `markerTargetBeforeFrameEvents` 只比 variable ID，掃到同 ID 但舊 lifetime 的 `l++`。現在同時核對 lifetime 與事件當下的有效範圍，兩者均由同一 unresolved 宣告位置進場。
- ghost 的同格 peer 判定改用各 ghost assignment schedule 的最後有效 target，不再只讀截幀時可能過期的 `traceBindingTarget`。
- 瀏覽器專項逐 tick 驗證：舊 `l:0→1` 全程舊 `r` 的 x 位移小於 1px；新 `l/r` 宣告中心差小於 2px；最後分別到達 `num[2]`、`num[3]`；無 page error。
- 驗證分級：V2，分類 G、J。未執行完整 regression；需由主代理在整合時評估 canonical-only 遞迴/layout 指標的 V3 範圍。
- 正式範例重新編譯為 39 幀，所有事件 order 均為數值且逐幀遞增；trace 包含 `l/r`，不再包含變數 `left/right`。3102 已由 PID 46132 重啟為 PID 77984，HTTP 200 並載入 `trace-267`；重啟後再次執行第 5→6 幀瀏覽器專項通過。

## 2026-10-03：第 11→12 幀單指標退場核對

- 事件資料確認第 11 幀完成 `r: 5→6` 後為 `l=4、r=6`；第 12 幀先做 `l: 4→5`，兩者沒有同格，之後才執行舊生命週期的 `r/l` 退場。
- 使用全新瀏覽器依序播放第 10→11、11→12 幀，避免直接渲染單幀掩蓋前一段 Tween 的殘留狀態；退場開始時 `l/r` 分別置中於 `num[5]`、`num[6]`，兩者皆為 `slot=0`、`groupSize=1`。
- 將此連續播放案例加入 `pointer-model.browser.test.js`，防止日後讓位排程或 Tween 收尾再次把已分開的指標保留為多人槽位。這是通用狀態規則的回歸檢查，不依賴 UI 幀號或變數名稱作執行期判斷。
- 驗證分級：V2，分類 G、J。`pointer-model.browser.test.js` 2/2、`node --check public/trace-frame-tween.js` 與相關 `git diff --check` 通過；本輪核對未再修改 runtime。
- 依使用者要求重新開啟 3102：舊 PID 77984 已停止；第一次在受限沙箱內啟動的 PID 58708 因無法寫入 worktree `tmp` 而回報 EPERM，已停止。改由可寫入該 worktree 的環境啟動 PID 27152；HTTP 200，載入 `trace-267`、`pointer-3`、`trace-240`，正式倍增範例編譯為 39 幀，重啟後瀏覽器專項 2/2 通過。

## 2026-10-03：第 11→12 幀離開同格後仍維持讓位

- 在使用者目前的 10 元素輸入、61 幀 trace 重現：第 11 幀 `l/r` 同在 `num[5]`；第 12 幀 `r:5→6` 後，兩者位置雖已分開，舊 ghost 仍保留 `groupSize=2`、左右槽位及斜箭頭，直到 scope-exit。
- 根因是舊生命週期的 assignment ghost 只累加資料格位移；既有 reflow 只處理「移入同格」，沒有處理「移出同格」後兩邊重新置中，也沒有更新 ghost 的箭頭路徑。
- `applyPreviousMarkerAssignmentReflows` 改為按 assignment 時間批次維護所有 ghost 的 target state，每次狀態變更都重新計算各 target 群組的 `offset/slot/groupSize`。資料格位移與群組排版位移分成兩條 schedule，可同時處理移入、移出和同一事件多來源變動。
- ghost tick 現在依群組排版 schedule 同步更新位移、`slot/groupSize` 與箭頭路徑；`r` 移至 `num[6]` 時，留在 `num[5]` 的 `l` 和移動後的 `r` 會同時置中並轉為垂直箭頭，再執行退場。
- 新增精確的第 11→12 幀 browser regression，使用輸入 `10 / 38 27 43 3 9 82 10 19 84 60`，確認 61 幀、`r:5→6`、退場前兩支皆 `slot=0/groupSize=1`、垂直箭頭且置中於 `num[5]/num[6]`。瀏覽器專項 3/3 通過。
- 新增離開同格 unit case，並更新移入同格案例以驗證「資料格移動」與「群組排版」分離。`unresolved-markers` 本次相關案例皆通過；完整檔仍保留 canonical-only 階段已知的遞迴 legacy fixture 1 項失敗，與本次修改無關。
- 使用者 Chrome 的 3102 分頁已重新 RUN，正常速度實測第 11→12 幀：退場前舊 `l/r` 均為垂直箭頭、單一槽位，畫面 console 無 error/warn。速度已恢復原本 1.2x，停在第 12 幀。
- 3102 已由 PID 27152 重啟為 PID 10176，HTTP 200，載入 `trace-268`。`node --check`、相關 `git diff --check`、pointer model 與入口測試通過；驗證分級 V2，分類 G、J，未執行完整 regression。

## 2026-10-03：遞迴 keep 子節點重播進場

- 根因是新建的 recursion snapshot 同時具備兩種來源：上一幀已顯示的 live `part`，以及遞迴父節點。Tween 原本優先採用父節點的 recursion growth，因此 `@keep` 後的子節點會從父節點方向縮放、位移進來，看似由左上角重新進場。
- 修正為 keep 原地交接優先：只要上一幀仍有可見的 live 來源，就沿用該幾何位置，不再建立 recursion-growth；只有沒有 live 來源的純結構節點才從父節點長出。倒放時原有的子節點縮回父節點行為維持不變。
- 新增遞迴 Merge Sort 瀏覽器回歸案例，確認新 keep 子節點沒有 `data-trace-recursion-growth`、沒有 `data-trace-appearing`，motion 不含 `scale(...)`；既有父 snapshot 在整段切換期間也不重播進場。
- 驗證分級：V2，分類 G、J。`entrypoints`、`outerframe-tween`、遞迴 Merge Sort browser 與 Fibonacci recursion browser 共 11/11 通過；`node --check` 與相關 `git diff --check` 通過，未執行完整 regression。
- 3102 已由 PID 10176 重啟為 PID 15404，HTTP 200，載入 `trace-269`；重啟後再跑遞迴 Merge Sort browser 專項 1/1 通過。

## 2026-10-03：每輪重新宣告 `temp`

- 倍增 Merge Sort 不再於函式開頭宣告一個 `temp` 並在每輪呼叫 `temp.clear()`；改為先顯示本輪說明幀，再於 `width` 迴圈內宣告新的 `vector<int> temp`。每輪完成後該物件自然離開作用域。
- 這讓程式生命週期與動畫語意一致：第一個顯示 `temp` 的 `merge_step` 同時包含真實 `declare`，不再由 capture-only 顯示切換補成獨立的 `visual-enter`。
- 正式輸入的三輪 width 產生 3 次 `declare temp`、3 次 `scope-exit temp`、0 次 `visual-enter temp`；三次宣告各有不同 lifetime，且宣告所在幀均實際顯示 `temp`。所有事件 order 仍為數值且逐幀排序。
- 驗證分級：V2，分類 F、G、J。`visual-lifecycle-events.integration` 與 Studio availability browser 共 4/4 通過；正式倍增 Merge Sort 的 canonical pointer browser 3/3 通過，包含重新宣告、assignment 移入及第 11→12 幀離開同格後置中。
- 瀏覽器逐 tick 確認第一個可見 `temp` 的 active event 是真實 `declare`，Trace Studio 宣告仍為綠色可用；無 page error。未執行完整 regression。
- 3102 已由 PID 15404 重啟為 PID 73308，HTTP 200，載入 `trace-269`；重啟後正式範例宣告生命週期專項 1/1 通過。

## 2026-10-03：六狀態指標排程接入 Tween

- canonical pointer model 新增單一 transition plan，先依 `pointerInstanceId` 配對同一 C++ 生命週期，再只對已確認的遞迴父子角色採用穩定 `pointerId` 配對；每支指標統一產生 `enter／exit／move／retarget／reflow／stay` 其中一種狀態。
- Tween 的進場、跨幀延續與同格避讓改讀 transition plan；canonical 模式不再呼叫舊的 frame-level marker reflow 與 exit reflow 判斷。assignment checkpoint 仍使用共用 ghost 執行器，但其幀邊界來源已由 canonical plan 決定。
- 一維與 matrix 的角色 ID 改由函式名、變數名、目標名及維度組成，不再依賴會隨遞迴 activation 改變的 variable ID；不同生命週期仍保有不同 instance ID，不會把迴圈重新宣告誤當延續。
- matrix row／column 在索引尚未有值時不再被 renderer 丟棄：row 停在左側、column 停在上方，且兩個 axis 使用不同 unresolved target group；原本一維未解析指標仍維持停在陣列左側。
- 舊 renderer 與 Tween 函式仍保留供使用者比對，但 canonical runtime 不會靜默 fallback；尚未依使用者驗收要求刪除。
- 驗證分級：V2，分類 G、J。`pointer-model.test.js` 與 `unresolved-markers.test.js` 共 74/74 通過；隔離 3192 的 `pointer-model.browser.test.js` 3/3、`merge-sort-recursive-layout.browser.test.js` 1/1 通過；JS 語法檢查與 `git diff --check` 通過。
- 實際瀏覽器覆蓋：matrix resolved／unresolved axis、倍增 Merge Sort 舊 `l/r` 退場→新生命週期宣告→assignment 移入、第 11→12 幀離開同格後復位、遞迴 keep 子節點不重播進場；無 page error。
- 舊有物件相容性：未新增持久化欄位；舊 trace 由 renderer 在載入時產生 pointer role／instance／transition，既有事件明確關閉設定未變更。本輪不涉及物件儲存格式與匯出往返。
- 未執行完整 regression；需由主代理整合時決定是否擴大到其他遞迴演算法與手動 layout 指標案例。
- 3102 已由 PID 73308 重啟為 PID 48548，HTTP 200，前端載入 `pointer-4`、`trace-270`、`trace-241`。

## 2026-10-03：事件 checkpoint 與退場判定改讀六狀態模型

- assignment／declare 等同一幀內的事件 checkpoint 現在會重建前後兩份指標狀態，再交給同一個 transition plan 分成 `enter／exit／move／retarget／reflow／stay`；不再由「哪一個變數被賦值」和「目的格是否有 peer」兩套特例各自決定動畫。
- 每個 checkpoint 會留下可檢查的 `checkpointTimeline`，記錄 event、起訖時間、pointer role／instance、前後 target 與 slot。新增案例直接確認 `i` 移入 `j` 所在格時，模型產生 `i: retarget` 與 `j: reflow`，動畫執行器只照計畫播放。
- 同格 slot、群組寬度、resolved／unresolved 停放位置統一改由 pointer model 的 layout 一次計算；matrix unresolved key 保留完整 axis 資訊，不會因 key 內含冒號而把 row／column 分到錯誤群組。
- canonical 模式的宣告進場延遲、跨幀延續與退場 ghost 是否需要建立，均由 transition plan 的 instance 配對結果決定。既有 ghost clone、opacity、SVG path 更新仍保留為「執行動畫」的 renderer／Tween 程式，但不再自行判斷指標身分或六種狀態。
- 舊 `deferredMarkerEntranceBarriers`、`declarationMarkerReflowSchedule`、`markerGroupReflowDuration`、`recursiveMarkerTransitionSteps`、`exitMarkerReflowSchedule` 函式暫時保留以便使用者比對；canonical 分支不會呼叫它們，尚未依使用者最終驗收刪除。
- 驗證分級：V2，分類 G、J。JS 語法檢查通過；pointer model 與 unresolved marker 共 74/74、入口依賴 1/1；隔離 3192 的 pointer browser 3/3、遞迴 Merge Sort keep browser 1/1 通過，無 page error。未執行完整 regression。
- `git diff --check` 通過（僅有既有 LF→CRLF 提示）。3102 已由舊 PID 48548 重啟為 PID 76808，HTTP 200，實際載入 `pointer-4`、`trace-271`、`trace-241`；重啟後以正式倍增範例呼叫 `/trace/analyze`，取得 8 個 frame directives 且無錯誤。

## 2026-10-03：宣告即賦值合併動畫

- runtime 仍保留 `declare` 與初始化 `assign` 兩筆原始事件及其順序，但以每個 declarator 的穩定 ID 配對；播放器與 Trace Studio 將其呈現為一個宣告動畫，不遺失重播資料。
- `int x = num[i]` 等可見來源初始化會讓 `x` 先以空值入場，同一個宣告時段複製來源數值飛入，抵達後才提交值；陣列複製會逐格套用相同規則。常數或未顯示來源則直接帶初始化值入場，不杜撰來源位置。
- 指標初始化宣告直接在初始化後的資料格位置入場，不再先停 unresolved 再播放第二段 assignment。
- 逗號宣告 `int n=5, m=6, t;` 依 declarator 拆成三個宣告動畫。程式碼標記分別顯示 `int n=5`、`int … m=6`、`int … t`，並用不連續 source ranges 同時標記共用型別與目前 declarator，不會把中間其他宣告一起高亮。
- 修正 literal initializer 的 replay baseline：宣告 value track 建立後若由同時段的 instant initializer 決定初始值，會在播放前同步為最終值；可見來源的 baseline 仍維持空白直到 transfer 抵達。
- 驗證分級：V2，分類 F、G、J。JS 語法與 `git diff --check` 通過；事件樹、事件預設、unresolved marker、入口依賴共 85/85；首尾事件、for initializer、逗號宣告及 container constructor 專項 6/6；初始化／算式 assignment browser 4/4，以及正式倍增 Merge Sort 指標直接入場 browser 1/1 通過，無 page error。
- 未執行完整 regression；依分級只執行宣告追蹤、事件呈現、正向 replay、來源 transfer 與指標初始化的相關最小驗證。未新增持久化必要欄位；舊 trace 缺少 declarator ID 時會退回既有 variable/lifetime 配對，既有明確事件開關仍保留。
- 3102 已由 PID 76808 重啟為 PID 5836，HTTP 200；確認載入 `trace-272`、`trace-63`、`code-37`、`trace-9`，新逗號宣告語法的 `/trace/analyze` 回傳 1 個 frame directive、0 個錯誤。

## 2026-10-03：容器插入的可見來源轉移

- `temp.push_back(num[l])` 不再只讓新格由邊緣淡入。sequence event 現在記錄來源格、插入邊／插入索引及實際插入值；來源可見時，新格先以空值出現，再複製來源格中的顯示值飛入，抵達後才提交結果。
- 這是通用的容器插入模型，不依賴 `temp`、`num` 或 Merge Sort。已涵蓋 sequence 的 `push_back／push_front／emplace_back／emplace_front`、單值 `insert(pos,value)／emplace(pos,value)`，以及 stack／queue 的單值 `push／emplace`。常數或未顯示來源維持原本的直接進場，不杜撰飛行起點。
- 中間 `insert` 由 runtime 回傳的 iterator 計算真正插入索引，不以 front／back 猜測；stack 以 top、queue 以 back 作為插入端。`priority_queue` 因插入後會重新堆化，暫不套用單一邊緣插入模型。
- 正向 replay 將 presence 與 value 的提交時間分開：新格外框在 sequence 開始時出現，可見來源的值則在 transfer 抵達時才顯示。修正 visual track 原先丟失每個 mutation 自訂 commit time 的問題。
- server 新增 `ASM_TEMP_DIR` 可選設定，測試／預覽服務可將編譯暫存檔放在明確可寫位置，避免 worktree `tmp` 的 Windows EPERM；未設定時仍維持原本 `algo-vis-backend/tmp` 行為。
- 驗證分級：V2，分類 F、G、J。sequence integration 6/6、宣告／算式／容器來源轉移 browser 5/5、入口依賴 1/1，共 12/12 通過；JS 語法與 `git diff --check` 通過。未執行完整 regression。
- 正式倍增 Merge Sort 在 3102 編譯為 39 幀；24 個 `push_back` 事件全部保留可見來源（例如 `num[r]`）。3102 已由 PID 5836 重啟為 PID 13416，HTTP 200，載入 `trace-273`，`/trace/analyze` 取得 8 個 frame directives 且無錯誤。

## 2026-10-04：遞迴節點生長、父層合併槽與 layout 固定邊界

- recursion growth 原本只比較 keep snapshots，因此最新一次遞迴呼叫仍是 live `part` 時不會被視為新節點。Tween 現在另外辨識新 activation 的 live layout node，從上一個可見父 activation 的位置執行生長；live→keep 交接仍保持原地，不會重播一次生長。
- 第 2→3 幀的浮動箭頭是同一條樹邊在 live→keep 交接時由物件 key 組成的 ID 改變，舊邊因而被當成退場 ghost。layout edge 改以 recursion activation identity 作穩定 ID，交接前後沿用同一條邊。
- bottom-up merge tree 會把已完成的子節點直接掛到目前 live `merged` activation；`merged` 因而佔用真正的父節點槽位，不再與自己的子節點排成兄弟節點。
- linear layout 不再用整體 bounding box 的中心沿生長軸重新置中：top-down 固定頂邊、bottom-up 固定底邊、left-right 固定左邊、right-left 固定右邊；另一軸仍遵守 authored anchor。recursion layout 的根朝向邊也維持固定，因此增加高度不會把既有內容向反方向推動。
- 驗證分級：V2，分類 G、J。`tests/layout-directives.test.js` 與 `tests/merge-sort-recursive-layout.browser.test.js` 共 27/27 通過；瀏覽器逐 tick 確認 live child 具有 recursion growth、keep 不重播入場、轉場沒有 layout edge ghost，且 merge children 的 parentId 指向 live `merged`。
- JS 靜態語法與 `git diff --check` 通過（只有既有 LF→CRLF 提示）。未執行完整 regression；依分級只執行 layout 與遞迴 Merge Sort 的最小相關驗證。
- 3102 已重啟為 PID 66692，HTTP 200，載入 `trace-frame-tween.js?v=trace-274` 與 `trace-renderer.js?v=trace-242`；重啟後遞迴 Merge Sort browser 專項 2/2 再次通過。

## 2026-10-04：`push_back` 完整來源格轉移

- 有可見資料來源時，例如 `temp.push_back(num[l])`，sequence 動畫改為複製整個來源格 SVG，包含格框、填色與數字，直接從 `num[l]` 移到 `temp` 實際新增的尾端槽位。
- 動畫期間真正的目的格已位於最終尾端位置但保持隱藏；完整格子 clone 抵達後才交接顯示，因此不會同時再跑一次由右側進場的舊動畫。
- 常數或沒有可見資料來源時，例如 `temp.push_back(9)`，不建立來源格 clone，維持原本由插入邊緣進場的 sequence 動畫。
- 使用共用 inserted index 計算，因此 `push_back` 落在舊 size 對應的尾端新位置；既有 `push_front` 與中間 `insert/emplace` 仍可沿用各自的實際插入位置。
- 驗證分級：V2，分類 F、G。新增 browser 定點檢查完整 clone 具有 `rect` 與數字、起點接近來源格、終點接近新尾格、真實目的格不由右側移入；同一案例也確認 literal push 保留超過 20px 的右側進場位移。專項 1/1、JS 語法與 `git diff --check` 通過。
- 3102 已由 PID 66692 重啟為 PID 63120，HTTP 200，載入 `trace-frame-tween.js?v=trace-275`；重啟後同一 browser 專項 1/1 再次通過。

## 2026-10-04：移除倍增範例的動畫用 `t`

- `t` 只用於控制 `@style temp[L:t]`，不是 Merge Sort 演算法需要的狀態，因此從 C++ 移除 `int t = 0` 與三處 `t++`，不再讓教學程式承擔動畫參數。
- 三處樣式統一改為 `@style temp[L:n-1] background AV_green!`。range 的終點可以超過目前 `temp` 的長度，renderer 會裁切到實際存在的最後一格，因此仍只塗目前已寫入的區段，不需要另算精確尾端索引或建立 `@let t`。
- 3102 `/trace/analyze` 與 `/compile` 以正式輸入產生 39 幀、4 個快照；trace 變數中沒有 `t`，34 個含 `temp` style 的幀可正常產生，所有事件 order 皆為數值且依執行順序排列。
- 驗證分級：V2，分類 E、H；本輪只修改正式範例指令與 C++ 展示程式，未執行完整 regression。
- 3102 已由 PID 63120 重啟為 PID 33084；`/api/samples` 回應 HTTP 200，正式範例內容不再包含 `int t = 0`。

## 2026-10-04：套用使用者提供的倍增 Merge Sort 程式

- 正式 `merge_sort_bottom_up.cpp` 已完整更新為使用者提供版本：移除逆序對 `sum`、移除 `takeLeft`，將 `l/r` 遞增直接放在實際取值分支與補值迴圈內。
- 結尾文字改為「Merge Sort 完成」，函式不再輸出逆序對，只由 `main` 輸出排序後陣列。
- 加入使用者提供的 `@asm-view`，明確關閉 `autoFixedEnabled` 與 `autoLoopBoundaryEnabled`；既有 layout、preset、keep、style 與 text 指令保持原樣。
- 3102 `/trace/analyze` 與 `/compile` 以正式 sample input 成功產生 39 幀、4 個快照；事件 order 全為數值且逐幀排序，trace 中不再包含 `sum` 或 `takeLeft`。
- 驗證分級：V2，分類 E、F、G；本輪只替換正式範例，未執行完整 regression。
- 3102 已由 PID 33084 重啟為 PID 34112，`/api/samples` 回應 HTTP 200；重啟後再次透過 3102 編譯，結果仍為 39 幀、4 個快照且事件順序有效。

## 2026-10-04：最後一幀 `num` 誤退場修正

- 根因是 `mergesort(vector<int>& num, int n)` 結束時產生的 `scope-exit` 代表參考參數綁定離開作用域，不代表呼叫端持有的陣列本體被銷毀；尾端事件附到最後一幀後，Tween 卻將它排成容器退場並在正向 replay 將 presence 設為 false。
- 新增自然參考容器退場判定：非手動的 `scope-exit` 若目標型別是參考且為可視容器，只結束 C++ 綁定，不建立 exit slot，也不移除畫面物件。區域 `vector` 等真正擁有物件的容器仍維持原本退場；明確 `visual-exit`／手動退場不受影響。
- 驗證分級：V2，分類 G、J。`scene-exit-entrance-order.test.js` 8/8 通過；新增精簡 reference final-frame 瀏覽器案例 1/1，以及正式 39 幀倍增 Merge Sort 最後兩幀案例 1/1，兩者在動畫播放完成後物件 opacity 為 1、可見且尺寸有效，無 page error。
- JS 語法與相關差異檢查通過；未執行完整 regression。未新增持久化欄位，本次不涉及已儲存物件格式、明確關閉設定或資料往返。
- 3102 已由 PID 34112 重啟為 PID 55868，HTTP 200 並載入 `trace-frame-tween.js?v=trace-276`；重啟後正式倍增 Merge Sort 最後兩幀瀏覽器案例再次 1/1 通過。

## 2026-10-04：幀條直接跳到最後一幀仍隱藏 `num`

- 幀條的 `goto` 使用 stable render，不執行 Tween；Renderer 會直接結算該幀已完成的生命週期事件。原修正只排除了 Tween timeline／forward replay 的參考容器退場，stable renderer 的 `applyCompletedScopeExits` 仍把 `vector<int>& num` 設為 `display="none"`。
- stable renderer 現在接收 trace document，並重用 Tween 的 `naturalReferenceContainerExitTarget` 判定；參考容器的自然 `scope-exit` 不再隱藏呼叫端物件，區域容器與明確 `visual-exit` 仍照常結算。
- 新增 `CodeScript.goto(-1)` 的直接跳幀驗證，同時覆蓋 2 幀精簡參考案例與正式 39 幀倍增 Merge Sort。兩者正常播放與直接跳到最後一幀後，目標陣列皆 opacity 1、display 非 none、尺寸有效，無 page error；瀏覽器專項 2/2 通過。
- 驗證分級：V2，分類 G、J。`scene-exit-entrance-order.test.js` 8/8、JS 語法與 `git diff --check` 通過；未執行完整 regression。
- 3102 已由 PID 57372 重啟為 PID 35168，HTTP 200 並載入 `trace-renderer.js?v=trace-243`；重啟後正式範例的正常播放與 `goto(-1)` 專項再次 1/1 通過。

## 2026-10-04：倍增 Merge Sort 範例定稿

- 正式 `merge_sort_bottom_up.cpp` 已更新為使用者提供版本：最後完成幀移除整列綠色背景，保留純文字「Merge Sort 完成」。
- `@asm-view` 新增 `codePanelFontSize: 11`，並明確關閉 `main` 的 `return 0`、逐項輸出與換行輸出三類事件；auto fixed 與 auto loop boundary 仍維持關閉。
- 經 3102 正式編譯仍產生 39 幀、4 個快照，所有事件 order 為數值且逐幀排序；三個事件關閉設定及程式碼字級均保留在 trace studio 設定。
- 驗證分級：V2，分類 D、G、J。正式範例正常播放與 `goto(-1)` 瀏覽器專項 1/1 通過，最後 `num` 維持可見；未執行完整 regression。
- 3102 已由 PID 35168 重啟為 PID 37192，`/api/samples` 回應 HTTP 200。

## 2026-10-04：遞迴 `part` 從父節點整體生長

- `vector<int> part(...)` 的新遞迴節點原本同時套用 recursion growth 與一般 declaration entrance。一般進場會把父→子位移歸零，且 outerframe／資料格分別執行生命週期進場，因此視覺上不是整顆節點由父節點長出，而像多個零件從外部飛入。
- Tween 現在讓 recursion／keep structural growth 優先：整個節點沿父節點位置移動與縮放，內部 outerframe、格子及標籤只繼承父容器運動，不再各自執行宣告進場；declare 事件本身仍保留在事件線。
- `split_tree` 與 `merge_tree` 的 `level-gap` 由預設 100px 明確改為 60px，兩棵樹的上下層距各縮小 40px。
- 驗證分級：V2，分類 E、G、J。遞迴 Merge Sort browser 專項 2/2 通過；新增斷言確認 live child 有 recursion growth、沒有普通 appearing，且獨立進場的內部元素數量為 0。正式樣本仍為 55 幀、30 個快照，事件 order 全為數值且逐幀排序；JS 語法與 `git diff --check` 通過，未執行完整 regression。
- 3102 已由 PID 37192 重啟為 PID 23116，HTTP 200 並載入 `trace-frame-tween.js?v=trace-277`；重啟後相同遞迴生長 browser 專項再次 1/1 通過。

## 2026-10-04：遞迴第 1→2 幀方向與內部幾何綁定

- 逐 tick 量測確認第 1→2 幀的 live child 雖有 recursion growth，但資料格仍依前一 activation 的同索引格各自插值（第一格額外 `translate(-80, 0)`）；outerframe 也同時由父陣列寬度插值到子陣列寬度。兩者疊上整體縮放後，外框中心比父節點向右偏約 59px，因此視覺上從右上滑入且內外框不同步。
- structural growth 現在鎖住所有子元素相對於節點容器的位置，不再沿用父 activation 的格子位移；top-level outerframe 在 recursion／keep growth 期間不做獨立尺寸插值。子節點的 outerframe、資料格和標籤只接受同一個父→子 transform。
- browser 回歸改為直接驗證第 1→2 幀：開始時子 outerframe 的水平／垂直中心與父節點誤差小於 2px、第一格中心位於 outerframe 內、outerframe 與完整節點同為約 0.72 scale，結束時子節點位於父節點下方，方向為 top-down。
- 遞迴 Merge Sort browser 專項 2/2 通過，包含 merge_tree 的父槽位案例；JS 語法與 `git diff --check` 通過，未執行完整 regression。
- 3102 已由 PID 23116 重啟為 PID 66688，HTTP 200 並載入 `trace-frame-tween.js?v=trace-278`；重啟後第 1→2 幀幾何綁定專項再次 1/1 通過。

## 2026-10-04：新增子節點時上層遞迴箭頭誤跟隨

- 箭頭 ID 經逐幀核對是正確且互不相同：既有上層 edge 為 `split_tree:activation-1:activation-2`，新 edge 為 `split_tree:activation-2:activation-3`；配對器也正確將上層 edge 與自身配對，新 edge 沒有借用舊 ID。
- 根因是配對後重建舊端點時，Tween 先用上一幀的 object key 查目前 elements map。遞迴區域變數 `part` 的 key 會跨 activation 重用，因此上層 edge 的舊終點被解析成最新子節點，造成它在轉場中跟著新節點移動，完成後才回正確位置。
- 箭頭端點回放現在優先使用上一幀已凍結的 `traceArrowFrom/ToX/Y`；只有舊 trace 缺少凍結座標時才用 key 查找。這保留 stable edge identity，同時避免可重用的遞迴變數 key 汙染舊端點。
- 新增第 2→3 幀逐 tick regression：上層 edge 的 x1/y1/x2/y2 在 start、early、middle、after 均與前一幀誤差小於 1px；新 edge 存在且沒有 previous 配對。遞迴 Merge Sort browser 專項 3/3、JS 語法與 `git diff --check` 通過，未執行完整 regression。
- 3102 已由 PID 66688 重啟為 PID 23708，HTTP 200 並載入 `trace-renderer.js?v=trace-244`；重啟後上層 edge 穩定性專項再次 1/1 通過。

## 2026-10-04：第 6→7 幀綠色葉節點連線重複

- 多出的綠色箭頭不是 recursion layout edge，而是 `@arrow from split_tree.current.bottom to merge_tree.current.top` 在 `@keep` 後由即時 ID `arrow-…-0` 改為快照 ID `arrow-…-0@snapshot:frame:…`。快照後綴必須保留，才能讓多條已保存的葉節點連線彼此獨立。
- 舊配對器只認完全相同的 ID，因此交接幀同時把舊箭頭排成退場 ghost、把快照箭頭排成新進場，造成動畫期間短暫看到兩支綠色箭頭。
- retained arrow 現在帶有一次性的 `handoffFromId`，配對器僅在來源類型相同且舊 ID 唯一時，將即時箭頭交接給快照箭頭；下一幀起仍以完整快照 ID 正常配對，不會錯接其他葉節點箭頭。
- 驗證分級：V2，分類 G、J。arrow identity 單元測試 3/3 通過；遞迴 Merge Sort browser 專項 4/4 通過。第 6→7 幀於交接開始、動畫途中與結束逐點取樣，綠色 directive arrow 始終只有一支，沒有 transition ghost；JS 語法與 `git diff --check` 通過，未執行完整 regression。
- 3102 已由 PID 23708 重啟為 PID 82852，HTTP 200 並載入 `trace-arrow-model.js?v=arrow-11`、`trace-renderer.js?v=trace-245`；重啟後第 6→7 幀綠色箭頭專項再次 1/1 通過。

## 2026-10-04：`branch-previews on` 第 3 幀重複 `part`

- 系統 branch preview 會用 `previewSnapshotId` 顯示即將執行的遞迴分支，但預覽幀同時沿用 authored frame 的 `primaryVariableId`。同一個 `part` 因此一份由 keep snapshot 呈現，另一份又被當成頂層 live recursion object 排到樹下方。
- renderer 現在只在 `systemBranchPreview` 且已有 `previewSnapshotId` 時，將該幀的主要遞迴變數列為僅供資料解析、不另外繪製。原 state 仍可供文字、樣式與其他物件使用，snapshot 內真正的 `part` 不受影響；這是所有 recursion branch preview 共用的規則，不依賴 Merge Sort 或固定幀號。
- 新增 `branch-previews on` 的第 2→3 幀 browser regression，於轉場途中及穩定畫面確認沒有頂層 live `part`，且指定的 preview snapshot 恰好出現一次。
- 驗證分級：V2，分類 G、J。遞迴 Merge Sort browser 專項 5/5、既有河內塔 branch preview browser 1/1 通過；renderer JS 語法與相關 `git diff --check` 通過，未執行完整 regression。
- 3102 已由 PID 82852 重啟為 PID 40400，HTTP 200 並載入 `trace-renderer.js?v=trace-246`；重啟後第 2→3 幀 branch preview 專項再次 1/1 通過。

## 2026-10-04：遞迴合併預配置、來源格索引與 keep 交接

- 遞迴範例的 `merged` 改為先配置 `R - L + 1` 格，再以 `merged[k] = num[i/j]` 寫入；範例不再使用 `push_back`，因此 outerframe、資料格與 index 一開始就有完整幾何，不會在接收資料時先後伸長。
- 合併中的目前格改用未指定顏色的 `highlight`，由系統預設色決定。正式 trace 的 style `color` 為空字串，未寫死綠色。
- sequence 來源索引支援 `i++`、`i--`、`++i`、`--i` 的安全擷取；`num[i++]` 使用運算前的實際索引定位來源格，不會再次執行副作用，也不會退回整個陣列或錯誤座標。
- 有可見來源的 `push_back` 只移動複製的完整來源格；真實目的格留在尾端並於交接前隱藏，不再同時執行由右側滑入／跳入。空陣列首次顯示時仍保留物件名稱。
- 修正 live 葉節點交給 `@keep` 的同一幀又遇到自然 `scope-exit` 時，Tween 再複製一次退場 ghost 的問題。若進場 keep 已接手相同 runtime identity，略過該自然退場 ghost；明確 `visual-exit` 不受影響。
- 驗證分級：V2，分類 F、G、J。正式遞迴樣本由 3102 產生 55 幀、30 個快照、0 個 `push_back`，assignment 的來源與目的索引皆已解析，事件 order 全為數值且逐幀排序。
- 專項測試：side-effecting source index 1/1；完整來源格轉移與空陣列名稱 2/2；split leaf → merge leaf → keep 不產生第三份 `part` 1/1。JS 語法與相關 `git diff --check` 通過，未執行完整 regression。
- 3102 已由本 worktree 從 PID 60868 重新啟動為 PID 81716，HTTP 200，載入 `trace-frame-tween.js?v=trace-279`、`trace-renderer.js?v=trace-246` 與 `trace-arrow-model.js?v=arrow-11`。

## 2026-10-05：同名 keep 節點與目前格子的標記所有權

- `updatePresentedHints` 依 decoration 綁定的實際 cell DOM 配對，不再只依 `merged#0` 等公開 key 收集或隱藏重複標記。未搬到 decoration layer 的格內標記也以實際格子祖先配對；不新增持久化欄位。
- 修正使用者範例第 11→12 幀 `num as merged` 的 mark 被同名 kept 葉節點標記誤判為重複而隱藏。
- V2／G、H：獨立 31992 與 headless Edge，`retained-hint-owner.browser.test.js` 1/1 通過；1×／4× 手動切幀與 autoplay 均顯示兩個 live mark，keep marks 保持可見。
- 同檔驗證自訂 mark／point／highlight 顏色、清除 live 標記時 keep 不變，以及 JSON 儲存重開後明確 `autoFixedEnabled:false` 保留。既有 trace 無需遷移，所有權由 DOM 重建。
- `entrypoints.test.js` 1/1、`presentation-hints.test.js` 2/2、renderer 語法與 diff whitespace 檢查通過。未跑完整 regression 或 Studio 全套操作；本次不更改 Studio、事件排程或 camera。
- renderer 快取版本更新為 trace-257；3102 由確認的本分支 PID 61596 重啟，僅停止本次独立測試服務。

## 2026-10-05：沒有繪圖指令時不建立動畫追蹤

- 依 C++ AST 的 LineComment 判定繪圖指令，避免字串中的 `// @frame` 被誤認。單獨 @let、@code hide/show、@asm-view 不啟用動畫追蹤。
- instrumentSource 在無繪圖意圖時直接回傳原始 C++，動畫 variables、frame/keep/layout、source/event metadata 皆為空；server 即使收到 trace.enabled=true 與 watches，也走一般編譯，不產生 traceDocument。正常程式輸出保留。
- analyze 回傳 drawingEnabled，前端 getCompileConfig 同步停用 trace；前端快取版本 trace-editor-30。既有有繪圖指令的程式流程不變，舊 API 缺少 drawingEnabled 欄位仍採原先啟用值。
- 本次 V2／F、G：no-drawing-trace 小驗證 3/3、入口 1/1 通過。涵蓋原始碼不改寫、字串／單純設定與參數註記、直接編譯請求、隔離瀏覽器前端設定及重新加入 @frame；語法與 whitespace 檢查通過。
- 行為變更為使用者明確要求：無繪圖指令的舊程式重新 RUN 不再自動建立動畫。已存 trace 不做破壞性遷移，讀取既有動畫仍保留。
- 使用本分支獨立 31992，不操作使用者分頁；未跑完整 regression 或無關演算法。完成後重啟本分支 3102。

## 2026-10-05：插入格子與 layout 位移使用相同事件時鐘

- 原本 outerframe 的 sequence resize 等待 push_back，但一般 layout 位移從幀開始就往最終位置移動。尺寸尚未增加時，merged 已提前偏移。
- 將單次 sequence resize 的位移時鐘從 heap 專用擴展到序列容器，並將相同 layout 的既有節點位移綁定相同 resize slot。格子及外框繼續使用既有來源複製、尺寸及相對位移邏輯；不依賴特定演算法、變數名或幀號。
- V2／G、H：新增 sequence-layout-timing.browser 專項，使用使用者程式設定與輸入 10／38 27 43 3 9 82 10 19 84 60。第 30→31 幀於 1×、4× 手動及 autoplay，插入前維持原 x/y/width，插入中位移比例與寬度增加比例一致，結束後與穩定幀幾何一致。
- 相關 browser 小驗證 3/3（排版時序、插入後格子保留、keep 標記所有權）；outerframe label／heap cell 相對位移 2/2、入口 1/1、語法與 whitespace 檢查通過。未執行完整 regression；多次 resize 同幀的逐次重新排版不在本輪擴充範圍。
- 無新增 trace 欄位或設定。既有資料與明確關閉動畫設定沿用既有流程，sequence-commit 專項包含關閉事件案例。Tween 快取升至 trace-291，完成後僅重啟本分支 3102 並清理隔離31992。

## 2026-10-05：允許零物件的 @frame

- 移除「@frame 至少需要一個緊接的 @object」限制。frame 仍是明確的繪圖／capture 邊界，零 objects 不退回無指令模式、不自動補變數。
- 延續原本 captureOnly 隱藏資料機制，空幀可包含文字、when 或 preset 樣式；原本 @frame 後追加 @object 的行為不變。物件設定仍要求有效物件，未放寬錯誤的 as／with 等設定。
- V2／E、G、J：獨立31992／Edge 驗證空首幀、物件幀後空幀、連續空幀、text-only、when 與整份程式全空幀。1×／4× 前進、返回、autoplay 均正確；JSON 儲存重開保留5幀，空幀沒有隱含物件。
- empty-frame browser 1/1、無繪圖閘門3/3、相關 preset／frame 條件解析3/3通過；語法與 whitespace 檢查通過。無新持久化欄位，不需資料遷移，未跑完整 regression。
- 完成後僅重啟本分支3102，清理獨立31992；沒有操作使用者分頁。

## 2026-10-05：default 單數正式語法與舊複數相容

- 新正式語法 @default／@enddefault；解析器同時接受 @defaults／@enddefaults，共用原有內部預設區塊身分，不建立第二套套用邏輯。錯誤訊息、提示目錄與10份既有範例改用單數。
- 舊程式不需改寫；當幀與 preset 覆寫優先順序、自訂鏡頭設定不變。沒有新增持久化欄位或破壞性來源遷移。
- V2／E、D：defaults 專項8/8、提示3/3、入口1/1通過，JS語法与whitespace檢查通過。包含單數 camera auto 空幀、舊複數編譯、實際隔離瀏覽器載入／儲存重開，原始來源、自訂鏡頭／字級及 autoFixedEnabled:false 保留。
- 本分支31992獨立服務／Edge；未跑完整 regression。提示快取升至directive-32，完成後只重啟本分支3102並清理測試服務。

## 2026-10-05：文字定位至 layout 根節點

- 文字等 semantic 位置綁定若目標為已存在 layout 的 .root／.current／.nodes／.leaves，沿用 arrow 的 materializeLayoutEndpoint 與 node collection，不另建節點判定規則；明確存在的 canvas 物件別名優先。
- 使用者最後的空幀 `@text "Merge Sort 完成" at merge_tree.root.bottom` 現在可定位至已 keep 的完成根節點。旧 trace 的 dotted targetObjectKey 直接適用，無需補新欄位或遷移來源。
- V2／E、D、J：獨立31992／Edge，layout-text-root 專項1/1，核對根呼叫的實際 SVG 外框與文字：置中、底部間隔8px；1×／4× 手動與autoplay、儲存重開、nodes[0]同根結果及明確關閉設定保留皆通過。
- text-object-bindings既有案例8/8、入口1/1、語法與whitespace檢查通過。未跑完整 regression。Renderer快取更新trace-258，完成後只重啟本分支3102，清理隔離服務。

## 2026-10-05：共用 layout 節點定位

- 物件/frame、keep、layout at、layout/object place、text、camera 與 arrow 共用 layoutTargetDescriptor → materializeLayoutEndpoint → layoutNodeCollection。支援 root/current/nodes/leaves/children/level/side/box；明確存在的 canvas 物件別名維持優先。定位 level(depth) 會捕捉 depth 依賴。
- pointer 增加 root/current/nodes/leaves/level/side 目標，先選節點，再依指標值定位原始索引的格子；沿用 snapshot-local proxy 避免同名遞迴來源混淆。舊 children[k] 及 frame 陣列指標仍可使用。root/current 的單一中括號是格子索引；集合先選節點，可再指定格子索引。
- 範圍僅為定位與 pointer；style/segment 的內容選取未擴充。未改變 @object in 的既有限制。
- V2／E、G、D、J：獨立31992／Edge。新共用定位 browser 1/1，核對 object/frame、object/layout place、layout at、keep、live current pointer、kept root/leaves 指標，以及 nodes/level/side 替換、JSON 儲存重開與明確 false 保留。既有 root-text browser 1/1（1×/4×手動與autoplay）、child pointer browser 2/2通過。
- 新共用解析1/1、pointer解析5/5、camera4/4、提示3/3、入口1/1、place9/9通過。place舊JSDOM測試缺少正式camera模組，補齊測試載入後原有斷言通過，未放寬斷言。JS語法與git diff --check通過，未跑完整 regression／全演算法驗證集。
- 舊 trace dotted targetName/indexExpressions 無需遷移。新 pointer 的可選 layoutTarget 僅用於新選擇器，舊 layoutChild 路徑相容；新建、已儲存 trace 載入使用與儲存重開都有實際 browser 證據。
- Renderer trace-259、提示 directive-33；只重啟本分支3102（PID56556），核對HTTP版本與 /trace/analyze 新語法，停止本次31992（PID77720）。未操作使用者分頁、其他服務、main 或 push。

## 2026-10-05：介紹幀對齊未出現的 split 根節點

- 使用者介紹幀維持 `@frame num`（不加入遞迴樹），定位改成 `@place num.top-left at split_tree.root.top-left`。原來 `.root.top` 是上邊中點，並非左上角。
- reserve:true 且目前沒有此 layout 的可見節點時，針對明確引用的 root 建立隱藏、anchor-only 的預留幾何；不新增可見節點、不產生資料格或指標、不改 trace 持久化結構。祖先 linear／layout place 同樣平移此 anchor。
- 預留 slot 尺寸可能來自 keep 的量測，使用第一次實際根 frame 外框尺寸套用與正式 reserve 排版相同的跨軸置中計算，避免把 slot 左上角當作實際根外框左上角。只預留跨軸跨度，不預先佔用未出現的層高。
- V2／E、D、J：隔離31992／Edge，reserved-root-intro 1/1通過。使用者程式（含雙layout、default camera auto、mark與獨立pointer），輸入10／38 27 43 3 9 82 10 19 84 60。1×／4×前進與返回，前兩幀實際 SVG 外框及鏡頭穩定後螢幕座標一致；第一幀可見tree節點0、第二幀1；Studio、縮圖、JSON儲存重開與reserve:false保留通過。
- 既有共用 layout-target browser1/1與入口1/1通過；JS語法及diff whitespace通過。未跑完整regression，未驗證其他演算法或全部direction／grow-from組合。
- Renderer trace-260。本分支3102已核對後重啟（PID34488），HTTP新resolver／入口版本確認；隔離31992（PID23476）已停止。未操作使用者分頁、main、其他代理服務或push。

## 2026-10-05：遞迴 Merge Sort 範例定稿更新

- algorithm_sample/Sorting/merge_sort_recursive_layout.cpp 更新成使用者提供版本：介紹首幀對齊 split_tree.root.top-left、保留 plural defaults camera auto、as merged、mark、比較後獨立 i++／j++、餘下元素 mark、區間發音替換、最後空幀文字綁 merge_tree.root.bottom，移除cout並保留兩個eventSettings:false。
- 本輪僅更新範例來源，不改解析器或renderer。來源指令解析9個frame宣告、asm-view JSON及明確false確認通過；未啟動演算法驗證集，前兩幀定位與此程式結構已在上一輪隔離browser验证。
- 保留原來sample input。3102核對後重啟為PID71756，HTTP200確認；未操作使用者草稿、其他代理服務或push。
