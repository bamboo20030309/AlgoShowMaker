/*
 * 範例：具 lazy propagation 的線段樹
 *
 * 用途與核心步驟：節點保存區間聚合值與延遲標記；更新完整涵蓋時留標記，必要下探前 push 給子節點，以避免逐點修改。
 * 輸入、輸出與複雜度：輸入區間設定／加值與查詢；輸出區間結果。建樹 O(n)，每次更新與查詢典型 O(log n)，空間 O(n)。
 *
 * 視覺化約定：`@frame`、`@layout`、`@style` 等註解由 AlgoShowMaker
 * 分析器讀取；它們描述畫面切點與呈現方式，不參與 C++ 演算法運算。
 */

// Standard Segment Tree Sample
#include <bits/stdc++.h>
using namespace std;

#define LM INT_MAX

vector<int> values, tree, lazy, sets;
int n, sum = 0;

// @default
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefault

// @preset operation_view
// @object tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)
// @object sum render cell
// @place sum.top at tree.bottom offset(0,45)
// @style lazy[1:4*n+4] background rgb(231,144,255) when value != 0
// @style sets[1:4*n+4] background rgb(255,183,77) when value != 2147483647
// @endpreset

// @preset operation_pointer_view
// @object tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)
// @object sum render cell
// @pointer now at tree
// @place sum.top at tree.bottom offset(0,45)
// @style lazy[1:4*n+4] background rgb(231,144,255) when value != 0
// @style sets[1:4*n+4] background rgb(255,183,77) when value != 2147483647
// @endpreset

// ─────────────────────────────────────────────────────────────────────────────
// 演算法與視覺化輔助程序：前者維護核心不變條件，後者只建立展示資料。
// ─────────────────────────────────────────────────────────────────────────────

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

void apply_set(int now, int l, int r, int value) {
    tree[now] = (r - l + 1) * value;
    sets[now] = value;
    lazy[now] = 0;
}

void apply_add(int now, int l, int r, int value) {
    tree[now] += (r - l + 1) * value;
    if (sets[now] != LM) sets[now] += value;
    else lazy[now] += value;
}

void push(int now, int l, int r) {
    if (l == r) {
        lazy[now] = 0;
        sets[now] = LM;
        return;
    }
    int mid = (l + r) / 2;
    if (sets[now] != LM) {
        apply_set(now * 2, l, mid, sets[now]);
        apply_set(now * 2 + 1, mid + 1, r, sets[now]);
        sets[now] = LM;
    }
    if (lazy[now] != 0) {
        apply_add(now * 2, l, mid, lazy[now]);
        apply_add(now * 2 + 1, mid + 1, r, lazy[now]);
        lazy[now] = 0;
    }
}

void update(int now, int l, int r, int L, int R, int kind, int value) {
    // @frame use operation_pointer_view
    // @style tree[now] highlight
    // @segment tree[1][L-1:R-1] color AV_magenta as active_range with split(now) when kind == 1
    // @segment tree[1][L-1:R-1] color AV_orange as active_range with split(now) when kind == 2
    // @text "下降到節點 ${now}，檢查區間 [${l},${r}]" at tree.top offset(0,-20)

    if (L <= l && r <= R) {
        if (kind == 1) apply_add(now, l, r, value);
        else apply_set(now, l, r, value);

        // @frame use operation_pointer_view
        // @style tree[now] highlight
        // @segment tree[1][L-1:R-1] color AV_magenta as active_range with split(now,after) when kind == 1
        // @segment tree[1][L-1:R-1] color AV_orange as active_range with split(now,after) when kind == 2
        // @text "整段加上 ${value}，目前 tree[${now}] = ${tree[now]}" at tree.top offset(0,-20) when kind == 1
        // @text "整段設成 ${value}，目前 tree[${now}] = ${tree[now]}" at tree.top offset(0,-20) when kind == 2
        return;
    }

    push(now, l, r);
    int mid = (l + r) / 2;
    if (L <= mid) update(now * 2, l, mid, L, R, kind, value);
    if (R > mid) update(now * 2 + 1, mid + 1, r, L, R, kind, value);
    tree[now] = tree[now * 2] + tree[now * 2 + 1];

    // @frame use operation_pointer_view
    // @style tree[now*2,now*2+1] highlight
    // @style tree[now] highlight,point
    // @segment tree[1][L-1:R-1] color AV_magenta as active_range with split(now,after) when kind == 1
    // @segment tree[1][L-1:R-1] color AV_orange as active_range with split(now,after) when kind == 2
    // @text "回朔到節點 ${now}：${tree[now*2]} + ${tree[now*2+1]} = ${tree[now]}" at tree.top offset(0,-20)
}

