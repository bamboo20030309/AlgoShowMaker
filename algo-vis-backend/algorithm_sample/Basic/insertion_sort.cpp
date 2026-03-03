#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;

int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for (int i=0; i<n; i++) cin>>arr[i];
    //draw{
    av.start_draw();
    int x_base = 350;
    int y_base = 100;
    int y_gap  = 110;

    string last_id = "init";
    Pos last_pos((double)x_base, (double)y_base);

    // --- 1. init: 初始狀態 ---
    av.accu_store(last_id, last_pos, arr, {}, {0}, "normal", 0, 1);
    
    av.start_frame_draw();
    av.accu_draw();
    av.colored_text({{"Insertion Sort (插入排序)\n將元素不斷與左側鄰居交換，直到鑽到正確位置"}}, Pos(last_id, "top", 0, -80));
    av.auto_camera(); 
    av.end_frame_draw();

    // --- 2. pass_1: 標記第一個元素 ---
    string pass1_id = "pass_1";
    Pos pass1_pos((double)x_base, last_pos.y + y_gap);

    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(pass1_id, pass1_pos, arr, {{{"mark"}, {0}}}, {0}, "normal", 0, 1);
    av.arrow(Pos(last_id, "bottom"), Pos(pass1_id, "top"));
    av.text("第一個元素 " + to_string(arr[0]) + " 已在正確位置", Pos(pass1_id, "bottom", 0, 35));
    av.camera(Pos(pass1_id), 1.7);
    av.end_frame_draw();

    av.accu_store(pass1_id, pass1_pos, arr, {{{"mark"}, {0}}}, {0}, "normal", 0, 1);
    av.accu_store_arrow(Pos(last_id, "bottom"), Pos(pass1_id, "top"));
    last_id = pass1_id;
    last_pos = pass1_pos;
    //}

    for (int i=1; i<n; i++) {
        //draw{
        string current_id = "pass_" + to_string(i + 1); 
        Pos current_pos((double)x_base, last_pos.y + y_gap);
        
        int moving_val = arr[i]; 

        // --- 提取元素影格 ---
        av.start_frame_draw();
        av.accu_draw();
        
        vector<int> ex_lt, ex_gt;
        for (int k = 0; k < i; k++) {
            if (arr[k] < moving_val) ex_lt.push_back(k);
            else if (arr[k] > moving_val) ex_gt.push_back(k);
        }

        av.frame_draw(current_id, current_pos, arr, {
            {{"highlight"}, {i}},
            {{"point"}, {i}},
            {{"background", "rgba(255, 82, 82, 0.45)"}, ex_lt}, 
            {{"background", "rgba(56, 255, 56, 0.45)"}, ex_gt}, 
            {{"mark"}, AV::AtoB(0, i - 1)}
        }, {0}, "normal", 0, 1);
        av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
        av.text("拿到 " + to_string(moving_val) + " 準備向前插入", Pos(current_id, "bottom", 0, 35));
        av.camera(Pos(current_id), 1.7);
        av.end_frame_draw();
        
        bool moved = false;
        //}
        int j;
        for (j=i; j>0 && arr[j]<arr[j-1]; j--) {
            //draw{
            moved = true;
            // --- 比較與準備交換影格 ---
            av.start_frame_draw();
            av.accu_draw();
            
            vector<int> lt, gt;
            for (int k = 0; k <= i; k++) {
                if (k == j) continue; 
                if (arr[k] < moving_val) lt.push_back(k);
                else if (arr[k] > moving_val) gt.push_back(k);
            }

            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {j, j - 1}},
                {{"point"}, {j}},
                {{"background", "rgba(255, 82, 82, 0.45)"}, lt},
                {{"background", "rgba(56, 255, 56, 0.45)"}, gt},
                {{"mark"}, AV::AtoB(0, i - 1)}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text(to_string(arr[j]) + " < " + to_string(arr[j-1]) + " 向左交換", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
            //}
            swap(arr[j], arr[j-1]);
        }
        //draw{
        // --- 停止移動原因說明 ---
        if (j > 0) {
            // 因為 arr[j] >= arr[j-1] 停止
            av.start_frame_draw();
            av.accu_draw();
            
            vector<int> s_lt, s_gt;
            for (int k = 0; k <= i; k++) {
                if (k == j) continue; 
                if (arr[k] < moving_val) s_lt.push_back(k);
                else if (arr[k] > moving_val) s_gt.push_back(k);
            }
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {j, j - 1}},
                {{"point"}, {j}},
                {{"background", "rgba(255, 82, 82, 0.45)"}, s_lt}, 
                {{"background", "rgba(56, 255, 56, 0.45)"}, s_gt},
                {{"mark"}, AV::AtoB(0, i - 1)}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text(to_string(arr[j]) + " {>=:不小於} " + to_string(arr[j-1]) + " 停止交換", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
        } else if (moved) {
            // j == 0 且有移動過，代表到頭了
            av.start_frame_draw();
            av.accu_draw();
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {0}},
                {{"mark"}, AV::AtoB(0, i - 1)}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text("到達最左端 停止交換", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
        }

        // 最終歸位紀錄影格
        av.start_frame_draw();
        av.accu_draw();
        av.frame_draw(current_id, current_pos, arr, {
            {{"mark"}, AV::AtoB(0, i)} 
        }, {0}, "normal", 0, 1);
        av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
        av.text("元素已插入正確位置", Pos(current_id, "bottom", 0, 35));
        av.camera(Pos(current_id), 1.7);
        av.end_frame_draw();

        // 輪末正式存檔
        av.accu_store(current_id, current_pos, arr, {{{"mark"}, AV::AtoB(0, i)}}, {0}, "normal", 0, 1);
        av.accu_store_arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
        
        last_id = current_id;
        last_pos = current_pos;
        //}
    }
    //draw{
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(last_id, last_pos, arr, {{{"mark"}, AV::AtoB(0, n - 1)}}, {0}, "normal", 0, 1);
    av.text("Insertion Sort 完成！", Pos(last_id, "bottom", 0, 45));
    av.auto_camera(); 
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}
