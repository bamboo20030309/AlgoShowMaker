#include <bits/stdc++.h>
using namespace std;
vector<int> values, tree;
int n;
// @defaults
// @camera focus tree offset(0,35) zoom(1.05)
// @enddefaults
// @preset view
// @object tree render segment_tree with range(1,n)
// @endpreset
// @preset pointer_view
// @object tree render segment_tree with range(1,n)
// @pointer now at tree
// @endpreset
void build(int now,int l,int r){          // 葉子存輸入，父節點存區間和
    // @frame use pointer_view
    // @style tree[now] highlight
    // @text "由上而下分裂：節點 ${now} 代表 [${l},${r}]" at tree.top offset(0,-20)
    if(l==r){                             // 單一元素，不再分裂
        tree[now]=values[l];
        // @frame use pointer_view
        // @style tree[now] highlight
        // @text "到達葉節點，填入 values[${l}] = ${values[l]}" at tree.top offset(0,-20)
        return;
    }
    int mid=(l+r)/2;
    build(now*2,l,mid);
    build(now*2+1,mid+1,r);
    tree[now]=tree[now*2]+tree[now*2+1];  // 由左右孩子重算父節點
    // @frame use pointer_view
    // @style tree[now] highlight
    // @text "回溯相加：${tree[now*2]} + ${tree[now*2+1]} = ${tree[now]}" at tree.top offset(0,-20)
}
int main(){
    cin>>n;
    values.assign(n+1,0); tree.assign(4*n+5,0);
    for(int i=1;i<=n;i++) cin>>values[i];
    build(1,1,n);
    cout<<tree[1]<<endl;
    // @frame use view
    // @text "建樹完成，根節點總和 ${tree[1]}" at tree.top offset(0,-20)
}


/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "codePanelFontSize": 14,
    "eventInstructionStates": {
      "function-enter:build:void build(int now,int l,int r){ // @frame use view // @style tree[now] highlight,point // @text \"由上而下分裂：節點 ${now} 代表 [${l},${r}]\" at tree.top offset(0,-20) if(l==r){ tree[now]=values[l]; // @frame use view // @style tree[now] highlight // ": false,
      "call:build:build(now*2,l,mid)": true,
      "call:build:build(now*2+1,mid+1,r)": true,
      "assign:build:tree[now]=values[l]": false
    },
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
