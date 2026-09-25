#include <bits/stdc++.h>
using namespace std;

int N;
map<string, deque<int>> pegs;
vector<string> ans; // 儲存搬運記錄

// 三根柱子直接引用原本 pegs 內的資料，不另外維護顯示狀態。
deque<int>& Peg_A = pegs["A"];
deque<int>& Peg_B = pegs["B"];
deque<int>& Peg_C = pegs["C"];

// 左側由上到下放置三個 disk，遞迴樹從右側往右生長。
// @layout recursion as "hanoi_tree" at canvas.left offset(360,310)
// @layout hanoi_tree direction left-right
// @layout hanoi_tree mode compact
// @layout hanoi_tree sibling-gap 32
// @layout hanoi_tree level-gap 88
// @layout hanoi_tree degree 2
// @layout hanoi_tree flow-arrows on

// @defaults
// @camera auto
// @enddefaults

void hanoi(int n, string from, string to, string aux) {
  if(n==0)return;

  string state = to_string(n) + "," + from + "→" + to;
  // @keep state as "H" in hanoi_tree
  // @frame state in hanoi_tree
  // @object Peg_A render disk
  // @object Peg_B render disk
  // @object Peg_C render disk
  // @place Peg_A.top-left at canvas.top-left offset(70,60)
  // @place Peg_B.top-left at Peg_A.bottom-left offset(0,36)
  // @place Peg_C.top-left at Peg_B.bottom-left offset(0,36)
  // @text "處理 ${state}" at state.top

  hanoi(n-1, from, aux, to);

  int disk = pegs[from].front();
  // @frame state in hanoi_tree
  // @object Peg_A render disk
  // @object Peg_B render disk
  // @object Peg_C render disk
  // @place Peg_A.top-left at canvas.top-left offset(70,60)
  // @place Peg_B.top-left at Peg_A.bottom-left offset(0,36)
  // @place Peg_C.top-left at Peg_B.bottom-left offset(0,36)
  // @text "準備搬動盤子 ${disk}：${from} → ${to}" at state.top

  pegs[from].pop_front();
  pegs[to].push_front(disk);
  ans.push_back(from + " → " + to);
  cout<<from<<" -> "<<to<<endl;

  // @frame state in hanoi_tree
  // @object Peg_A render disk
  // @object Peg_B render disk
  // @object Peg_C render disk
  // @place Peg_A.top-left at canvas.top-left offset(70,60)
  // @place Peg_B.top-left at Peg_A.bottom-left offset(0,36)
  // @place Peg_C.top-left at Peg_B.bottom-left offset(0,36)
  // @text "盤子 ${disk} 已移到 ${to}" at state.top

  hanoi(n-1, aux, to, from);
}
int main() {
  N=4; cin>>N;
  for (int i = 1; i <= N; i++)
    pegs["A"].push_back(i);

  // @frame
  // @object Peg_A render disk
  // @object Peg_B render disk
  // @object Peg_C render disk
  // @place Peg_A.top-left at canvas.top-left offset(70,60)
  // @place Peg_B.top-left at Peg_A.bottom-left offset(0,36)
  // @place Peg_C.top-left at Peg_B.bottom-left offset(0,36)
  // @text "這是河內塔的遞迴範例" at canvas.top offset(0,20)

  hanoi(N, "A", "C", "B");

  // @frame
  // @object Peg_A render disk
  // @object Peg_B render disk
  // @object Peg_C render disk
  // @place Peg_A.top-left at canvas.top-left offset(70,60)
  // @place Peg_B.top-left at Peg_A.bottom-left offset(0,36)
  // @place Peg_C.top-left at Peg_B.bottom-left offset(0,36)
  // @text "所有步驟執行完畢，河內塔搬運成功" at canvas.top offset(0,20)

  return 0;
}
