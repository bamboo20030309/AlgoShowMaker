# 依來源可見性合併宣告初始化

## 使用者確認的規則

保留宣告、初始化賦值兩份語意事件。播放合併成一次完整初始化，只有完整操作之間套用事件間隔。常數或沒有可見來源時帶值入場；有可見值來源時空目標入場，再接既有複製／計算動畫。部分來源隱藏時沿用原本在接收格子呈現數值的做法，不新增浮動算式提示。

`vector<int> num(n,0)` 直接完整入場，不製作長度 n 的關係動畫。常數指標直接在正確格子入場；可見來源的指標初始化，以及後續指標賦值，保留位移，標籤與箭頭一起移動。

本紀錄取代上一輪 `declaration-initializer-playback-2026-11-05.md` 的「四個分離播放步驟」規格；保留上一輪紀錄作為變更背景，不將舊驗收結果當成本輪證據。

## 實作

- 啟用既有 declarator 配對，增加 lifetime 核對；舊資料使用初始化標記、來源位置與相同變數核實，不按變數名稱／教材幀號寫特例。獨立的後續賦值不合併。
- 只有兩個內部事件都可播放才合併，保留明確關閉與自動可用性設定。內部事件、順序與 ID 不刪除。
- 共用播放 slot 管理空目標入場、來源傳遞、值提交與指標位移；帶值入場在入場開始時呈現結果，有來源的值則在抵達時提交。
- 指標的合併初始化保留自己的後段移動軌；不能因 initializer 不再是獨立 slot 而丟掉位移。未合併初始化也保留自己的賦值與位移時鐘。
- 同一幀內已先完成入場的來源，也能被後面的初始化使用。合併後共用原本的賦值特效入口，不省略 min/max 的比較與選值子動作。
- 程式反白以同一 slot 的宣告、初始化來源範圍共同呈現完整宣告，不影響 Studio 的個別語意事件開關。讀取強調仍跟隨初始化賦值，預設及顏色沿用原設定。
- 不改投影片或 Trace 格式、不新增必填欄位；公開 Trace 可直接使用，無需重新執行教材來套用此播放端修正。

## 固定答案與驗證入口

- `tests/fixtures/initializer-visibility.cpp`、`tests/initializer-visibility.browser.test.js`：常數、隱藏來源、可見格子複製、部分可見的計算、n 可見的數量建構、常數陣列、二維數量建構、完整陣列複製、常數指標、可見來源指標、獨立後續賦值、同幀新來源及 min 選值。帶值入場 220 ms，可見來源純量／容器 1480 ms、指標初始化 2500 ms、min 初始化 3040 ms。檢查入場期間的實際值、複製格子數、比較子動畫、指標和箭頭中間位置，涵蓋新建、刪除非必要語意欄位後的保存重開、1/2 倍、同值賦值與中途取消／跳幀。
- `tests/merge-declaration.browser.test.js`：既有合併排序第 26 幀，兩個初始化 slot、完整宣告反白、0/500 ms 間隔、1/2 倍與明確關閉賦值。
- `tests/declaration-cell-copy.browser.test.js`：公開插入排序的新編譯與保存 Trace；來源整格移動、原來源保留、自訂樣式保留，以及明確關閉。
- `tests/event-contract-clock.browser.test.js` 限 E02/E03/E05：以固定答案核對初始化、一般複製與計算在提交前後的實際 SVG 值，1/2 倍。
- `tests/event-gap.browser.test.js`：預設、0、600 ms 的設定、跨幀間隔與保存重開。
- `tests/heap-marker-assignment.integration.test.js` 限未合併 for initializer 與常數指標初始化兩案。
- `tests/declaration-highlight.test.js`、`tests/event-code-tree.test.js`、`tests/event-motion-policy.test.js`：來源範圍、Studio 個別事件與既有時間規則。

僅執行相關小驗證，不執行全量 regression。實際觀察輸出位於忽略的 `test-results/initializer-visibility/`，不提交。

## 交付範圍

交付至 intergration、推送 GitHub並重啟 3100；main、3000 與 release 不在本輪修改範圍。

快取版本：tween trace-316、code presenter code-35、slides-308、內嵌 runtime-64。沿用目前 Trace ID，不更改教材檔案。
