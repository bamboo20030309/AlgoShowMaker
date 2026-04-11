#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

AV av;
int N;
int ans = 0;
vector<int> board; // 全域 board
//draw{
// 將 bitmask board 轉為帶有皇后的 string 矩陣
vector<vector<string>> to_queen_board(const vector<int>& b, int n) {
    vector<vector<string>> res;
    for (int i = 0; i < n; ++i) {
        vector<string> row;
        for (int j = n - 1; j >= 0; --j) {
            if ((b[i] >> j) & 1) row.push_back("♛");
            else row.push_back("");
        }
        res.push_back(row);
    }
    return res;
}
//}
void dfs(int n, int L, int M, int R) {
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
    
    // 設定樣式：背景顏色使用半透明紅色 (攻擊) 與 深灰色 (皇后)
    vector<array2D_style> attack_style = {
        {{"background", "#ef9a9a"}, attacked_cells},
        {{"background", "#6d6d6dff"}, queens}
    };

    av.start_frame_draw();
    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(board, N), attack_style, {}, "normal");
    //}

    if (n == N) {
        ans++;
        //draw{
        // 找到解的時候，用關鍵幀 (key_frame) 存起來，方便跳轉
        av.key_frame_draw("chess_board", Pos(0, 0), to_queen_board(board, N), attack_style, {}, "normal");
        av.auto_camera();
        av.end_frame_draw();
        //}
        return;
    }

    int P = ((1<<N)-1) & ~(L|M|R);

    //draw{
    av.auto_camera();
    if (P == 0 && n < N) {
        av.colored_text({
            {{"{沒路了，}回溯{尋找其他解。}"}},
        }, Pos("chess_board", "top", 0, -20));
    }
    
    if (n != N) av.end_frame_draw();
    //}

    while (P > 0) {
        int p=P&-P; // 取得最右邊的 1
        P^=p;
        
        board[n]=p; // 在第 n 列標記皇后的位置 (回溯前置)
        dfs(n+1, (L|p)<<1, M|p, (R|p)>>1);
        board[n]=0; // 回溯：還原狀態
    }
}

