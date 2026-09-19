// Segment_Tree Sample
#include <bits/stdc++.h>
using namespace std;

#define pb push_back
#define int int
#define LM INT_MAX
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree, lazy, sets;
int Tmask, Tsize, Tdeep, n;

// @defaults
// @camera focus tree offset(0,70) zoom(1.1)
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

// query／add／set 共用原本的特殊節點排列與延遲標記。
int query(int l, int r, int L, int R, int Add, int Set, int now) {
    // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
    // @style tree[now] highlight,point
    // @style lazy[1:Tsize-1] background AV_blue when value != 0
    // @style sets[1:Tsize-1] background AV_orange when value != 2147483647
    // @segment tree[1][L-Tmask:R-Tmask] color AV_blue as active_range with split(now) when Add != 0
    // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now) when Set != 2147483647
    // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now) when Add == 0 and Set == 2147483647
    // @text "檢查節點 ${now} 與這次操作範圍的重疊部分" at tree.top offset(0,-20)
    if (L <= l && r <= R) {
        if (Set != LM) {
            sets[now] = Set;
            tree[now] = (r - l + 1) * Set;
            lazy[now] = 0;
        }
        if (Add != 0) {
            if (sets[now] != LM) sets[now] += Add, tree[now] = (r - l + 1) * sets[now];
            else lazy[now] += Add, tree[now] += (r - l + 1) * Add;
        }
        if (l == r) lazy[now] = 0, sets[now] = LM;
        // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
        // @style tree[now] highlight,point
        // @style lazy[1:Tsize-1] background AV_blue when value != 0
        // @style sets[1:Tsize-1] background AV_orange when value != 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_blue as active_range with split(now) when Add != 0
        // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now) when Set != 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now) when Add == 0 and Set == 2147483647
        // @text "整段命中；格內依序顯示 tree、lazy、sets，目前值為 ${tree[now]}" at tree.top offset(0,-20)
        return tree[now];
    }

    int m = (l + r) >> 1, M = r - m, sum = 0;
    if (sets[now] != LM) {
        sets[now << 1] = sets[now << 1 | 1] = sets[now];
        tree[now << 1] = tree[now << 1 | 1] = tree[now] / 2;
        lazy[now << 1] = lazy[now << 1 | 1] = 0;
        sets[now] = LM;
        // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
        // @style tree[now,now*2,now*2+1] highlight
        // @style sets[now*2,now*2+1] background AV_orange
        // @text "把節點 ${now} 的 set 標記往兩個子節點傳遞" at tree.top offset(0,-20)
    }
    if (lazy[now] != 0) {
        if (sets[now << 1] != LM) sets[now << 1] += lazy[now], tree[now << 1] = M * sets[now << 1];
        else lazy[now << 1] += lazy[now], tree[now << 1] += M * lazy[now << 1];
        if (sets[now << 1 | 1] != LM) sets[now << 1 | 1] += lazy[now], tree[now << 1 | 1] = M * sets[now << 1 | 1];
        else lazy[now << 1 | 1] += lazy[now], tree[now << 1 | 1] += M * lazy[now << 1 | 1];
        lazy[now] = 0;
        // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
        // @style tree[now,now*2,now*2+1] highlight
        // @style lazy[now*2,now*2+1] background AV_blue when value != 0
        // @style sets[now*2,now*2+1] background AV_orange when value != 2147483647
        // @text "把節點 ${now} 的 add 標記往兩個子節點傳遞" at tree.top offset(0,-20)
    }

    if (L <= m) sum = rule(sum, query(l, m, L, R, Add, Set, now << 1));
    if (R > m) sum = rule(sum, query(m + 1, r, L, R, Add, Set, now << 1 | 1));
    tree[now] = rule(tree[now << 1], tree[now << 1 | 1]);
    // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
    // @style tree[now] highlight
    // @style lazy[1:Tsize-1] background AV_blue when value != 0
    // @style sets[1:Tsize-1] background AV_orange when value != 2147483647
    // @segment tree[1][L-Tmask:R-Tmask] color AV_blue as active_range with split(now,after) when Add != 0
    // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now,after) when Set != 2147483647
    // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now,after) when Add == 0 and Set == 2147483647
    // @text "子節點處理完成，重新計算節點 ${now} 的總和" at tree.top offset(0,-20)
    return sum;
}

int main() {
    int m, q, x, y, k;
    cin >> n >> m;
    build();
    // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
    // @style lazy[1:Tsize-1] background AV_blue when value != 0
    // @style sets[1:Tsize-1] background AV_orange when value != 2147483647
    // @text "每格依序顯示總和、add標記、set標記；未使用的標記不顯示" at tree.top offset(0,-20)
    // @keep tree as "built_tree"
    for (int i = 0; i < m; i++) {
        cin >> q >> x >> y;
        if (q != 3) cin >> k;
        int ans = 0;
        // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
        // @style lazy[1:Tsize-1] background AV_blue when value != 0
        // @style sets[1:Tsize-1] background AV_orange when value != 2147483647
        // @segment tree[1][x-1:y-1] color AV_blue as active_range when q == 1
        // @segment tree[1][x-1:y-1] color AV_orange as active_range when q == 2
        // @segment tree[1][x-1:y-1] color AV_green as active_range when q == 3
        // @text "藍色是區間加值、橘色是區間設定、綠色是區間查詢" at tree.top offset(0,-20)
        if (q == 1) query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), k, LM, 1);
        else if (q == 2) query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), 0, k, 1);
        else ans = query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), 0, LM, 1), cout << ans << endl;
        // @frame tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
        // @style lazy[1:Tsize-1] background AV_blue when value != 0
        // @style sets[1:Tsize-1] background AV_orange when value != 2147483647
        // @text "這次操作完成；所有欄位仍由原本的三個陣列分別追蹤" at tree.top offset(0,-20)
    }
}
