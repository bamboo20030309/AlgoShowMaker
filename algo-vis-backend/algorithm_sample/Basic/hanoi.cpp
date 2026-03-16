#include "AV.hpp"
#include <bits/stdc++.h>

using namespace std;

int N;
//draw{
AV av;
TreeLayout tree(2, Pos(500, 450), 10, 80.0, 220.0);
map<string, deque<int>> pegs;
vector<string> ans; // 儲存搬運記錄
bool show_intro = true;

void draw_all_pegs() {
  int base_x = -250;
  int base_y = 50;
  int rowH = 40;                   // 前端 index=0 → rowH = baseBoxSize(40)
  int floor_y = base_y + N * rowH; // 所有柱子的底部對齊線

  auto draw_single_peg = [&](string peg_key, int x) {
    int k = pegs[peg_key].size();
    int y_start = floor_y - (max(1, k) * rowH);
    //                                    itemsPerRow=1, index=1
    av.frame_draw("Peg_" + peg_key, Pos(x, y_start),
                  vector<int>(pegs[peg_key].begin(), pegs[peg_key].end()), {},
                  {0}, "normal", 1);
  };

  draw_single_peg("A", base_x);
  draw_single_peg("B", base_x + 150);
  draw_single_peg("C", base_x + 300);
}

//}

