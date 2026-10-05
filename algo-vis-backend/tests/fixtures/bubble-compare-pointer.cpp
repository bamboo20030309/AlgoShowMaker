#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for(auto&v:arr)cin>>v;
    // @frame arr
    // @text "Bubble Sort (冒泡排序)\n透過將最大的元素一個一個往後丟，來進行排序" at arr.top
    // @camera focus arr zoom(2.0)
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
            }
            // @frame arr[j,j+1]
            // @text "兩兩比較 左邊比右邊大就交換" at arr.bottom
            // @camera focus arr zoom(2.0)
        }
        // @keep last
    }
    // @frame arr
    // @text "Bubble Sort 完成" at arr.bottom
    // @camera auto
    return 0;
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":true,"autoLoopBoundaryEnabled":false}}}
@asm-view */
