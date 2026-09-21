// Binary Indexed Tree Range Query Sample
#include <bits/stdc++.h>
using namespace std;

int n;
vector<int> num, BIT;
bool deduct;

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
// @let start = iteration.first(i)
// @style BIT[1:n] focus when index <= start && index + (index & -index) > start
// @endpreset

void add(int i, int x) {
    for (; i <= n; i += i & -i) BIT[i] += x;
}

int sum(int i) {
    int ans = 0;
    for (; i > 0; i -= i & -i) {
        // @frame use binary_indexed_tree_pointer_view
        // @style num[i-lb+1:i] background AV_green when !deduct
        // @style num[i-lb+1:i] background AV_red when deduct
        // @style BIT[i] highlight
        // @style BIT[i] background AV_green when !deduct
        // @style BIT[i] background AV_red when deduct
        // @text "BIT[${i}] 代表 num[${i-lb+1}~${i}]，這段會加入右端前綴和" at num.top offset(0,-20) when !deduct
        // @text "BIT[${i}] 代表 num[${i-lb+1}~${i}]，這段最後會從答案扣除" at num.top offset(0,-20) when deduct

        ans += BIT[i];

        // @frame use binary_indexed_tree_pointer_view
        // @style num[i-lb+1:i] background AV_green when !deduct
        // @style num[i-lb+1:i] background AV_red when deduct
        // @style BIT[i] highlight
        // @style BIT[i] background AV_green when !deduct
        // @style BIT[i] background AV_red when deduct
        // @text "右端前綴和目前是 ${ans}" at num.top offset(0,-20) when !deduct
        // @text "要扣除的左端前綴和目前是 ${ans}" at num.top offset(0,-20) when deduct
    }

    // @frame use binary_indexed_tree_view
    // @let start = iteration.first(i)
    // @style num[1:start] background AV_green when !deduct
    // @style num[1:start] background AV_red when deduct
    // @style BIT[1:n] background AV_green when !deduct && index <= start && index + (index & -index) > start
    // @style BIT[1:n] background AV_red when deduct && index <= start && index + (index & -index) > start
    // @text "所有數字總和為 ${ans}" as sum_total at num.top offset(0,-20)

    return ans;
}

int main() {
    cin >> n;
    num.resize(n + 1);
    BIT.resize(n + 1);
    for (int i = 1; i <= n; i++) cin >> num[i];
    for (int i = 1; i <= n; i++) add(i, num[i]);

    int L, R;
    while (cin >> L >> R) {

        // @frame use binary_indexed_tree_view
        // @events animate off
        // @style num[L:R] background AV_green
        // @text "查詢第 ${L} 到第 ${R} 個數：計算 sum(${R}) - sum(${L - 1})" at num.top offset(0,-20)

        deduct = false;
        int sumR = sum(R);
        deduct = true;
        int sumL = sum(L - 1);
        int ans = sumR - sumL;

        // @frame use binary_indexed_tree_view
        // @style num[L:R] background AV_green
        // @text "區間和 = ${sumR} - ${sumL} = ${ans}" at num.top offset(0,-20)

        cout << "sum of L to R = " << ans << '\n';
    }
    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventSettings": {
      "autoFixedEnabled": true,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
