#include <bits/stdc++.h>
using namespace std;

// @layout linear as merge_scene

// @layout recursion as split_tree in merge_scene
// @layout split_tree branch-previews off
// @layout split_tree reserve on
// @layout split_tree level-gap 60

// @layout recursion as merge_tree in merge_scene
// @layout merge_tree direction bottom-up
// @layout merge_tree grow-from leaves
// @layout merge_tree reserve on
// @layout merge_tree level-gap 60

// @place merge_tree.top-left at split_tree.bottom-left offset(0,40)


// @defaults
// @camera auto
// @enddefaults

void merge_sort(vector<int>& num, int L, int R) {
    // @frame num with range(L,R) in split_tree
    // @text "分裂區間 [${L}{：:到}${R}]" at num.bottom
    // @keep last as "split" in split_tree

    if (L == R) {
        // 葉節點在 split 與 merge 兩棵樹各畫一次。
        // @frame num as merged with range(L,R) in merge_tree
        // @style num[L] mark
        // @arrow from split_tree.current.bottom
        //        to merge_tree.current.top
        //        in merge_scene
        // @keep last as "merge" in merge_tree
        return;
    }

    int mid = L + (R - L) / 2;
    merge_sort(num, L, mid);
    merge_sort(num, mid + 1, R);

    vector<int> merged;
    int i = L, j = mid + 1;
    // @frame merged as merged in merge_tree
    // @pointer i at merge_tree.children[0]
    // @pointer j at merge_tree.children[1]
    // @text "合併左右子樹" at merged.bottom
    while (i <= mid && j <= R) {
        if (num[i] <= num[j]) {
            merged.push_back(num[i]);
            i++;
        } else {
            merged.push_back(num[j]);
            j++;
        }

        // @frame merged as merged in merge_tree
        // @pointer i at merge_tree.children[0]
        // @pointer j at merge_tree.children[1]
        // @style merged[merged.size()-1] highlight
        // @text "比較兩側開頭，將較小值放入結果" at merged.bottom
    }
    while (i <= mid) {
        merged.push_back(num[i++]);
        // @frame merged as merged in merge_tree
        // @pointer i at merge_tree.children[0]
        // @pointer j at merge_tree.children[1]
        // @style merged[merged.size()-1] highlight
        // @style merged[0:merged.size()-2] mark
        // @text "補上左側剩餘元素" at merged.bottom
    }
    while (j <= R) {
        merged.push_back(num[j++]);
        // @frame merged as merged in merge_tree
        // @pointer i at merge_tree.children[0]
        // @pointer j at merge_tree.children[1]
        // @style merged[merged.size()-1] highlight
        // @style merged[0:merged.size()-2] mark
        // @text "補上右側剩餘元素" at merged.bottom
    }

    copy(merged.begin(), merged.end(), num.begin() + L);

    // @frame num as merged with range(L,R) in merge_tree
    // @text "區間 [${L}{：:到}${R}] 合併完成" at num.bottom
    // @style num[L:R] mark
    // @keep last as "merge" in merge_tree
}

int main() {
    int n;
    cin >> n;
    vector<int> num(n);
    for (int& value : num) cin >> value;

    // @frame num
    // @place num.top-left at split_tree.root.top-left
    // @text "這是 Merge Sort 的範例" at num.bottom

    merge_sort(num, 0, n - 1);

    // @frame
    // @text "Merge Sort 完成" at merge_tree.root.bottom

    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
