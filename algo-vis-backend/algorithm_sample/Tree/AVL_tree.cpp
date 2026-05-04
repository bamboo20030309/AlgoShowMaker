#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

//draw{
AV av;
TreeLayout tree("tree", 2, Pos(500, 100), 80.0, 200.0);
bool is_key_frame = false;
//}
struct Node {
    int val, height, bf;
    Node *left, *right;
    Node(int v) : val(v), height(1), bf(0), left(NULL), right(NULL) {}
};

Node* Root = NULL;

int get_height(Node* n) { return n ? n->height : 0; }
int get_balance(Node* n) { return n ? get_height(n->left) - get_height(n->right) : 0; }
void update_height(Node* n) { 
    if (n) {
        n->height = 1 + max(get_height(n->left), get_height(n->right));
        n->bf = get_height(n->left) - get_height(n->right);
    }
}
//draw{
// 將旋轉後的新節點暫時接回全域樹，讓 sync_tree_layout(Root) 能正確遍歷
void patch_tree(Node* new_node, int d, int o) {
    if (d == 0) { Root = new_node; return; }
    Node* cur = Root;
    for (int level = d - 1; level >= 1; level--) {
        int bit = (o >> level) & 1;
        if (bit == 0) cur = cur->left;
        else          cur = cur->right;
    }
    if (o & 1) cur->right = new_node;
    else       cur->left  = new_node;
}

// ===== 同步 Node 樹 → TreeLayout =====
void sync_tree_layout(Node* root, int d = 0, int o = 0) {
    if (!root) return;
    tree.nodes.insert({d, o});
    tree.vals[{d, o}] = to_string(root->val) + "," + to_string(root->bf);
    if (root->left)  sync_tree_layout(root->left,  d + 1, o * 2);
    if (root->right) sync_tree_layout(root->right, d + 1, o * 2 + 1);
}

// 根據 (d, o) 取得節點的唯一且穩定 ID (不再隨位置改變而變動)
string get_node_id(int d, int o) {
    if (tree.vals.count({d, o})) {
        string val_str = tree.vals[{d, o}];
        size_t comma = val_str.find(',');
        if (comma != string::npos) {
            return "node_" + val_str.substr(0, comma);
        }
        return "node_" + val_str;
    }
    return tree.get_id(d, o);
}


void draw_tree_content(bool highlight_root_ptr = false, bool show_focus = true, bool hide_root_arrow = false, bool is_key = false) {
    is_key_frame = is_key;

    tree.nodes.clear();
    tree.vals.clear();
    sync_tree_layout(Root);
    tree.update_layout();

    int old_d = tree.curr_d;
    if (!show_focus) tree.curr_d = -1;

    tree.show_edges = false;
    tree.redraw(av);

    // 手動繪製邊
    set<pair<int,int>> active_path;
    active_path.insert({tree.curr_d, tree.curr_o});
    for (auto p : tree.path_stack) active_path.insert(p);

    for (auto const& node : tree.nodes) {
        int d = node.first, o = node.second;
        if (d > 0) {
            int pd = d - 1, po = o / tree.degree;
            if (tree.nodes.count({pd, po})) {
                string color = "black";
                string width = "2";
                if (tree.edge_colors.count({d, o})) {
                    color = tree.edge_colors[{d, o}];
                    width = "4";
                } else if (active_path.count({d, o}) && active_path.count({pd, po})) {
                    color = "orange";
                }
                string pid_draw = get_node_id(pd, po);
                string cid_draw = get_node_id(d, o);
                auto styles = vector<pair<string, string>>{{"color", color}, {"width", width}};
                string dir = (o % 2 == 0) ? "L" : "R";
                string arrow_id = "tree_d" + to_string(pd) + "-" + to_string(po) + "_" + dir + "_d" + to_string(d) + "-" + to_string(o);
                av.arrow(Pos(pid_draw, "bottom"), Pos(cid_draw, "top"), styles, arrow_id);
                if (is_key) av.key_arrow(Pos(pid_draw, "bottom"), Pos(cid_draw, "top"), styles, arrow_id);
            }
        }
    }

    if (!show_focus) tree.curr_d = old_d;

    // Root 指標方塊
    vector<array_style> root_ptr_style = {{{"background","#cccccc"},{0}}};
    if (highlight_root_ptr) {
        root_ptr_style.push_back({{"highlight"}, {0}});
        root_ptr_style.push_back({{"point"}, {0}});
    }
    av.frame_draw("tree_root", Pos(500, -110), vector<string>{"Root"}, root_ptr_style);
    if (is_key) av.key_frame_draw("tree_root", Pos(500, -110), vector<string>{"Root"}, root_ptr_style);

    if (Root && !hide_root_arrow) {
        string root_draw_id = get_node_id(0, 0);
        auto styles = vector<pair<string, string>>{{"color", "black"}, {"width", "2"}, {"dash", "10,5"}};
        string arrow_id = "arrow_root";
        av.arrow(Pos("tree_root", "bottom"), Pos(root_draw_id, "top"), styles, arrow_id);
        if (is_key) av.key_arrow(Pos("tree_root", "bottom"), Pos(root_draw_id, "top"), styles, arrow_id);
    }

    av.accu_draw();
    is_key_frame = false;
}

