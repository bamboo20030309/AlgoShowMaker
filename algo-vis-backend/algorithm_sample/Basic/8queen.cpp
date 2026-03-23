#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

AV av;
int N = 8;
int ans = 0;

void dfs(int n, int L, int M, int R, vector<int> board) {
    // //draw{
    // 每次進入遞迴都畫一幀，展示當前棋盤狀態
    av.start_frame_draw();
    // 使用 to_2Darray 把 1D 的位元數組轉成 2D 矩陣
    // 參數：L=0, R=N-1 (所有數字), l=N-1, r=0 (高位元到低位元，MSB在左)
    av.frame_draw("board", Pos(0, 0), AV::to_2Darray(board, 0, N - 1, N - 1, 0), {}, {}, "binary");
    // //}

    if (n == N) {
        ans++;
        // //draw{
        // 找到解的時候，用關鍵幀 (key_frame) 存起來，方便跳轉
        av.key_frame_draw("board", Pos(0, 0), AV::to_2Darray(board, 0, N - 1, N - 1, 0), {}, {}, "binary");
        av.end_frame_draw();
        // //}
        return;
    }

    // //draw{
    if (n != N) av.end_frame_draw();
    // //}

    int P = ((1 << N) - 1) & ~(L | M | R); // 可放皇后的位置 (1代表可以放)
    
    while (P > 0) {
        int p = P & -P; // 取得最右邊的 1
        P -= p;
        
        // 算出這是第幾欄 (為了記錄在 board 裡)
        int col = 0;
        int temp = p;
        while (temp > 1) { temp >>= 1, col++; }
        
        vector<int> next_board = board;
        next_board[n] = p; // 在第 n 列標記皇后的位置
        
        dfs(n + 1, (L | p) << 1, M | p, (R | p) >> 1, next_board);
    }
}

int main() {
    N = 8;
    // //draw{
    av.start_draw();
    // //}
    
    dfs(0, 0, 0, 0, vector<int>(N, 0));
    
    // //draw{
    av.end_draw();
    // //}
    
    cout << "Total Solutions: " << ans << endl;
    return 0;
}
