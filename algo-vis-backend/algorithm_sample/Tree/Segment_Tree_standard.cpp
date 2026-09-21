// Standard Segment Tree Sample
#include <bits/stdc++.h>
using namespace std;

vector<int> values, tree;
int n, ans = 0;

// @defaults
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefaults

// @preset query_view
// @object tree render segment_tree with domain(1,n), root(1), unit(48)
// @object ans render cell
// @place ans.top at tree.bottom offset(0,45)
// @endpreset

// @preset query_pointer_view
// @object tree[now] render segment_tree with domain(1,n), root(1), unit(48)
// @object ans render cell
// @place ans.top at tree.bottom offset(0,45)
// @endpreset

void build(int now, int l, int r) {
    if (l == r) {
        tree[now] = values[l];
        return;
    }
    int mid = (l + r) / 2;
    build(now * 2, l, mid);
    build(now * 2 + 1, mid + 1, r);
    tree[now] = tree[now * 2] + tree[now * 2 + 1];
}

void query(int now, int l, int r, int L, int R) {
    // @frame use query_pointer_view
    // @style tree[now] highlight
    // @segment tree[1][L-1:R-1] color AV_green as query_range with split(now)
    // @text "目前檢查 tree[${now}]，代表區間 [${l},${r}]" at tree.top offset(0,-20)

    if (L <= l && r <= R) {
        ans += tree[now];
        // @frame use query_pointer_view
        // @style tree[now] highlight
        // @style ans highlight
        // @segment tree[1][L-1:R-1] color AV_green as query_range with split(now,after)
        // @text "區間 [${l},${r}] 完整命中，將 ${tree[now]} 加入 ans" at tree.top offset(0,-20)
        return;
    }

    int mid = (l + r) / 2;
    if (L <= mid) query(now * 2, l, mid, L, R);
    if (R > mid) query(now * 2 + 1, mid + 1, r, L, R);
}

int main() {
    cin >> n;
    values.assign(n + 1, 0);
    tree.assign(4 * n + 5, 0);
    for (int i = 1; i <= n; i++) cin >> values[i];
    build(1, 1, n);

    int L, R;
    cin >> L >> R;
    ans = 0;

    // @frame use query_view
    // @segment tree[1][L-1:R-1] color AV_green as query_range
    // @text "準備查詢區間 [${L},${R}]" at tree.top offset(0,-20)

    query(1, 1, n, L, R);

    // @frame use query_view
    // @style ans highlight
    // @text "查詢完成，答案是 ${ans}" at tree.top offset(0,-20)

    cout << ans << '\n';
    return 0;
}