void hanoi(int n, string from, string to, string aux) {
  if (n == 0) {
    //draw{
    av.start_frame_draw();
    av.addEditorHighlight(66);
    tree.redraw(av);
    av.accu_draw();
    draw_all_pegs();
    if (tree.nodes.count({N - 1, 0})) {
      av.frame_draw("ans",Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),ans, {}, {0}, "normal", 1);
    }
    
    int pd = tree.curr_d;
    int po = tree.curr_o;
    string pnid = tree.get_id(pd, po);
    string state = "0," + from + "→" + to;
    
    Pos n0_pos = Pos(pnid, "top right", 50, 0);
    vector<array_style> style = { {{"background-color", "#ffebee"}, {0}} };
    av.frame_draw("temp_n0", n0_pos, vector<string>{state}, style);
    
    // 拉過去的箭頭 (左偏 15)
    av.arrow(Pos(pnid, "right", 0, -15), Pos("temp_n0", "left", 0, -15), {{"color", "black"}, {"width", "2"}});
    // 拉回來的箭頭 (右偏 15)
    av.arrow(Pos("temp_n0", "left", 0, 15), Pos(pnid, "right", 0, 15), {{"color", "black"}, {"width", "2"}});
    
    av.text("{基礎情況 }n=0：沒有盤子可搬動，直接返回", Pos("tree_0_0", "top", 0, -100));
    av.auto_camera();
    av.end_frame_draw();
    //}
    return;
  }
  //draw{
  int d = tree.curr_d;
  int o = tree.curr_o;
  string nid = tree.get_id(d, o);
  string state = to_string(n) + "," + from + "→" + to;

  if (show_intro) {
    show_intro = false;
    tree.paint(av, state, -1, [&] {
      draw_all_pegs();
      if (tree.nodes.count({N - 1, 0})) {
        av.frame_draw(
            "ans", Pos("tree_" + to_string(N - 1) + "_0", "top right", 50, 0),
            ans, {}, {0}, "normal", 1);
      }
      av.text("河內塔遞迴的核心概念\n"
              "1. 移花：{移動底盤以上的盤子到中間}\n"
              "{2. 搬動底盤：移動底盤到右邊}\n"
              "{3. 接木：移動中間的盤子回到右邊}",
              Pos("tree_0_0", "top", 0, -120));
      av.auto_camera();
    });

    // 模擬移花
    deque<int> top_disks;
    for (int i = 0; i < N - 1; i++) {
      top_disks.push_back(pegs[from].front());
      pegs[from].pop_front();
    }
    for (int i = N - 2; i >= 0; i--) {
      pegs[aux].push_front(top_disks[i]);
    }

    tree.paint(av, state, -1, [&] {
      draw_all_pegs();
      if (tree.nodes.count({N - 1, 0})) {
        av.frame_draw(
            "ans", Pos("tree_" + to_string(N - 1) + "_0", "top right", 50, 0),
            ans, {}, {0}, "normal", 1);
      }
      av.text("{河內塔遞迴的核心概念}\n"
              "{1. 移花：}移動底盤以上的盤子到中間\n"
              "2. 搬動底盤：{移動底盤到右邊}\n"
              "{3. 接木：移動中間的盤子回到右邊}",
              Pos("tree_0_0", "top", 0, -120));
      av.auto_camera();
    });

    // 模擬搬動底盤
    int bottom_disk = pegs[from].front();
    pegs[from].pop_front();
    pegs[to].push_front(bottom_disk);

    tree.paint(av, state, -1, [&] {
      draw_all_pegs();
      if (tree.nodes.count({N - 1, 0})) {
        av.frame_draw(
            "ans", Pos("tree_" + to_string(N - 1) + "_0", "top right", 50, 0),
            ans, {}, {0}, "normal", 1);
      }
      av.text("{河內塔遞迴的核心概念}\n"
              "{1. 移花：移動底盤以上的盤子到中間}\n"
              "{2. 搬動底盤：}移動底盤到右邊\n"
              "3. 接木：{移動中間的盤子回到右邊}",
              Pos("tree_0_0", "top", 0, -120));
      av.auto_camera();
    });

    // 模擬接木
    for (int i = 0; i < N - 1; i++)
      pegs[aux].pop_front();
    for (int i = N - 2; i >= 0; i--)
      pegs[to].push_front(top_disks[i]);

    tree.paint(av, state, -1, [&] {
      draw_all_pegs();
      if (tree.nodes.count({N - 1, 0})) {
        av.frame_draw(
            "ans", Pos("tree_" + to_string(N - 1) + "_0", "top right", 50, 0),
            ans, {}, {0}, "normal", 1);
      }
      av.text("{河內塔遞迴的核心概念}\n"
              "{1. 移花：移動底盤以上的盤子到中間}\n"
              "{2. 搬動底盤：移動底盤到右邊}\n"
              "{3. 接木：}移動中間的盤子回到右邊",
              Pos("tree_0_0", "top", 0, -120));
      av.auto_camera();
    });

    // 復原現場以供正式遞迴使用
    pegs[to].clear();
    pegs[aux].clear();
    pegs[from].clear();
    for (int i = 1; i <= N; i++)
      pegs[from].push_back(i);
  }
  
  tree.paint(av, state, -1, [&] {
    av.addEditorHighlight(68);
    draw_all_pegs();
    if (tree.nodes.count({N - 1, 0})) {
      av.frame_draw("ans",Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),ans, {}, {0}, "normal", 1);
    }
    av.text("解問題：\n將 " + to_string(n) + " 個盤子從 " + from + " 搬到 " +
                to + "\n(透過 " + aux + " 作為輔助柱子)",
            Pos("tree_0_0", "top", 0, -100));
    av.auto_camera();
  });
  string cid1;
  if (n - 1 > 0) {
    tree.push(0);
    cid1 = tree.get_id(tree.curr_d, tree.curr_o);
    tree.nodes.insert({tree.curr_d, tree.curr_o}); // 先行註冊節點，確保箭頭錨點抓得到座標
    string next_state = to_string(n - 1) + "," + from + "→" + aux;
    tree.vals[{tree.curr_d, tree.curr_o}] = next_state; // 預先設定子節點文字
    tree.update_layout();

    // 儲存往下的箭頭 (上偏 15，黑色，細度 2)
    av.accu_store_arrow(Pos(nid, "right", 0, -15), Pos(cid1, "left", 0, -15),
                        {{"color", "black"}, {"width", "2"}});
  }

  av.start_frame_draw();
  av.addEditorHighlight(206);
  tree.redraw(av); // 必須先 redraw 產生節點 DOM
  av.accu_draw();  // 才畫得出依附在節點上的箭頭
  draw_all_pegs();
  if (tree.nodes.count({N - 1, 0})) {
    av.frame_draw("ans",
                  Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),
                  ans, {}, {0}, "normal", 1);
  }
  av.text("{移花}：\n為了移動上面的 " + to_string(n - 1) + " 個盤子到 " + aux +
              "，\n所以呼叫小弟來幫忙計算",
          Pos("tree_0_0", "top", 0, -100));
  av.auto_camera();
  av.end_frame_draw();
  //}
  hanoi(n-1, from, aux, to);
  //draw{
  //  從第一步返回：儲存往上的箭頭 (下偏 15，黑色，細度 2)
  if (n - 1 > 0) {
    av.accu_store_arrow(Pos(cid1, "left", 0, 15), Pos(nid, "right", 0, 15),
                        {{"color", "black"}, {"width", "2"}});
  }

  av.start_frame_draw();
  av.addEditorHighlight(207);
  tree.redraw(av);
  av.accu_draw();
  draw_all_pegs();
  if (tree.nodes.count({N - 1, 0})) {
    av.frame_draw("ans",
                  Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),
                  ans, {}, {0}, "normal", 1);
  }
  av.text("小弟計算完成，將搬動 " + to_string(n - 1) + " 個盤子的結果回傳給大哥",
          Pos("tree_0_0", "top", 0, -100));
  av.auto_camera();
  av.end_frame_draw();
  if (n - 1 > 0) tree.pop();

  
  int disk = pegs[from].front();
  tree.paint(av, state, -1, [&] {
    av.addEditorHighlight(249);
    draw_all_pegs();
    if (tree.nodes.count({N - 1, 0})) {
      av.frame_draw("ans",
                    Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),
                    ans, {}, {0}, "normal", 1);
    }
    av.text("{搬動底盤}：\n上面盤子都移開了，最底下的盤子 " + to_string(disk) +
                " 自由了！\n從 " + from + " 移至最終目標 " + to,
            Pos("tree_0_0", "top", 0, -100));
    av.auto_camera();
  });
  pegs[from].pop_front();
  pegs[to].push_front(disk);
  ans.push_back(from + " → " + to);
  //}
  cout<<from<<" -> "<<to<<endl;
  //draw{
  string cid2;
  if (n - 1 > 0) {
    tree.push(1);
    cid2 = tree.get_id(tree.curr_d, tree.curr_o);
    tree.nodes.insert({tree.curr_d, tree.curr_o});
    string next_state = to_string(n - 1) + "," + aux + "→" + to;
    tree.vals[{tree.curr_d, tree.curr_o}] = next_state; // 預先設定子節點文字
    tree.update_layout();

    // 儲存往下的箭頭 (上偏 15，黑色，細度 2)
    av.accu_store_arrow(Pos(nid, "right", 0, -15), Pos(cid2, "left", 0, -15),
                        {{"color", "black"}, {"width", "2"}});
  }

  av.start_frame_draw();
  av.addEditorHighlight(281);
  tree.redraw(av);
  av.accu_draw();
  draw_all_pegs();
  if (tree.nodes.count({N - 1, 0})) {
    av.frame_draw("ans",
                  Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),
                  ans, {}, {0}, "normal", 1);
  }
  av.text("{接木}：\n底盤已經移過去，現在要把剛才移走的 " + to_string(n - 1) +
              " 個盤子，\n從暫存的 " + aux + " 搬回目標 " + to + "...",
          Pos("tree_0_0", "top", 0, -100));
  av.auto_camera();
  av.end_frame_draw();
  //}
  hanoi(n-1, aux, to, from);
  //draw{
  //  從第三步返回：儲存往上的箭頭 (下偏 15，黑色，細度 2)
  if (n - 1 > 0) {
    av.accu_store_arrow(Pos(cid2, "left", 0, 15), Pos(nid, "right", 0, 15),
                        {{"color", "black"}, {"width", "2"}});
  }

  av.start_frame_draw();
  av.addEditorHighlight(282);
  tree.redraw(av);
  av.accu_draw();
  draw_all_pegs();
  if (tree.nodes.count({N - 1, 0})) {
    av.frame_draw("ans",
                  Pos("tree_" + to_string(N-1) + "_0", "top right", 150, 0),
                  ans, {}, {0}, "normal", 1);
  }
  av.text("已將 " + aux + " 暫存的盤子搬到目標，回傳給大哥。",
          Pos("tree_0_0", "top", 0, -100));
  av.auto_camera();
  av.end_frame_draw();
  if (n - 1 > 0) tree.pop();
  //}
}

