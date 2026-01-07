# 選擇 Node.js 官方映像，並安裝 clang 編譯器
FROM node:18

# 更新 apt，安裝 g++ 與 build-essential
RUN apt-get update && \
    apt-get install -y g++ build-essential && \
    rm -rf /var/lib/apt/lists/*

# 建立工作目錄
WORKDIR /usr/src/app

# 複製 package.json 及 lockfile，安裝 npm 依賴
COPY package.json ./
RUN npm install

# 複製其餘程式碼
COPY . .

# 對外開放 3000 埠口
EXPOSE 3000

# 容器啟動時執行
CMD ["npm", "start"]
