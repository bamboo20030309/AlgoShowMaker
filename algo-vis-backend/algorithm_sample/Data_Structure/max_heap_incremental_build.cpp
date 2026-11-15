// Max Heap Sample
#include <bits/stdc++.h>
using namespace std;

// heap[0] 不使用，讓父子索引關係保持簡單：
// parent = i / 2、left = i * 2、right = i * 2 + 1。

// @defaults
// @camera focus heap zoom(1.2)
// @enddefaults

vector<int> heap = {0};

void heap_push(int value) {
    heap.push_back(value);
    int heapSize = heap.size() - 1;
    int now = heapSize;

    // @frame heap render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
    // @pointer now at heap
    // @style heap[now] highlight
    // @text "先把 ${value} 加到 heap 的最後一格" at heap.bottom

    while (now > 1) {
        int parent = now / 2;

        if (heap[parent] >= heap[now]) {
            // @frame heap render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
            // @pointer parent at heap
            // @pointer now at heap
            // @style heap[parent,now] highlight
            // @text "父節點 ${heap[parent]} 不小於子節點 ${heap[now]}，停止向上調整" at heap.bottom
            break;
        }

        // @frame heap render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
        // @pointer parent at heap
        // @pointer now at heap
        // @style heap[parent,now] highlight
        // @text "子節點 ${heap[now]} 較大，與父節點 ${heap[parent]} 交換" at heap.bottom

        swap(heap[parent], heap[now]);

        // @frame heap render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
        // @pointer parent at heap
        // @pointer now at heap
        // @style heap[parent,now] highlight
        // @text "較大的值已上移，繼續檢查新的父節點" at heap.bottom

        now = parent;
    }
}


int main() {
    int n;
    cin >> n;
    vector<int> input(n);
    for (int& value : input) cin >> value;

    for (int value : input) heap_push(value);

    int builtSize = heap.size() - 1;
    // @frame heap render heap with range(1,builtSize), labels(value,index) at canvas.top offset(0,80)
    // @text "逐一插入完成：每次加入後都保持最大堆積性質" at heap.bottom
    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "codePanelPosition": {
      "x": 0.0181,
      "y": 0.0523
    },
    "codePanelFontSize": 13,
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
