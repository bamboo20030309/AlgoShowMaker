# 伺服器啟動指令
在algo-vis-backend目錄的cmd打指令

## 開啟伺服器
```
docker-compose up -d --build
```
## 關掉伺服器
```
docker-compose down
```
## 查看log
```
docker-compose logs -f backend
```

# draw 視覺化指令
首先一定要引入標頭檔 `#include "AV.hpp"` 並宣告 `AV av;` 這個演算法視覺化物件。

## 腳本控制

### 腳本起始
在撰寫一個新腳本時要先呼叫 `av.start_draw();` 告訴物件從這裡開始，放的位置只要提前所有繪圖指令就好。
撰寫完腳本後則要呼叫 `av.end_draw();` 告訴物件到此為止，放的位置也是比所有繪圖指令晚就好。

### 

## 繪製資料結構
核心函數 `av.draw` 支援多載，可根據傳入的參數繪製不同類型的資料結構。
1. 一維陣列 (array)
最簡單的
一維陣列總共有4種模式，分別為 `normal` , `heap` , `segment_tree` , `BIT`。
