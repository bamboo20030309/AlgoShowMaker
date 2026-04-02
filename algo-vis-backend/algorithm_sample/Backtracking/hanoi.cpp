#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

int N;
//draw{
AV av;
TreeLayout tree("tree", 3, Pos(500, 500), 80.0, 220.0);
map<string, deque<int>> pegs;
vector<string> ans; // 儲存搬運記錄
map<pair<int, int>, string> custom_colors;
vector<pair<string, int>> _draw_ans_links; // 紀錄樹節點與答案的連結

void draw_ans_and_links() {
  if (!tree.nodes.count({N - 1, 0})) return;
  // 統一使用 150,0 作為 base position，並設定 gap 為 40
  Pos ans_pos = Pos("tree_" + to_string(N - 1) + "_0", "top right", 150, 0);
  av.frame_draw("ans", ans_pos, ans, {}, {0}, "normal",1 , 0, 40);
  
  for (auto const& link : _draw_ans_links) {
    av.arrow(Pos(link.first,0 , "right"), Pos("ans", link.second, "left"), {
      {"color", "rgba(128, 128, 128, 0.5)"},
      {"width", "4"},
      {"dash", "10,5"}
    });
  }
}

void draw_all_pegs(map<int, string> disk_colors = {}) {
  int base_x = -150;
  int base_y = 150;
  int rowH = 40;
  int pegGap = (N + 2) * rowH; // 柱子之間的垂直間距

  auto draw_single_peg = [&](string peg_key, int y_offset) {
    int k = pegs[peg_key].size();
    vector<int> data(pegs[peg_key].begin(), pegs[peg_key].end());
    
    vector<array_style> styles;
    map<string, vector<int>> color_groups;
    for(int i=0; i<data.size(); ++i) {
        if(disk_colors.count(data[i])) color_groups[disk_colors[data[i]]].push_back(i);
    }
    for(auto const& [color, indices] : color_groups) {
        styles.push_back({{"background", color}, indices});
    }

    int pegH = (N + 1) * rowH;
    int baseW = 40 + (N - 1) * 20 + 20; 
    styles.push_back({{"peg_height", to_string(pegH)}, {}});
    styles.push_back({{"base_width", to_string(baseW)}, {}});

    // 每一根柱子都有自己的 floor_y
    int local_floor_y = base_y + y_offset + pegH;
    av.frame_draw("Peg_" + peg_key, Pos(base_x, local_floor_y - pegH), data, styles, {0}, "disk", 1);
  };

  draw_single_peg("A", 0);
  draw_single_peg("B", pegGap);
  draw_single_peg("C", pegGap * 2);
}

//}

