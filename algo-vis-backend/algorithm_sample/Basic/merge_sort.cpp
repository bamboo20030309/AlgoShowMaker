#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

AV av;
vector<int> arr_global;
int max_d = 0;

struct Node {
    string id;
    int L, R, y_level;
    vector<int> data;
};
vector<Node> history;

struct Edge { string from, to; };
vector<Edge> edges;

// 輔助繪圖：繪製所有歷史節點、箭頭與字幕
void draw_all(string msg, string active_id = "", vector<int> highlights = {}, string src_l = "", int idx_l = -1, string src_r = "", int idx_r = -1) {
    //draw{
    av.start_frame_draw();
    
    // 1. 繪製所有節點 (初始背景為純白色)
    for (auto &n : history) {
        vector<array_style> styles;
        string bg = "white"; 
        
        if (n.id == active_id) {
            bg = "rgba(255, 68, 246, 0.45)"; // 目前操作節點為金黃色
            if (!highlights.empty()) styles.push_back({{"highlight"}, highlights});
        }
        
        // 若正在進行合併，高亮子節點中被比較的元素
        if (n.id == src_l && idx_l != -1) styles.push_back({{"highlight"}, {idx_l}});
        if (n.id == src_r && idx_r != -1) styles.push_back({{"highlight"}, {idx_r}});

        styles.push_back({{"background", bg}, AV::AtoB(0, (int)n.data.size()-1)});
        
        double slot_w = 60.0; 
        double cell_w = 40.0; 
        double center_x = 550 + ((n.L + n.R) / 2.0 - (arr_global.size()-1) / 2.0) * slot_w;
        double draw_x = center_x - (n.data.size() * cell_w / 2.0);
        
        // 修正重疊問題：
        // 分裂階段 y 軸由 0 開始往下：100 + depth * 100
        // 合併階段為了不重疊，將整體下移一個 offset
        // 分裂最深層是 max_d，合併最底層（一格）也畫在 max_d + 1
        // 最終合併回頂層（整條）則在 2 * max_d + 1
        double draw_y = 100 + n.y_level * 100;
        
        av.frame_draw(n.id, Pos(draw_x, draw_y), n.data, styles);
    }

    // 2. 繪製陣列之間的箭頭聯繫
    for (auto &e : edges) {
        av.arrow(Pos(e.from, "bottom"), Pos(e.to, "top"), {{"color", "#777777"}, {"width", "2"}});
    }
    
    // 3. 繁體中文人性化字幕
    av.colored_text({{msg}}, Pos(463, 40));
    av.end_frame_draw();
    //}
}

int get_depth(int n) { int d=0, s=1; while(s<n){s*=2; d++;} return d; }

void perform_merge(int L, int mid, int R, int depth) {
    string my_id = "m_" + to_string(L) + "_" + to_string(R) + "_" + to_string(depth);
    string left_id = "m_" + to_string(L) + "_" + to_string(mid) + "_" + to_string(depth+1);
    string right_id = "m_" + to_string(mid+1) + "_" + to_string(R) + "_" + to_string(depth+1);

    vector<int> merged_data(R - L + 1, 0);
    // 合併層級修正：2 * max_d - depth + 1，確保最底部的單格節點與分裂底部分開
    history.push_back({my_id, L, R, 2 * max_d - depth + 1, merged_data});
    
    //draw{
    edges.push_back({left_id, my_id});
    edges.push_back({right_id, my_id});
    //}

    vector<int> l_v, r_v;
    for(auto &h : history) {
        if(h.id == left_id) l_v = h.data;
        if(h.id == right_id) r_v = h.data;
    }

    int i = 0, j = 0, k = 0;
    while (i < l_v.size() && j < r_v.size()) {
        //draw{
        string msg = "合併比較：左側 [" + to_string(l_v[i]) + "] 與 右側 [" + to_string(r_v[j]) + "]";
        draw_all(msg, my_id, {}, left_id, i, right_id, j);
        //}
        
        if (l_v[i] <= r_v[j]) {
            merged_data[k] = l_v[i];
            i++;
        } else {
            merged_data[k] = r_v[j];
            j++;
        }
        //draw{
        for(auto &h : history) if(h.id == my_id) h.data = merged_data;
        draw_all("將較小者放入位置 " + to_string(k), my_id, {k});
        //}
        k++;
    }
    while (i < l_v.size()) {
        merged_data[k] = l_v[i];
        //draw{
        for(auto &h : history) if(h.id == my_id) h.data = merged_data;
        draw_all("補齊左側剩餘元素 " + to_string(l_v[i]), my_id, {k}, left_id, i);
        //}
        i++; k++;
    }
    while (j < r_v.size()) {
        merged_data[k] = r_v[j];
        //draw{
        for(auto &h : history) if(h.id == my_id) h.data = merged_data;
        draw_all("補齊右側剩餘元素 " + to_string(r_v[j]), my_id, {k}, right_id, j);
        //}
        j++; k++;
    }
    for(int idx=0; idx<merged_data.size(); idx++) arr_global[L+idx] = merged_data[idx];
}

void merge_sort(int L, int R, int depth, string parent_id = "") {
    string my_id = "s_" + to_string(L) + "_" + to_string(R) + "_" + to_string(depth);
    vector<int> current;
    for(int i=L; i<=R; ++i) current.push_back(arr_global[i]);
    
    history.push_back({my_id, L, R, depth, current});
    //draw{
    if (!parent_id.empty()) edges.push_back({parent_id, my_id});
    draw_all("DFS 向下分裂：區間 [" + to_string(L) + ", " + to_string(R) + "]", my_id);
    //}

    if (L >= R) {
        string m_id = "m_" + to_string(L) + "_" + to_string(R) + "_" + to_string(depth);
        // 單格節點在合併階段的 y_level 設定為 max_d + 1
        history.push_back({m_id, L, R, 2 * max_d - depth + 1, current});
        //draw{
        edges.push_back({my_id, m_id}); 
        draw_all("到達遞迴底部，轉向合併流程", m_id);
        //}
        return;
    }

    int mid = L + (R - L) / 2;
    merge_sort(L, mid, depth + 1, my_id);
    merge_sort(mid + 1, R, depth + 1, my_id);
    
    perform_merge(L, mid, R, depth);
}

int main() {
    arr_global = {38, 27, 43, 3, 9, 82, 10, 19};
    max_d = get_depth(arr_global.size());

    //draw{
    av.start_draw();
    //}

    merge_sort(0, arr_global.size() - 1, 0);

    //draw{
    draw_all("排序完成！菱形邊界已完整分開。");
    av.end_draw();
    //}
    return 0;
}
