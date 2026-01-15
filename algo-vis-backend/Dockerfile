# 1. 使用 Node.js 18 的輕量版 (slim) 作為基底
# slim 版本比較小，但包含執行 node 所需的一切
FROM node:18-slim

# 2. 安裝 C++ 編譯器 (g++) 和建置工具
# 這是為了編譯使用者上傳的 .cpp 檔案
RUN apt-get update && \
    apt-get install -y g++ build-essential python3 && \
    rm -rf /var/lib/apt/lists/*

# 3. 設定工作目錄 (專案根目錄)
WORKDIR /usr/src/app

# ==========================================
# 安全防護核心設置 (Sandbox Setup)
# ==========================================

# 建立 /sandbox 目錄
# 這是我們要在 server.js 裡用 cwd: '/sandbox' 切換過去的地方
RUN mkdir /sandbox

# 設定權限為 555 (r-x r-x r-x)
# 意義：所有使用者都只能讀、只能執行，絕對不能寫 (No Write)
RUN chmod 555 /sandbox

# 確保有一個 UID 為 1000 的使用者
# Node 官方映像檔通常已經內建一個 'node' 使用者 (UID 1000)
# 為了保險起見，我們嘗試建立 sandboxuser，如果 UID 1000 已被佔用則忽略錯誤
RUN useradd -u 1000 -m -s /bin/bash sandboxuser || true

# ==========================================
# 專案安裝與設定
# ==========================================

# 4. 複製 package.json 並安裝依賴
# 先做這步是為了利用 Docker Layer 快取，加速建置
COPY package*.json ./
RUN npm install --production

# 5. 複製所有程式碼 (包含 server.js, public 資料夾等)
COPY . .

# 6. 建立 tmp 目錄並設定權限
# 雖然 docker-compose 會掛載 tmpfs 覆蓋這裡，但預先建好並設權限是好習慣
# 確保 UID 1000 (sandboxuser) 可以在這裡寫入編譯檔
RUN mkdir -p tmp && \
    chown -R 1000:1000 tmp && \
    chmod 1777 tmp

# 7. 開放埠號 (根據你的 server.js 設定，通常是 3000 或 8080)
EXPOSE 3000

# 8. 啟動伺服器
CMD ["node", "server.js"]