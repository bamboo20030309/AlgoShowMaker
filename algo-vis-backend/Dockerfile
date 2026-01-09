# 1. 選擇基礎映像檔：使用 Node.js 18 (或其他你穩定的版本)
FROM node:18

# 2. 安裝系統依賴：因為是 slim 版或基礎版，可能需要手動安裝 g++
# apt-get update: 更新套件列表
# apt-get install -y g++: 安裝 C++ 編譯器
# rm -rf /var/lib/apt/lists/*: 清理緩存以減小映像檔體積
RUN apt-get update && \
    apt-get install -y g++ && \
    rm -rf /var/lib/apt/lists/*

# 3. 設定工作目錄：容器內的所有指令都會在這裡執行
WORKDIR /usr/src/app

# 4. 建立非 root 使用者 (安全性關鍵步驟)
# useradd -m: 建立使用者並建立家目錄
# -s /bin/bash: 指定 shell
# sandboxuser: 使用者名稱
RUN useradd -m -s /bin/bash sandboxuser

# 5. 複製依賴描述檔並安裝
# 這樣做是為了利用 Docker 快取層，若 package.json 沒變，就不會重跑 npm install
COPY package*.json ./
RUN npm install

# 6. 複製專案的所有程式碼到容器內
COPY . .

# 7. [權限設定] 確保 sandboxuser 擁有這個資料夾的權限
# mkdir -p tmp: 確保 tmp 資料夾存在 (雖然你的專案裡可能有，但強制建一個比較保險)
# chown -R sandboxuser:sandboxuser .: 將當前目錄 (/usr/src/app) 下的所有檔案擁有權轉給 sandboxuser
# 如果不跑這行，檔案擁有者會是 root，切換使用者後 server.js 會無法讀取或寫入
RUN mkdir -p tmp && \
    chown -R sandboxuser:sandboxuser /usr/src/app

# 8. 切換使用者 (從 root 切換成 sandboxuser)
# 此行之後的所有指令 (包含 CMD) 都會以這個低權限使用者的身分執行
USER sandboxuser

# 9. 宣告容器會使用的 Port (這只是文件說明，實際要在 docker-compose 映射)
EXPOSE 3000

# 10. 啟動伺服器
CMD ["node", "server.js"]