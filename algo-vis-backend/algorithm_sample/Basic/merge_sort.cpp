#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
vector<int> arr_global;
int max_d = 0;
//}

//draw{
// 計算位置的輔助函式
Pos get_node_pos(int L, int R, int data_size, int y_level) {
    double slot_w = 60.0; 
    double cell_w = 40.0; 
    double center_x = 550 + ((L + R) / 2.0 - (arr_global.size()-1) / 2.0) * slot_w;
    double draw_x = center_x - (data_size * cell_w / 2.0);
    double draw_y = 100 + y_level * 100;
    return Pos(draw_x, draw_y);
}
//}


int get_depth(int n) { int d = 0, s = 1; while (s < n) { s *= 2; d++; } return d; }

void perform_merge(int L, int mid, int R, int depth) {
    //draw{
    string my_id = "m_" + to_string(L) + "_" + to_string(R) + "_" + to_string(depth);
    string left_id = "m_" + to_string(L) + "_" + to_string(mid) + "_" + to_string(depth + 1);
    string right_id = "m_" + to_string(mid + 1) + "_" + to_string(R) + "_" + to_string(depth + 1);
    //}

    vector<int> merged_data(R - L + 1, 0);

    //draw{
    int y_level = 2 * max_d - depth + 1;
    Pos my_pos = get_node_pos(L, R, merged_data.size(), y_level);
    //}

    vector<int> l_v(arr_global.begin() + L, arr_global.begin() + mid + 1);
    vector<int> r_v(arr_global.begin() + mid + 1, arr_global.begin() + R + 1);

    int i = 0, j = 0, k = 0;

    //draw{
    auto draw_merging_step = [&](string msg, int k_idx, int l_idx, int r_idx) {
        av.start_frame_draw();
        av.accu_draw(); // 畫出歷史累積背景

        // 1. 繪製合併中的陣列 (my_id)
        vector<array_style> m_styles;
        if (k_idx > 0) m_styles.push_back({{"mark"}, AV::AtoB(0, k_idx - 1)}); // 已確定的部分用 mark
        m_styles.push_back({{"point"}, {k_idx}});                             // 目前決定的格用 point 指
        m_styles.push_back({{"highlight"}, {k_idx}});                         // 同時加上 highlight
        av.frame_draw(my_id, my_pos, merged_data, m_styles);

        // 2. 畫出指向目前陣列的暫時箭頭
        av.arrow(Pos(left_id, "bottom"), Pos(my_id, "top"), {{"color", "#000000ff"}, {"width", "2px"}});
        av.arrow(Pos(right_id, "bottom"), Pos(my_id, "top"), {{"color", "#000000ff"}, {"width", "2px"}});

        // 3. 繪製並渲染來源陣列狀態
        Pos l_pos = get_node_pos(L, mid, l_v.size(), 2 * max_d - (depth + 1) + 1);
        vector<array_style> l_styles;
        if (l_idx == -1) { // 代表左邊已經全部取完
            l_styles.push_back({{"background", "#ccc"}, AV::AtoB(0, (int)l_v.size() - 1)});
        } else {
            if (l_idx > 0) l_styles.push_back({{"background", "#ccc"}, AV::AtoB(0, l_idx - 1)});
            l_styles.push_back({{"highlight"}, {l_idx}});
        }
        av.frame_draw(left_id, l_pos, l_v, l_styles);

        Pos r_pos = get_node_pos(mid + 1, R, r_v.size(), 2 * max_d - (depth + 1) + 1);
        vector<array_style> r_styles;
        if (r_idx == -1) { // 代表右邊已經全部取完
            r_styles.push_back({{"background", "#ccc"}, AV::AtoB(0, (int)r_v.size() - 1)});
        } else {
            if (r_idx > 0) r_styles.push_back({{"background", "#ccc"}, AV::AtoB(0, r_idx - 1)});
            r_styles.push_back({{"highlight"}, {r_idx}});
        }
        av.frame_draw(right_id, r_pos, r_v, r_styles);

        av.colored_text({{msg}}, Pos(my_id, "bottom", 0, 40));
        av.camera(Pos(my_id, "top"), 1.7); // 關注最底下的陣列的上面錨點
        av.end_frame_draw();
    };
    //}


    while (i < l_v.size() && j < r_v.size()) {
        if (l_v[i] <= r_v[j]) {
            //draw{
            draw_merging_step("左側小取左", k, i, j);
            //}
            merged_data[k] = l_v[i++];
        } else {
            //draw{
            draw_merging_step("右側小取右", k, i, j);
            //}
            merged_data[k] = r_v[j++];
        }
        k++;
    }
    while (i < l_v.size()) {
        //draw{
        draw_merging_step("補齊左側", k, i, -1);
        //}
        merged_data[k++] = l_v[i++];
    }
    while (j < r_v.size()) {
        //draw{
        draw_merging_step("補齊右側", k, -1, j);
        //}
        merged_data[k++] = r_v[j++];
    }

    // 更新全域陣列
    for (int idx = 0; idx < k; idx++) arr_global[L + idx] = merged_data[idx];

    //draw{
    // 合併完全結束後，將最終結果與箭頭正式存入歷史 (存入時為乾淨白色，不帶動態樣式)
    av.accu_store(my_id, my_pos, merged_data, {{{"background", "white"}, AV::AtoB(0, (int)merged_data.size() - 1)}});
    av.accu_store_arrow(Pos(left_id, "bottom"), Pos(my_id, "top"), {{"color", "#000000ff"}, {"width", "2px"}});
    av.accu_store_arrow(Pos(right_id, "bottom"), Pos(my_id, "top"), {{"color", "#000000ff"}, {"width", "2px"}});
    //}

    //draw{
    // 將來源子節點設為淺灰色背景並更新到歷史，表示已消耗
    Pos l_pos = get_node_pos(L, mid, l_v.size(), 2 * max_d - (depth + 1) + 1);
    Pos r_pos = get_node_pos(mid + 1, R, r_v.size(), 2 * max_d - (depth + 1) + 1);
    av.accu_store(left_id, l_pos, l_v, {{{"background", "#ccc"}, AV::AtoB(0, (int)l_v.size() - 1)}});
    av.accu_store(right_id, r_pos, r_v, {{{"background", "#ccc"}, AV::AtoB(0, (int)r_v.size() - 1)}});
    //}

    //draw{
    // 畫出合併完成的穩定幀
    av.start_frame_draw();
    av.accu_draw();
    av.colored_text({{"區間合併完成"}}, Pos(my_id, "bottom", 0, 40));
    av.camera(Pos(my_id, "top"), 1.7); // 跟合併過程幀保持一致的鏡頭
    av.end_frame_draw();
    //}
}

