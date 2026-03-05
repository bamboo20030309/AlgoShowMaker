#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;

int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for(int i=0;i<n;i++) cin>>arr[i];
    //draw{
    av.start_draw();
    int x_base = 350;
    int y_base = 100;

    string last_id = "init";
    Pos last_pos((double)x_base, (double)y_base);
    // 初始狀態：第一行先存入歷史
    av.accu_store(last_id, last_pos, arr, {}, {0}, "normal", 0, 1);
    
    av.start_frame_draw();
    av.accu_draw();
    av.colored_text({{"Bubble Sort (冒泡排序)\n透過將最大的元素一個一個往後丟，來進行排序"}}, Pos(last_id, "top", 0, -80));
    av.auto_camera();
    av.end_frame_draw();
    //}

    for (int i=0; i<n-1; i++) {
        //draw{
        // 這一輪準備要在下方產生的 ID 與位置
        string current_id = "pass_" + to_string(i);
        Pos current_pos((double)x_base, last_pos.y + 110);
        //}
        for (int j=0; j<n-i-1; j++) {
            //draw{
            // 在「每一輪」的交換過程中，我們畫在 current_id (新的這行)
            av.start_frame_draw();
            av.accu_draw(); // 畫出上方已確定的歷史
            
            // 繪製目前正在處理的這行
            av.frame_draw(current_id, current_pos, arr, {
                {{"highlight"}, {j, j + 1}},
                {{"mark"}, AV::AtoB(n - i, n - 1)} 
            }, {0}, "normal", 0, 1);
            // 暫時的箭頭（還沒存入紀錄）
            av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
            av.text("比較左右兩邊", Pos(current_id, "bottom", 0, 35));
            av.camera(Pos(current_id),1.7);
            av.end_frame_draw();
            //}
            if (arr[j] > arr[j+1]) {
                swap(arr[j], arr[j+1]);
                //draw{
                av.start_frame_draw();
                av.accu_draw();
                av.frame_draw(current_id, current_pos, arr, {
                    {{"highlight"}, {j, j + 1}},
                    {{"mark"}, AV::AtoB(n - i, n - 1)}
                }, {0}, "normal", 0, 1);
                av.arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
                av.text("左比右大就左右交換", Pos(current_id, "bottom", 0, 35));
                av.camera(Pos(current_id), 1.7);
                av.end_frame_draw();
                //}
            }
        }
        //draw{
        vector<int> sorted_indices = AV::AtoB(n - i - 1, n - 1);
        av.accu_store(current_id, current_pos, arr, {{{"mark"}, sorted_indices}}, {0}, "normal", 0, 1);
        av.accu_store_arrow(Pos(last_id, "bottom"), Pos(current_id, "top"));
        
        av.start_frame_draw();
        av.accu_draw();
        av.text("第" + to_string(i + 1) + "輪結束，確認位置" + to_string(n-i-1), Pos(current_id, "bottom", 0, 40));
        av.camera(Pos(current_id), 1.7);
        av.end_frame_draw();
        
        last_id = current_id;
        last_pos = current_pos;
        //}
    }
    //draw{
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(last_id, last_pos, arr, {{{"mark"}, AV::AtoB(0, n - 1)}}, {0}, "normal", 0, 1);
    av.text("Bubble Sort 完成！", Pos(last_id, "bottom", 0, 45));
    av.auto_camera();
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}
