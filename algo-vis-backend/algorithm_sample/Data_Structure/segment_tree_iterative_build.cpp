#include <bits/stdc++.h>
using namespace std;

#define int int
#define Hbit(X) ((X) == 0 ? 0 : 64-__builtin_clzll(X))

vector<int> tree;
int Tmask, Tsize, Tdeep, Tcapacity, n;

// @defaults
// @camera focus tree offset(0,35) zoom(1.05)
// @style tree[1:Tsize-1] focus
// @enddefaults

// @preset build_view
// @object tree render segment_tree with range(1,Tmask)
// @endpreset

// @preset build_pointer_view
// @object tree render segment_tree with range(1,Tmask)
// @pointer i at tree
// @endpreset
void build() {                                 // 葉子存輸入，父節點存區間和
    Tmask = 1 << Hbit(n - 1);                  // n=10 時 P=16，輸入放在 [16:25]
    Tsize = Tmask + n;
    Tdeep = Hbit(n - 1) + 1;
    Tcapacity = (1 << Tdeep) - 1;              // 索引 [1:2P-1]，配置含索引 0 的 2P 格
    tree.assign(Tcapacity + 1, 0);

    // @frame use build_view
    // @events animate off
    // @text "先建立可容納 ${n} 個輸入值的線段樹" at tree.top offset(0,-20)

    for (int i = Tsize - n; i < Tsize; i++) {  // 依序填入同一層的葉節點
        cin >> tree[i];
        // @frame use build_pointer_view
        // @style tree[i] highlight
        // @text "讀入第 ${i-(Tsize-n)+1} 個值 ${tree[i]}，放到葉節點 tree[${i}]" at tree.top offset(0,-20)
    }

    for (int i = Tsize - n - 1; i > 0; i--) {  // 從最後的父節點往根合併
        int left = i << 1, right = i << 1 | 1;
        tree[i] = tree[left] + tree[right];    // 由左右孩子重算父節點
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

int main() {
    cin >> n;
    build();
    return 0;
}


/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "codePanelFontSize": 14,
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