void hanoi(int n, string from, string to, string aux) {
  if(n==0)return;
  //draw{
  int d = tree.curr_d;
  int o = tree.curr_o;
  string nid = tree.get_id(d, o);
  string state = to_string(n) + "," + from + "→" + to;

  string disk_upper_color = "#ef9a9a";
  string bottom_color = "#a5d6a7";
  map<int, string> current_disk_colors;
  if(n > 1) {
    for (int i = 1; i < n; ++i) current_disk_colors[i] = disk_upper_color;
    current_disk_colors[n] = bottom_color;
  }

  if (n > 1) {
    tree.paint(av, state, -1, [&] {
      av.addEditorHighlight(50);
      draw_all_pegs(current_disk_colors);
      draw_ans_and_links();
      av.text("現在要處理將 " + to_string(n) + " 個盤子從 " + from + " 移到 " + to, Pos(nid, "top", 0, -70));
      av.auto_camera();
    });
  }

  if (n > 1) {
    auto backup_pegs = pegs;
    string cid0, cid1, cid2;

    // Step 1: Move n-1 disks
    tree.push(0); cid0 = tree.get_id(tree.curr_d, tree.curr_o); tree.nodes.insert({tree.curr_d, tree.curr_o}); tree.vals[{tree.curr_d, tree.curr_o}] = to_string(n - 1) + "," + from + "→" + aux; tree.pop();
    tree.update_layout();

    deque<int> top_disks;
    for (int i = 0; i < n - 1; i++) {
        if(!pegs[from].empty()){ top_disks.push_back(pegs[from].front()); pegs[from].pop_front(); }
    }
    for (int i = (int)top_disks.size() - 1; i >= 0; i--) {
        pegs[aux].push_front(top_disks[i]);
    }
    
    map<int, string> c1; 
    for(int i=1; i<n; ++i) c1[i] = disk_upper_color;
    c1[n] = bottom_color; // 補上底盤顏色
    custom_colors[{d+1, o*3+0}] = disk_upper_color;
    tree.paint(av, state, -1, [&] {
        av.addEditorHighlight(50);
        draw_all_pegs(c1);
        draw_ans_and_links();
        if (n == N) {
            av.colored_text({
                {"河內塔遞迴的核心概念\n", "", "", ""},
                {"1. 移花：", "", "", ""}, {"移動底盤以上的盤子", disk_upper_color, "black", ""}, {" 到中間\n", "", "", ""},
                {"{2. 搬動底盤：移動底盤到右邊}\n", "", "", ""},
                {"{3. 接木：移動中間的盤子回到右邊}", "", "", ""}
            }, Pos(nid, "top", 0, -130));
        } else {
            av.colored_text({
                {"為了解決 n=" + to_string(n) + " 的問題\n", "", "", ""},
                {"{1. 移花：}", "", "", ""}, {"移動上面 " + to_string(n-1) + " 個盤子", disk_upper_color, "black", ""}
            }, Pos(nid, "top", 0, -90));
        }
        av.auto_camera();
    });

    // Step 2: Move bottom disk
    tree.push(1); cid1 = tree.get_id(tree.curr_d, tree.curr_o); tree.nodes.insert({tree.curr_d, tree.curr_o}); tree.vals[{tree.curr_d, tree.curr_o}] = "1," + from + "→" + to; tree.pop();
    tree.update_layout();

    int bottom_disk = -1;
    if(!pegs[from].empty()){
        bottom_disk = pegs[from].front(); pegs[from].pop_front(); pegs[to].push_front(bottom_disk);
    }
    
    map<int, string> c2; 
    for(int i=1; i<n; ++i) c2[i] = disk_upper_color; // 維持上方的色彩
    c2[n] = bottom_color;                      // 底盤綠色
    custom_colors[{d+1, o*3+1}] = bottom_color;
    tree.paint(av, state, -1, [&] {
        av.addEditorHighlight(50);
        draw_all_pegs(c2);
        draw_ans_and_links();
        if (n == N) {
            av.colored_text({
                {"{河內塔遞迴的核心概念}\n", "", "", ""},
                {"{1. 移花：移動底盤以上的盤子到中間}\n", "", "", ""},
                {"2. 搬動底盤：", "", "", ""}, {"移動底盤", bottom_color, "black", ""}, {" 到右邊\n", "", "", ""},
                {"{3. 接木：移動中間的盤子回到右邊}", "", "", ""}
            }, Pos(nid, "top", 0, -130));
        } else {
            av.colored_text({
                {"接下來\n", "", "", ""},
                {"{2. 搬動底盤：}", "", "", ""}, {"移動底盤到目標", bottom_color, "black", ""}
            }, Pos(nid, "top", 0, -90));
        }
        av.auto_camera();
    });

    // Step 3: Move n-1 disks to target
    tree.push(2); cid2 = tree.get_id(tree.curr_d, tree.curr_o); tree.nodes.insert({tree.curr_d, tree.curr_o}); tree.vals[{tree.curr_d, tree.curr_o}] = to_string(n - 1) + "," + aux + "→" + to; tree.pop();
    tree.update_layout();

    for (int i = 0; i < (int)top_disks.size(); i++) {
        if(!pegs[aux].empty()) pegs[aux].pop_front();
    }
    for (int i = (int)top_disks.size() - 1; i >= 0; i--) {
        pegs[to].push_front(top_disks[i]);
    }
    
    map<int, string> c3; 
    for(int i=1; i<n; ++i) c3[i] = disk_upper_color; // 移花盤子改回紅色準備接木
    c3[n] = bottom_color;                      // 底盤維持綠色
    custom_colors[{d+1, o*3+2}] = disk_upper_color;
    tree.paint(av, state, -1, [&] {
        av.addEditorHighlight(50);
        draw_all_pegs(c3);
        draw_ans_and_links();
        if (n == N) {
            av.colored_text({
                {"{河內塔遞迴的核心概念}\n", "", "", ""},
                {"{1. 移花：移動底盤以上的盤子到中間}\n", "", "", ""},
                {"{2. 搬動底盤：移動底盤到右邊}\n", "", "", ""},
                {"3. 接木：", "", "", ""}, {"移動中間的盤子", disk_upper_color, "black", ""}, {" 回到右邊", "", "", ""}
            }, Pos(nid, "top", 0, -130));
        } else {
            av.colored_text({
                {"最後\n", "", "", ""},
                {"{3. 接木：}", "", "", ""}, {"將上面 " + to_string(n-1) + " 個盤子歸位", disk_upper_color, "black", ""}
            }, Pos(nid, "top", 0, -90));
        }
        av.auto_camera();
    });

    tree.paint(av, state, -1, [&] {
        av.addEditorHighlight(204);
        av.addEditorHighlight(245);
        draw_all_pegs();
        draw_ans_and_links();
        if (n - 1 == 1) {
            av.text("交給小弟處理剩餘搬運", Pos(nid, "top", 0, -70));
        } else {
            av.text("由於沒辦法直接搬 " + to_string(n - 1) + " 個盤子，\n所以交給小弟處理", Pos(nid, "top", 0, -90));
        }
        av.auto_camera();
    });

    pegs = backup_pegs;
  }
  
  if (n > 1) {
    tree.push(0);
  //}
  hanoi(n-1, from, aux, to);
  //draw{
    tree.pop();

    // 搬底盤
    tree.push(1); // 聚焦到「搬底盤」子節點
    string step2_nid = tree.get_id(tree.curr_d, tree.curr_o);
    map<int, string> rc2; 
    for(int i=1; i<n; ++i) rc2[i] = disk_upper_color; // 搬底盤時，上方的盤子也要維持紅色
    rc2[n] = bottom_color; 
    int disk_base = pegs[from].front();
    av.start_frame_draw();
    tree.redraw(av); // 依照 push(1) 後的狀態重繪，子節點會被 highlight
    av.accu_draw();
    av.addEditorHighlight(241);
    draw_all_pegs(rc2);
    draw_ans_and_links();
    av.colored_text({
      {"{2. 搬動底盤}：\n上面盤子都移開了，將底盤 ", "", "", ""},
      {to_string(disk_base), "", "black", ""},
      {" 移至最終目標 " + to, "", "", ""}
    }, Pos(step2_nid, "top", 0, -90));
    av.auto_camera();
    av.end_frame_draw();
    pegs[from].pop_front();
    pegs[to].push_front(disk_base);
    ans.push_back(from + " → " + to);
    _draw_ans_links.push_back({step2_nid, (int)ans.size() - 1});
    av.start_frame_draw();
    tree.redraw(av);
    av.accu_draw();
    av.addEditorHighlight(241);
    draw_all_pegs(rc2); // 搬完後，維持著色
    draw_ans_and_links();
    av.auto_camera();
    av.end_frame_draw();
    tree.pop(); // 動作結束後恢復焦點
    //}
  cout<<from<<" -> "<<to<<endl;
  //draw{
    tree.push(2);
    //}
  hanoi(n-1, aux, to, from);
  //draw{
    tree.pop();
  } else {
    int disk = pegs[from].front();
    tree.paint(av, state, -1, [&] {
      av.addEditorHighlight(241);
      draw_all_pegs({ {disk, disk_upper_color}, {disk + 1, bottom_color} }); // 搬過去時顏色與假裝搬時一致
      draw_ans_and_links();
      av.text("直接搬過去", Pos(nid, "top", 0, -70));
      av.auto_camera();
    });
    pegs[from].pop_front();
    pegs[to].push_front(disk);
    ans.push_back(from + " → " + to);
    _draw_ans_links.push_back({nid, (int)ans.size() - 1});
    cout << from << " -> " << to << endl;
    tree.paint(av, state, -1, [&] {
      av.addEditorHighlight(241);
      draw_all_pegs({ {disk, disk_upper_color}, {disk + 1, bottom_color} }); // 搬完後，維持著色
      draw_ans_and_links();
      av.auto_camera();
    });
  }
  //}
}

