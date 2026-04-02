#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;

int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for(int i=0; i<n; i++) cin>>arr[i];

    //draw{
    av.start_draw();
    int x_base = 350;
    int y_base = 100;
    int y_gap  = 110;

    string last_id = "init";
    Pos last_pos((double)x_base, (double)y_base);

    // 初始狀態
    av.accu_store(last_id, last_pos, arr, {}, {0}, "normal", 0, 1);
    
    av.start_frame_draw();
    av.accu_draw();
    av.colored_text({{"Selection Sort (選擇排序 - 選小)\n每一輪在未排序部分找最小值，並與未排序部分的第一個位置交換來排序的方法"}}, Pos(last_id, "top", 0, -80));
    av.auto_camera();
    av.end_frame_draw();
    //}

    for (int i=0; i<n-1; i++) {
        //draw{
        string current_id = "pass_" + to_string(i);
        Pos current_pos((double)x_base, last_pos.y + y_gap);
        //}
        
        int min_idx = i;
        for (int j=i; j<n; j++) {
            //draw{
            av.start_frame_draw();
            av.accu_draw(); 
            
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {j}},                  // 檢查中的
                {{"point"}, {j}},                // 目前指標位置
                {{"mark"}, av.AtoB(0, i - 1)},         // 左側已排好的
                {{"background","rgba(56, 255, 56, 0.45)"}, {min_idx}} // 目前找到最小的
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.colored_text({
                {"檢查索引 " + to_string(j) + "，目前最小值格子的值: ", ""},
                {to_string(arr[min_idx]), "rgba(56, 255, 56, 0.45)"}
            }, Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
            //}

            if (arr[j] < arr[min_idx]) {
                min_idx = j;
                //draw{
                av.start_frame_draw();
                av.accu_draw();
                av.frame_draw(current_id, current_pos, arr, {
                    {{"highlight"}, {j}}, 
                    {{"point"}, {min_idx}},
                    {{"mark"}, av.AtoB(0, i - 1)},
                    {{"background","rgba(56, 255, 56, 0.45)"}, {min_idx}}
                }, {0}, "normal", 0, 1);
                av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
                av.text("發現更小的值！更新目前最小值格子為索引 " + to_string(min_idx), Pos(current_id, "bottom", 0, 35));
                av.camera(Pos(current_id), 1.7);
                av.end_frame_draw();
                //}
            }
        }

        if (min_idx != i) {
            swap(arr[min_idx], arr[i]);
            //draw{
            av.start_frame_draw();
            av.accu_draw();
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {i, min_idx}},
                {{"mark"}, av.AtoB(0, i - 1)},
                {{"background","rgba(56, 255, 56, 0.45)"}, {i}}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text("找到未排序部分的最小值，與索引 " + to_string(i) + " 的格位交換", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
            //}
        } else {
            //draw{
            av.start_frame_draw();
            av.accu_draw();
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {i}},
                {{"mark"}, av.AtoB(0, i - 1)},
                {{"background","rgba(255, 255, 56, 0.45)"}, {i}}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text("最小值就在索引 " + to_string(i) + "，不需交換", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
            //}
        }

        //draw{
        av.accu_store(current_id, current_pos, arr, {{{"mark"}, av.AtoB(0, i)}}, {0}, "normal", 0, 1);
        av.accu_store_arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
        
        last_id = current_id;
        last_pos = current_pos;
        //}
    }

    //draw{
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(last_id, last_pos, arr, {{{"mark"}, av.AtoB(0, n - 1)}}, {0}, "normal", 0, 1);
    av.text("Selection Sort 完成！", Pos(last_id, "bottom", 0, 45));
    av.auto_camera();
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}
