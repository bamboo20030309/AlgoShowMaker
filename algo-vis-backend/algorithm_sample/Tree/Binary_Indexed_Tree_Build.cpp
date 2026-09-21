// Binary Indexed Tree Build Sample
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
// @let lb = i & -i
// @style BIT[1:n] focus when index >= k && index - (index & -index) < k
// @endpreset

void build(int i) {
    int k = i;
    for (; i <= n; i += i & -i) {
        // @frame use binary_indexed_tree_pointer_view
        // @style num[k] highlight
        // @style BIT[i] highlight
        // @style BIT[i] background AV_green
        // @text "BIT[${i}] 涵蓋 num[${i-lb+1}~${i}]，準備加上 num[${k}] = ${num[k]}" at num.top offset(0,-20)

        BIT[i] += num[k];

        // @frame use binary_indexed_tree_pointer_view
        // @style num[k] highlight
        // @style BIT[i] highlight
        // @style BIT[i] background AV_green
        // @text "BIT[${i}] 更新為 ${BIT[i]}；下一個索引是 ${i + lb}" at num.top offset(0,-20)

    }
}

int main() {
    cin >> n;
    num.resize(n + 1);
    BIT.resize(n + 1);
    for (int i = 1; i <= n; i++) cin >> num[i];

    // @frame use binary_indexed_tree_view
    // @events animate off
    // @text "num[0] 是保留格；接著把每個數加入 Binary Indexed Tree" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) build(i);

    // @frame use binary_indexed_tree_view
    // @text "建構完成；每個寬格代表它負責的連續區間" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) {
        if (i > 1) cout << ' ';
        cout << BIT[i];
    }
    cout << '\n';
    return 0;
}
