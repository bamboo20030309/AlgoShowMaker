#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

//draw{
AV av;
TreeLayout tree(2, Pos(500, 100), 80.0, 200.0);

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

void draw_tree_content(bool highlight_root_ptr = false, bool show_focus = true, bool hide_root_arrow = false) {
    tree.nodes.clear();
    tree.vals.clear();
    sync_tree_layout(Root);
    tree.update_layout();
    
    // 如果不顯示焦點，暫時將游標移走
    int old_d = tree.curr_d;
    if (!show_focus) tree.curr_d = -1;
    
    tree.redraw(av); 
    
    // 恢復游標
    if (!show_focus) tree.curr_d = old_d;
    
    // 全局 Root 指針盒
    vector<array_style> root_ptr_style = {{{"background","#cccccc"},{0}}};
    if (highlight_root_ptr) {
        root_ptr_style.push_back({{"highlight"}, {0}});
        root_ptr_style.push_back({{"point"}, {0}});
    }
    av.frame_draw("tree_root", Pos(500, -80), vector<string>{"Root"}, root_ptr_style);
    
    if (Root && !hide_root_arrow) {
        // 從指針盒下緣畫一條虛線箭頭到目前的根節點上緣
        av.arrow(Pos("tree_root", "bottom"), Pos(tree.get_id(0, 0), "top"), {
            {"color", "black"}, 
            {"width", "2"}, 
            {"dash", "10,5"}
        });
    }
    
    av.accu_draw();
}

void draw_tree(string title = "") {
    av.start_frame_draw();
    draw_tree_content();
    if (title != "") {
        // 如果樹非空，將文字綁定在當前游標節點下；否則放頂端
        if (tree.nodes.count({tree.curr_d, tree.curr_o})) {
            av.text(title, Pos(tree.get_id(tree.curr_d, tree.curr_o), "bottom", 0, 10));
        } else {
            av.text(title, Pos(500, 10));
        }
    }
    av.auto_camera(0.8);
    av.end_frame_draw();
}
//}

