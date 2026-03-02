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
    av.colored_text({{"Selection Sort (選擇排序 - 找最大)\n每一輪在未排序部分找最大值，並與最後一個位置交換"}}, Pos(last_id, "top", 0, -80));
    av.auto_camera();
    av.end_frame_draw();
    //}

    for (int i=n-1; i>0; i--) {
        //draw{
        string current_id = "pass_" + to_string(n - 1 - i);
        Pos current_pos((double)x_base, last_pos.y + y_gap);
        //}
        int max_idx = 0;
        for (int j=0; j<=i; j++) {
            //draw{
            av.start_frame_draw();
            av.accu_draw(); 
            
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {j}},                  // 檢查中的
                {{"point"}, {j}},                // 目前找到最大的
                {{"mark"}, AV::AtoB(i + 1, n - 1)},     // 右側已排好的
                {{"background","rgba(56, 255, 56, 0.45)"}, {max_idx}}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.colored_text({
                {"檢查第 " + to_string(j) + " 格，目前最大值: ", ""},
                {to_string(arr[max_idx]), "rgba(56, 255, 56, 0.45)"}
            }, Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
            //}
            if (arr[j] > arr[max_idx]) {
                max_idx = j;
                //draw{
                av.start_frame_draw();
                av.accu_draw();
                av.frame_draw(current_id, current_pos, arr, {
                    {{"highlight"}, {j}}, 
                    {{"point"}, {max_idx}},
                    {{"mark"}, AV::AtoB(i + 1, n - 1)},
                    {{"background","rgba(56, 255, 56, 0.45)"}, {max_idx}}
                }, {0}, "normal", 0, 1);
                av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
                av.text("發現更大的值！更新最大值為 " + to_string(arr[max_idx]), Pos(current_id, "bottom", 0, 35));
                av.camera(Pos(current_id), 1.7);
                av.end_frame_draw();
                //}
            }
        }

        if (max_idx != i) {
            swap(arr[max_idx], arr[i]);
            //draw{
            av.start_frame_draw();
            av.accu_draw();
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {i, max_idx}},
                {{"mark"}, AV::AtoB(i + 1, n - 1)},
                {{"background","rgba(56, 255, 56, 0.45)"}, {i}}
            }, {0}, "normal", 0, 1);
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text("找到最大值，將他移到最後", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id), 1.7);
            av.end_frame_draw();
            //}
        }
        //draw{
        av.accu_store(current_id, current_pos, arr, {{{"mark"}, AV::AtoB(i, n - 1)}}, {0}, "normal", 0, 1);
        av.accu_store_arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
        
        last_id = current_id;
        last_pos = current_pos;
        //}
    }
    //draw{
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(last_id, last_pos, arr, {{{"mark"}, AV::AtoB(0, n - 1)}}, {0}, "normal", 0, 1);
    av.text("Selection Sort 完成！", Pos(last_id, "bottom", 0, 45));
    av.auto_camera();
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}
