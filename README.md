# AlgoShowMaker

AlgoShowMaker 是一套演算法教學與簡報製作工具。你可以在 C++ 程式碼中加入少量視覺化指令，執行後產生可播放、可編輯的動畫，再把動畫、文字、LaTeX、程式碼與資料結構排成教學投影片。

- 介面語言：繁體中文
- 穩定版本：AV_V4.12
- 專案首頁：[GitHub](https://github.com/bamboo20030309/AlgoShowMaker)

## 核心功能

- 追蹤 C++ 程式執行，將變數與資料結構轉成動畫。
- 支援陣列、圖、樹、堆積、線段樹、Binary Indexed Tree 等結構。
- 使用 `@frame`、`@style`、`@move` 等指令控制畫面與事件。
- 在 Trace Studio 檢查執行步驟、事件與資料變化。
- 在投影片編輯器混合動畫、文字、LaTeX、程式碼、圖片與形狀。
- 提供範例演算法投影片，可直接學習與編輯；修改保存在本機，不改動公開教材。
- 範例動畫使用預建 Trace 與快取，後端以編譯佇列管理多人請求。
- 支援專案儲存、分享、匯入與匯出；觀看分享連結也可編輯本機副本，不改動原檔。
- 首頁只載入卡片與封面快取；新 `.asmdeck` 可單獨讀取封面，舊檔仍可匯入。

## 主要介面

| 介面 | 用途 |
| --- | --- |
| 工作區 | 管理程式碼、動畫與投影片專案 |
| 演算法編輯器 | 撰寫 C++、執行追蹤並預覽動畫 |
| Trace Studio | 檢查幀、事件、變數與資料結構 |
| 投影片編輯器 | 編排教學內容與嵌入演算法動畫 |
| 範例投影片 | 瀏覽並套用既有教學投影片 |

## 快速啟動

需求：

- Node.js 20.19 以上（建議 Node.js 22）
- MongoDB
- 可編譯 C++17 的編譯器

```bash
cd algo-vis-backend
npm install
```

在 `algo-vis-backend/.env` 建立環境設定：

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/algoshowmaker
JWT_SECRET=replace-with-a-random-secret
```

啟動服務：

```bash
cd algo-vis-backend
npm start
```

開啟 `http://localhost:3000`。若需要 Windows、Docker、MongoDB 或部署設定，請參考 [安裝與部署指南](SETUP_GUIDE.md)。

## 建立第一段動畫

在演算法編輯器貼上程式碼，加入視覺化指令後按下 **RUN**：

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<int> a = {5, 2, 4, 1};
    // @frame a

    for (int i = 0; i < (int)a.size(); ++i) {
        for (int j = 0; j + 1 < (int)a.size() - i; ++j) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);
            }
            // @frame a[j,j+1]
            // @style a[j,j+1] highlight
        }
    }
}
```

常用指令包含 `@frame`、`@style`、`@text`、`@keep`、`@arrow` 與 `@camera`。完整語法、作用範圍與範例集中在 [演算法視覺化指令手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)。

## 製作教學投影片

從工作區開啟投影片編輯器，即可新增一般投影片或演算法投影片。既有動畫可以直接嵌入頁面，LaTeX 與程式碼請使用對應元件，方便後續編輯、排版與相容性處理。

想從完成品開始，可開啟首頁或工作區的「範例投影片」，直接在本機修改，或匯出為自己的投影片檔。

## 運作方式

```mermaid
flowchart LR
    A[C++ 程式與視覺化指令] --> B[分析與執行追蹤]
    B --> C[幀、事件與資料狀態]
    C --> D[共用渲染與播放器]
    D --> E[演算法編輯器]
    D --> F[Trace Studio]
    D --> G[投影片編輯器]
```

編輯器、Trace Studio 與投影片使用同一套動畫資料與渲染流程，因此同一段演算法可以在不同介面中重複使用。各指令如何轉成事件、何時產生幀，以及播放排程的細節，請查閱指令手冊與程式碼。

範例動畫可直接載入預先保存的結果；程式或輸入改變時再執行追蹤。伺服器管理編譯佇列與資源限制，各請求的執行與除錯訊息彼此隔離。

## 專案結構

| 路徑 | 內容 |
| --- | --- |
| `algo-vis-backend/server.js` | Web 服務與主要 API |
| `algo-vis-backend/public/` | 編輯器、播放器與前端資源 |
| `algo-vis-backend/trace-instrumenter.js` | C++ 追蹤與解析 |
| `algo-vis-backend/algorithm_sample/` | 範例程式 |
| `algo-vis-backend/tests/` | 自動化測試 |

## 測試

先查看驗證索引，這個指令不執行測試：

```bash
cd algo-vis-backend
npm run test:inventory
```

依改動選最小相關測試；純前端／投影片修改不啟動演算法動畫集。續跑會保留有效的通過結果，只重跑失敗、未完成或因依賴修改而失效的項目。

指令、隔離環境、報告與故障處理見 [驗證集使用手冊](docs/驗證集使用手冊.md)。大型驗證由主代理依風險執行，PR 目前不會自動觸發。

## 相關文件

- [演算法視覺化指令手冊](ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)
- [AI 教材製作 skill](skills/algoshowmaker-authoring/SKILL.md)／[單檔精簡指南](skills/algoshowmaker-authoring/QUICKSTART.md)
- [安裝與部署指南](SETUP_GUIDE.md)
- [驗證集使用手冊](docs/驗證集使用手冊.md)
- [驗證集設計與覆蓋範圍](docs/驗證集設計.md)
- [AV_V4.12 版本說明](docs/releases/v4.12.md)

## 授權

本專案採用 [MIT License](LICENSE)。
