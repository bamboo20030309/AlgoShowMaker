以下都在algo-vis-backend目錄的cmd打指令

每次更改重新測試都要再build一次
docker build -t algo-vis-backend .
上面的沒成功就試試下面這個
docker build --network host -t algo-vis-backend .


重新run一次
docker run -p 3000:3000 --rm -v "%cd%/public:/usr/src/app/public" algo-vis-backend

build+run
docker build -t algo-vis-backend . && docker run -p 3000:3000 --rm -v "%cd%/public:/usr/src/app/public" algo-vis-backend



---------------新---------------

開啟伺服器
docker-compose up -d --build

關掉伺服器
docker-compose down