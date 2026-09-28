/*
 * 範例：陣列越界示範
 *
 * 用途與核心步驟：刻意存取不合法索引，用於展示分析器如何標示越界風險；此檔是錯誤案例而非安全存取範本。
 * 輸入、輸出與複雜度：固定陣列作為輸入情境；輸出為追蹤診斷。時間與額外空間皆 O(1)。
 *
 * 視覺化約定：`@frame`、`@layout`、`@style` 等註解由 AlgoShowMaker
 * 分析器讀取；它們描述畫面切點與呈現方式，不參與 C++ 演算法運算。
 */

#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
//}

// ─────────────────────────────────────────────────────────────────────────────
// 範例入口：準備輸入與初始畫面，執行核心算法，最後輸出結果／收尾畫面。
// ─────────────────────────────────────────────────────────────────────────────

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
