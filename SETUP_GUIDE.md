# AlgoShowMaker 伺服器架設與維護手冊

本手冊記載如何在全新的 Linux 伺服器上部署 AlgoShowMaker 專案。

## 一、 環境準備
在開始之前，請確保伺服器為 Linux 系統（推薦 Ubuntu 22.04+），並安裝必要工具。
1. **安裝 Docker 與 Docker Compose**：執行 `sudo apt-get update` 與 `sudo apt-get install docker.io docker-compose -y`。
2. **設定 Docker 權限**：執行 `sudo usermod -aG docker $USER` 並執行 `newgrp docker` 以免除每次使用 sudo 的需求。
3. **設定 Git 資訊**：執行 `git config --global user.name "您的名稱"` 與 `git config --global user.email "您的信箱@example.com"`。

## 二、 專案取得與配置
1. **複製專案**：執行 `git clone <您的專案倉庫網址>` 並進入目錄 `cd AlgoShowMaker`。
2. **設定環境變數 (.env)**：進入後端目錄 `cd algo-vis-backend` 並建立設定檔 `nano .env`。
請在文件中填入內容，包含 `PORT=3000`、`MONGO_URI=mongodb://mongo:27017/algo_vis` 以及自訂的 `JWT_SECRET`。
- 範例
```
# [必填] 加密 Token 的金鑰：請填入一串隨機的長字串（可用於驗證登入身分）
# 建議產生方式：在終端機輸入 `openssl rand -base64 32`
JWT_SECRET=請在此處填入隨機字串

# [必填] 忘記密碼寄送通知信的 Gmail 帳號
SMTP_USER=你的帳號@gmail.com

# [必填] Gmail 的「應用程式專用密碼」
# 注意：這不是你的 Google 登入密碼，需前往 Google 帳號安全性設定中產生
SMTP_PASS=十六位元的應用程式密碼

# [必填] 伺服器的對外網址
# 請填入伺服器的實體 IP，例如 http://120.125.77.194
BASE_URL=http://你的伺服器IP

# 服務執行的連接埠（與 docker-compose 對應）
PORT=3000

# MongoDB 連線字串
# 其中 "mongo" 是 docker-compose.yml 裡定義的服務名稱
MONGO_URI=mongodb://mongo:27017/algo_vis_db
```
Docker Compose 會在 backend 容器內明確將 `MONGO_URI` 覆寫為
`mongodb://mongo:27017/algo_vis_db`。即使本機開發用 `.env` 指向 `localhost`，容器仍會透過
Compose service 名稱 `mongo` 連線。Docker 映像使用 Node.js 22，以符合 Mongoose 9 的 runtime 要求。
## 三、 啟動伺服器
1. **修正相容性問題**：若伺服器 CPU 不支援 AVX，請將 `docker-compose.yml` 中的 `image: mongo:latest` 改為 `image: mongo:4.4`。若 Docker 版本過舊導致 `pids` 報錯，請註解掉 `pids: 128` 這一行。
2. **執行啟動指令**：在 `algo-vis-backend` 目錄下執行 `docker-compose up -d --build`。

## 四、 維運常用指令
| 需求 | 指令 |
| :--- | :--- |
| 查看所有服務狀態 | `docker-compose ps` |
| 查看後端即時日誌 | `docker-compose logs -f backend` |
| 查看資料庫日誌 | `docker-compose logs -f mongo` |
| 停止伺服器 | `docker-compose down` |
| 重啟所有服務 | `docker-compose restart` |

## 五、 程式碼更新流程 (Git Update)
當您有新的程式碼推送到遠端時，請按此順序更新伺服器：
1. **回到專案根目錄拉取更新**：執行 `cd ~/AlgoShowMaker` 並執行 `git pull`。
2. **重新編譯並啟動**：回到 `cd algo-vis-backend` 目錄並再次執行 `docker-compose up -d --build`。

### 2026/09/17：動畫結果分離儲存的部署注意事項

新版前端先按內容雜湊分塊上傳完整動畫、素材與設定快照，再提交小型快照 ID；backend 在 MongoDB 獨立的 SlideResourceChunk 集合保存內容，deck 只保存 cloud_snapshot／resource_keys。全部驗證成功後才切換引用，成功後回收無引用舊結果，失敗保留原 deck。必須同步更新 public、server.js 與 cloud-content.js，不能只換前端。舊文件仍可讀，下一次儲存才遷移；不需要刪除資料庫、清除資料卷或重新 RUN。

單次 HTTP 請求仍限制 8 MB；新儲存分塊為 256 Ki 字元，單資源保護上限 128 MB、deck 總容量 512 MB，暫存容許兩倍容量。未引用上傳閒置 48 小時後每小時回收，現有引用不受此期限影響。部署使用單 backend 程序，提交及回收按 deck 序列化；若擴充多 replica，須先換成分散式鎖／交易協調。讀取仍完整還原 deck，後續可優化懶載入。

只更新應用服務時，可執行 `docker compose up -d --build --no-deps backend`，然後 `docker compose restart nginx`。不要執行 `down -v`。完成後確認 `/slides.html`、`/algorithm.html` 回應正常，以及 backend 可連線 MongoDB；雲端還需驗證儲存、重開與分享播放。

建置使用 `.dockerignore` 排除本機 node_modules、暫存、測試報告、日誌與 `.env`；依賴由 Linux 映像內安裝，環境設定由 Compose 的 `env_file` 在啟動時傳入，不複製進映像。

## 六、 安全與技術機制說明
* **沙箱環境 (Sandbox)**：後端會在 `/sandbox` 目錄執行使用者程式碼，該目錄設為唯讀權限 `555` 以防止惡意修改。
* **資源限制**：透過 Docker 限制後端容器使用最多 0.5 CPU 與 1G 記憶體，防止 Fork Bomb 或資源耗盡。
* **請求大小**：Nginx 的 `client_max_body_size` 與 Express JSON body 上限皆為 8 MB。修改其中一層時必須同步修改另一層，否則較小的一層會先拒絕投影片儲存請求。
* **檔案系統**：編譯產生的暫存檔存放在 `tmp` 目錄，該目錄掛載為 64 MB 的 `tmpfs` 記憶體區，確保重啟後自動清空且不損毀磁碟。Linux 執行器另由與 sandboxuser 相同 UID 的 GNU `timeout` 管理硬性逾時，避免 Node 在缺少 `CAP_KILL` 時無法回收殘留程式，造成已刪除檔案仍占滿 tmpfs。若 `df -h /usr/src/app/tmp` 顯示 100%，先重啟 backend 釋放空間，再從 debug log 檢查 `SIGKILL` 失敗原因。
* **視覺化開發**：撰寫 C++ 腳本必須引入標頭檔 `#include "AV.hpp"` 並宣告 `AV av;` 物件，並以 `av.start_draw();` 與 `av.end_draw();` 包裹繪圖指令。


## 七、 更新進度
`cd AlgoShowMaker/ && git pull && cd algo-vis-backend/ && docker-compose down && docker-compose up -d --build`
---

*最後更新日期：2026/09/12*
