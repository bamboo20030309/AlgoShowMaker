#include <bits/stdc++.h>
using namespace std;

int n;
vector<int> heap;

void sift_down(int now) {
    while (now * 2 <= n) {
        int left = now * 2;
        int right = left + 1;
        int largest = now;

        // @frame heap[now] render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @style heap[now,left] highlight
        // @style heap[right] highlight when right <= n

        if (heap[left] > heap[largest]) largest = left;
        if (right <= n && heap[right] > heap[largest]) largest = right;
        if (largest == now) {
            // @frame heap[now] render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
            // @style heap[now] highlight
            break;
        }

        // @frame heap[now,largest] render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @style heap[now,largest] highlight
        swap(heap[now], heap[largest]);

        // @frame heap[now,largest] render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @style heap[now,largest] highlight
        now = largest;
    }
}

int main() {
    cin >> n;
    heap.resize(n + 1);
    for (int i = 1; i <= n; ++i) cin >> heap[i];

    // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
    // @events animate off

    for (int i = n / 2; i >= 1; --i) {
        // @frame heap[i] render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @style heap[i] highlight
        sift_down(i);

        // @frame heap[i] render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
        // @style heap[i] highlight
    }

    // @frame heap render heap with range(1,n), labels(value,index) at canvas.top offset(0,80)
    return 0;
}