void query(int now, int l, int r, int L, int R) {
    // @frame use operation_pointer_view
    // @style tree[now] highlight
    // @segment tree[1][L-1:R-1] color AV_green as active_range with split(now)
    // @text "下降到節點 ${now}，檢查區間 [${l},${r}]" at tree.top offset(0,-20)

    if (L <= l && r <= R) {
        sum += tree[now];
        // @frame use operation_pointer_view
        // @style tree[now] highlight
        // @style sum highlight
        // @segment tree[1][L-1:R-1] color AV_green as active_range with split(now,after)
        // @text "整段命中，將 ${tree[now]} 加入 sum；目前 sum = ${sum}" at tree.top offset(0,-20)
        return;
    }

    push(now, l, r);
    int mid = (l + r) / 2;
    if (L <= mid) query(now * 2, l, mid, L, R);
    if (R > mid) query(now * 2 + 1, mid + 1, r, L, R);
}

// ─────────────────────────────────────────────────────────────────────────────
// 範例入口：準備輸入與初始畫面，執行核心算法，最後輸出結果／收尾畫面。
// ─────────────────────────────────────────────────────────────────────────────

int main() {
    int m;
    cin >> n >> m;
    values.assign(n + 1, 0);
    tree.assign(4 * n + 5, 0);
    lazy.assign(4 * n + 5, 0);
    sets.assign(4 * n + 5, LM);
    for (int i = 1; i <= n; i++) cin >> values[i];
    build(1, 1, n);

    for (int i = 0; i < m; i++) {
        int kind, L, R, value = 0;
        cin >> kind >> L >> R;
        if (kind != 3) cin >> value;
        sum = 0;

        // @frame use operation_view
        // @segment tree[1][L-1:R-1] color AV_magenta as active_range when kind == 1
        // @segment tree[1][L-1:R-1] color AV_orange as active_range when kind == 2
        // @segment tree[1][L-1:R-1] color AV_green as active_range when kind == 3
        // @text "modify：將第 ${L} 到第 ${R} 個值都加上 ${value}" at tree.top offset(0,-20) when kind == 1
        // @text "set：將第 ${L} 到第 ${R} 個值都設成 ${value}" at tree.top offset(0,-20) when kind == 2
        // @text "query：計算第 ${L} 到第 ${R} 個值總和" at tree.top offset(0,-20) when kind == 3

        if (kind == 1) update(1, 1, n, L, R, kind, value);
        else if (kind == 2) update(1, 1, n, L, R, kind, value);
        else {
            query(1, 1, n, L, R);
            cout << sum << '\n';
        }

        // @frame use operation_view
        // @style tree[1] highlight when kind != 3
        // @style sum highlight when kind == 3
        // @text "modify 完成；紫色欄位保留尚未下推的 lazy 標記" at tree.top offset(0,-20) when kind == 1
        // @text "set 完成；橘色欄位保留尚未下推的 set 標記" at tree.top offset(0,-20) when kind == 2
        // @text "query 完成，答案是 ${sum}" at tree.top offset(0,-20) when kind == 3
    }
    return 0;
}
