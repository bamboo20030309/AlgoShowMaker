#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
//}

int main() {
    int n = 5;
    vector<int> num(n, 0);
    //draw{
    av.start_draw();
    //}
    
    // 故意跑到 n (越界)
    for(int i = 0; i <= n; i++) {
        // 實際執行賦值前先判斷，避免 C++ 真的崩潰
        num[i] = i+1;

        //draw{
        av.start_frame_draw();
        av.frame_draw("num", Pos(500, 100), num, {{{"highlight"},{i}}}, {0});
        
        av.auto_camera();
        av.end_frame_draw();
        //}
        
    }
    
    //draw{
    av.end_draw();
    //}
    return 0;
}
