#include <iostream>
#include <vector>
#include <algorithm>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
TreeLayout tree("tree", 2, Pos(500, 150), 80.0, 120.0);

vector<string> pre_arr;   // 前序陣列 (字串版，用於繪製)
vector<string> in_arr;    // 中序陣列 (字串版，用於繪製)
vector<int>    post_ans;  // 後序結果

// 繪製所有內容
void draw_all(int pre_highlight = -1, int in_hl_L = -1, int in_hl_R = -1, int in_root = -1, string msg = "") {
    // 繪製前序陣列
    vector<array_style> pre_st;
    if (pre_highlight >= 0) {
        pre_st.push_back({{"highlight"},               {pre_highlight}});
        pre_st.push_back({{"point"},                   {pre_highlight}});
        pre_st.push_back({{"background", "#ffb74d"},   {pre_highlight}});
    }
    av.frame_draw("pre", Pos(500, 20), pre_arr, pre_st, {0}, "normal", 0, 0, 10);

    // 繪製中序陣列
    vector<array_style> in_st;
    if (in_hl_L >= 0 && in_hl_R >= 0) {
        in_st.push_back({{"background", "rgba(144,202,249,0.4)"}, AV::AtoB(in_hl_L, in_hl_R)});
    }
    if (in_root >= 0) {
        in_st.push_back({{"highlight"},               {in_root}});
        in_st.push_back({{"point"},                   {in_root}});
        in_st.push_back({{"background", "#ffb74d"},   {in_root}});
    }
    av.frame_draw("in", Pos(500, 80), in_arr, in_st, {0}, "normal", 0, 0, 10);

    // 前序/中序的標題
    av.text("前序 (Preorder)", Pos("pre", "left", -120, 0));
    av.text("中序 (Inorder)",  Pos("in",  "left", -120, 0));

    // 繪製樹
    tree.update_layout();
    tree.show_edges = true;
    tree.redraw(av);

    // 繪製後序結果
    if (!post_ans.empty()) {
        av.frame_draw("post", Pos("tree", "raw bottom left", 0, 100.0), post_ans, {}, {0}, "normal", 0, 0, 10);
        av.text("後序 (Postorder)", Pos("post", "left", -120, 0));
    }

    // 累積箭頭
    av.accu_draw();

    // 文字訊息
    if (!msg.empty()) {
        av.text(msg, Pos("tree", "top", 0, -30));
    }

    av.auto_camera(0.8, 30, 20);
}

// key_frame 版本
void key_draw_all(string msg = "") {
    av.key_frame_draw("pre", Pos(500, 20), pre_arr, {}, {0}, "normal", 0, 0, 10);
    av.key_frame_draw("in",  Pos(500, 80), in_arr,  {}, {0}, "normal", 0, 0, 10);

    av.key_text("前序 (Preorder)", Pos("pre", "left", -120, 0));
    av.key_text("中序 (Inorder)",  Pos("in",  "left", -120, 0));

    tree.update_layout();
    tree.show_edges = true;
    tree.key_redraw(av);

    if (!post_ans.empty()) {
        av.key_frame_draw("post", Pos("tree", "raw bottom left", 0, 100.0), post_ans, {}, {0}, "normal", 0, 0, 10);
        av.key_text("後序 (Postorder)", Pos("post", "left", -120, 0));
    }

    av.key_accu_draw();

    if (!msg.empty()) {
        av.key_text(msg, Pos("tree", "top", 0, -30));
    }

    av.auto_camera(0.8, 30, 20);
}
//}

// pre_idx: 當前處理到前序數組的第幾個元素
// in_left, in_right: 當前子樹在中序數組中的範圍
void printPostorder(const vector<int>& pre, const vector<int>& in, int& pre_idx, int in_left, int in_right) {
    if (in_left > in_right) return;

    // 前序的第一個元素必定是根節點
    int root_val = pre[pre_idx++];

    // 在中序中找到根節點的位置，以此區分左右子樹
    int in_idx = find(in.begin() + in_left, in.begin() + in_right, root_val) - in.begin();

//draw{
    int d = tree.curr_d, o = tree.curr_o;
    // 把節點加入樹中
    tree.nodes.insert({d, o});
    {
        int td = d, to_ = o;
        while (td > 0) {
            td--; to_ /= 2;
            tree.nodes.insert({td, to_});
        }
    }
    tree.vals[{d, o}] = to_string(root_val);
    tree.node_colors[{d, o}] = "#ffb74d";

    // Step 1: 標記前序中取出的根
    av.start_frame_draw();
    draw_all(pre_idx - 1, in_left, in_right, -1,
        "從前序取出根節點 " + to_string(root_val));
    av.end_frame_draw();

    // Step 2: 在中序中找到根的位置，分割左右子樹
    string left_info  = (in_idx > in_left)  ? "左子樹 [" + to_string(in_left) + "," + to_string(in_idx - 1) + "]"     : "無左子樹";
    string right_info = (in_idx < in_right) ? "右子樹 [" + to_string(in_idx + 1) + "," + to_string(in_right) + "]" : "無右子樹";
    av.start_frame_draw();
    draw_all(pre_idx - 1, in_left, in_right, in_idx,
        "在中序找到 " + to_string(root_val) + " → " + left_info + "、" + right_info);
    av.end_frame_draw();

    tree.node_colors[{d, o}] = "#a5d6a7";
//}

    // 遞迴處理左子樹
    if (in_idx > in_left) {
//draw{
        tree.push(0);
//}
        printPostorder(pre, in, pre_idx, in_left, in_idx - 1);
//draw{
        tree.pop();
//}
    }

    // 遞迴處理右子樹
    if (in_idx < in_right) {
//draw{
        tree.push(1);
//}
        printPostorder(pre, in, pre_idx, in_idx + 1, in_right);
//draw{
        tree.pop();
//}
    }

    // 最後輸出根節點 (後序：左 -> 右 -> 根)
    cout << root_val << " ";

//draw{
    tree.node_colors[{d, o}] = "#ce93d8";
    post_ans.push_back(root_val);

    av.accu_store_arrow(
        Pos(tree.get_id(d, o), "bottom"),
        Pos("post", (int)post_ans.size() - 1, "top"), {
        {"color", "rgba(128, 128, 128, 0.5)"},
        {"width", "4"},
        {"dash", "10,5"}
    });

    av.start_frame_draw();
    draw_all(-1, -1, -1, -1,
        "{後序輸出：}" + to_string(root_val));
    av.end_frame_draw();
//}
}