int main() {
  //draw{
  tree.renderer = [](string id, Pos p, int d, int o, bool is_focus) {
    string val = tree.vals[{d, o}];
    bool is_done = (tree.edge_colors[{d, o}] == "black");
    vector<array_style> style;
    if (is_done)
      style.push_back({{"background-color", "#e3f2fd"}, {0}});
    av.frame_draw(id, p, vector<string>{val}, style);
  };
  //}
  N = 3;
  //draw{
  tree.horizontal = true;
  tree.root_pos = Pos(100, 100 + N * 85); // 隨著 N 動態向下調整
  tree.show_edges = false; // 關閉預設的連線，讓自訂的進出箭頭不受干擾
  for (int i = 1; i <= N; i++)
    pegs["A"].push_back(i);
  av.start_draw();
  //}
  hanoi(N, "A", "C", "B");
  //draw{
  //  修正總結影格：同樣要先 redraw 再 accu_draw
  av.start_frame_draw();
  tree.redraw(av); // 先產生節點
  av.accu_draw();  // 才畫得出所有歷史箭頭
  draw_all_pegs();
  if (tree.nodes.count({N - 1, 0})) {
    av.frame_draw("ans",
                  Pos("tree_" + to_string(N-1) + "_0", "top right", 50, 0),
                  ans, {}, {0}, "normal", 1);
  }
  av.auto_camera();
  av.text("所有步驟執行完畢，河內塔搬運成功", Pos("tree_0_0", "top", 0, -100));
  av.end_frame_draw();
  av.end_draw();
  //}

  return 0;
}
