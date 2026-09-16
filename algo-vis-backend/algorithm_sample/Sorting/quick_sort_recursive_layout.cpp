#include <bits/stdc++.h>
using namespace std;

// 宣告一個具名的遞迴排版。其餘設定使用預設值：
// compact、置中、兄弟間距 40px、層級間距 100px、二分支、AV.hpp 樹排版使用的黑色 2px 箭頭。
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree direction top-down

void quick_sort(vector<int>& arr, int low, int high) {
    // 空區間不需要建立節點。
    if (low > high) return;

    // 單一元素是遞迴樹的葉節點。
    if (low == high) {
        // leaf: @frame arr with range(low,high) in quick_tree
        // @style arr[low] highlight AV_green
        // @text "區間只剩 ${arr[low]}，已經完成排序" at arr.bottom
        // @keep last as "partition" in quick_tree
        return;
    }

    int pivot = arr[high];
    int i = low;

    // 以最右邊元素作為 pivot，將較小元素移到左側。
    for (int j = low; j < high; j++) {
        if (arr[j] < pivot) {
            if (i != j) swap(arr[i], arr[j]);
            i++;
        }
    }
    if (i != high) swap(arr[i], arr[high]);

    // 每次 partition 完成後，只顯示這次遞迴負責的區間並保存成樹節點。
    // partition: @frame arr[i] with range(low,high) in quick_tree
    // @style arr[i] point red
    // @style arr[low:i-1] background AV_green when low < i
    // @style arr[i+1:high] background AV_red when i < high
    // @text "pivot ${pivot} 已放到索引 ${i}，接著分裂左右區間" at arr.bottom
    // @keep last as "partition" in quick_tree

    quick_sort(arr, low, i - 1);
    quick_sort(arr, i + 1, high);
}

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int i = 0; i < n; i++) cin >> arr[i];

    // @frame arr
    // @text "Quick Sort：每次 partition 後，將左右遞迴畫成分裂樹" at arr.bottom

    quick_sort(arr, 0, n - 1);

    // @frame arr
    // @style arr[0:n-1] highlight AV_green
    // @text "Quick Sort 完成" at arr.bottom

    return 0;
}