int main() {
//draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool focus) {
        string val = tree.vals.count({d, o}) ? tree.vals[{d, o}] : "?";
        vector<array_style> st;
        if (focus) {
            st.push_back({{"highlight"}, {0}});
            st.push_back({{"point"},     {0}});
        }
        if (tree.node_colors.count({d, o})) {
            st.push_back({{"background", tree.node_colors[{d, o}]}, {0}});
        }
        if (tree._is_key_drawing) av.key_frame_draw(id, p, vector<string>{val}, st);
        else                      av.frame_draw(id, p, vector<string>{val}, st);
    };
    av.start_draw();
    tree.mode = TreeLayout::COMPACT;
//}

    int n;
    if (!(cin >> n)) return 0;

    vector<int> pre(n), in(n);
    for (int i = 0; i < n; ++i) cin >> pre[i];
    for (int i = 0; i < n; ++i) cin >> in[i];

//draw{
    for (int i = 0; i < n; i++) {
        pre_arr.push_back(to_string(pre[i]));
        in_arr.push_back(to_string(in[i]));
    }

    // 初始幀：展示兩個輸入陣列
    av.start_frame_draw();
    av.frame_draw("pre", Pos(500, 20), pre_arr, {}, {0}, "normal", 0, 0, 10);
    av.frame_draw("in",  Pos(500, 80), in_arr,  {}, {0}, "normal", 0, 0, 10);
    av.text("前序 (Preorder)", Pos("pre", "left", -120, 0));
    av.text("中序 (Inorder)",  Pos("in",  "left", -120, 0));
    av.text("給定前序與中序遍歷，還原二元樹並輸出後序", Pos(500, -20));
    av.auto_camera(0.8, 30, 20);
    av.end_frame_draw();

    // 說明原理
    av.start_frame_draw();
    av.frame_draw("pre", Pos(500, 20), pre_arr, {{{"highlight"}, {0}}, {{"point"}, {0}}, {{"background", "#ffb74d"}, {0}}}, {0}, "normal", 0, 0, 10);
    av.frame_draw("in",  Pos(500, 80), in_arr,  {}, {0}, "normal", 0, 0, 10);
    av.text("前序 (Preorder)", Pos("pre", "left", -120, 0));
    av.text("中序 (Inorder)",  Pos("in",  "left", -120, 0));
    av.text("核心概念：前序的第一個元素一定是根節點", Pos(500, -20));
    av.auto_camera(0.8, 30, 20);
    av.end_frame_draw();

    av.start_frame_draw();
    av.frame_draw("pre", Pos(500, 20), pre_arr, {{{"highlight"}, {0}}, {{"point"}, {0}}, {{"background", "#ffb74d"}, {0}}}, {0}, "normal", 0, 0, 10);
    // 找到根在中序的位置
    int demo_root_pos = find(in.begin(), in.end(), pre[0]) - in.begin();
    vector<array_style> demo_in_st;
    if (demo_root_pos > 0) {
        demo_in_st.push_back({{"background", "rgba(165,214,167,0.5)"}, AV::AtoB(0, demo_root_pos - 1)});
    }
    demo_in_st.push_back({{"highlight"},             {demo_root_pos}});
    demo_in_st.push_back({{"point"},                 {demo_root_pos}});
    demo_in_st.push_back({{"background", "#ffb74d"}, {demo_root_pos}});
    if (demo_root_pos < n - 1) {
        demo_in_st.push_back({{"background", "rgba(144,202,249,0.5)"}, AV::AtoB(demo_root_pos + 1, n - 1)});
    }
    av.frame_draw("in", Pos(500, 80), in_arr, demo_in_st, {0}, "normal", 0, 0, 10);
    av.text("前序 (Preorder)", Pos("pre", "left", -120, 0));
    av.text("中序 (Inorder)",  Pos("in",  "left", -120, 0));
    av.text("在中序中找到根 → 左邊為左子樹(綠)、右邊為右子樹(藍)", Pos(500, -20));
    av.auto_camera(0.8, 30, 20);
    av.end_frame_draw();

    av.stop();

    tree.curr_d = 0;
    tree.curr_o = 0;
//}

    int pre_idx = 0;
    printPostorder(pre, in, pre_idx, 0, n - 1);
    cout << endl;

//draw{
    // 最終結果幀
    av.start_frame_draw();
    draw_all(-1, -1, -1, -1, "後序遍歷完成！");
    key_draw_all("後序遍歷完成！");
    av.end_frame_draw();
//}

//draw{
    av.end_draw();
//}
    return 0;
}
