#include <bits/stdc++.h>
using namespace std;

// 這一版只使用目前已存在的指令。
// 由於目前無法指定 layout node，合併迴圈必須直接寫在 merge_sort() 裡。
// 兩個 layout 都直接採用目前的 recursion 預設設定。

// @layout recursion as "split_tree" at canvas.top offset(0,60)

// @layout recursion as "merge_tree" at canvas.bottom offset(0,-60)
// @layout merge_tree direction bottom-up

// 通用語法提案不替 Merge Sort 增加 leaf-links-from 特例。
// 葉節點連線比照河內塔：每次走到 base case 時建立一支普通箭頭，
// 端點使用 tree_id.current 選取目前上下兩棵樹正在處理的節點。
// 完整規格見 layout-composition-proposal.md。

void merge_sort(vector<int>& arr, int L, int R) {
    vector<int> current(arr.begin() + L, arr.begin() + R + 1);

    // 分裂樹使用目前 merge_sort() 的 recursion activation。
    // @frame current in split_tree
    // @text "分裂區間 [${L}:${R}]" at current.bottom
    // @keep last as "split" in split_tree

    if (L == R) {
        // 再畫一次，成為下方合併樹的葉節點。
        // @frame current in merge_tree
        // @style current[0] background AV_green!
        // @text "同一個單元素在合併樹重新出現" at current.bottom
        // @keep last as "merge" in merge_tree

        // 提案：@arrow from split_tree.current.bottom
        // 提案：       to merge_tree.current.top
        // 提案：       as "leaf_link" color AV_green! width 2
        // 與河內塔一樣，這行會在每個 base case 各執行一次；@keep 會保留該支箭頭。
        return;
    }

    int mid = L + (R - L) / 2;
    merge_sort(arr, L, mid);
    merge_sort(arr, mid + 1, R);

    vector<int> left(arr.begin() + L, arr.begin() + mid + 1);
    vector<int> right(arr.begin() + mid + 1, arr.begin() + R + 1);
    vector<int> merged;
    int i = 0;
    int j = 0;

    while (i < (int)left.size() && j < (int)right.size()) {
        if (left[i] <= right[j]) {
            merged.push_back(left[i++]);
        } else {
            merged.push_back(right[j++]);
        }

        // 因為這裡仍在 merge_sort()，畫面會更新正確的目前節點。
        // @frame merged in merge_tree
        // @style merged[merged.size()-1] highlight AV_green
        // @text "比較左右開頭，將較小值放入結果" at merged.bottom
    }

    while (i < (int)left.size()) {
        merged.push_back(left[i++]);
        // @frame merged in merge_tree
        // @style merged[merged.size()-1] highlight AV_green
        // @text "補上左側剩餘元素" at merged.bottom
    }

    while (j < (int)right.size()) {
        merged.push_back(right[j++]);
        // @frame merged in merge_tree
        // @style merged[merged.size()-1] highlight AV_green
        // @text "補上右側剩餘元素" at merged.bottom
    }

    copy(merged.begin(), merged.end(), arr.begin() + L);

    // 保存這個 activation 的最終合併結果。
    // @frame merged in merge_tree
    // @style merged[0:merged.size()-1] background AV_green!
    // @text "區間 [${L}:${R}] 合併完成" at merged.bottom
    // @keep last as "merge" in merge_tree
}

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int& value : arr) cin >> value;

    // @frame arr
    // @text "Merge Sort：上半部先分裂，下半部再合併" at arr.bottom

    if (!arr.empty()) merge_sort(arr, 0, n - 1);

    // @frame arr
    // @style arr[0:n-1] highlight AV_green
    // @text "Merge Sort 完成" at arr.bottom

    for (int value : arr) cout << value << ' ';
    cout << '\n';
    return 0;
}
