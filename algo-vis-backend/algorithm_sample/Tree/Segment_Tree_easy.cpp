// Segment_Tree_easy Sample
#include <bits/stdc++.h>
using namespace std;

#define pb push_back
#define int int
#define LM INT_MAX
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree, lazy, sets;
int Tmask, Tsize, Tdeep, n;

// @defaults
// @camera focus tree offset(0,70) zoom(1.15)
// @enddefaults

int rule(int a, int b) { return a + b; }

void build() {
    Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;
    tree.assign(1 << Tdeep, 0);
    lazy.assign(1 << Tdeep, 0);
    sets.assign(1 << Tdeep, LM);
    for (int i = Tsize - n; i < Tsize; i++) cin >> tree[i];
    for (int i = Tsize - n - 1; i > 0; i--)
        tree[i] = rule(tree[i << 1], tree[i << 1 | 1]);
}

// 保留原本的特殊葉節點排列：根區間是 [Tmask, 2*Tmask-1]。
int query(int l, int r, int L, int R, int now) {
    // @frame tree render heap with range(1,Tsize-1)
    // @style tree[now] highlight,point AV_green
    // @segment tree[now][L-l:R-l] color AV_green as active_range when L <= R
    // @text "節點 ${now} 代表目前區間，顯示和查詢範圍重疊的部分" at tree.top offset(0,-20)
    if (L <= l && r <= R) {
        // @frame tree render heap with range(1,Tsize-1)
        // @style tree[now] highlight,point AV_green
        // @segment tree[now][0:r-l] color AV_green as active_range
        // @text "整段都在查詢範圍內，直接回傳 ${tree[now]}" at tree.top offset(0,-20)
        return tree[now];
    }
    int m = (l + r) >> 1, M = r - m, sum = 0;
    if (L <= m) sum = rule(sum, query(l, m, L, R, now << 1));
    if (R > m) sum = rule(sum, query(m + 1, r, L, R, now << 1 | 1));
    tree[now] = rule(tree[now << 1], tree[now << 1 | 1]);
    // @frame tree render heap with range(1,Tsize-1)
    // @style tree[now] highlight AV_green
    // @segment tree[now][L-l:R-l] color AV_green as active_range when L <= R
    // @text "左右結果合併後，目前查詢值為 ${sum}" at tree.top offset(0,-20)
    return sum;
}

int main() {
    int m, q, x, y, k;
    cin >> n >> m;
    build();
    // @frame tree render heap with range(1,Tsize-1)
    // @text "線段樹由葉節點往上合併；這個版本只示範區間查詢" at tree.top offset(0,-20)
    // @keep tree as "built_tree"
    for (int i = 0; i < m; i++) {
        cin >> x >> y;
        // @frame tree render heap with range(1,Tsize-1)
        // @segment tree[1][x-1:y-1] color AV_green as active_range
        // @text "查詢第 ${x} 到第 ${y} 個輸入值" at tree.top offset(0,-20)
        int ans = query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), 1);
        cout << ans << endl;
        // @frame tree render heap with range(1,Tsize-1)
        // @segment tree[1][x-1:y-1] color AV_green as active_range
        // @text "這次區間查詢的答案是 ${ans}" at tree.top offset(0,-20)
    }
}
