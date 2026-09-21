// Segment_Tree Sample
#include <bits/stdc++.h>
using namespace std;

#define int int
#define LM INT_MAX
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree, lazy, sets;
int Tmask, Tsize, Tdeep, n, ans = 0;

// @defaults
// @camera focus tree offset(0,40) zoom(1.02)
// @enddefaults

// 操作時在樹下方顯示 query 已累加的答案。
// @preset operation_view
// @object tree render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0, sets=LM)
// @object ans render cell
// @place ans.top at tree.bottom offset(0,45)
// @style lazy[1:Tsize-1] background rgb(231,144,255) when value != 0
// @style sets[1:Tsize-1] background rgb(255,183,77) when value != 2147483647
// @endpreset

// 遞迴操作期間用 now 作為 tree 的實際陣列指標。
// @preset operation_pointer_view
// @object tree[now] render heap with range(1,Tsize-1), fields(tree,lazy,sets), hide(lazy=0, sets=LM)
// @object ans render cell
// @place ans.top at tree.bottom offset(0,45)
// @style lazy[1:Tsize-1] background rgb(231,144,255) when value != 0
// @style sets[1:Tsize-1] background rgb(255,183,77) when value != 2147483647
// @endpreset

void build() {
    Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;
    tree.assign(1 << Tdeep, 0);
    lazy.assign(1 << Tdeep, 0);
    sets.assign(1 << Tdeep, LM);

    for (int i = Tsize - n; i < Tsize; i++) cin >> tree[i];

    for (int i = Tsize - n - 1; i > 0; i--)
        tree[i] = tree[i << 1] + tree[i << 1 | 1];
}

// 保留原本的特殊葉節點排列與 lazy／set 優先關係。
int query(int l, int r, int L, int R, int Add, int Set, int now) {
    // segment 只在下降時分裂；同一時間保留另一側尚待處理的區段。
    // @frame use operation_pointer_view
    // @style tree[now] highlight
    // @segment tree[1][L-Tmask:R-Tmask] color AV_magenta as active_range with split(now) when Add != 0
    // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now) when Set != 2147483647
    // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now) when Add == 0 and Set == 2147483647
    // @text "下降到節點 ${now}，檢查它與操作範圍的重疊" at tree.top offset(0,-20)

    if (L <= l && r <= R) {
        if (Set != LM) {
            sets[now] = Set;
            tree[now] = (r - l + 1) * Set;
            lazy[now] = 0;
        }
        if (Add != 0) {
            if (sets[now] != LM)
                sets[now] += Add, tree[now] = (r - l + 1) * sets[now];
            else
                lazy[now] += Add, tree[now] += (r - l + 1) * Add;
        }
        if (Add == 0 && Set == LM) ans += tree[now];
        if (l == r) lazy[now] = 0, sets[now] = LM;

        // 命中的區段在這一幀向下淡出；遞迴返回時不再重新建立。
        // @frame use operation_pointer_view
        // @style tree[now] highlight
        // @style ans highlight when Add == 0 and Set == 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_magenta as active_range with split(now,after) when Add != 0
        // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now,after) when Set != 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now,after) when Add == 0 and Set == 2147483647
        // @text "整段命中，將 modify ${Add} 寫入 lazy；目前 tree[${now}] = ${tree[now]}" at tree.top offset(0,-20) when Add != 0
        // @text "整段命中，用 ${Set} 覆蓋此區段；目前 tree[${now}] = ${tree[now]}" at tree.top offset(0,-20) when Set != 2147483647
        // @text "整段命中，將 ${tree[now]} 加入 ans；目前 ans = ${ans}" at tree.top offset(0,-20) when Add == 0 and Set == 2147483647
        return tree[now];
    }

    int m = (l + r) >> 1, M = r - m, sum = 0;
    if (sets[now] != LM) {
        sets[now << 1] = sets[now << 1 | 1] = sets[now];
        tree[now << 1] = tree[now << 1 | 1] = tree[now] / 2;
        lazy[now << 1] = lazy[now << 1 | 1] = 0;
        sets[now] = LM;
        // @frame use operation_pointer_view
        // @style tree[now,now*2,now*2+1] highlight
        // @style sets[now*2,now*2+1] background rgb(255,183,77)
        // @segment tree[1][L-Tmask:R-Tmask] color AV_magenta as active_range with split(now) when Add != 0
        // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now) when Set != 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now) when Add == 0 and Set == 2147483647
        // @text "先把節點 ${now} 的 set 標記下推；它會覆蓋兩個子節點原本的 add 標記" at tree.top offset(0,-20)
    }
    if (lazy[now] != 0) {
        if (sets[now << 1] != LM)
            sets[now << 1] += lazy[now], tree[now << 1] = M * sets[now << 1];
        else
            lazy[now << 1] += lazy[now], tree[now << 1] += M * lazy[now << 1];
        if (sets[now << 1 | 1] != LM)
            sets[now << 1 | 1] += lazy[now], tree[now << 1 | 1] = M * sets[now << 1 | 1];
        else
            lazy[now << 1 | 1] += lazy[now], tree[now << 1 | 1] += M * lazy[now << 1 | 1];
        lazy[now] = 0;
        // @frame use operation_pointer_view
        // @style tree[now,now*2,now*2+1] highlight
        // @style lazy[now*2,now*2+1] background rgb(231,144,255) when value != 0
        // @style sets[now*2,now*2+1] background rgb(255,183,77) when value != 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_magenta as active_range with split(now) when Add != 0
        // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now) when Set != 2147483647
        // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now) when Add == 0 and Set == 2147483647
        // @text "把節點 ${now} 的 add 標記下推；若子節點已有 set，就直接加在 set 上" at tree.top offset(0,-20)
    }

    if (L <= m) sum += query(l, m, L, R, Add, Set, now << 1);
    if (R > m) sum += query(m + 1, r, L, R, Add, Set, now << 1 | 1);

    int left = now << 1, right = now << 1 | 1;
    tree[now] = tree[left] + tree[right];
    // 回溯更新父節點，並保留祖先層尚待處理的 segment；剛完成的子樹不會重新出現。
    // @frame use operation_pointer_view
    // @style tree[now] highlight
    // @arrow from tree[left] to tree[now] as "left_child_sum"
    // @arrow from tree[right] to tree[now] as "right_child_sum"
    // @segment tree[1][L-Tmask:R-Tmask] color AV_magenta as active_range with split(now,after) when Add != 0
    // @segment tree[1][L-Tmask:R-Tmask] color AV_orange as active_range with split(now,after) when Set != 2147483647
    // @segment tree[1][L-Tmask:R-Tmask] color AV_green as active_range with split(now,after) when Add == 0 and Set == 2147483647
    // @text "回到節點 ${now}，由 ${tree[left]} + ${tree[right]} 更新為 ${tree[now]}" at tree.top offset(0,-20)
    return sum;
}

