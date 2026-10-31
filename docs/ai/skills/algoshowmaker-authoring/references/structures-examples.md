# 結構與教學範例

## 結構選擇

| 內容 | 建議畫面 | 注意 |
| --- | --- | --- |
| 陣列／前綴和 | 預設陣列、索引、上下兩列 | 索引起點與 sentinel 要解釋 |
| 二維 DP | matrix renderer | 先查二維索引、range 與標記語法 |
| 堆積／樹／圖 | 專用 renderer | 先查實作支援的資料表示與 renderer 名稱 |
| 河內塔 | disk renderer 與三個柱子 | 移動狀態與遞迴呼叫樹分開說明 |
| KMP prefix function | 原字串 s 的字元陣列、pi 陣列、i/j 指標 | 直接呈現實際比較的 s[i]、s[j]，讓比較、回退及寫入事件能找到可見目標 |

字串逐字呈現使用 `char(s)`；一般 `@frame s` 不會自動拆字。優先沿用原字串；其他容器使用已確認支援的 renderer，不臆造能力。儘量避免展示副本：相同資料不代表相同事件目標。只有確認直接呈現不足時才加入必要副本，保持同步、不影響結果，並說明事件呈現限制。

## 最小前綴和範例

這是獨立的教學程式，沒有線上評測 AC 認證。輸入 `4` 及 `2 1 3 4`，stdout 應為 `10`；pre 應為 `[0,2,3,6,10]`。

```cpp
#include <iostream>
#include <vector>
using namespace std;
int main() {
    int n;
    cin >> n;
    vector<long long> a(n + 1), pre(n + 1, 0);
    for (int i = 1; i <= n; ++i) cin >> a[i];
    // @frame a,pre
    // @text "pre[0] = 0；第 0 格是邊界初值" at pre.bottom
    for (int i = 1; i <= n; ++i) {
        pre[i] = pre[i - 1] + a[i];
        // @frame a,pre
        // @pointer i at a
        // @pointer i at pre
        // @style a[i] highlight AV_red
        // @style pre[i] highlight AV_green
        // @text "pre[${i}] = pre[${i-1}] + a[${i}]" at pre.bottom
    }
    cout << pre[n] << '\n';
}
```

## 河內塔

repo 的現代註解範例是 `algo-vis-backend/algorithm_sample/Backtracking/hanoi-recursion.cpp`；`hanoi.cpp` 是舊 AV.hpp 版本，不能混用。先展示 N=3 的合法盤子移動，再解釋「移 n−1 個 → 移最大盤 → 移 n−1 個」；遞迴樹與三柱畫面用穩定 ID 對照。若只有本 skill 沒有範例來源，先交付分鏡，不臆造遞迴 layout 語法。

## KMP：最大相等真前後綴

`pi[i]` 是 `s[0..i]` 的最長相等真前綴與真後綴的長度，不能把整個字串當成自己的真前綴。這個範例只做 pi 建表，全文搜尋可以另設章節。

示範：`abababca` → `0 0 1 2 3 4 0 1`。i=6 時 c 與 s[4] 的 a 不符，依 `j = pi[j-1]` 從 4 回到 2，再到 0；仍失配所以 pi[6]=0。回退後仍處理同一個 i，不能把 i 同時前移。

練習：`aabaaab` → `0 1 0 1 2 2 3`。包含直接匹配、回退後成功和回退至 0。先給骨架與目標畫面，請參與者補繪圖註解，再要求用另一個輸入核對。

分鏡依序顯示目前子字串、候選前後綴長度 j、比較的兩格、失配原因、回退值及寫入 pi。每次回退都要有可觀察狀態，不能只用最終 pi 代替回退過程。