int main() {
  //draw{
  tree.renderer = [](string id, Pos p, int d, int o, bool is_focus) {
    string val = tree.vals[{d, o}];
    bool is_done = (tree.edge_colors[{d, o}] == "black");
    vector<array_style> style;
    if (custom_colors.count({d, o})) {
      style.push_back({{"background", custom_colors[{d, o}]}, {0}});
    } else if (is_done) {
      style.push_back({{"background", "#90caf9"}, {0}});
    }
    if (is_focus) {
      style.push_back({{"highlight"}, {0}});
      style.push_back({{"point"}, {0}});
    }
    av.frame_draw(id, p, vector<string>{val}, style);
  };
  //}
  N=4; cin>>N;
  //draw{
  tree.horizontal = true;
  tree.root_pos = Pos(100, 100 + N * 85); // 隨著 N 動態向下調整
  tree.show_edges = true; // 開啟預設連線 (單圖單箭頭)
  custom_colors[{0, 0}] = "#ef9a9a"; // 根節點塗成紅色
  for (int i = 1; i <= N; i++)
    pegs["A"].push_back(i);
  av.start_draw();
  av.start_frame_draw();
  tree.nodes.insert({0, 0});
  tree.vals[{0, 0}] = to_string(N) + ",A→C";
  tree.redraw(av);
  av.accu_draw();
  draw_all_pegs();
  av.text("這是河內塔的遞迴範例", Pos("tree_0_0", "top", 0, -70));
  av.auto_camera();
  av.end_frame_draw();
  //}
  hanoi(N, "A", "C", "B");
  //draw{
  //  修正總結影格：同樣要先 redraw 再 accu_draw
  av.start_frame_draw();
  tree.redraw(av); // 先產生節點
  av.accu_draw();  // 才畫得出所有歷史箭頭
  draw_all_pegs();
  draw_ans_and_links();
  av.auto_camera();
  av.text("所有步驟執行完畢，河內塔搬運成功", Pos("tree_0_0", "top", 0, -70));
  av.end_frame_draw();
  av.end_draw();
  //}
  return 0;
}