Node* insert(Node* root, int val) {
    string node_id = tree.get_id(tree.curr_d, tree.curr_o);
    //draw{
    if (root) {
        av.start_frame_draw();
        draw_tree_content();
        if (val == root->val) {
            av.frame_draw("moving_val", Pos(node_id, "left top", 0, -90), vector<int>{val});
            av.text(to_string(val) + " = " + to_string(root->val) + "，已存在相同節點，不需要再額外新增", Pos(node_id, "bottom", 0, 10));
        } else {
            string side = (val > root->val) ? "top right" : "top left";
            double offset_x = (val > root->val) ? 20.0 : -70.0;
            string cmp = (val > root->val) ? " > " : " < ";
            string direction = (val > root->val) ? "，往右走" : "，往左走";
            av.frame_draw("moving_val", Pos(node_id, side, offset_x, 0), vector<int>{val});
            av.text(to_string(val) + cmp + to_string(root->val) + direction, Pos(node_id, "bottom", 0, 10));
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
        // 暫時將新節點加入佈局以計算坐標
        tree.nodes.insert({tree.curr_d, tree.curr_o});
        tree.vals[{tree.curr_d, tree.curr_o}] = to_string(val);
        tree.update_layout();
        Pos target_p = tree.get_pos(tree.curr_d, tree.curr_o);
        
        draw_tree_content(); 
        av.frame_draw("moving_val", target_p, vector<int>{val}, {{{"highlight"}, {0}}, {{"point"}, {0}}});
        av.text("找到空位！將節點 " + to_string(val) + " 放置於此點", Pos("moving_val", "bottom", 0, 10));
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
    }
    return root;
}

bool search(Node* root, int val) {
    if (!root) {
        //draw{
        string parent_id = (tree.curr_d > 0) ? tree.get_id(tree.curr_d - 1, tree.curr_o / 2) : "tree_root";
        av.start_frame_draw();
        draw_tree_content();
        av.text("沒辦法再繼續往下走，因此找不到 " + to_string(val), Pos(parent_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        return false;
    }
    //draw{
    string node_id = tree.get_id(tree.curr_d, tree.curr_o);
    //}
    if (root->val == val) {
        //draw{
        // 找到了
        tree.node_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7"; // 指定綠色
        av.start_frame_draw();
        draw_tree_content();
        av.text(to_string(val) + " = " + to_string(root->val) + "，找到了！", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        tree.node_colors.erase({tree.curr_d, tree.curr_o});
        av.stop();
        //}
        return true;
    }

    //draw{
    // 影格 2: 說明為什麼往哪走
    av.start_frame_draw();
    draw_tree_content();
    string reason = (val > root->val) ? " > " : " < ";
    string direction = (val > root->val) ? "，往右走" : "，往左走";
    av.text(to_string(val) + reason + to_string(root->val) + direction, Pos(node_id, "bottom", 0, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    //}

    if (val < root->val) {
        //draw{
        tree.push(0);
        //}
        bool res = search(root->left, val);
        //draw{
        tree.pop();
        //}
        return res;
    } else {
        //draw{
        tree.push(1);
        //}
        bool res = search(root->right, val);
        //draw{
        tree.pop();
        //}
        return res;
    }
}

Node* find_min(Node* root) {
    if (!root) return NULL;
    //draw{
    int p_cnt = 0;
    string node_id = tree.get_id(tree.curr_d, tree.curr_o);
    //}
    while (root->left) {
        //draw{
        av.start_frame_draw();
        draw_tree_content();
        av.text("尋找繼承者 (右子樹之最小)", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();

        tree.push(0);
        p_cnt++;
        //}
        root = root->left;
        //draw{
        node_id = tree.get_id(tree.curr_d, tree.curr_o);
        //}
    }
    
    //draw{
    // 找到繼承者
    tree.node_colors[{tree.curr_d, tree.curr_o}] = "#a5d6a7";
    av.start_frame_draw();
    draw_tree_content();
    av.text("無法繼續往左走，找到右子樹最小值：" + to_string(root->val) + " (繼承者)", Pos(node_id, "bottom", 0, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    tree.node_colors.erase({tree.curr_d, tree.curr_o});

    while(p_cnt--) tree.pop();
    //}
    return root;
}

Node* remove(Node* root, int val) {
    if (!root) {
        //draw{
        string parent_id = (tree.curr_d > 0) ? tree.get_id(tree.curr_d - 1, tree.curr_o / 2) : "tree_root";
        av.start_frame_draw();
        draw_tree_content();
        av.text("沒辦法再繼續往下走，因此找不到 " + to_string(val), Pos(parent_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
        return NULL;
    }
    //draw{
    string node_id = tree.get_id(tree.curr_d, tree.curr_o);
    //}
    if (val < root->val) {
        //draw{
        // 說明 (如同查詢)
        av.start_frame_draw();
        draw_tree_content();
        av.text(to_string(val) + " < " + to_string(root->val) + "，往左走", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();

        tree.push(0);
        //}
        root->left = remove(root->left, val);
        //draw{
        tree.pop();
        //}
    } else if (val > root->val) {
        //draw{
        // 說明 (如同查詢)
        av.start_frame_draw();
        draw_tree_content();
        av.text(to_string(val) + " > " + to_string(root->val) + "，往右走", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();

        tree.push(1);
        //}
        root->right = remove(root->right, val);
        //draw{
        tree.pop();
        //}
    } else {
        //draw{
        // 影格: 準備刪除 (切換為紅色彩標)
        tree.node_colors[{tree.curr_d, tree.curr_o}] = "#ef9a9a"; 

        av.start_frame_draw();
        draw_tree_content();
        av.text("找到 " + to_string(val) + " 了！ 準備刪除", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}

        if (!root->left || !root->right) {
            Node* temp = root->left ? root->left : root->right;
            
            //draw{
            if (!temp) {
                av.start_frame_draw();
                draw_tree_content();
                av.text("因為是葉節點，直接刪除", Pos(node_id, "bottom", 0, 10));
                av.auto_camera(0.85);
                av.end_frame_draw();
            } else {
                if (tree.curr_d > 0) tree.edge_colors[{tree.curr_d, tree.curr_o}] = "transparent";
                bool hide_root_arr = (tree.curr_d == 0);
                
                av.start_frame_draw();
                draw_tree_content(false, true, hide_root_arr);
                
                if (tree.curr_d > 0) tree.edge_colors.erase({tree.curr_d, tree.curr_o});
                
                string parent_id = (tree.curr_d > 0) ? tree.get_id(tree.curr_d - 1, tree.curr_o / 2) : "tree_root";
                string child_id = root->left ? tree.get_id(tree.curr_d + 1, tree.curr_o * 2) : tree.get_id(tree.curr_d + 1, tree.curr_o * 2 + 1);
                
                av.arrow(Pos(parent_id, "bottom"), Pos(child_id, "top"), {{"color", "red"}, {"width", "2"}});
                av.text("因為它有一個子節點，所以要將父節點重新連向其子節點", Pos(node_id, "bottom", 0, 10));
                
                av.auto_camera(0.85);
                av.end_frame_draw();
            }

            if (root == Root) Root = temp;
            tree.node_colors.erase({tree.curr_d, tree.curr_o});
            //}
            delete root;
            return temp;
        }
        
        //draw{
        // 雙子節點情況
        av.start_frame_draw();
        draw_tree_content();
        av.text("因為有兩個子節點，需要尋找右子樹最小值作為繼承者", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();

        tree.push(1); 
        //}
        Node* temp = find_min(root->right);
        int successor_val = temp->val;
        //draw{
        tree.pop(); 
        
        av.start_frame_draw();
        draw_tree_content();
        av.text("取得繼承者 " + to_string(successor_val) + "，將其值覆蓋至目標節點", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}

        root->val = successor_val;
        //draw{
        tree.node_colors.erase({tree.curr_d, tree.curr_o}); // 數值已取代，恢復原節點背景色

        av.start_frame_draw();
        draw_tree_content();
        av.text("現在要把剛剛的 " + to_string(successor_val) + " 刪除", Pos(node_id, "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();

        tree.push(1); 
        //}
        root->right = remove(root->right, successor_val);
        //draw{
        tree.pop(); 
        //}
    }
    return root;
}

int main() {
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool focus) {
        string val = tree.vals[{d, o}];
        vector<array_style> st;
        if (focus) { st.push_back({{"highlight"}, {0}}); st.push_back({{"point"}, {0}}); }
        // 渲染自訂節點顏色
        if (tree.node_colors.count({d, o})) {
            st.push_back({{"background", tree.node_colors[{d, o}]}, {0}});
        }
        av.frame_draw(id, p, vector<string>{val}, st);
    };
    av.start_draw();
    tree.show_edges = true;
    tree.mode = TreeLayout::INORDER;

    // 影格：開場說明
    av.start_frame_draw();
    draw_tree_content(false, false);
    av.text("這是二元搜尋樹 (BST)\n功能是搜尋速度快 (平均 O(log n))，且資料會自動排序\n建構規則是 左子樹之值 < 根節點 < 右子樹之值\n能夠 新增 (1)、查詢 (2)、刪除 (3)", Pos("tree_root", "bottom", 0, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    //}

    int op, val;
    while (cin >> op >> val) {
        //draw{
        // --- 任務開場說明 ---
        string task_msg = "";
        
        if (op == 1) task_msg = "現在要新增節點 " + to_string(val);
        else if (op == 2) task_msg = "現在要查詢節點 " + to_string(val);
        else if (op == 3) task_msg = "現在要刪除節點 " + to_string(val);

        av.start_frame_draw();
        draw_tree_content(true, false);
        // 說明文字統一綁定在 Root 指針方塊下方
        av.text(task_msg, Pos("tree_root", "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}

        if (op == 1) {
            Root = insert(Root, val);
            //draw{
            task_msg = "節點 " + to_string(val) + " 新增完成";
            //}
        } else if (op == 2) {
            search(Root, val);
            //draw{
            task_msg = "節點 " + to_string(val) + " 查詢完成";
            //}
        } else if (op == 3) {
            Root = remove(Root, val);
            //draw{
            task_msg = "節點 " + to_string(val) + " 刪除完成";
            //}
        }

        //draw{
        // 影格：展示最終結果
        av.start_frame_draw();
        draw_tree_content(false, false);
        av.text(task_msg, Pos("tree_root", "bottom", 0, 10));
        av.auto_camera(0.85);
        av.end_frame_draw();
        //}
    }
    
    //draw{
    // 影格：所有操作結束 (移除 highlight)
    av.start_frame_draw();
    draw_tree_content(false, false);
    av.text("所有操作結束", Pos("tree_root", "bottom", 0, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    
    av.end_draw();
    //}
    
    return 0;
}
