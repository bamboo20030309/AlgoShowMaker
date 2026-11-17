// Binary Indexed Tree Linear Build Sample
#include <bits/stdc++.h>
using namespace std;

int n;
vector<int> num, BIT;

// @defaults
// @camera auto zoom(1.05)
// @enddefaults

// @preset binary_indexed_tree_view
// @object num with labels(value,index)
// @object BIT render binary indexed tree with range(1,n), labels(value,binary-index-padded)
// @style num[0] background AV_grey
// @place num.left-bottom at BIT.left-top offset(-40,-70)
// @endpreset

// @preset binary_indexed_tree_pointer_view
// @object num with labels(value,index)
// @object BIT render binary indexed tree with range(1,n), labels(value,binary-index-padded)
// @pointer i at BIT
// @style num[0] background AV_grey
// @place num.left-bottom at BIT.left-top offset(-40,-70)
// @endpreset

int main() {
    cin >> n;
    num.resize(n + 1);
    BIT.resize(n + 1);
    for (int i = 1; i <= n; i++) cin >> num[i];

    // @frame use binary_indexed_tree_view
    // @events animate off
    // @text "先把每個數放入同索引的 BIT 格" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) {
        // @frame use binary_indexed_tree_pointer_view
        // @style num[i] highlight
        // @style BIT[i] highlight
        // @text "初始化 BIT[${i}]：放入 num[${i}] = ${num[i]}" at num.top offset(0,-20)

        BIT[i] = num[i];
    }

    // @frame use binary_indexed_tree_view
    // @text "每個 BIT 格已有自己的值，開始將整段傳給父區段" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) {
        if (i + (i & -i) <= n) {
            // @frame use binary_indexed_tree_pointer_view
            // @style BIT[i] highlight
            // @style BIT[i + (i & -i)] background AV_green
            // @arrow from BIT[i] to BIT[i+ (i&-i)]
            // @text "lowbit(${i}) = ${i & -i}；BIT[${i}] 的整段傳到 BIT[${i + (i & -i)}]" at num.top offset(0,-20)

            BIT[i + (i & -i)] += BIT[i];

            // @frame use binary_indexed_tree_pointer_view
            // @style BIT[i] highlight
            // @style BIT[i + (i & -i)] background AV_green
            // @arrow from BIT[i] to BIT[i+ (i&-i)]
            // @text "BIT[${i + (i & -i)}] 現在是 ${BIT[i + (i & -i)]}" at num.top offset(0,-20)
        }
    }

    // @frame use binary_indexed_tree_view
    // @text "線性建樹完成：每個 BIT[i] 都是自己的尾端區段總和" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) {
        if (i > 1) cout << ' ';
        cout << BIT[i];
    }
    cout << '\n';
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