int main() {
    N = 8; cin>>N;
    board.assign(N, 0); // 初始化全域 board
    //draw{
    av.start_draw();
    
    // 開場說明帧
    av.start_frame_draw();
    // 範例方案：[0, 4, 7, 5, 2, 6, 1, 3] 欄位
    // 對應 bit (MSB 在左): bit 7, 3, 0, 2, 5, 1, 6, 4
    vector<int> sample_sol = {128, 8, 1, 4, 32, 2, 64, 16};
    vector<pair<int, int>> sample_attacked;
    vector<pair<int, int>> sample_queens;
    for(int i = 0; i < N; i++) {
        for(int b = 0; b < N; b++) {
            if((sample_sol[i] >> b) & 1) sample_queens.push_back({i, N - 1 - b});
        }
    }
    for(int r = 0; r < N; r++) {
        for(int c = 0; c < N; c++) {
            bool is_q = false; bool is_at = false;
            for(auto q : sample_queens) {
                if(q.first == r && q.second == c) { is_q = true; break; }
                if(q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) is_at = true;
            }
            if(is_at && !is_q) sample_attacked.push_back({r, c});
        }
    }
    vector<array2D_style> sample_style = {
        {{"background", "#ef9a9a"}, sample_attacked},
        {{"background", "#6d6d6dff"}, sample_queens}
    };

    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(sample_sol, N), sample_style, {}, "normal");
    av.colored_text({
        {{"八皇后問題 (位元運算版)\n","","","20"}},
        {{"這是一個很經典的 回溯 (backtracking) 演算法問題\n給一個 8{*:乘}8 的棋盤，問你總共有多少種皇后的擺法可以讓任意兩個皇后都不會互相攻{擊:及}?"}}
    }, Pos("chess_board","top",0, -20));
    
    av.auto_camera();
    av.end_frame_draw();

    // 第一幀：DFS 策略 (從上往下)
    av.start_frame_draw();
    // 範例：已放兩顆皇后 (0,0) 與 (1,4)
    vector<int> partial_1 = {128, 8, 0, 0, 0, 0, 0, 0};
    vector<pair<int, int>> q_1 = {{0, 0}, {1, 4}};
    vector<pair<int, int>> att_1;
    vector<pair<int, int>> legal_row2; // 第三列的合法位置
    for(int r = 0; r < N; r++) {
        for(int c = 0; c < N; c++) {
            bool is_q = false; bool is_at = false;
            for(auto& q : q_1) {
                if(q.first == r && q.second == c) { is_q = true; break; }
                if(q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) is_at = true;
            }
            if(is_at && !is_q) att_1.push_back({r, c});
            // 特別挑出第三列 (r=2) 且沒被攻擊的位置
            if(r == 2 && !is_at) legal_row2.push_back({r, c});
        }
    }

    // 樣式：紅色為攻擊，綠色為合法，深灰色為皇后
    vector<array2D_style> style_1 = {
        {{"background", "#ef9a9a"}, att_1},
        {{"background", "rgba(76, 175, 80, 0.46)"}, legal_row2},
        {{"background", "#6d6d6dff"}, q_1}
    };

    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(partial_1, N), style_1, {}, "normal");
    av.colored_text({
        {{"策略一：從上往下放","","","20"}},
        {{"\n為什麼要按順序放？\n因為八皇后規定每一列 "}},
        {{"必須且只能"},"rgba(252, 255, 64, 0.46)"},
        {{" 放一個皇后。\n"}},
        {{"這使得我們可以把問題簡化，不再是隨機亂放，而是從第一列放起，再放第二列...\n"}},
        {{"如圖所示，當我們放好了前兩列，"}},
        {{"第三列的合法位置"},"rgba(76, 175, 80, 0.46)"},
        {{" 就已經被縮小了。\n"}},
        {{"這種 "}},
        {{"逐行推進"},"rgba(252, 255, 64, 0.46)"},
        {{" 的 DFS 方式，讓我們只需關心 "}},
        {{"上方已經放好的皇后"},"rgba(252, 255, 64, 0.46)"},
        {{" ，且可以減少很多不必要的搜尋，\n"}},
        {{"將當前皇后的影響力像影子一樣往下傳遞，這就是高效解法的第一步。"}}
    }, Pos("chess_board","top",0, -20));
    av.auto_camera();
    av.end_frame_draw();

    // 第二幀：位元運算與狀態壓縮
    av.start_frame_draw();
    // 圖解一列的狀態：假設某列放了皇后在位元 7 與 3 (10001000 = 136)
    vector<int> bit_demo = {0, 0, 136, 0, 0, 0, 0, 0};
    vector<pair<int, int>> q_2 = {{2, 0}, {2, 4}};
    vector<pair<int, int>> att_2;
    for(int r = 0; r < N; r++) {
        for(int c = 0; c < N; c++) {
            bool is_q = false; bool is_at = false;
            for(auto& q : q_2) {
                if(q.first == r && q.second == c) { is_q = true; break; }
                if(q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) is_at = true;
            }
            if(is_at && !is_q) att_2.push_back({r, c});
        }
    }
    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(bit_demo, N), {
        {{"background", "#ef9a9a"}, att_2},
        {{"background", "#6d6d6dff"}, q_2}
    }, {}, "normal");
    av.colored_text({
        {{"策略二：二進位狀態壓縮","","","20"}},
        {{"\n為什麼可以用二進位？\n因為棋盤的狀態總共就只有兩種狀態分為 有放的 和 沒放的 。\n"}},
        {{"我們用 1 代表有放皇后，0 代表沒放皇后。\n"}},
        {{"用 "}},
        {{"一個數字就可以描述一列"},"rgba(252, 255, 64, 0.46)"},
        {{" 的狀態，這個動作就稱為 "}},
        {{"狀態壓縮"},"rgba(252, 255, 64, 0.46)"},
        {{" 。\n"}},
        {{"例如：{10001000:這樣子} 代表這列的第 0 與 第 4 欄有皇后。\n"}},
        {{"\n關鍵就在這裡：\n傳統碰撞檢查需要用迴圈掃描，但在二進位下，我們可以用位元運算 ( AND / OR / NOT )\n\n"}},
        {{"這樣做不僅能夠讓程式寫起來更簡潔，而且還可以加速不少常數時間，\n"}},
        {{"電腦本身對於這種位元運算非常直覺，計算速度非常快。"}}
    }, Pos("chess_board","top",0, -20));
    av.auto_camera();
    av.end_frame_draw();

    // 第三幀：魔法般的 L, M, R 遮罩
    av.start_frame_draw();
    // 範例：皇后在 (1, 4)
    vector<int> lmr_demo = {0, 8, 0, 0, 0, 0, 0, 0};
    vector<pair<int, int>> q_lmr = {{1, 4}};
    vector<pair<int, int>> m_cells, l_cells, r_cells;
    for(int r = 2; r < N; r++) {
        m_cells.push_back({r, 4});                   // 直下
        if(4-(r-1) >= 0) l_cells.push_back({r, 4-(r-1)}); // 左下
        if(4+(r-1) < 8) r_cells.push_back({r, 4+(r-1)});  // 右下
    }
    vector<array2D_style> lmr_styles = {
        {{"background", "#bbdefb"}, m_cells}, // Middle - 藍
        {{"background", "rgba(76, 175, 80, 0.46)"}, l_cells}, // Left - 綠
        {{"background", "#f8bbd0"}, r_cells},  // Right - 粉
        {{"background", "#6d6d6dff"}, q_lmr}     // Queen - 深灰
    };
    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(lmr_demo, N), lmr_styles, {}, "normal");
    av.colored_text({
        {{"策略三：L, M, R 的極速碰撞檢查","","","20"}},
        {{"\n接下來是這套演算法最精妙的地方：\n我們只用三個整數就能夠追蹤所有攻擊範圍\n"}},
        {{"{1. }"}}, {{"M (Middle)"}, "#bbdefb"}, {{"：代表 "}}, {{"垂直"}, "#bbdefb"}, {{" 方向的攻擊範圍。\n"}},
        {{"{2. }"}}, {{"L (Left)"}, "rgba(76, 175, 80, 0.46)"}, {{"：代表 "}}, {{"左下對角線"}, "rgba(76, 175, 80, 0.46)"}, {{" 的限制。往下傳遞時會將位元 " }}, {{"左移"}, "rgba(76, 175, 80, 0.46)"}, {{"。\n"}},
        {{"{3. }"}}, {{"R (Right)"}, "#f8bbd0"}, {{"：代表 "}}, {{"右下對角線"}, "#f8bbd0"}, {{" 的限制。往下傳遞時會將位元 "}}, {{"右移"}, "#f8bbd0"}, {{"。\n"}},
        {{"\n這三組限制會隨{著:ㄓㄜ˙}遞迴 "}}, {{"向下傳遞"}, "rgba(252, 255, 64, 0.46)"}, {{" 給下一列使用。\n"}},
        {{"在每一列，我們只需執行 "}}, {{"( L | M | R )"}, "rgba(252, 255, 64, 0.46)"},
        {{" 將所有 "}}, {{"攻擊範圍取聯集"}, "rgba(252, 255, 64, 0.46)"}, {{" ，\n就能瞬間找出所有受威脅的格子，一次搞定所有檢查！"}}
    }, Pos("chess_board","top",0, -20));
    av.auto_camera();
    av.end_frame_draw();
    //}
    
    dfs(0, 0, 0, 0);
    
    //draw{
    av.end_draw();
    //}
    
    cout << "Total Solutions: " << ans << endl;
    return 0;
}