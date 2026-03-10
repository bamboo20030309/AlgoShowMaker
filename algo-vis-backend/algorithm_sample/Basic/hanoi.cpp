#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
TreeLayout tree(2, Pos(500, 450), 10, 120.0, 150.0);
map<string, deque<int>> pegs;
bool show_intro = true;
int N_DISKS = 4; // 全域盤子數量，用於計算佈局

void draw_all_pegs() {
    int base_y    = -100;
    int rowH      = 40; // 前端 index=0 → rowH = baseBoxSize(40)
    int floor_y   = base_y + N_DISKS * rowH;     // 所有柱子的底部對齊線
    
    auto draw_single_peg = [&](string peg_key, int x) {
        int k = pegs[peg_key].size();
        int y_start = floor_y - (max(1, k) * rowH);
        //                                    itemsPerRow=1, index=1
        av.frame_draw("Peg_" + peg_key, Pos(x, y_start), vector<int>(pegs[peg_key].begin(), pegs[peg_key].end()), {}, {0}, "normal", 1);
    };

    draw_single_peg("A", 250);
    draw_single_peg("B", 500);
    draw_single_peg("C", 750);
}

//}

void hanoi(int n, string from, string to, string aux) {
    //draw{
    int d = tree.curr_d;
    int o = tree.curr_o;
    string nid = tree.get_id(d, o);
    string state = to_string(n) + "," + from + "→" + to;

    if (show_intro) {
        show_intro = false;
        tree.paint(av, state, -1, [&]{
            draw_all_pegs();
            av.auto_camera();
            av.text("河內塔遞迴的核心概念：\n1. 移花 (移動底盤以上的盤子到中間)\n2. 搬動底盤 (移動底盤到右邊)\n3. 接木 (移動中間的盤子回到右邊)", Pos("tree_0_0", "top", 0, -110));
        });
    }
    //}

    if (n == 1) {
        //draw{
        int disk = pegs[from].front();
        pegs[from].pop_front();
        pegs[to].push_front(disk);

        tree.paint(av, state, -1, [&]{
            draw_all_pegs();
            av.auto_camera();
            av.text("{基礎情況}：n=1\n只有一個盤子，不需要找輔助位，\n直接從 " + from + " 搬到 " + to + "！", Pos("tree_0_0", "top", 0, -90));
        });
        tree.edge_colors[{d, o}] = "black";
        //}
        return;
    }

    //draw{
    tree.paint(av, state, -1, [&]{
        draw_all_pegs();
        av.auto_camera();
        av.text("解問題：\n將 " + to_string(n) + " 個盤子從 " + from + " 搬到 " + to + "\n(透過 " + aux + " 作為輔助柱子)", Pos("tree_0_0", "top", 0, -90));
    });
    //}

    // 第一步：處理上面的 n-1 個障礙
    //draw{
    tree.push(0); 
    string cid1 = tree.get_id(tree.curr_d, tree.curr_o);
    tree.nodes.insert({tree.curr_d, tree.curr_o}); // 先行註冊節點，確保箭頭錨點抓得到座標
    string next_state = to_string(n-1) + "," + from + "→" + aux;
    tree.vals[{tree.curr_d, tree.curr_o}] = next_state; // 預先設定子節點文字
    tree.update_layout();
    
    // 儲存往下的箭頭 (左偏 15，黑色，細度 2)
    av.accu_store_arrow(Pos(nid, "bottom", -15, 0), Pos(cid1, "top", -15, 0), {{"color", "black"}, {"width", "2"}});

    av.start_frame_draw();
    tree.redraw(av);    // 必須先 redraw 產生節點 DOM
    av.accu_draw();     // 才畫得出依附在節點上的箭頭
    draw_all_pegs();
    av.auto_camera();
    av.text("{移花}：\n為了移動上面的 " + to_string(n-1) + " 個盤子到 " + aux + "，\n又必須去遞迴計算它的移動過程...", Pos("tree_0_0", "top", 0, -90));
    av.end_frame_draw();
    //}

    hanoi(n - 1, from, aux, to);

    //draw{
    // 從第一步返回：儲存往上的箭頭 (右偏 15，黑色，細度 2)
    av.accu_store_arrow(Pos(cid1, "top", 15, 0), Pos(nid, "bottom", 15, 0), {{"color", "black"}, {"width", "2"}});

    av.start_frame_draw();
    tree.redraw(av);
    av.accu_draw();
    draw_all_pegs();
    av.auto_camera();
    av.text("已完成上面 " + to_string(n-1) + " 個盤子的移花步驟，返回主層級。", Pos("tree_0_0", "top", 0, -90));
    av.end_frame_draw();
    tree.pop();
    //}

    // 第二步：搬動最底下的那個
    //draw{
    int disk = pegs[from].front();
    pegs[from].pop_front();
    pegs[to].push_front(disk);

    tree.paint(av, state, -1, [&]{
        draw_all_pegs();
        av.auto_camera();
        av.text("搬動底盤：\n上面盤子都移開了，最底下的盤子 " + to_string(disk) + " 自由了！\n從 " + from + " 移至最終目標 " + to, Pos("tree_0_0", "top", 0, -90));
    });
    //}

    // 第三步：搬回剛才暫存的盤子
    //draw{
    tree.push(1);
    string cid2 = tree.get_id(tree.curr_d, tree.curr_o);
    tree.nodes.insert({tree.curr_d, tree.curr_o});
    next_state = to_string(n-1) + "," + aux + "→" + to;
    tree.vals[{tree.curr_d, tree.curr_o}] = next_state; // 預先設定子節點文字
    tree.update_layout();

    // 儲存往下的箭頭 (左偏 15，黑色，細度 2)
    av.accu_store_arrow(Pos(nid, "bottom", -15, 0), Pos(cid2, "top", -15, 0), {{"color", "black"}, {"width", "2"}});

    av.start_frame_draw();
    tree.redraw(av);
    av.accu_draw();
    draw_all_pegs();
    av.auto_camera();
    av.text("{接木}：\n底盤已歸位，現在要把剛才遞迴移走的 " + to_string(n-1) + " 個盤子，\n從暫存的 " + aux + " 搬回目標 " + to + "...", Pos("tree_0_0", "top", 0, -90));
    av.end_frame_draw();
    //}

    hanoi(n - 1, aux, to, from);

    //draw{
    // 從第三步返回：儲存往上的箭頭 (右偏 15，黑色，細度 2)
    av.accu_store_arrow(Pos(cid2, "top", 15, 0), Pos(nid, "bottom", 15, 0), {{"color", "black"}, {"width", "2"}});

    av.start_frame_draw();
    tree.redraw(av);
    av.accu_draw();
    draw_all_pegs();
    av.auto_camera();
    av.text("已將 " + aux + " 暫存的盤子接木完成，返回主層級。", Pos("tree_0_0", "top", 0, -90));
    av.end_frame_draw();
    tree.pop();
    //}

    //draw{
    tree.edge_colors[{d, o}] = "black";
    tree.paint(av, state, -1, [&]{ 
        draw_all_pegs(); 
        av.auto_camera();
        av.text("問題解畢：\n" + to_string(n) + " 個盤子的搬運進度已全部完成，返回上層。", Pos("tree_0_0", "top", 0, -70));
    });
    //}
}

int main() {
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool is_focus) {
        string val = tree.vals[{d, o}];
        bool is_done = (tree.edge_colors[{d, o}] == "black");
        vector<array_style> style;
        if (is_done) style.push_back({ {"background-color", "#e3f2fd"}, {0} });
        av.frame_draw(id, p, vector<string>{val}, style); 
    };
    //}

    N_DISKS = 4;
    tree.root_pos = Pos(500, -50 + N_DISKS * 40 + 150); // 同步基準點位
    tree.show_edges = false; // 關閉預設的連線，讓自訂的進出箭頭不受干擾
    for (int i = 1; i <= N_DISKS; i++) pegs["A"].push_back(i);

    //draw{
    av.start_draw();
    //}
    hanoi(N_DISKS, "A", "C", "B");

    //draw{
    // 修正總結影格：同樣要先 redraw 再 accu_draw
    av.start_frame_draw();
    tree.redraw(av);    // 先產生節點
    av.accu_draw();     // 才畫得出所有歷史箭頭
    draw_all_pegs();
    av.auto_camera();
    av.text("所有步驟執行完畢，河內塔搬運成功！", Pos("tree_0_0", "top", 0, -60));
    av.end_frame_draw();
    av.end_draw();
    //}

    return 0;
}
