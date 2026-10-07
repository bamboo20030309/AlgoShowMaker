# 卡片清單與獨立封面區

## 行為與格式

/api/slides 一次回傳擁有者的完整卡片資訊：deck_uid、標題、封面縮圖、頁數、建立／最後編輯時間、格式版本、分類及資料夾排序 layout。Mongo 查詢只選卡片欄位，不讀 deck、素材或 Trace。首頁直接使用此結果，不再逐張呼叫 thumbnail API，也不再為缺少縮圖下載完整投影片。缺失縮圖先用預設封面，保存／匯出時由既有 renderer 產生。

範例區也只讀 guest-decks.json：已為 15 份公開教材預先建立縮圖、頁數、封面版本與已知編輯時間。build-guest-card-cache.js 為建置時的一次性產生器，不 RUN 演算法、不更動範例動畫。既有範例 .asmdeck 保留原檔，不在訪客首頁解包。

新匯出的 .asmdeck 使用 ASMDECK2 換行檔頭、4-byte little-endian 封面長度、UTF-8 JSON 封面區與 gzip 內容區。封面包含 title/categories/tags/slideCount/updatedAt/thumbnail/contentHash。未知的最後編輯時間是 null，manifest.exportedAt 仍是匯出時間，兩者不混用。封面上限 512 KB；完整匯入核對封面雜湊、內容雜湊、頁數及圖片素材。內容區仍只引用 Trace ID。

ASMDeck.readCover 只讀檔頭與封面區；readCoverURL 使用兩個 HTTP Range 請求，不支援 Range 的來源不回退成整檔下載。首頁拖入新 .asmdeck 時只檢查封面，真正開啟編輯器才完整驗證內容。ASMDECK1 舊檔仍可完整匯入，readCover 回傳 null，不以讀取封面為由偷偷解包整檔。

編輯器匯出與雲端保存共用封面快取；首張投影片資料雜湊沒變就沿用縮圖。內容有修改才更新最後編輯時間；封面分類沿用所開啟卡片或匯入檔資訊。新匯出包含封面，舊檔無此欄位仍可載入、編輯、保存與重開。

## 驗證（V1）

asmdeck 格式與舊檔相容測試、asmdeck-cover 的局部讀取／中繼資料往返／破損封面拒絕／真實 HTTP Range 測試、完整卡片 API 的所有權與非 deck 查詢測試、首頁 cache 與缺失縮圖測試、範例卡片首頁零 asmdeck／Trace／compile 測試、實際拖入檔案與雲端保存重開、資料夾與拖曳、匯出檔名與本機分享編輯、entrypoints 均通過。

舊資料夾測試仍等待缺失縮圖自動生成，已改為預設封面契約與對應拖曳目標；HTTP fixture 最初以隱藏檔名建立被 static 忽略，改為一般隨機檔名後實際 Range 通過。未放寬產品答案、不修改播放或事件語意，不跑大型演算法動畫驗證集。

## 載入效能

入口：algo-vis-backend 的 node scripts/benchmark-card-loading.js。使用獨立伺服器與 headless Edge、固定資料，沒有操作使用者瀏覽器／投影片。以 7347375 的前端作基準。每組 3 次取中位數；API fixture 每次回應延遲 20 ms。50 張工作區卡片與實際 15 份範例分開測量，避免另一區初始化混入工作區結果。包含介面顯示與圖片解碼時間，不等同純 API 回應時間，也不是公開站 WAN 或 50 人併發壓測。

| 情境 | 修改前 | 修改後 |
| --- | ---: | ---: |
| 50 張工作區卡片首次顯示 | 742 ms | 185 ms |
| 同瀏覽器重開工作區 | 137 ms | 158 ms |
| 工作區清單相關請求（不含登入核實） | 52 | 1 |
| 15 份範例卡片首次顯示 | 3146 ms | 129 ms |
| 範例首頁完整 asmdeck 請求 | 15 | 0 |

重開的工作區沒有量到加速；完整卡片 API 每次帶回縮圖，測試回應內容約 802 KB，舊暖快取清單約 9 KB。這是完整卡片回應的取捨，不能宣稱所有載入場景都變快。範例索引可沿用靜態 HTTP 快取。

封面讀取測試以八皇后教材為來源，旧檔 1946075 bytes；轉為新引用格式的測試檔 47656 bytes，封面區（含檔頭）16099 bytes。7 次中位數：舊檔完整解包 1808.84 ms、新檔完整解包 10.17 ms、只讀新封面 0.22 ms。這個新檔僅為量測時產生，未覆蓋既有範例。

## 交付

文件與相關修改推送 intergration，重啟 3100；不合併 main、不發布 release、不部署公開站。test-results/card-loading-benchmark.json 是忽略的量測產物，不提交。