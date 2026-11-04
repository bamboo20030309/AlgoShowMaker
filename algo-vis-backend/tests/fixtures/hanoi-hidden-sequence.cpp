#include <bits/stdc++.h>
using namespace std;

int N;
// @code hide
map<string, deque<int>> pegs;
vector<string> ans; // 儲存搬運記錄

// 三根柱子直接引用原本 pegs 內的資料，不另外維護顯示狀態。
deque<int>& Peg_A = pegs["A"];
deque<int>& Peg_B = pegs["B"];
deque<int>& Peg_C = pegs["C"];
// @endcode

// 左側由上到下放置三個 disk，遞迴樹從右側往右生長。
// `at` 的位置就是根節點朝向父層的錨點；向右生長時為根節點 center.left。
// @layout recursion as "hanoi_tree" at canvas.left offset(360,100)
// @layout hanoi_tree direction left-right
// @layout hanoi_tree level-gap 88
// @layout hanoi_tree degree 3
// @layout hanoi_tree background AV_opaque_red

// @preset hanoi_scene_view
// @object Peg_A, Peg_B, Peg_C render disk with capacity(N)
// @object ans render normal with columns(1), gap(0,68)
// @place Peg_A.top-left at canvas.top-left offset(70,60)
// @place Peg_B.top-left at Peg_A.bottom-left offset(0,36)
// @place Peg_C.top-left at Peg_B.bottom-left offset(0,36)
// @place ans.top-left at hanoi_tree.top-right offset(150,0)
// @endpreset

// 實際執行與 Move 預覽直接使用目前 n；移花／接木預覽的 n 屬於子節點，因此使用 n+1。
// @preset active_disks_view
// @style Peg_A, Peg_B, Peg_C background AV_opaque_red when value < n && (!recursion_preview || recursion_branch == 1)
// @style Peg_A, Peg_B, Peg_C background AV_opaque_green when value == n && (!recursion_preview || recursion_branch == 1)
// @style Peg_A, Peg_B, Peg_C background AV_opaque_red when value < n+1 && recursion_preview && recursion_branch != 1
// @style Peg_A, Peg_B, Peg_C background AV_opaque_green when value == n+1 && recursion_preview && recursion_branch != 1
// @endpreset

// @preset hanoi_node_view
// @let state = n
// @object state in hanoi_tree with display("${n},${from}→${to}")
// @endpreset

// @preset current_node_view
// @style state[0] highlight
// @style state[0] point
// @endpreset

// @preset move_node_view
// @let state = n
// @object state in hanoi_tree with display("1, ${from}→${to}")
// @style state background AV_opaque_green
// @endpreset

// 三個根分支共用同一段說明，文字只需維護一次。
// @preset core_preview_text
// @text [{"text":"河內塔遞迴的核心概念\n1. 移花："},{"text":"移動底盤以上的盤子","background":"AV_opaque_red","color":"black"},{"text":" 到中間\n2. 搬動底盤：移動底盤到右邊\n3. 接木：移動中間的盤子回到右邊"}] at recursion_parent.top offset(0,-20) when recursion_preview && recursion_depth == 1 && recursion_branch == 0 && n > 1
// @text [{"text":"河內塔遞迴的核心概念\n1. 移花：移動底盤以上的盤子到中間\n2. 搬動底盤："},{"text":"移動底盤","background":"AV_opaque_green","color":"black"},{"text":" 到右邊\n3. 接木：移動中間的盤子回到右邊"}] at recursion_parent.top offset(0,-20) when recursion_preview && recursion_depth == 1 && recursion_branch == 1 && n > 1
// @text [{"text":"河內塔遞迴的核心概念\n1. 移花：移動底盤以上的盤子到中間\n2. 搬動底盤：移動底盤到右邊\n3. 接木："},{"text":"移動中間的盤子","background":"AV_opaque_red","color":"black"},{"text":" 回到右邊"}] at recursion_parent.top offset(0,-20) when recursion_preview && recursion_depth == 1 && recursion_branch == 2 && n > 1
// @endpreset

void hanoi(int n, string from, string to, string aux) {
  if(n==0)return;

  // @frame use hanoi_node_view, hanoi_scene_view when n == N
  // @text "這是河內塔的遞迴範例" at state.top offset(0,-20)
  // @keep state as "H" in hanoi_tree
  // @frame use hanoi_node_view, current_node_view, hanoi_scene_view, active_disks_view, core_preview_text
  // @let count = n
  // @text "現在要處理將 ${count} 個盤子從 ${from} 移到 ${to}" at state.top offset(0,-20) when !recursion_preview
  // @text [{"text":"為了解決 n=${count+1} 的問題\n1. 移花："},{"text":"移動上面 ${count} 個盤子","background":"AV_opaque_red","color":"black"}] at recursion_parent.top offset(0,-20) when recursion_preview && recursion_depth > 1 && recursion_branch == 0
  // @text [{"text":"最後\n3. 接木："},{"text":"將上面 ${count} 個盤子歸位","background":"AV_opaque_red","color":"black"}] at recursion_parent.top offset(0,-20) when recursion_preview && recursion_depth > 1 && recursion_branch == 2

  // 三個系統分支預覽播完後，回到目前真實盤面且取消盤子著色。
  // @frame use hanoi_node_view, current_node_view, hanoi_scene_view when n > 1
  // @let count = n - 1
  // @text "交給小弟處理剩餘搬運" at state.top offset(0,-20) when count == 1
  // @text "由於沒辦法直接搬 ${count} 個盤子，\n所以交給小弟處理" at state.top offset(0,-20) when count > 1

  hanoi(n-1, from, aux, to);

  // @branch as "Move" in hanoi_tree
  // @frame use move_node_view, current_node_view, hanoi_scene_view, active_disks_view, core_preview_text
  // @let disk = n
  // @text "直接搬過去" at recursion_parent.top offset(0,-20) when recursion_preview && disk == 1
  // @text "直接搬過去" at state.top offset(0,-20) when !recursion_preview && disk == 1
  // @text [{"text":"接下來\n2. 搬動底盤："},{"text":"移動底盤到目標","background":"AV_opaque_green","color":"black"}] at recursion_parent.top offset(0,-20) when recursion_preview && recursion_depth > 1 && disk > 1
  // @text [{"text":"接下來\n2. 搬動底盤："},{"text":"移動底盤到目標","background":"AV_opaque_green","color":"black"}] at state.top offset(0,-20) when !recursion_preview && recursion_depth > 1 && disk > 1

  // @code hide
  pegs[to].push_front(pegs[from].front());
  pegs[from].pop_front();
  ans.push_back(from + " → " + to);
  // @endcode
  cout<<from<<" -> "<<to<<endl;

  // @frame use move_node_view, current_node_view, hanoi_scene_view, active_disks_view
  // @let move_index = ans.size() - 1
  // @arrow from state[0].right to ans[move_index].left color rgba(128,128,128,0.5) width 4 dash 10,5
  // @endbranch

  hanoi(n-1, aux, to, from);
}
int main() {
  N=4; cin>>N;
  // @code hide
  for (int i = 1; i <= N; i++)
    pegs["A"].push_back(i);
  // @endcode

  hanoi(N, "A", "C", "B");

  // @frame use hanoi_scene_view
  // @text "所有步驟執行完畢，河內塔搬運成功" at canvas.top offset(0,20)

  return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventSettings": {
      "autoFixedEnabled": true,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