int main() {
    int m, q, x, y, k;
    cin >> n >> m;
    build();

    for (int i = 0; i < m; i++) {
        cin >> q >> x >> y;
        if (q != 3) cin >> k;
        ans = 0;

        // @frame use operation_view
        // @segment tree[1][x-1:y-1] color AV_magenta as active_range when q == 1
        // @segment tree[1][x-1:y-1] color AV_orange as active_range when q == 2
        // @segment tree[1][x-1:y-1] color AV_green as active_range when q == 3
        // @text "modify：將第 ${x} 到第 ${y} 個值都加上 ${k}" at tree.top offset(0,-20) when q == 1
        // @text "區間設定：將第 ${x} 到第 ${y} 個值都設成 ${k}" at tree.top offset(0,-20) when q == 2
        // @text "區間查詢：計算第 ${x} 到第 ${y} 個值的總和" at tree.top offset(0,-20) when q == 3

        if (q == 1)
            query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), k, LM, 1);
        else if (q == 2)
            query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), 0, k, 1);
        else
            ans = query(Tmask, (Tmask << 1) - 1, (x - 1 | Tmask), (y - 1 | Tmask), 0, LM, 1), cout << ans << endl;

        // @frame use operation_view
        // @style tree[1] highlight when q != 3
        // @style ans highlight when q == 3
        // @text "modify 完成；紫色欄位保留尚未下推的 lazy 標記" at tree.top offset(0,-20) when q == 1
        // @text "區間設定完成；橘色欄位保留尚未下推的 set 標記" at tree.top offset(0,-20) when q == 2
        // @text "區間查詢完成，答案是 ${ans}" at tree.top offset(0,-20) when q == 3
    }
    return 0;
}
