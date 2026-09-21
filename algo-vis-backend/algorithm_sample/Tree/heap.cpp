// Max Heap Sample
#include <bits/stdc++.h>
using namespace std;

// heap[0] 不使用，讓父子索引關係保持簡單：
// parent = i / 2、left = i * 2、right = i * 2 + 1。
vector<int> heap = {0};

void heap_push(int value) {
    heap.push_back(value);
    int heapSize = heap.size() - 1;
    int now = heapSize;

    // @frame heap[now] render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
    // @style heap[now] highlight
    // @text "先把 ${value} 加到 heap 的最後一格" at heap.bottom

    while (now > 1) {
        int parent = now / 2;

        if (heap[parent] >= heap[now]) {
            // @frame heap[parent,now] render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
            // @style heap[parent,now] highlight
            // @text "父節點 ${heap[parent]} 不小於子節點 ${heap[now]}，停止向上調整" at heap.bottom
            break;
        }

        // @frame heap[parent,now] render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
        // @style heap[parent,now] highlight
        // @text "子節點 ${heap[now]} 較大，與父節點 ${heap[parent]} 交換" at heap.bottom

        swap(heap[parent], heap[now]);

        // @frame heap[parent,now] render heap with range(1,heapSize), labels(value,index) at canvas.top offset(0,80)
        // @style heap[parent,now] highlight
        // @text "較大的值已上移，繼續檢查新的父節點" at heap.bottom

        now = parent;
    }
}

int heap_top() {
    int heapSize = heap.size() - 1;
    if (heapSize == 0) return 0;

    // @frame heap[1] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
    // @style heap[1] highlight
    // @text "最大值 ${heap[1]} 位於根節點" at heap.bottom

    return heap[1];
}

void heap_pop() {
    int heapSize = heap.size() - 1;
    if (heapSize == 0) return;

    // @frame heap[1,heapSize] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
    // @style heap[1,heapSize] highlight
    // @text "先把根節點與最後一格交換" at heap.bottom

    swap(heap[1], heap[heapSize]);

    // @frame heap[1,heapSize] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
    // @style heap[1,heapSize] highlight
    // @text "移除已經換到最後一格的最大值 ${heap[heapSize]}" at heap.bottom

    heap.pop_back();
    heapSize--;

    // @frame heap render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
    // @text "從根節點開始向下維護最大堆積" at heap.bottom when heapSize > 0

    int now = 1;
    while (now <= heapSize) {
        int left = now * 2;
        int right = now * 2 + 1;

        if (left > heapSize) {
            // @frame heap[now] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
            // @style heap[now] highlight
            // @text "節點 ${now} 已經沒有子節點，向下調整完成" at heap.bottom
            break;
        }

        int largest = now;
        if (heap[left] > heap[largest]) largest = left;
        if (right <= heapSize && heap[right] > heap[largest]) largest = right;

        if (largest == now) {
            // @frame heap[now,left,right] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
            // @style heap[now,left,right] highlight
            // @text "父節點 ${heap[now]} 已不小於現有子節點，停止向下調整" at heap.bottom
            break;
        }

        // @frame heap[now,largest] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
        // @style heap[now,largest] highlight
        // @text "將較大的子節點 ${heap[largest]} 與父節點 ${heap[now]} 交換" at heap.bottom

        swap(heap[now], heap[largest]);

        // @frame heap[now,largest] render heap with range(1,heapSize), labels(value,index) at keep.bottom offset(0,40)
        // @style heap[now,largest] highlight
        // @text "較小的值已下沉，繼續檢查它的新位置" at heap.bottom

        now = largest;
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
    // @text "所有元素都已加入，最大堆積建立完成" at heap.bottom
    // @keep heap as "built_heap"

    // @frame heap render heap with range(1,builtSize), labels(value,index) at keep.bottom offset(0,40)
    // @text "接著反覆查詢並刪除最大值" at heap.bottom

    while (heap.size() > 1) {
        cout << heap_top() << '\n';
        heap_pop();
    }

    return 0;
}