void merge_sort(int L, int R, int depth, string pid = "", int split_type = 0) {
    // split_type: 0 = root, 1 = left, 2 = right
    
    //draw{
    string my_id = "s_" + to_string(L) + "_" + to_string(R) + "_" + to_string(depth);
    vector<int> current(arr_global.begin() + L, arr_global.begin() + R + 1);
    Pos my_pos = get_node_pos(L, R, current.size(), depth);

    // 確定訊息
    string msg = "向下分裂";
    if (split_type == 0) msg = "開始分裂";
    else if (split_type == 1) msg = "分裂出左半部";
    else if (split_type == 2) msg = "分裂出右半部";

    // 存入歷史
    av.accu_store(my_id, my_pos, current, {{{"background", "white"}, AV::AtoB(0, (int)current.size() - 1)}});
    if (!pid.empty()) {
        av.accu_store_arrow(Pos(pid, "bottom"), Pos(my_id, "top"), {{"color", "#000000ff"}, {"width", "2px"}});
    }

    // 顯示繪圖幀
    av.start_frame_draw();
    av.accu_draw();
    av.colored_text({{msg}}, Pos(my_id, "bottom", 0, 40));
    av.auto_camera();
    av.end_frame_draw();
    //}

    if (L >= R) {
        //draw{
        string m_id = "m_" + to_string(L) + "_" + to_string(R) + "_" + to_string(depth);
        Pos m_pos = get_node_pos(L, R, current.size(), 2 * max_d - depth + 1);
        //}

        //draw{
        av.accu_store(m_id, m_pos, current, {{{"background", "white"}, {0}}});
        av.accu_store_arrow(Pos(my_id, "bottom"), Pos(m_id, "top"), {{"color", "#000000ff"}, {"width", "2px"}});
        //}

        //draw{
        av.start_frame_draw();
        av.accu_draw();
        av.colored_text({{"到底就停"}}, Pos(m_id, "bottom", 0, 40));
        av.auto_camera();
        av.end_frame_draw();
        //}
        return;
    }

    int mid = L + (R - L) / 2;
    merge_sort(L, mid, depth + 1, my_id, 1);
    merge_sort(mid + 1, R, depth + 1, my_id, 2);
    perform_merge(L, mid, R, depth);
}

int main() {
    int n; cin >> n;
    arr_global.resize(n);
    for (int i = 0; i < n; i++) cin >> arr_global[i];
    max_d = get_depth(arr_global.size());
    //draw{
    av.start_draw();

    // 開場說明
    av.start_frame_draw();
    av.frame_draw("num",Pos(390, 100),arr_global);
    av.colored_text({{"Merge Sort (合併排序)\n透過遞迴分裂陣列，再將有序的子陣列合併起來來排序"}}, Pos("num", "bottom", 0, 40));
    av.auto_camera(); // 初始對齊
    av.end_frame_draw();
    //}
    merge_sort(0, arr_global.size() - 1, 0);
    //draw{
    av.start_frame_draw();
    av.accu_draw();
    string root_m_id = "m_0_" + to_string((int)arr_global.size()-1) + "_0";
    av.colored_text({{"Merge Sort 排序完成！"}}, Pos(root_m_id, "bottom", 0, 40));
    av.auto_camera(); // 完成後查看全景
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}
