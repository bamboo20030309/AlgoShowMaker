#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

AV av;
int N = 8;
int ans = 0;

void dfs(int n, int L, int M, int R, vector<int> board) {
//draw{
    // --- 1. 計算所有皇後的攻擊範圍 ---
    vector<pair<int, int>> attacked_cells;
    vector<pair<int, int>> queens;
    
    // 找出目前已經放置的皇后位置 (前 n 列)
    for (int i = 0; i < n; i++) {
        for (int b = 0; b < N; b++) {
            if ((board[i] >> b) & 1) {
                // 對應到 2D array 的欄位索引：你的 to_2Darray 是由高位元到低位元，
                // 所以第 b 個 bit 在 2D 陣列中的 col 索引是 N - 1 - b
                queens.push_back({i, N - 1 - b}); 
            }
        }
    }
    
    // 檢查整個棋盤，找出被攻擊的格子
    for (int r = 0; r < N; r++) {
        for (int c = 0; c < N; c++) {
            bool is_attacked = false;
            bool is_queen = false;
            
            for (auto q : queens) {
                if (q.first == r && q.second == c) {
                    is_queen = true;
                    break;
                }
                // 若與任何一個皇后同行、同欄、或同對角線，即為被攻擊
                if (q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) {
                    is_attacked = true;
                }
            }
            
            // 把被攻擊且不是皇后本身的格子記錄下來
            if (is_attacked && !is_queen) {
                attacked_cells.push_back({r, c});
            }
        }
    }
    
    // 設定樣式：背景顏色使用半透明紅色
    vector<array2D_style> attack_style = {{{"background", "#ef9a9a"}, attacked_cells}};

    // 每次進入遞迴都畫一幀，展示當前棋盤狀態
    av.start_frame_draw();
    if (n == 0) {
        av.text("【核心原理：L, M, R 位元遮罩】\n\n1. M (Middle): 代表垂直下方的攻擊範圍。\n2. L (Left): 代表向左下對角線的限制。傳遞時使用 (L|p)<<1。\n3. R (Right): 代表向右下對角線的限制。傳遞時使用 (R|p)>>1。\n\n透過 (L | M | R) 聯集，我們能瞬間得知下一列所有被攻擊到的位置，\n這就是為什麼位元運算版本如此高效且優雅！", Pos(500, 50));
    }
    // 將計算好的 attack_style 放在第 4 個參數
    av.frame_draw("board", Pos(0, 0), AV::to_2Darray(board, 0, N - 1, N - 1, 0), attack_style, {}, "binary");
//}

    if (n == N) {
        ans++;
//draw{
        // 找到解的時候，用關鍵幀 (key_frame) 存起來，方便跳轉
        av.key_frame_draw("board", Pos(0, 0), AV::to_2Darray(board, 0, N - 1, N - 1, 0), attack_style, {}, "binary");
        av.end_frame_draw();
//}
        return;
    }

//draw{
    if (n != N) av.end_frame_draw();
//}

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
//draw{
    av.start_draw();
    
    // 開場說明帧
    av.start_frame_draw();
    av.text("【8 皇后問題：位元運算版】\n1. 二進位壓縮：每一列只有 8 格，可用一個 8 位元整數表示。\n1 代表皇后，0 代表空位，讓計算變成極速的位元運算。\n2. 從上往下放：採用 DFS 遞迴。每一列只放一個，\n我們只需動態追蹤上方皇后的垂直與對角線影響即可。", Pos(500, 50));
    av.end_frame_draw();
//}
    
    dfs(0, 0, 0, 0, vector<int>(N, 0));
    
//draw{
    av.end_draw();
//}
    
    cout << "Total Solutions: " << ans << endl;
    return 0;
}