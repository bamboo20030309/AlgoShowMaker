#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

//draw{
AV av;
TreeLayout tree(2, Pos(500, 50), 60.0, 150.0);

struct Node {
    int val;
    Node *left, *right;
    Node(int v) : val(v), left(NULL), right(NULL) {}
};

// 用一個全域指針記錄樹根，確保每次繪製都是完整的樹
Node* GlobalRoot = NULL;

void sync_tree_layout(Node* root, int d = 0, int o = 0) {
    if (!root) return;
    tree.nodes.insert({d, o});
    tree.vals[{d, o}] = to_string(root->val);
    if (root->left) sync_tree_layout(root->left, d + 1, o * 2);
    if (root->right) sync_tree_layout(root->right, d + 1, o * 2 + 1);
}

void draw_tree(string title = "", int focus_d = -1, int focus_o = -1) {
    // 徹底清理舊狀態
    tree.nodes.clear();
    tree.vals.clear();
    // 由全域根節點重新建立視覺節點
    sync_tree_layout(GlobalRoot);
    tree.update_layout();

    av.start_frame_draw();
    int backup_d = tree.curr_d, backup_o = tree.curr_o;
    if (focus_d != -1) { tree.curr_d = focus_d; tree.curr_o = focus_o; }
    tree.redraw(av); 
    tree.curr_d = backup_d; tree.curr_o = backup_o;

    av.accu_draw();
    if (title != "") av.text(title, Pos(500, 30));
    av.auto_camera(0.8);
    av.end_frame_draw();
}
//}

Node* insert(Node* root, int val, int d = 0, int o = 0) {
    //draw{ 進入節點比對
    if (root) {
        draw_tree("正在比對 " + to_string(val) + " 與 " + to_string(root->val), d, o);
    }
    //}
    
    if (!root) {
        Node* newNode = new Node(val);
        //draw{ 新增葉子
        if (!GlobalRoot) GlobalRoot = newNode; 
        draw_tree("找到空位，插入新節點 " + to_string(val), d, o);
        //}
        return newNode;
    }
    
    if (val < root->val) {
        //draw{ 往左移動
        av.text(to_string(val) + " < " + to_string(root->val), Pos("tree_" + to_string(d) + "_" + to_string(o), "left", -20, 0));
        //}
        root->left = insert(root->left, val, d + 1, o * 2);
    } else if (val > root->val) {
        //draw{ 往右移動
        av.text(to_string(val) + " > " + to_string(root->val), Pos("tree_" + to_string(d) + "_" + to_string(o), "right", 20, 0));
        //}
        root->right = insert(root->right, val, d + 1, o * 2 + 1);
    }
    return root;
}

bool search(Node* root, int val, int d = 0, int o = 0) {
    if (!root) {
        //draw{ 查無此值
        draw_tree("找不到值 " + to_string(val) + " (到達空節點)", d, o);
        //}
        return false;
    }
    
    //draw{ 比對中
    draw_tree("正在搜尋 " + to_string(val) + "，目前節點：" + to_string(root->val), d, o);
    //}
    
    if (root->val == val) {
        //draw{ 找到啦
        av.text("找到了！節點值確為 " + to_string(val), Pos("tree_" + to_string(d) + "_" + to_string(o), "bottom", 0, 20));
        av.stop();
        //}
        return true;
    }
    
    if (val < root->val) return search(root->left, val, d + 1, o * 2);
    else return search(root->right, val, d + 1, o * 2 + 1);
}

Node* find_min(Node* root, int d, int o) {
    while (root->left) {
        //draw{ 找繼承者 (Successor)
        draw_tree("尋找右子樹最小節點...", d, o);
        //}
        root = root->left;
        d++; o *= 2;
    }
    return root;
}

Node* remove(Node* root, int val, int d = 0, int o = 0) {
    if (!root) return NULL;
    
    //draw{ 搜尋要刪除的節點
    draw_tree("搜尋刪除目標 " + to_string(val) + "，目前：" + to_string(root->val), d, o);
    //}

    if (val < root->val) root->left = remove(root->left, val, d + 1, o * 2);
    else if (val > root->val) root->right = remove(root->right, val, d + 1, o * 2 + 1);
    else {
        if (!root->left || !root->right) {
            //draw{
            draw_tree("找到目標！直接移除", d, o);
            //}
            Node* temp = root->left ? root->left : root->right;
            if (root == GlobalRoot) GlobalRoot = temp; // 處理刪除根節點
            delete root;
            return temp;
        }
        
        //draw{
        draw_tree("找到目標！有兩個子節點，需找右子節點最小值替換", d, o);
        //}
        Node* temp = find_min(root->right, d + 1, o * 2 + 1);
        int successor_val = temp->val;
        
        //draw{
        draw_tree("將目標節點值替換為 " + to_string(successor_val), d, o);
        //}
        
        root->val = temp->val;
        root->right = remove(root->right, temp->val, d + 1, o * 2 + 1);
    }
    return root;
}

int main() {
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool focus) {
        string val = tree.vals[{d, o}];
        vector<array_style> st;
        if (focus) { st.push_back({{"highlight"}, {0}}); st.push_back({{"point"}, {0}}); }
        av.frame_draw(id, p, vector<string>{val}, st);
    };
    av.start_draw();
    tree.show_edges = true;
    tree.mode = TreeLayout::INORDER;
    //}
    
    vector<int> vals = {50, 30, 70, 20, 40, 60, 80};
    for (int v : vals) GlobalRoot = insert(GlobalRoot, v);
    
    //draw{
    av.text("BST 建立完成！查詢 60", Pos(500, 30));
    av.stop();
    //}
    search(GlobalRoot, 60);
    
    //draw{
    av.text("刪除 50 (根節點)", Pos(500, 30));
    av.stop();
    //}
    GlobalRoot = remove(GlobalRoot, 50);
    
    //draw{
    draw_tree("操作結束");
    av.end_draw();
    //}
    
    return 0;
}
