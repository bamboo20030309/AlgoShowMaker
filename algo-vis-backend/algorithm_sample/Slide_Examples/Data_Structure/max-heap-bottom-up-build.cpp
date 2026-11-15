// Bottom-up Max Heapify (1-based)
#include <bits/stdc++.h>
using namespace std;

// @defaults
// @camera focus heap zoom(1.08)
// @enddefaults

int n;
vector<int> heap;

void sift_down(int now) {
    while (now * 2 <= n) {
        int left = now * 2;
        int right = left + 1;
        int largest = now;

        // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @pointer now at heap
        // @style heap[now,left] highlight
        // @style heap[right] highlight when right <= n
        // @text "比較節點 ${now} 與它的孩子，找出最大值" at heap.bottom

        if (heap[left] > heap[largest]) largest = left;
        if (right <= n && heap[right] > heap[largest]) largest = right;
        if (largest == now) {
            // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
            // @pointer now at heap
            // @style heap[now] highlight
            // @text "節點 ${now} 已不小於孩子，這棵子樹整理完成" at heap.bottom
            break;
        }

        // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @pointer now at heap
        // @pointer largest at heap
        // @style heap[now,largest] highlight
        // @text "將 ${heap[now]} 與較大的孩子 ${heap[largest]} 交換" at heap.bottom

        swap(heap[now], heap[largest]);

        // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @pointer now at heap
        // @pointer largest at heap
        // @style heap[now,largest] highlight
        // @text "交換後，繼續從較低的位置檢查" at heap.bottom

        now = largest;
    }
}

int main() {
    cin >> n;
    heap.resize(n + 1);
    for (int i = 1; i <= n; ++i) cin >> heap[i];

    // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
    // @events animate off
    // @text "所有值先放入陣列；葉節點自然已是堆" at heap.bottom

    for (int i = n / 2; i >= 1; --i) {
        // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @pointer i at heap
        // @style heap[i] highlight
        // @text "從節點 ${i} 開始下沉；它的孩子都已是堆" at heap.bottom

        sift_down(i);

        // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @pointer i at heap
        // @style heap[i] highlight
        // @text "以節點 ${i} 為根的子樹已整理完成" at heap.bottom
    }

    // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
    // @text "由底往上建堆完成：每個父節點都不小於孩子" at heap.bottom
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
      "autoFixedEnabled": true,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
