// Segment_Tree_easy Sample
#include <bits/stdc++.h>
using namespace std;

#define pb push_back
#define int int
#define LM INT_MAX
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree, lazy, sets;
int Tmask, Tsize, Tdeep, Tcapacity, n, sum = 0;

// @defaults
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefaults

// @preset build_view
// @object tree render heap with range(1,Tcapacity)
// @endpreset

// @preset query_view
// @object tree render heap with range(1,Tsize-1)
// @object sum render cell
// @place sum.top at tree.bottom offset(0,45)
// @endpreset

int rule(int a, int b) { return a + b; }

void build() {
    Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;
    Tcapacity = (1 << Tdeep) - 1;
    tree.assign(Tcapacity + 1, 0);
    lazy.assign(Tcapacity + 1, 0);
    sets.assign(Tcapacity + 1, LM);
    for (int i = Tsize - n; i < Tsize; i++) {
        cin >> tree[i];
        // @frame use build_view
        // @style tree[i] highlight
        // @text "讀入第 ${i-(Tsize-n)+1} 個值 ${tree[i]}，放到葉節點 tree[${i}]" at tree.top offset(0,-20)
    }
    for (int i = Tsize - n - 1; i > 0; i--) {
        int left = i << 1, right = i << 1 | 1;
        tree[i] = rule(tree[left], tree[right]);
        // @frame use build_view
        // @style tree[i] highlight
        // @style tree[left,right] point
        // @arrow from tree[left] to tree[i] as "left_child_sum"
        // @arrow from tree[right] to tree[i] as "right_child_sum"
        // @text "左右子節點 ${tree[left]} + ${tree[right]} = ${tree[i]}\n因此得到 tree[${i}]" at tree.top offset(0,-20)
    }
}

// 保留原本的特殊葉節點排列：根區間是 [Tmask, 2*Tmask-1]。
void query(int l, int r, int L, int R, int now) {
    // @frame use query_view
    // @style tree[now] highlight,point
    // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now)
    // @text "節點 ${now} 代表目前區間；另一側尚待處理的區段也會保留" at tree.top offset(0,-20)
    if (L <= l && r <= R) {
        sum += tree[now];
        // @frame use query_view
        // @style tree[now] highlight,point
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
    int m, q, x, y, k;
    cin >> n >> m;
    build();
    // @frame use query_view
    // @text "所有父節點都已由左右子節點相加完成，接著開始區間查詢" at tree.top offset(0,-20)
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