void draw_tree(string title = "") {
    av.start_frame_draw();
    draw_tree_content();
    if (title != "") {
        if (tree.nodes.count({tree.curr_d, tree.curr_o})) {
            av.text(title, Pos(tree.get_id(tree.curr_d, tree.curr_o), "bottom", 0, 20));
        } else {
            av.text(title, Pos(500, 10));
        }
    }
    av.auto_camera(0.8);
    av.end_frame_draw();
}
//}

// ===== 旋轉操作 =====

Node* rotate_right(Node* y) {
    Node* x  = y->left;
    Node* T2 = x->right;
    x->right = y;
    y->left  = T2;
    update_height(y);
    update_height(x);
    return x;
}

Node* rotate_left(Node* x) {
    Node* y  = x->right;
    Node* T2 = y->left;
    y->left  = x;
    x->right = T2;
    update_height(x);
    update_height(y);
    return y;
}

// ===== 插入 =====

Node* insert(Node* root, int val) {
    int d = tree.curr_d, o = tree.curr_o;
    //draw{
    if (root) {
        av.start_frame_draw();
        draw_tree_content();
        string cid = get_node_id(d, o);
        if (val == root->val) {
            av.frame_draw("moving_val", Pos(cid, "top", 0, -20), vector<string>{to_string(val)});
            av.text(to_string(val) + " = " + to_string(root->val) + "，已存在，不新增", Pos(cid, "top", 0, -20));
        } else {
            string side = (val > root->val) ? "right" : "left";
            double offset_x = (val > root->val) ? 20.0 : -20.0;
            string cmp = (val > root->val) ? " > " : " < ";
            string direction = (val > root->val) ? "，往右走" : "，往左走";
            av.frame_draw("moving_val", Pos(cid, side, offset_x, 0), vector<string>{to_string(val)});
            av.text(to_string(val) + cmp + to_string(root->val) + direction, Pos(cid, "top", 0, -20));
        }
        av.auto_camera(0.85);
        av.end_frame_draw();
    }
    //}

    if (!root) {
        Node* newNode = new Node(val);
        //draw{
        bool isInitialRoot = (Root == NULL);

        av.start_frame_draw();
        tree.nodes.insert({tree.curr_d, tree.curr_o});
        tree.vals[{tree.curr_d, tree.curr_o}] = to_string(val) + ",0";
        tree.update_layout();
        Pos target_p = tree.get_pos(tree.curr_d, tree.curr_o);

        draw_tree_content(false, true, false, true);
        av.frame_draw("moving_val", target_p, vector<string>{to_string(val)}, {{{"highlight"}, {0}}, {{"point"}, {0}}});
        av.key_frame_draw("moving_val", target_p, vector<string>{to_string(val)}, {{{"highlight"}, {0}}, {{"point"}, {0}}});
        av.text("找到空位！將節點 " + to_string(val) + " 放置於此", Pos("moving_val", "bottom", 0, 20));
        av.key_text("找到空位！將節點 " + to_string(val) + " 放置於此", Pos("moving_val", "bottom", 0, 20));
        av.auto_camera(0.85);
        av.end_frame_draw();

        if (isInitialRoot) Root = newNode;
        //}
        return newNode;
    }

    if (val < root->val) {
        //draw{
        tree.push(0);
        //}
        root->left = insert(root->left, val);
        //draw{
        tree.pop();
        //}
    } else if (val > root->val) {
        //draw{
        tree.push(1);
        //}
        root->right = insert(root->right, val);
        //draw{
        tree.pop();
        //}
    } else {
        return root; // 重複值不插入
    }

    // 更新高度
    update_height(root);
    int balance = root->bf;

    // ===== 執行平衡檢查與旋轉 (合併影格) =====
    // 情況 A: 平衡正常
    //draw{
    if (balance >= -1 && balance <= 1) {
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + "，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡正常", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
    }
    else 
    //}
    // 情況 B: LL 型
    if (balance > 1 && val < root->left->val) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n新節點插在左{子:紫}的左邊，因此{為:維} "},
            {"LL 型", "AV_red"},
            {"，\n對 " + to_string(root->val) + " 做 "},
            {"右旋", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_right(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("右旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    // 情況 C: RR 型
    else if (balance < -1 && val > root->right->val) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n新節點插在右{子:紫}的右邊，因此{為:維} "},
            {"RR 型", "AV_green"},
            {"，\n對 " + to_string(root->val) + " 做 "},
            {"左旋", "AV_red"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_left(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("左旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    // 情況 D: LR 型
    else if (balance > 1 && val > root->left->val) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n新節點插在左{子:紫}的右邊，因此{為:維} "},
            {"LR 型", "AV_green"},
            {"，\n先對 " + to_string(root->left->val) + " 做 "},
            {"左旋", "AV_red"},
            {"\n再對 " + to_string(root->val) + " 做 "},
            {"右旋", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root->left = rotate_left(root->left);
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.text("左{子:紫}左旋完成，變成 LL 型", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_right(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("右旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    // 情況 E: RL 型
    else if (balance < -1 && val < root->right->val) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n新節點插在右{子:紫}的左邊，因此{為:維} "},
            {"RL 型", "AV_green"},
            {"，\n先對 " + to_string(root->right->val) + " 做 "},
            {"右旋", "AV_red"},
            {"\n再對 " + to_string(root->val) + " 做 "},
            {"左旋", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root->right = rotate_right(root->right);
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.text("右{子:紫}右旋完成，變成 RR 型", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_left(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("左旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }

    return root;
}

// ===== 刪除 =====

Node* find_min(Node* root) {
    while (root->left) root = root->left;
    return root;
}

Node* remove_node(Node* root, int val, bool silent = false) {
    int d = tree.curr_d, o = tree.curr_o;
    string cid;

    if (!root) {
        //draw{
        if (!silent) {
            av.start_frame_draw();
            draw_tree_content();
            string parent_id = (d > 0) ? get_node_id(d - 1, o / 2) : "tree_root";
            av.text("找不到 " + to_string(val), Pos(parent_id, "bottom", 0, 20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }
        //}
        return NULL;
    }

    if (val < root->val) {
        //draw{
        if (!silent) {
            av.start_frame_draw();
            draw_tree_content();
            av.text(to_string(val) + " < " + to_string(root->val) + "，往左走", Pos(get_node_id(d, o), "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }
        tree.push(0);
        //}
        root->left = remove_node(root->left, val, silent);
        //draw{
        tree.pop();
        //}
    } else if (val > root->val) {
        //draw{
        if (!silent) {
            av.start_frame_draw();
            draw_tree_content();
            av.text(to_string(val) + " > " + to_string(root->val) + "，往右走", Pos(get_node_id(d, o), "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }
        tree.push(1);
        //}
        root->right = remove_node(root->right, val, silent);
        //draw{
        tree.pop();
        //}
    } else {
        // 找到要刪除的節點
        //draw{
        if (!silent) {
            tree.node_colors[{d, o}] = "#ef9a9a";
            av.start_frame_draw();
            draw_tree_content();
            av.text("找到 " + to_string(val) + " 了！準備刪除", Pos(get_node_id(d, o), "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }
        //}
        if (!root->left || !root->right) {
            Node* temp = root->left ? root->left : root->right;
            //draw{
            if (!silent) {
                if (!temp) {
                    av.start_frame_draw();
                    draw_tree_content();
                    av.text("是葉節點，直接刪除", Pos(get_node_id(d, o), "top", 0, -20));
                    av.auto_camera(0.85);
                    av.end_frame_draw();
                } else {
                    av.start_frame_draw();
                    draw_tree_content();
                    av.text("只有一個子節點，用子節點取代", Pos(get_node_id(d, o), "top", 0, -20));
                    av.auto_camera(0.85);
                    av.end_frame_draw();
                }

            }
            //}
            if (root == Root) Root = temp;
            //draw{
            tree.node_colors.erase({d, o});
            //}
            delete root;
            //draw{
            patch_tree(temp, d, o);
            av.start_frame_draw();
            draw_tree_content();
            string anchor_id = temp ? get_node_id(d, o) : ((d > 0) ? get_node_id(d - 1, o / 2) : "tree_root");
            av.text("刪除完成，開始往上回溯檢查平衡", Pos(anchor_id, "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
            //}
            return temp;
        }
        // 有兩個子節點：視覺化尋找右子樹中的最小值 (繼承者)
        //draw{
        if (!silent) {
            av.start_frame_draw();
            draw_tree_content();
            av.text("有兩個子節點，準備找右子樹最小值作為繼承者", Pos(get_node_id(d, o), "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }
        // 1. 導航到繼承者位置並顯示說明 (合併影格)
        tree.push(1);
        //}
        Node* curr = root->right;
        //draw{
        int left_moves = 0;
        while (curr->left) {
            curr = curr->left;
            tree.push(0);
            left_moves++;
        }
        int succ_d = tree.curr_d, succ_o = tree.curr_o;

        if (!silent) {
            av.start_frame_draw();
            draw_tree_content();
            av.text("找到右子樹最左節點 " + to_string(curr->val) + " 作為繼承者", Pos(get_node_id(succ_d, succ_o), "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }

        // 3. 執行數值交換並顯示影格 (此時焦點仍在底部的繼承者處)
        int succ_val = curr->val;
        int old_val = root->val;
        //}
        root->val = succ_val;
        curr->val = old_val;
        //draw{
        
        // 顏色轉移：頂端變白，底部(繼承者原位)變紅
        tree.node_colors.erase({d, o});
        tree.node_colors[{succ_d, succ_o}] = "#ef9a9a";

        if (!silent) {
            av.start_frame_draw();
            draw_tree_content();
            av.text("交換位置：將待刪除的 " + to_string(old_val) + " 換到底部", Pos(get_node_id(succ_d, succ_o), "top", 0, -20));
            av.auto_camera(0.85);
            av.end_frame_draw();
        }

        // 4. 返回頂層，準備遞迴刪除
        for (int i = 0; i < left_moves; ++i) tree.pop();
        tree.pop(); // 退回原始 node (目前的 root)

        // 5. 進入右子樹執行靜默刪除 (刪除換下去的 old_val)
        tree.push(1);
        //}
        root->right = remove_node(root->right, old_val, true);
        //draw{
        tree.pop();
        //}
    }

    if (!root) return root;

    update_height(root);
    int balance = root->bf;

    // ===== 執行平衡檢查與旋轉 (刪除情形 - 合併影格) =====
    // 情況 A: 平衡正常
    //draw{
    if (balance >= -1 && balance <= 1) {
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + "，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡正常", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
    }
    else 
    //}
    // 情況 B: LL 型
    if (balance > 1 && get_balance(root->left) >= 0) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n左{子:紫}樹偏重於左側，因此{為:維} "},
            {"LL 型", "AV_red"},
            {"，\n對 " + to_string(root->val) + " 做 "},
            {"右旋", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_right(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("右旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    // 情況 C: RR 型
    else if (balance < -1 && get_balance(root->right) <= 0) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n右{子:紫}樹偏重於右側，因此{為:維} "},
            {"RR 型", "AV_green"},
            {"，\n對 " + to_string(root->val) + " 做 "},
            {"左旋", "AV_red"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_left(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("左旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    // 情況 D: LR 型
    else if (balance > 1 && get_balance(root->left) < 0) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n左{子:紫}樹偏重於右側，因此{為:維} "},
            {"LR 型", "AV_green"},
            {"，\n先對 " + to_string(root->left->val) + " 做 "},
            {"左旋", "AV_red"},
            {"\n再對 " + to_string(root->val) + " 做 "},
            {"右旋", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root->left = rotate_left(root->left);
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.text("左{子:紫}左旋完成，變成 LL 型", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_right(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("右旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    // 情況 E: RL 型
    else if (balance < -1 && get_balance(root->right) > 0) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.colored_text({
            {"回溯到 " + to_string(root->val) + " ，平衡因子 (bf) = " + to_string(balance) + "，"},
            {"平衡失常", "AV_red"},
            {"\n右{子:紫}樹偏重於左側，因此{為:維} "},
            {"RL 型", "AV_green"},
            {"，\n先對 " + to_string(root->right->val) + " 做 "},
            {"右旋", "AV_red"},
            {"\n再對 " + to_string(root->val) + " 做 "},
            {"左旋", "AV_green"}
        }, Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root->right = rotate_right(root->right);
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.text("右{子:紫}右旋完成，變成 RR 型", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        root = rotate_left(root);
        //draw{
        patch_tree(root, d, o);
        av.start_frame_draw();
        draw_tree_content();
        av.text("左旋完成，恢復平衡", Pos(get_node_id(d, o), "top", 0, -20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }

    return root;
}

int main() {
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool focus) {
        string val_str = tree.vals[{d, o}];
        if (val_str.empty()) return;

        // 解析 "數值,平衡因子"
        vector<string> items;
        stringstream ss(val_str);
        string item;
        while (getline(ss, item, ',')) items.push_back(item);

        string display_val = items[0];
        string bf_str = (items.size() > 1) ? items[1] : "0";
        int bf = stoi(bf_str);

        // 節點身分鎖定在 display_val 上 (數值 ID)
        string stable_id = "node_" + display_val;

        // 節點本體
        vector<array_style> st;
        if (focus) {
            st.push_back({{"highlight"}, {0}});
            st.push_back({{"point"}, {0}});
        }
        if (tree.node_colors.count({d, o})) {
            st.push_back({{"background", tree.node_colors[{d, o}]}, {0}});
        } else if (bf > 1 || bf < -1) {
            st.push_back({{"background", "AV_node_red"}, {0}}); // 失衡紅色
        } else {
            st.push_back({{"background", "AV_node_green"}, {0}}); // 正常綠色
        }

        av.frame_draw(stable_id, p, vector<string>{display_val}, st);
        if (is_key_frame) av.key_frame_draw(stable_id, p, vector<string>{display_val}, st);

        // 在節點右側顯示平衡因子
        string bf_label = "bf=" + bf_str;
        av.draw_word(bf_label, Pos(stable_id, "right", 10, 0));
        if (is_key_frame) av.key_draw_word(bf_label, Pos(stable_id, "right", 10, 0));
    };

    av.start_draw();
    tree.show_edges = true;
    tree.mode = TreeLayout::INORDER;

    // ===== 開場說明 =====
    av.start_frame_draw();
    av.colored_text({
        {"AVL Tree\n", "", "", "20"},
        {"AVL Tree 是一種 "},
        {"自平衡二元搜尋樹", "AV_yellow"},
        {"。\n\n"},
        {"自平衡二元搜尋樹的概念：\n"},
        {"只要有其中一個節點的左子樹高度與右子樹高度相差超過 1，\n"},
        {"就判定為失衡，要透過旋轉來恢復平衡\n\n"},
        {"實作方法：\n"},
        {"每個節點都會維護一個 "},
        {"平衡因子 (BF)", "AV_yellow"},
        {"{=:他的計算方法是：} 左子樹高度 {-:減掉} 右子樹高度。\n"},
        {"當平衡因子超出 {[-1, 1]:-1 到 依} 的範圍時(失衡)，就需要通過 "},
        {"旋轉", "AV_yellow"},
        {" 操作來恢復平衡。"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();
    
    const Pos P1(500, 150), P2L(400, 300), P2R(600, 300);

    auto draw_demo_node = [&](string id, string val, Pos p, string color = "AV_node_green") {
        vector<array_style> st = {{vector<string>{"background", color}, vector<int>{0}}};
        av.frame_draw(id, p, vector<string>{val}, st);
    };

    auto draw_case_base = [&](string highlight_st = "") {
        draw_demo_node("nA", "A", P1, "AV_node_green");
        draw_demo_node("nB", "B", P2L);
        draw_demo_node("nC", "C", P2R);
        av.arrow(Pos("nA", "bottom"), Pos("nB", "top"), {{"color", "black"},{"width","2"}});
        av.arrow(Pos("nA", "bottom"), Pos("nC", "top"), {{"color", "black"},{"width","2"}});

        // 四個基礎子樹
        string c_ll = (highlight_st == "LL" ? "AV_orange" : "AV_green");
        string c_lr = (highlight_st == "LR" ? "AV_orange" : "AV_green");
        string c_rl = (highlight_st == "RL" ? "AV_orange" : "AV_green");
        string c_rr = (highlight_st == "RR" ? "AV_orange" : "AV_green");

        av.draw_triangle("st_B_L", Pos("nB", "bottom", -50, 60), 200, 80, {{"background", c_ll}, {"text", "LL"}});
        av.arrow(Pos("nB", "bottom"), Pos("st_B_L", "top"), {{"color", "black"},{"width","2"}});
        av.draw_triangle("st_B_R", Pos("nB", "bottom", 50, 60), 200, 80, {{"background", c_lr}, {"text", "LR"}});
        av.arrow(Pos("nB", "bottom"), Pos("st_B_R", "top"), {{"color", "black"},{"width","2"}});

        av.draw_triangle("st_C_L", Pos("nC", "bottom", -50, 60), 200, 80, {{"background", c_rl}, {"text", "RL"}});
        av.arrow(Pos("nC", "bottom"), Pos("st_C_L", "top"), {{"color", "black"},{"width","2"}});
        av.draw_triangle("st_C_R", Pos("nC", "bottom", 50, 60), 200, 80, {{"background", c_rr}, {"text", "RR"}});
        av.arrow(Pos("nC", "bottom"), Pos("st_C_R", "top"), {{"color", "black"},{"width","2"}});
    };

    // 1. 旋轉說明
    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n20", "20", Pos(400, 300));
    av.arrow(Pos("n30", "bottom"), Pos("n20", "top"), {{"color", "black"},{"width","2"}});
    
    // 為空缺處補上三角形子樹並加上箭頭
    // 箭頭終點直接定位到三角形頂點
    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"為何需要旋轉?\n", "", "", "20"},
        {"因為樹長得 "},
        {"太歪", "AV_yellow"},
        {" ，搜尋就會變慢。\n"},
        {"而旋轉的目的很簡單，\n"},
        {"就是把比較歪斜的節點 "},
        {"提","AV_yellow"},
        {" 上來，讓樹變矮。\n"},
        {"樹越矮，速度就越快！"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    // 2.右旋過程
    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n20", "20", Pos(400, 300));
    av.arrow(Pos("n30", "bottom"), Pos("n20", "top"), {{"color", "black"},{"width","2"}});
    
    // 為空缺處補上三角形子樹並加上箭頭
    // 箭頭終點直接定位到三角形頂點
    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"遇到樹偏左歪的情況，就應該右旋它\n\n"},
        {"右旋過程：\n"},
        {"{1. 先把左子的右子變成父節點\n"},
        {"2. 再把左子的右子樹轉交給父節點的左子\n"},
        {"這樣就完成右旋}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n20", "20", Pos(400, 300));
    av.arrow(Pos("n20", "top"), Pos("n30", "bottom"), {{"color", "black"},{"width","2"}});
    
    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"{遇到樹偏左歪的情況，就應該右旋它\n\n"},
        {"右旋過程：}\n"},
        {"1. 先把左{子:ㄗˇ}的右{子:ㄗˇ}變成父節點\n"},
        {"{2. 再把左子的右子樹轉交給父節點的左子\n"},
        {"這樣就完成右旋}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n20", "20", Pos(400, 300));
    av.arrow(Pos("n20", "top"), Pos("n30", "bottom"), {{"color", "black"},{"width","2"}});
    
    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"{遇到樹偏左歪的情況，就應該右旋它\n\n"},
        {"右旋過程：\n"},
        {"1. 先把左子的右子變成父節點}\n"},
        {"2. 再把左{子:ㄗˇ}的右{子:ㄗˇ}樹轉交給父節點的左{子:ㄗˇ}\n"},
        {"{這樣就完成右旋}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(600, 300));
    draw_demo_node("n20", "20", Pos(500, 150));
    av.arrow(Pos("n20", "bottom"), Pos("n30", "top"), {{"color", "black"},{"width","2"}});
    
    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n30", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});
    
    av.colored_text({
        {"{遇到樹偏左歪的情況，就應該右旋它\n\n"},
        {"右旋過程：\n"},
        {"1. 先把左子的右子變成父節點\n"},
        {"2. 再把左子的右子樹轉交給父節點的左子}\n"},
        {"這樣就完成右旋"}
    }, Pos("n20", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();


    // 3.左旋過程
    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n40", "40", Pos(600, 300));
    av.arrow(Pos("n30", "bottom"), Pos("n40", "top"), {{"color", "black"},{"width","2"}});
    
    // 為空缺處補上三角形子樹並加上箭頭
    av.draw_triangle("st_n30_L", Pos("n30", "bottom", -100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n40_L", Pos("n40", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n40", "bottom"), Pos("st_n40_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n40_R", Pos("n40", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n40", "bottom"), Pos("st_n40_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"遇到樹偏右歪的情況，就應該左旋它\n\n"},
        {"左旋過程：\n"},
        {"{1. 先把右子的左子變成父節點\n"},
        {"2. 再把右子的左子樹轉交給父節點的右子\n"},
        {"這樣就完成左旋}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n40", "40", Pos(600, 300));
    av.arrow(Pos("n40", "top"), Pos("n30", "bottom"), {{"color", "black"},{"width","2"}});
    
    av.draw_triangle("st_n30_L", Pos("n30", "bottom", -100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n40_L", Pos("n40", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n40", "bottom"), Pos("st_n40_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n40_R", Pos("n40", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n40", "bottom"), Pos("st_n40_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"{遇到樹偏右歪的情況，就應該左旋它\n\n"},
        {"左旋過程：}\n"},
        {"1. 先把右{子:ㄗˇ}的左{子:ㄗˇ}變成父節點\n"},
        {"{2. 再把右子的左子樹轉交給父節點的右子\n"},
        {"這樣就完成左旋}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150));
    draw_demo_node("n40", "40", Pos(600, 300));
    av.arrow(Pos("n40", "top"), Pos("n30", "bottom"), {{"color", "black"},{"width","2"}});
    
    av.draw_triangle("st_n30_L", Pos("n30", "bottom", -100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n40_L", Pos("n40", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n40_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n40_R", Pos("n40", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n40", "bottom"), Pos("st_n40_R", "top"), {{"color", "black"},{"width","2"}});

    av.colored_text({
        {"{遇到樹偏右歪的情況，就應該左旋它\n\n"},
        {"左旋過程：\n"},
        {"1. 先把右子的左子變成父節點}\n"},
        {"2. 再把右{子:ㄗˇ}的左{子:ㄗˇ}樹轉交給父節點的右{子:ㄗˇ}\n"},
        {"{這樣就完成左旋}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(400, 300));
    draw_demo_node("n40", "40", Pos(500, 150));
    av.arrow(Pos("n40", "bottom"), Pos("n30", "top"), {{"color", "black"},{"width","2"}});
    
    av.draw_triangle("st_n30_L", Pos("n30", "bottom", -50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n40_L", Pos("n30", "bottom", 50, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n40_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n40_R", Pos("n40", "bottom", 100, 60), 200, 80, {{"text", "子樹"}});
    av.arrow(Pos("n40", "bottom"), Pos("st_n40_R", "top"), {{"color", "black"},{"width","2"}});
    
    av.colored_text({
        {"{遇到樹偏右歪的情況，就應該左旋它\n\n"},
        {"左旋過程：\n"},
        {"1. 先把右子的左子變成父節點\n"},
        {"2. 再把右子的左子樹轉交給父節點的右子}\n"},
        {"這樣就完成左旋"}
    }, Pos("n40", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();



    // 新增：旋轉情況概覽影格
    av.start_frame_draw();
    draw_case_base();
    av.colored_text({
        {"失衡分為四種情況，皆為一邊比另一邊高出兩階的情況，\n"},
        {"回復平衡的做法分別為：\n"},
        {"• LL 型： 右旋\n"},
        {"• RR 型： 左旋\n"},
        {"• LR 型： 先左旋再右旋\n"},
        {"• RL 型： 先右旋再左旋"}
    }, Pos("nA", "top", 0, -20));
    av.auto_camera(0.8);
    av.sleep();
    av.end_frame_draw();

    // ===== 情況區分動態說明 =====
    std::map<string, vector<string>> cases = {
        {"LL", {"nA", "nB", "st_B_L", "如果更新點落在了 A 的左{子:ㄗˇ}的左{子:ㄗˇ}樹，那他就稱為 LL 型，應該右旋"}},
        {"LR", {"nA", "nB", "st_B_R", "如果更新點落在了 A 的左{子:ㄗˇ}的右{子:ㄗˇ}樹，那他就稱為 LR 型，應該先左旋再右旋"}},
        {"RL", {"nA", "nC", "st_C_L", "如果更新點落在了 A 的右{子:ㄗˇ}的左{子:ㄗˇ}樹，那他就稱為 RL 型，應該先右旋再左旋"}},
        {"RR", {"nA", "nC", "st_C_R", "如果更新點落在了 A 的右{子:ㄗˇ}的右{子:ㄗˇ}樹，那他就稱為 RR 型，應該左旋"}}
    };

    for (auto const& c : cases) {
        string type = c.first;
        string p1_id = c.second[0], p2_id = c.second[1], p3_id = c.second[2], desc = c.second[3];

        // 進入子樹並亮起
        av.start_frame_draw();
        draw_case_base(type);
        av.colored_text({{desc}}, Pos(p3_id, "top", 0, -20));
        av.auto_camera(0.8);
        av.end_frame_draw();
    }

    av.start_frame_draw();
    draw_case_base();
    av.colored_text({
        {"觀察後可以得知其兩兩互相為對稱\n"},
        {"實際上只有兩種類型\n"},
        {"因此這邊只敘述這兩種如何翻轉\n"},
        {"另一邊就直接全部反轉過去就好"}
    }, Pos("nA", "top", 0, -20));
    av.auto_camera(0.8);
    av.sleep();
    av.end_frame_draw();

    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150), "AV_node_red");
    draw_demo_node("n20", "20", Pos(400, 300));
    av.arrow(Pos("n30", "bottom"), Pos("n20", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 200, 80, {{"text", "H-1"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -70, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R2", Pos("n20", "bottom", 70, 60), 350, 80, {{"text", "H"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 70, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_word("bf=2", Pos("n30", "right", 10, 0));
    av.draw_word("bf=[0~1]", Pos("n20", "right", 10, 0));
    av.colored_text({
        {"接{著:ㄓㄜ˙}是如何翻轉的部分，子樹高度不同的地方代表有多種可能"}
    }, Pos("n30", "top", 0, -20));
    av.auto_camera(0.8);
    av.end_frame_draw();

    // LL 型 (Right Rotate) =====
    // Frame 1: Before
    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150), "AV_node_red");
    draw_demo_node("n20", "20", Pos(400, 300));
    av.arrow(Pos("n30", "bottom"), Pos("n20", "top"), {{"color", "black"},{"width","2"}});
    
    // 為空缺處補上三角形子樹並加上箭頭
    // 箭頭終點直接定位到三角形頂點
    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 200, 80, {{"text", "H-1"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -70, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R2", Pos("n20", "bottom", 70, 60), 350, 80, {{"text", "H"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 70, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_word("bf=2", Pos("n30", "right", 10, 0));
    av.draw_word("bf=[0~1]", Pos("n20", "right", 10, 0));
    av.colored_text({
        {"LL 型 (Left-Left Case)\n", "", "", "20"},
        {"當失衡位置位於失衡節點的 左{子:ㄗˇ}的左{子:ㄗˇ}樹時。\n\n"},
        {"平衡方式：\n對失衡節點做一次 "},
        {"右旋", "AV_blue"}, 
        {"。\n"},
        {"{右旋就是把左子提上來，自己變成右子。}"}
    }, Pos("n30", "top", 0, -20)); 
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Frame 2: Balanced
    av.start_frame_draw();
    draw_demo_node("n20", "20", Pos(500, 150));
    draw_demo_node("n30", "30", Pos(600, 300));
    av.arrow(Pos("n20", "bottom"), Pos("n30", "top"), {{"color", "black"}, {"width", "2"}});

    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 70, 60), 200, 80, {{"text", "H-1"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -100, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_R2", Pos("n30", "bottom", -70, 60), 350, 80, {{"text", "H"}});
    av.draw_triangle("st_n20_R", Pos("n30", "bottom", -70, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_word("bf=[0~1]", Pos("n30", "right", 10, 0));
    av.draw_word("bf=[-1~0]", Pos("n20", "right", 10, 0));
    av.colored_text({
        {"{LL 型 (Left-Left Case)\n", "", "", "20"},
        {"當失衡位置位於失衡節點的 左子的左子樹時。\n\n"},
        {"平衡方式：\n對失衡節點做一次 "},
        {"右旋", "AV_blue"}, 
        {"。}\n"},
        {"右旋就是把左子提上來，自己變成右子。"},
    }, Pos("n20", "top", 0, -20)); 
    av.auto_camera(0.85); 
    av.sleep(); 
    av.end_frame_draw();


    // ===== LR 型 (Left-Right Case) =====
    // Frame 1: Before Step 1
    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150), "AV_node_red");
    draw_demo_node("n10", "10", Pos(300, 300));
    draw_demo_node("n20", "20", Pos(400, 450));
    av.arrow(Pos("n30", "bottom"), Pos("n10", "top"), {{"color", "black"}, {"width", "2"}});
    av.arrow(Pos("n10", "bottom"), Pos("n20", "top"), {{"color", "black"}, {"width", "2"}});

    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 350, 80, {{"text", "H"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n10_L", Pos("n10", "bottom", -100, 60), 350, 80, {{"text", "H"}});
    av.arrow(Pos("n10", "bottom"), Pos("st_n10_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n20", "bottom", -50, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.draw_triangle("st_n20_L2", Pos("n20", "bottom", -50, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 50, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.draw_triangle("st_n20_R2", Pos("n20", "bottom", 50, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_word("bf=2", Pos("n30", "right", 10, 0));
    av.draw_word("bf=-1", Pos("n10", "right", 10, 0));
    av.draw_word("bf=[-1~1]", Pos("n20", "right", 10, 0));
    
    av.colored_text({
        {"LR 型 (Left-Right Case)\n", "", "", "20"},
        {"當失衡位置位於失衡節點的 左{子:ㄗˇ}的右{子:ㄗˇ}樹時。\n\n"},
        {"平衡方式：\n"},
        {"第一步：對左{子:ㄗˇ}做一次 "},
        {"左旋","AV_green"},
        {"{，轉成 LL 型。\n"},
        {"第二步：對失衡節點做一次 "},
        {"右旋","AV_blue"},
        {" ，轉成平衡狀態。}"}
    }, Pos("n30", "top", 0, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Frame 2: LL State
    av.start_frame_draw();
    draw_demo_node("n30", "30", Pos(500, 150), "AV_node_red");
    draw_demo_node("n20", "20", Pos(400, 300));
    draw_demo_node("n10", "10", Pos(300, 450));
    av.arrow(Pos("n30", "bottom"), Pos("n20", "top"), {{"color", "black"}, {"width", "2"}});
    av.arrow(Pos("n20", "bottom"), Pos("n10", "top"), {{"color", "black"}, {"width", "2"}});

    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 100, 60), 350, 80, {{"text", "H"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n10_L", Pos("n10", "bottom", -50, 60), 350, 80, {{"text", "H"}});
    av.arrow(Pos("n10", "bottom"), Pos("st_n10_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n10", "bottom", 50, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.draw_triangle("st_n20_L2", Pos("n10", "bottom", 50, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n10", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n20", "bottom", 100, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.draw_triangle("st_n20_R2", Pos("n20", "bottom", 100, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n20", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});
    
    av.draw_word("bf=2", Pos("n30", "right", 10, 0));
    av.draw_word("bf=[0~1]", Pos("n10", "right", 10, 0));
    av.draw_word("bf=[1~2]", Pos("n20", "right", 10, 0));

    av.colored_text({
        {"{LR 型 (Left-Right Case)\n", "", "", "20"},
        {"當失衡位置位於失衡節點的 左子的右子樹時。\n\n"},
        {"平衡方式：\n"},
        {"第一步：對左子做一次 "},
        {"左旋}","AV_green"},
        {"，轉成 LL 型。\n"},
        {"第二步：對失衡節點做一次 "},
        {"右旋","AV_blue"},
        {"{ ，轉成平衡狀態。}"}
    }, Pos("n30", "top", 0, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Frame 3: Final Balanced
    av.start_frame_draw();
    draw_demo_node("n20", "20", Pos(500, 150));
    draw_demo_node("n10", "10", Pos(400, 300));
    draw_demo_node("n30", "30", Pos(600, 300));
    av.arrow(Pos("n20", "bottom"), Pos("n30", "top"), {{"color", "black"}, {"width", "2"}});
    av.arrow(Pos("n20", "bottom"), Pos("n10", "top"), {{"color", "black"}, {"width", "2"}});

    av.draw_triangle("st_n30_R", Pos("n30", "bottom", 50, 60), 350, 80, {{"text", "H"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n30_R", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n10_L", Pos("n10", "bottom", -50, 60), 350, 80, {{"text", "H"}});
    av.arrow(Pos("n10", "bottom"), Pos("st_n10_L", "top"), {{"color", "black"},{"width","2"}});

    av.draw_triangle("st_n20_L", Pos("n10", "bottom", 50, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.draw_triangle("st_n20_L2", Pos("n10", "bottom", 50, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n10", "bottom"), Pos("st_n20_L", "top"), {{"color", "black"},{"width","2"}});
    av.draw_triangle("st_n20_R", Pos("n30", "bottom", -50, 60), 350, 80, {{"text", "H"}, {"color", "AV_orange"}});
    av.draw_triangle("st_n20_R2", Pos("n30", "bottom", -50, 60), 200, 80, {{"text", "H-1"}, {"color", "rgba(165, 214, 167, 1)"}});
    av.arrow(Pos("n30", "bottom"), Pos("st_n20_R", "top"), {{"color", "black"},{"width","2"}});
    
    av.draw_word("bf=[-1~0]", Pos("n30", "right", 10, 0));
    av.draw_word("bf=[0~1]", Pos("n10", "right", 10, 0));
    av.draw_word("bf=0", Pos("n20", "right", 10, 0));

    av.colored_text({
        {"{LR 型 (Left-Right Case)\n", "", "", "20"},
        {"當失衡位置位於失衡節點的 左子的右子樹時。\n\n"},
        {"平衡方式：\n"},
        {"第一步：對左子做一次 "},
        {"左旋","AV_green"},
        {"，轉成 LL 型。\n"},
        {"第二步：對失衡節點做一次 "},
        {"右旋}","AV_blue"},
        {" ，轉成平衡狀態。"}
    }, Pos("n20", "top", 0, -20));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();


    // 正式開始
    Root = NULL;
    av.start_frame_draw();
    av.frame_draw("tree_root", Pos(500, -110), vector<string>{"Root"}, {{{"background","#CCCCCC"},{0}}});
    av.key_frame_draw("tree_root", Pos(500, -110), vector<string>{"Root"}, {{{"background","#CCCCCC"},{0}}});
    av.text("接下來進入實際操作流程", Pos("tree_root", "bottom", 0, 20));
    av.key_text("接下來進入實際操作流程", Pos("tree_root", "bottom", 0, 20));
    av.auto_camera(0.85);
    av.end_frame_draw();
    
    int Cas=0;
    //}

    int op, val;
    while (cin >> op >> val) {
        //draw{
        string task_msg = "";
        if (op == 1) task_msg = "現在要插入節點 " + to_string(val);
        else if (op == 3) task_msg = "現在要刪除節點 " + to_string(val);
        
        av.start_frame_draw();
        draw_tree_content(true, false);
        av.text(task_msg, Pos("tree_root", "bottom", 0, 20));
        av.auto_camera(0.85);
        av.end_frame_draw();

        if(Cas++>=5)av.fast();
        //}
        if (op == 1) {
            Root = insert(Root, val);
            //draw{
            task_msg = "節點 " + to_string(val) + " 插入完成";
            //}
        } else if (op == 3) {
            Root = remove_node(Root, val);
            //draw{
            task_msg = "節點 " + to_string(val) + " 刪除完成";
            //}
        }
        //draw{
        av.start_frame_draw();
        draw_tree_content(false, false, false, true);
        av.text(task_msg, Pos("tree_root", "bottom", 0, 20));
        av.key_text(task_msg, Pos("tree_root", "bottom", 0, 20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    //draw{
    av.start_frame_draw();
    draw_tree_content(false, false, false, true);
    av.text("所有操作結束", Pos("tree_root", "bottom", 0, 20));
    av.key_text("所有操作結束", Pos("tree_root", "bottom", 0, 20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.end_draw();
    //}

    return 0;
}
