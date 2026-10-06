#include <bits/stdc++.h>
using namespace std;

// 語法提案：單一 split-merge layout。
// split 在上半部、merge 在下半部；兩邊各自擁有一份葉節點。
// layout 從完整 trace 預先保留所有 activation slot，因此合併從葉子開始時不會重新排版。
// split-merge 預設會用箭頭連接上下兩份對應的葉節點。

// @layout split-merge as "merge_flow" at canvas.top offset(0,60)

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

        // phase merge 放在共用葉層下方；node caller 指向 merge_sort(L,R)。
        // @frame merged in merge_flow phase merge node caller
        // @style merged[merged.size()-1] highlight AV_green
        // @text "比較左右開頭，將較小值放入結果" at merged.bottom
    }

    while (i < (int)left.size()) {
        merged.push_back(left[i++]);
        // @frame merged in merge_flow phase merge node caller
        // @style merged[merged.size()-1] highlight AV_green
        // @text "補上左側剩餘元素" at merged.bottom
    }

    while (j < (int)right.size()) {
        merged.push_back(right[j++]);
        // @frame merged in merge_flow phase merge node caller
        // @style merged[merged.size()-1] highlight AV_green
        // @text "補上右側剩餘元素" at merged.bottom
    }

    // @frame merged in merge_flow phase merge node caller
    // @style merged[0:merged.size()-1] background AV_green!
    // @text "目前區間合併完成" at merged.bottom
    // @keep last as "merge" in merge_flow phase merge node caller
    return merged;
}

void merge_sort(vector<int>& arr, int L, int R) {
    vector<int> current(arr.begin() + L, arr.begin() + R + 1);

    if (L == R) {
        // 上方分裂樹的葉節點。
        // @frame current in merge_flow phase split node current
        // @style current[0] background AV_blue!
        // @text "分裂到單一元素" at current.bottom
        // @keep last as "split" in merge_flow phase split node current

        // 下方合併樹再畫一份葉節點。layout 會自動從上方葉節點
        // 畫箭頭連到這個節點，表示它是合併階段的起點。
        // @frame current in merge_flow phase merge node current
        // @style current[0] background AV_green!
        // @text "從相同的單元素開始合併" at current.bottom
        // @keep last as "merge" in merge_flow phase merge node current
        return;
    }

    // phase split 放在上半部，方向為 top-down。
    // @frame current in merge_flow phase split node current
    // @text "分裂區間 [${L}:${R}]" at current.bottom
    // @keep last as "split" in merge_flow phase split node current

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
    // @text "Merge Sort：單一 split-merge layout 管理完整沙漏結構" at arr.bottom

    if (!arr.empty()) merge_sort(arr, 0, n - 1);

    // @frame arr
    // @style arr[0:n-1] highlight AV_green
    // @text "Merge Sort 完成" at arr.bottom

    for (int value : arr) cout << value << ' ';
    cout << '\n';
    return 0;
}
