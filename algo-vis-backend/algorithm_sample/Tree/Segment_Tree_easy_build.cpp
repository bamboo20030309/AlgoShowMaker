// Segment_Tree_easy Build Sample
#include <bits/stdc++.h>
using namespace std;

#define int int
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree;
int Tmask, Tsize, Tdeep, Tcapacity, n;

// @defaults
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefaults

// @preset build_view
// @object tree render heap with range(1,Tcapacity)
// @endpreset

void build() {
    Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;
    Tcapacity = (1 << Tdeep) - 1;
    tree.assign(Tcapacity + 1, 0);

    // @frame use build_view
    // @events animate off
    // @text "先建立可容納 ${n} 個輸入值的線段樹" at tree.top offset(0,-20)

    for (int i = Tsize - n; i < Tsize; i++) {
        cin >> tree[i];
        // @frame use build_view
        // @style tree[i] highlight
        // @text "讀入第 ${i-(Tsize-n)+1} 個值 ${tree[i]}，放到葉節點 tree[${i}]" at tree.top offset(0,-20)
    }

    for (int i = Tsize - n - 1; i > 0; i--) {
        int left = i << 1, right = i << 1 | 1;
        tree[i] = tree[left] + tree[right];
        // @frame use build_view
        // @style tree[i] highlight,point
        // @arrow from tree[left] to tree[i] as "left_child_sum"
        // @arrow from tree[right] to tree[i] as "right_child_sum"
        // @text "左右子節點 ${tree[left]} + ${tree[right]} = ${tree[i]}\n因此得到 tree[${i}]" at tree.top offset(0,-20)
    }

    // @frame use build_view
    // @style tree[1] highlight
    // @text "所有父節點都已完成，根節點的值是 ${tree[1]}" at tree.top offset(0,-20)
}

int main() {
    cin >> n;
    build();
    return 0;
}
