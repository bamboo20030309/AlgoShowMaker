// Segment_Tree_easy Query Sample
#include <bits/stdc++.h>
using namespace std;

#define int int
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree;
int Tmask, Tsize, Tdeep, Tcapacity, n, sum = 0;

// @defaults
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefaults

// @preset query_view
// @object tree render heap with range(1,Tsize-1)
// @object sum render cell
// @place sum.top at tree.bottom offset(0,45)
// @endpreset

// 遞迴查詢期間用 now 作為 tree 的實際陣列指標。
// @preset query_pointer_view
// @object tree[now] render heap with range(1,Tsize-1)
// @object sum render cell
// @place sum.top at tree.bottom offset(0,45)
// @endpreset

// 先完成資料建構，不在查詢動畫中逐步播放。
void build_tree() {
    Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;
    Tcapacity = (1 << Tdeep) - 1;
    tree.assign(Tcapacity + 1, 0);
    for (int i = Tsize - n; i < Tsize; i++) cin >> tree[i];
    for (int i = Tsize - n - 1; i > 0; i--)
        tree[i] = tree[i << 1] + tree[i << 1 | 1];
}

// 保留原本的特殊葉節點排列：根區間是 [Tmask, 2*Tmask-1]。
void query(int l, int r, int L, int R, int now) {
    // @frame use query_pointer_view
    // @style tree[now] highlight
    // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now)
    // @text "節點 ${now} 代表目前區間；另一側尚待處理的區段也會保留" at tree.top offset(0,-20)
    if (L <= l && r <= R) {
        sum += tree[now];
        // @frame use query_pointer_view
        // @style tree[now] highlight
        // @style sum highlight
        // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now,after)
        // @text "整段命中，將 ${tree[now]} 加入 sum；目前 sum = ${sum}" at tree.top offset(0,-20)
        return;
    }
    int m = (l + r) >> 1;
    if (L <= m) query(l, m, L, R, now << 1);
    if (R > m) query(m + 1, r, L, R, now << 1 | 1);
}

int main() {
    int m, x, y;
    cin >> n >> m;
    build_tree();

    // @frame use query_view
    // @events animate off
    // @text "線段樹已建構完成，接著只播放區間查詢" at tree.top offset(0,-20)

    for (int i = 0; i < m; i++) {
        cin >> x >> y;
        sum = 0;
        // @frame use query_view
        // @segment tree[1][x-1:y-1] color AV_green as active_range
        // @text "查詢第 ${x} 到第 ${y} 個輸入值" at tree.top offset(0,-20)
        query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), 1);
        cout << sum << endl;
        // @frame use query_view
        // @style sum highlight
        // @text "所有命中區段都已加入，這次查詢答案是 ${sum}" at tree.top offset(0,-20)
    }
}
