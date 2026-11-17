#include <bits/stdc++.h>
using namespace std;

// 語法提案：在 @frame／@keep 後加入 node current 或 node caller。
// current 表示目前函式 activation；caller 表示上一層呼叫者 activation。

// @layout recursion as "split_tree" at canvas.top offset(0,60)

// @layout recursion as "merge_tree" at canvas.bottom offset(0,-60)
// @layout merge_tree direction bottom-up

vector<int> merge_range(const vector<int>& left, const vector<int>& right) {
    vector<int> merged;
    int i = 0;
    int j = 0;

    while (i < (int)left.size() && j < (int)right.size()) {
        if (left[i] <= right[j]) {
            merged.push_back(left[i++]);
        } else {
            merged.push_back(right[j++]);
        }

        // merge_range() 自己會產生一個 activation；node caller 將畫面
        // 寫回呼叫它的 merge_sort(L,R) 節點，而不是建立額外子節點。
        // @frame merged in merge_tree node caller
        // @style merged[merged.size()-1] highlight AV_green
        // @text "比較左右開頭，將較小值放入結果" at merged.bottom
    }

    while (i < (int)left.size()) {
        merged.push_back(left[i++]);
        // @frame merged in merge_tree node caller
        // @style merged[merged.size()-1] highlight AV_green
        // @text "補上左側剩餘元素" at merged.bottom
    }

    while (j < (int)right.size()) {
        merged.push_back(right[j++]);
        // @frame merged in merge_tree node caller
        // @style merged[merged.size()-1] highlight AV_green
        // @text "補上右側剩餘元素" at merged.bottom
    }

    // @frame merged in merge_tree node caller
    // @style merged[0:merged.size()-1] background AV_green!
    // @text "目前區間合併完成" at merged.bottom
    // @keep last as "merge" in merge_tree node caller
    return merged;
}

void merge_sort(vector<int>& arr, int L, int R) {
    vector<int> current(arr.begin() + L, arr.begin() + R + 1);

    // node current 可以明確表示這是目前 merge_sort activation 的節點。
    // @frame current in split_tree node current
    // @text "分裂區間 [${L}:${R}]" at current.bottom
    // @keep last as "split" in split_tree node current

    if (L == R) {
        // 葉節點會畫兩遍：上方 split_tree 已經有一份，這裡建立下方版本。
        // @frame current in merge_tree node current
        // @style current[0] background AV_green!
        // @text "同一個單元素在合併樹重新出現" at current.bottom
        // @keep last as "merge" in merge_tree node current

        // layout node 也能作為箭頭端點；兩端都選取目前 merge_sort activation。
        // @arrow from split_tree.node(current).bottom to merge_tree.node(current).top
        return;
    }

    int mid = L + (R - L) / 2;
    merge_sort(arr, L, mid);
    merge_sort(arr, mid + 1, R);

    vector<int> left(arr.begin() + L, arr.begin() + mid + 1);
    vector<int> right(arr.begin() + mid + 1, arr.begin() + R + 1);
    vector<int> merged = merge_range(left, right);
    copy(merged.begin(), merged.end(), arr.begin() + L);
}

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int& value : arr) cin >> value;

    // @frame arr
    // @text "Merge Sort：node caller 讓 merge() 更新正確的區間節點" at arr.bottom

    if (!arr.empty()) merge_sort(arr, 0, n - 1);

    // @frame arr
    // @style arr[0:n-1] highlight AV_green
    // @text "Merge Sort 完成" at arr.bottom

    for (int value : arr) cout << value << ' ';
    cout << '\n';
    return 0;
}
