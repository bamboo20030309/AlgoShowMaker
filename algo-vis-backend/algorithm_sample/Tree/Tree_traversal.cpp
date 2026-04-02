#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
TreeLayout tree(2, Pos(500, 100), 80.0, 200.0, "tree");
bool first_visit = true; // 用於判斷是否為遍歷中的首次訪問

struct Node {
    int val;
    Node *left, *right;
    Node(int v) : val(v), left(NULL), right(NULL) {}
};

Node* Root = NULL;

void sync_tree_layout(Node* root, int d = 0, int o = 0) {
    if (!root) return;
    tree.nodes.insert({d, o});
    tree.vals[{d, o}] = to_string(root->val);
    if (root->left) sync_tree_layout(root->left, d + 1, o * 2);
    if (root->right) sync_tree_layout(root->right, d + 1, o * 2 + 1);
}

void draw_tree_content(bool show_focus = true) {
    tree.nodes.clear();
    tree.vals.clear();
    sync_tree_layout(Root);
    tree.update_layout();
    
    int old_d = tree.curr_d;
    if (!show_focus) tree.curr_d = -1;
    
    tree.show_edges = false; // 關閉自動畫線
    tree.redraw(av); 
    
    // 手動繪製邊緣以控制寬度
    std::set<pair<int,int>> active_path;
    active_path.insert({tree.curr_d, tree.curr_o});
    for(auto p : tree.path_stack) active_path.insert(p);

    for (auto const& node : tree.nodes) {
        int d = node.first, o = node.second;
        if (d > 0) {
            int pd = d - 1, po = o / tree.degree;
            if (tree.nodes.count({pd, po})) {
                string color = "black";
                string width = "2";
                if (tree.edge_colors.count({d, o})) {
                    color = tree.edge_colors[{d, o}];
                    width = "4"; // 遍歷過的路徑加寬
                } else if (active_path.count({d, o}) && active_path.count({pd, po})) {
                    color = "orange";
                }
                av.arrow(Pos(tree.get_id(pd, po), "bottom"), Pos(tree.get_id(d, o), "top"), 
                    {{"color", color}, {"width", width}, {"key", "arrow_" + tree.get_id(d, o)}});
            }
        }
    }
    if (!show_focus) tree.curr_d = old_d;
    av.accu_draw();
}
//}

Node* insert(Node* root, int val) {
    if (!root) return new Node(val);
    if (val < root->val) root->left = insert(root->left, val);
    else if (val > root->val) root->right = insert(root->right, val);
    return root;
}

Node* find_min_node(Node* root) {
    while (root && root->left) root = root->left;
    return root;
}

Node* remove_node(Node* root, int val) {
    if (!root) return NULL;
    if (val < root->val) root->left = remove_node(root->left, val);
    else if (val > root->val) root->right = remove_node(root->right, val);
    else {
        if (!root->left || !root->right) {
            Node* temp = root->left ? root->left : root->right;
            delete root;
            return temp;
        }
        Node* temp = find_min_node(root->right);
        root->val = temp->val;
        root->right = remove_node(root->right, temp->val);
    }
    return root;
}

bool search_node(Node* root, int val) {
    if (!root) return false;
    if (root->val == val) return true;
    if (val < root->val) return search_node(root->left, val);
    return search_node(root->right, val);
}

