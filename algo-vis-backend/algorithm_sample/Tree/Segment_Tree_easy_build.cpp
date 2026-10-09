/*
 * 範例：線段樹迭代建構
 *
 * 用途與核心步驟：先把原陣列放在葉節點，再由底向上合併子節點資訊得到父節點。
 * 輸入、輸出與複雜度：輸入長度 n 的陣列；輸出區間聚合樹。建構 O(n)、空間 O(n)。
 *
 * 視覺化約定：`@frame`、`@layout`、`@style` 等註解由 AlgoShowMaker
 * 分析器讀取；它們描述畫面切點與呈現方式，不參與 C++ 演算法運算。
 */

// Segment_Tree_easy Build Sample
#include <bits/stdc++.h>
using namespace std;

#define int int
#define Hbit(X) (32-__builtin_clzll(X))

vector<int> tree;
int Tmask, Tsize, Tdeep, Tcapacity, n;

// @default
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefault

// @preset build_view
// @object tree render heap with range(1,Tcapacity)
// @endpreset

// 建樹迴圈中以實際變數 i 作為 tree 的陣列指標。
// @preset build_pointer_view
// @object tree render heap with range(1,Tcapacity)
// @pointer i at tree
// @endpreset

// ─────────────────────────────────────────────────────────────────────────────
// 演算法與視覺化輔助程序：前者維護核心不變條件，後者只建立展示資料。
// ─────────────────────────────────────────────────────────────────────────────

void build() {
    Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;
    Tcapacity = (1 << Tdeep) - 1;
    tree.assign(Tcapacity + 1, 0);

    // @frame use build_view
    // @events animate off
    // @text "先建立可容納 ${n} 個輸入值的線段樹" at tree.top offset(0,-20)

    for (int i = Tsize - n; i < Tsize; i++) {
        cin >> tree[i];
        // @frame use build_pointer_view
        // @style tree[i] highlight
        // @text "讀入第 ${i-(Tsize-n)+1} 個值 ${tree[i]}，放到葉節點 tree[${i}]" at tree.top offset(0,-20)
    }

    for (int i = Tsize - n - 1; i > 0; i--) {
        int left = i << 1, right = i << 1 | 1;
        tree[i] = tree[left] + tree[right];
        // @frame use build_pointer_view
        // @style tree[i] highlight
        // @arrow from tree[left] to tree[i] as "left_child_sum"
        // @arrow from tree[right] to tree[i] as "right_child_sum"
        // @text "左右子節點 ${tree[left]} + ${tree[right]} = ${tree[i]}\n因此得到 tree[${i}]" at tree.top offset(0,-20)
    }

    // @frame use build_view
    // @style tree[1] highlight
    // @text "所有父節點都已完成，根節點的值是 ${tree[1]}" at tree.top offset(0,-20)
}

// ─────────────────────────────────────────────────────────────────────────────
// 範例入口：準備輸入與初始畫面，執行核心算法，最後輸出結果／收尾畫面。
// ─────────────────────────────────────────────────────────────────────────────

int main() {
    cin >> n;
    build();
    return 0;
}
