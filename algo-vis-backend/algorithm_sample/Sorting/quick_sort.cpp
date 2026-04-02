#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;

void quick_sort(vector<int>& arr, int low, int high, string& _draw_last_id, Pos& _draw_last_pos, set<int>& _draw_sorted_indices) {
    //draw{
    int _draw_x_base = 350;
    int _draw_y_gap = 110;

    // --- 剩餘一格或空區間的說明影格 ---
    if (low >= high) {
        if (low == high) {
            string _draw_current_id = "pass_" + to_string(_draw_last_id == "init" ? 1 : stoi(_draw_last_id.substr(5)) + 1);
            Pos _draw_current_pos((double)_draw_x_base, _draw_last_pos.y + _draw_y_gap);
            
            _draw_sorted_indices.insert(low); 
            av.start_frame_draw();
            av.accu_draw();
            av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
                {{"highlight"}, {low}},
                {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
            av.text("範圍內僅剩元素 " + to_string(arr[low]) + "，不需再分區交換，直接視為已排序", Pos(_draw_current_id, "bottom", 0, 35));
            av.camera(Pos(_draw_current_id), 1.7);
            av.end_frame_draw();

            av.accu_store(_draw_current_id, _draw_current_pos, arr, {{{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}}, {0}, "normal", 0, 1);
            av.accu_store_arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));

            _draw_last_id = _draw_current_id;
            _draw_last_pos = _draw_current_pos;
        }
        return;
    }

    string _draw_current_id = "pass_" + to_string(_draw_last_id == "init" ? 1 : stoi(_draw_last_id.substr(5)) + 1);
    Pos _draw_current_pos((double)_draw_x_base, _draw_last_pos.y + _draw_y_gap);
    //}

    int pivot = arr[high];
    int i = low;

    //draw{
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
        {{"point"}, {high}},                     
        {{"highlight"}, AV::AtoB(low, high)},      
        {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
    }, {0}, "normal", 0, 1);
    av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
    av.text("現在處理範圍 [" + to_string(low) + "{,:到}" + to_string(high) + "]，選取最右端 " + to_string(pivot) + " 作為基準點", Pos(_draw_current_id, "bottom", 0, 35));
    av.camera(Pos(_draw_current_id), 1.7);
    av.end_frame_draw();
    //}

    for (int j=low; j<high; j++) {
        //draw{
        av.start_frame_draw();
        av.accu_draw();
        vector<int> _draw_lt, _draw_gt;
        for (int k = low; k <= j; k++) {
            if (arr[k] < pivot) _draw_lt.push_back(k);
            else if (arr[k] > pivot) _draw_gt.push_back(k);
        }

        av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
            {{"point"}, {high}},                  
            {{"highlight"}, {j}},                 
            {{"background", "rgba(255, 82, 82, 0.45)"}, _draw_lt}, 
            {{"background", "rgba(56, 255, 56, 0.45)"}, _draw_gt},
            {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
        }, {0}, "normal", 0, 1);
        av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
        av.text("比較 " + to_string(arr[j]) + (arr[j] < pivot ? " < " : " >= ") + to_string(pivot) + (arr[j] < pivot ? "" : " 不用換"), Pos(_draw_current_id, "bottom", 0, 35));
        av.camera(Pos(_draw_current_id), 1.7);
        av.end_frame_draw();
        //}

        if (arr[j] < pivot) {
            if (i != j) {
                //draw{
                av.start_frame_draw();
                av.accu_draw();
                vector<int> _draw_lt2, _draw_gt2;
                for (int k = low; k <= j; k++) {
                    if (arr[k] < pivot) _draw_lt2.push_back(k);
                    else if (arr[k] > pivot) _draw_gt2.push_back(k);
                }
                av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
                    {{"point"}, {high}}, 
                    {{"highlight"}, {i, j}},
                    {{"background", "rgba(255, 82, 82, 0.45)"}, _draw_lt2},
                    {{"background", "rgba(56, 255, 56, 0.45)"}, _draw_gt2},
                    {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
                }, {0}, "normal", 0, 1);
                av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
                av.text(to_string(arr[j]) + " 較小，換到左側區塊", Pos(_draw_current_id, "bottom", 0, 35));
                av.camera(Pos(_draw_current_id), 1.7);
                av.end_frame_draw();
                //}
                swap(arr[i], arr[j]);
                //draw{
                av.start_frame_draw();
                av.accu_draw();
                vector<int> _draw_lt3, _draw_gt3;
                for (int k = low; k <= j; k++) {
                    if (arr[k] < pivot) _draw_lt3.push_back(k);
                    else if (arr[k] > pivot) _draw_gt3.push_back(k);
                }
                av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
                    {{"point"}, {high}}, 
                    {{"highlight"}, {i, j}},
                    {{"background", "rgba(255, 82, 82, 0.45)"}, _draw_lt3},
                    {{"background", "rgba(56, 255, 56, 0.45)"}, _draw_gt3},
                    {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
                }, {0}, "normal", 0, 1);
                av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
                av.text("交換完成", Pos(_draw_current_id, "bottom", 0, 35));
                av.camera(Pos(_draw_current_id), 1.7);
                av.end_frame_draw();
                //}
            } else {
                //draw{
                av.start_frame_draw();
                av.accu_draw();
                vector<int> _draw_lt_ns, _draw_gt_ns;
                for (int k = low; k <= j; k++) {
                    if (arr[k] < pivot) _draw_lt_ns.push_back(k);
                    else if (arr[k] > pivot) _draw_gt_ns.push_back(k);
                }
                av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
                    {{"point"}, {high}}, 
                    {{"highlight"}, {i}}, 
                    {{"background", "rgba(255, 82, 82, 0.45)"}, _draw_lt_ns},
                    {{"background", "rgba(56, 255, 56, 0.45)"}, _draw_gt_ns},
                    {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
                }, {0}, "normal", 0, 1);
                av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
                av.text(to_string(arr[j]) + " 已在正確的左側位置，不需交換", Pos(_draw_current_id, "bottom", 0, 35));
                av.camera(Pos(_draw_current_id), 1.7);
                av.end_frame_draw();
                //}
            }
            i++;
        }
    }

    if (i != high) {
        //draw{
        av.start_frame_draw();
        av.accu_draw();
        vector<int> _draw_final_lt, _draw_final_gt;
        for (int k = low; k < high; k++) {
            if (arr[k] < pivot) _draw_final_lt.push_back(k);
            else if (arr[k] > pivot) _draw_final_gt.push_back(k);
        }
        av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
            {{"highlight"}, {i, high}},
            {{"background", "rgba(255, 82, 82, 0.45)"}, _draw_final_lt},
            {{"background", "rgba(56, 255, 56, 0.45)"}, _draw_final_gt},
            {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
        }, {0}, "normal", 0, 1);
        av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
        av.text("分區完成，將基準點 " + to_string(pivot) + " 歸位到較大區的左邊 (索引: " + to_string(i) + ")", Pos(_draw_current_id, "bottom", 0, 35));
        av.camera(Pos(_draw_current_id), 1.7);
        av.end_frame_draw();
        //}
        swap(arr[i], arr[high]);
    } else {
        //draw{
        av.start_frame_draw();
        av.accu_draw();
        vector<int> _draw_final_lt, _draw_final_gt;
        for (int k = low; k < high; k++) {
            if (arr[k] < pivot) _draw_final_lt.push_back(k);
            else if (arr[k] > pivot) _draw_final_gt.push_back(k);
        }
        av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
            {{"highlight"}, {high}},
            {{"background", "rgba(255, 82, 82, 0.45)"}, _draw_final_lt},
            {{"background", "rgba(56, 255, 56, 0.45)"}, _draw_final_gt},
            {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
        }, {0}, "normal", 0, 1);
        av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
        av.text("所有元素皆較小，基準點 " + to_string(pivot) + " 已在正確位置", Pos(_draw_current_id, "bottom", 0, 35));
        av.camera(Pos(_draw_current_id), 1.7);
        av.end_frame_draw();
        //}
    }

    //draw{
    _draw_sorted_indices.insert(i);
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(_draw_current_id, _draw_current_pos, arr, {
        {{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}
    }, {0}, "normal", 0, 1);
    av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));
    av.text("基準點已固定，繼續遞迴處理兩側", Pos(_draw_current_id, "bottom", 0, 35));
    av.camera(Pos(_draw_current_id), 1.7);
    av.end_frame_draw();

    av.accu_store(_draw_current_id, _draw_current_pos, arr, {{{"mark"}, vector<int>(_draw_sorted_indices.begin(), _draw_sorted_indices.end())}}, {0}, "normal", 0, 1);
    av.accu_store_arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_current_id, "top"));

    _draw_last_id = _draw_current_id;
    _draw_last_pos = _draw_current_pos;
    //}

    quick_sort(arr, low, i - 1, _draw_last_id, _draw_last_pos, _draw_sorted_indices);
    quick_sort(arr, i + 1, high, _draw_last_id, _draw_last_pos, _draw_sorted_indices);
}

int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for (int i=0; i<n; i++) cin>>arr[i];

    //draw{
    av.start_draw();
    int _draw_x_base = 350;
    int _draw_y_base = 100;

    string _draw_last_id = "init";
    Pos _draw_last_pos((double)_draw_x_base, (double)_draw_y_base);
    set<int> _draw_sorted_indices;

    av.accu_store(_draw_last_id, _draw_last_pos, arr, {}, {0}, "normal", 0, 1);
    
    av.start_frame_draw();
    av.accu_draw();
    av.colored_text({{"Quick Sort (快速排序)\n選取基準點 並進行分區來排序的方法"}}, Pos(_draw_last_id, "top", 0, -80));
    av.auto_camera(); 
    av.end_frame_draw();
    //}
    quick_sort(arr, 0, n - 1, _draw_last_id, _draw_last_pos, _draw_sorted_indices);
    //draw{
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(_draw_last_id, _draw_last_pos, arr, {{{"mark"}, AV::AtoB(0, n - 1)}}, {0}, "normal", 0, 1);
    av.text("Quick Sort 完成！", Pos(_draw_last_id, "bottom", 0, 45));
    av.auto_camera(); 
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}