// 深度優先遍歷 (DFS): flag 0=前序, 1=中序, 2=後序
void traverse(Node* root, int flag) {
    if (!root) return;

    // 前序 (Pre-order) 訪問
    if (flag == 0) {
        cout << root->val << " ";
        //draw{
        string msg = "前序：遇到節點就輸出";
        if (!first_visit) msg = "{前序：遇到節點就}輸出";
        first_visit = false;

        tree.node_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7";
        av.start_frame_draw();
        draw_tree_content();
        av.text(msg, Pos(tree.get_id(tree.curr_d, tree.curr_o), "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }

    // 向左探索
    if (root->left) {
        //draw{
        tree.push(0);
        tree.edge_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7";
        av.start_frame_draw();
        draw_tree_content();
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        traverse(root->left, flag);
        //draw{
        tree.pop();
        //}
    }

    // 中序 (In-order) 訪問
    if (flag == 1) {
        cout << root->val << " ";
        //draw{
        string msg = "中序：等左邊走完再輸出";
        if (!first_visit) msg = "{中序：等左邊走完再}輸出";
        first_visit = false;

        tree.node_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7";
        av.start_frame_draw();
        draw_tree_content();
        av.text(msg, Pos(tree.get_id(tree.curr_d, tree.curr_o), "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }

    // 向右探索
    if (root->right) {
        //draw{
        tree.push(1);
        tree.edge_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7";
        av.start_frame_draw();
        draw_tree_content();
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        traverse(root->right, flag);
        //draw{
        tree.pop();
        //}
    }

    // 後序 (Post-order) 訪問
    if (flag == 2) {
        cout << root->val << " ";
        //draw{
        string msg = "後序：等兩邊都走完再輸出";
        if (!first_visit) msg = "{後序：等兩邊都走完再}輸出";
        first_visit = false;

        tree.node_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7";
        av.start_frame_draw();
        draw_tree_content();
        av.text(msg, Pos(tree.get_id(tree.curr_d, tree.curr_o), "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
}

void levelorder(Node* root) {
    if (!root) return;
    queue<tuple<Node*, int, int>> q;
    q.push({root, 0, 0});
    while (!q.empty()) {
        auto [node, d, o] = q.front(); q.pop();
        cout << node->val << " ";
        //draw{
        tree.curr_d = d; tree.curr_o = o;
        if (d > 0) {
            tree.edge_colors[{d, o}] = "#a5d6a7";
            av.start_frame_draw();
            draw_tree_content();
            av.text("層序遍歷：移動到下一層節點...", Pos(tree.get_id(d, o), "bottom", 0, 10));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }
        // 影格 2: 再將節點變綠
        //draw{
        string msg = "層序：依序輸出";
        if (!first_visit) msg = "{層序：依序}輸出";
        first_visit = false;

        tree.node_colors[{d, o}] = "#a5d6a7";
        av.start_frame_draw();
        draw_tree_content();
        av.text(msg, Pos(tree.get_id(d, o), "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        if (node->left) q.push({node->left, d + 1, o * 2});
        if (node->right) q.push({node->right, d + 1, o * 2 + 1});
    }
}

int main() {
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool focus) {
        string val = tree.vals[{d, o}];
        vector<array_style> st;
        if (focus) { st.push_back({{"highlight"}, {0}}); st.push_back({{"point"}, {0}}); }
        if (tree.node_colors.count({d, o})) st.push_back({{"background", tree.node_colors[{d, o}]}, {0}});
        av.frame_draw(id, p, vector<string>{val}, st);
    };
    av.start_draw();
    tree.mode = TreeLayout::INORDER;
    //}

    int op, val;
    while (cin >> op >> val) {
        if (op == 1) {
            Root = insert(Root, val);
        } else if (op == 2) {
            bool found = search_node(Root, val);
        } else if (op == 3) {
            Root = remove_node(Root, val);
        } else if (op == 4) {
            //draw{
            string task_msg = "";
            if (val == 0) task_msg = "現在要執行 前序遍歷 (Pre-order)";
            else if (val == 1) task_msg = "現在要執行 中序遍歷 (In-order)";
            else if (val == 2) task_msg = "現在要執行 後序遍歷 (Post-order)";
            else if (val == 3) task_msg = "現在要執行 層序遍歷 (Level-order)";
            
            av.start_frame_draw();
            draw_tree_content();
            av.text(task_msg, Pos(tree.get_id(0, 0), "top", 0, -60)); // 綁定在 Root 節點上方
            av.auto_camera(0.85);
            av.end_frame_draw();
            //}
            
            //draw{
            first_visit = true; // 每次執行新遍歷前，重置標記
            //}
            if (val >= 0 && val <= 2) traverse(Root, val);
            else if (val == 3) levelorder(Root);
            cout << endl;

            //draw{
            tree.node_colors.clear();
            tree.edge_colors.clear();
            tree.curr_d = 0; tree.curr_o = 0;
            av.start_frame_draw();
            draw_tree_content(false);
            av.text("遍歷完成！已清除標記", Pos(tree.get_id(0, 0), "top", 0, -60));
            av.auto_camera(0.85);
            av.end_frame_draw();
            //}
        }
    }

    //draw{
    av.end_draw();
    //}
    return 0;
}
