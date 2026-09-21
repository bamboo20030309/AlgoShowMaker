// Binary Indexed Tree Sample
#include <bits/stdc++.h>
using namespace std;

int n;
vector<int> num, BIT;

// @defaults
// @camera auto zoom(1.05)
// @enddefaults

// num[0] 保留為 0；實際資料與 BIT 都從 index 1 開始。
// @preset binary_indexed_tree_view
// @object num with labels(value,index)
// @object BIT render binary indexed tree with range(1,n), labels(value,binary-index-padded)
// @style num[0] background AV_grey
// @place num.left-bottom at BIT.left-top offset(-40,-70)
// @endpreset

// @preset binary_indexed_tree_pointer_view
// @object num with labels(value,index)
// @object BIT[i] render binary indexed tree with range(1,n), labels(value,binary-index-padded)
// @style num[0] background AV_grey
// @place num.left-bottom at BIT.left-top offset(-40,-70)
// @endpreset

void build(int i) {
    int k = i;
    for (; i <= n; i += i & -i) {
        // @frame use binary_indexed_tree_pointer_view
        // @style num[k] highlight
        // @style BIT[i] highlight
        // @style BIT[i] background AV_green
        // @text "BIT[${i}] 涵蓋 num[${i-(i&-i)+1}~${i}]，準備加上 num[${k}] = ${num[k]}" at num.top offset(0,-20)

        BIT[i] += num[k];

        // @frame use binary_indexed_tree_pointer_view
        // @style num[k] highlight
        // @style BIT[i] highlight
        // @style BIT[i] background AV_green
        // @text "BIT[${i}] 更新為 ${BIT[i]}；下一個索引是 ${i + (i & -i)}" at num.top offset(0,-20)

    }
}

int sum(int i) {
    int ans = 0;
    for (; i > 0; i -= i & -i) {
        // @frame use binary_indexed_tree_pointer_view
        // @style num[i-(i&-i)+1:i] background AV_blue
        // @style BIT[i] highlight
        // @style BIT[i] background AV_blue
        // @text "BIT[${i}] 代表 num[${i-(i&-i)+1}~${i}]，將 ${BIT[i]} 加入總和" at num.top offset(0,-20)

        ans += BIT[i];

        // @frame use binary_indexed_tree_pointer_view
        // @style num[i-(i&-i)+1:i] background AV_blue
        // @style BIT[i] highlight
        // @style BIT[i] background AV_blue
        // @text "目前總和是 ${ans}；下一個索引是 ${i - (i & -i)}" at num.top offset(0,-20)

    }
    return ans;
}

int main() {
    cin >> n;
    num.resize(n + 1);
    BIT.resize(n + 1);
    for (int i = 1; i <= n; i++) cin >> num[i];

    // @frame use binary_indexed_tree_view
    // @events animate off
    // @text "num[0] 是保留格；實際資料與 Binary Indexed Tree 都從 index 1 開始" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) build(i);

    // @frame use binary_indexed_tree_view
    // @text "Binary Indexed Tree 建構完成；每個寬格代表它負責的連續區間" at num.top offset(0,-20)

    int L, R;
    cin >> L >> R;

    // @frame use binary_indexed_tree_view
    // @style num[L:R] background AV_green
    // @text "查詢第 ${L} 到第 ${R} 個數：計算 sum(${R}) - sum(${L - 1})" at num.top offset(0,-20)

    int sumR = sum(R);
    int sumL = sum(L - 1);
    int ans = sumR - sumL;

    // @frame use binary_indexed_tree_view
    // @style num[L:R] background AV_green
    // @text "區間和 = ${sumR} - ${sumL} = ${ans}" at num.top offset(0,-20)

    cout << "sum of L to R = " << ans << '\n';
    return 0;
}
