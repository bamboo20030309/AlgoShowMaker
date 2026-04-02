#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

AV av;
//draw{
// 初始化 TreeLayout，分支度最大為 N (這裡預設先給 8，後面 main 會根據 N 更新)
// 調整了 dx 跟 dy 把每個盤面的間距拉開
TreeLayout tree("tree", 8, Pos(800, 100), 250.0, 300.0);

// 用來儲存每個 (深度, 順序) 對應的 2D 盤面狀態與攻擊樣式
map<pair<int,int>, vector<vector<string>>> node_boards;
map<pair<int,int>, vector<array2D_style>> node_styles;

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

int N;
int ans = 0;
vector<int> board; // 全域 board

void dfs(int n, int L, int M, int R) {
    //draw{
    // 取得當前節點在樹上的位置
    int d = tree.curr_d;
    int o = tree.curr_o;
    // 將 1D 的位元數組轉成 帶有王后的 2D 矩陣並存起來
    node_boards[{d, o}] = to_queen_board(board, N);

    // 計算攻擊範圍
    vector<pair<int, int>> queens, attacked;
    for (int i = 0; i < n; i++)
        for (int b = 0; b < N; b++)
            if ((board[i] >> b) & 1) queens.push_back({i, N - 1 - b});
    for (int r = 0; r < N; r++)
        for (int c = 0; c < N; c++) {
            bool is_q = false, is_at = false;
            for (auto& q : queens) {
                if (q.first == r && q.second == c) { is_q = true; break; }
                if (q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) is_at = true;
            }
            if (is_at && !is_q) attacked.push_back({r, c});
        }
    node_styles[{d, o}] = {
        {{"background", "#ef9a9a"}, attacked},
        {{"background", "#6d6d6dff"}, queens}
    };
    //}

    if (n == N) {
        //draw{
        // 觸發畫圖，畫出當前的盤面節點（找到解的情況）
        tree.paint(av, "", -1, [&]{
            av.colored_text({
                {{"找到解了！"}}
            }, Pos(tree.get_id(d, o), "top", 0, -60));

            // 把整棵樹也畫進 key frame track
            for (auto& kv : node_boards) {
                int nd = kv.first.first, no = kv.first.second;
                string kid = tree.get_id(nd, no);
                Pos kp = tree.get_pos(nd, no);
                av.key_frame_draw(kid, kp, kv.second,
                    node_styles.count(kv.first) ? node_styles[kv.first] : vector<array2D_style>{}, {}, "normal");
                // 畫連線
                if (nd > 0) {
                    av.key_arrow(Pos(tree.get_id(nd - 1, no / tree.degree), "bottom"),
                                 Pos(kid, "top"), {{"color", "black"}, {"width", "2"}});
                }
            }
            av.key_text("找到解了！", Pos(tree.get_id(d, o), "top", 0, -60));
            av.camera(Pos(tree.get_id(d, o)), 1.2); 
            tree.edge_colors[{d, o}] = "red"; 
        });
        //}
        ans++;
        return;
    }

    int P = ((1<<N)-1) & ~(L|M|R); // 可放皇后的位置 (1代表可以放)

    //draw{
    // 觸發畫圖，畫出當前的盤面節點（搜尋中或沒路的情況）
    tree.paint(av, "", -1, [&]{
        if (P == 0) {
            av.colored_text({
                {{"沒路了，回溯"}}
            }, Pos(tree.get_id(d, o), "top", 0, -50));
        }
    });
    int branch_idx = 0; // 紀錄目前往下長的是第幾個分支
    //}
    while (P > 0) {
        int p=P&-P; // 取得最右邊的 1
        P^=p;
        
        board[n]=p; // 在第 n 列標記皇后的位置 (全域 board)
        //draw{
        // 進入遞迴前，把樹的游標往下推一個分支
        tree.push(branch_idx);
        //}
        dfs(n+1, (L|p)<<1, M|p, (R|p)>>1);
        //draw{
        // 遞迴結束後，把游標退回父節點
        tree.pop();
        branch_idx++;
        //}
        board[n]=0; // 回溯：還原狀態
    }
}

int main() {
    // 建議畫圖時 N 先設小一點 (例如 4 或 5) 比較好觀察整棵樹的結構
    N = 4; cin>>N;
    //draw{
    tree.degree = N; // 動態更新樹的最大分支度
    tree.dx = N * 60.0; // 根據 N 加大水平間距
    tree.dy = N * 60.0 + 100.0; // 根據 N 加大垂直層距
    
    // 設定每個節點長什麼樣子
    tree.renderer = [](string id, Pos p, int d, int o, bool is_focus) {
        // 從我們存好的 map 中拿出對應的 2D 陣列
        if (node_boards.count({d, o})) {
            // 用 normal 模式畫出 2D 矩陣 (包含皇后 Emoji)
            av.frame_draw(id, p, node_boards[{d, o}], node_styles.count({d,o}) ? node_styles[{d,o}] : vector<array2D_style>{}, {}, "normal");
        }
        // 如果是當前專注的節點，讓鏡頭跟過去（用物件 ID 定位中心）
        if (is_focus) {
            av.camera(Pos(id), 1.2);
        }
        av.addEditorHighlight(97);
    };

    av.start_draw();
    // ====== 開場說明帧 ======
    {
    int demo_N = 8; // 說明幀固定用 8x8 棋盤
    av.start_frame_draw();
    // 範例方案：[0, 4, 7, 5, 2, 6, 1, 3] 欄位
    // 對應 bit (MSB 在左): bit 7, 3, 0, 2, 5, 1, 6, 4
    vector<int> sample_sol = {128, 8, 1, 4, 32, 2, 64, 16};
    vector<pair<int, int>> sample_attacked;
    vector<pair<int, int>> sample_queens;
    for(int i = 0; i < demo_N; i++) {
        for(int b = 0; b < demo_N; b++) {
            if((sample_sol[i] >> b) & 1) sample_queens.push_back({i, demo_N - 1 - b});
        }
    }
    for(int r = 0; r < demo_N; r++) {
        for(int c = 0; c < demo_N; c++) {
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

    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(sample_sol, demo_N), sample_style, {}, "normal");
    av.colored_text({
        {{"八皇后問題 (位元運算版)\n","","","20"}},
        {{"這是一個很經典的 回溯 (backtracking) 演算法問題\n給一個 8{*:乘}8 的棋盤，問你總共有多少種皇后的擺法可以讓任意兩個皇后都不會互相攻{擊:及}?"}}
    }, Pos("chess_board","top",0, -120));
    
    av.auto_camera();
    av.end_frame_draw();

    // ====== 策略一：DFS 從上往下 ======
    av.start_frame_draw();
    vector<int> partial_1 = {128, 8, 0, 0, 0, 0, 0, 0};
    vector<pair<int, int>> q_1 = {{0, 0}, {1, 4}};
    vector<pair<int, int>> att_1;
    vector<pair<int, int>> legal_row2;
    for(int r = 0; r < demo_N; r++) {
        for(int c = 0; c < demo_N; c++) {
            bool is_q = false; bool is_at = false;
            for(auto& q : q_1) {
                if(q.first == r && q.second == c) { is_q = true; break; }
                if(q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) is_at = true;
            }
            if(is_at && !is_q) att_1.push_back({r, c});
            if(r == 2 && !is_at) legal_row2.push_back({r, c});
        }
    }

    vector<array2D_style> style_1 = {
        {{"background", "#ef9a9a"}, att_1},
        {{"background", "rgba(76, 175, 80, 0.46)"}, legal_row2},
        {{"background", "#6d6d6dff"}, q_1}
    };

    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(partial_1, demo_N), style_1, {}, "normal");
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
    }, Pos("chess_board","top",0, -210));
    av.auto_camera();
    av.end_frame_draw();

    // ====== 策略二：位元運算與狀態壓縮 ======
    av.start_frame_draw();
    vector<int> bit_demo = {0, 0, 136, 0, 0, 0, 0, 0};
    vector<pair<int, int>> q_2 = {{2, 0}, {2, 4}};
    vector<pair<int, int>> att_2;
    for(int r = 0; r < demo_N; r++) {
        for(int c = 0; c < demo_N; c++) {
            bool is_q = false; bool is_at = false;
            for(auto& q : q_2) {
                if(q.first == r && q.second == c) { is_q = true; break; }
                if(q.first == r || q.second == c || abs(q.first - r) == abs(q.second - c)) is_at = true;
            }
            if(is_at && !is_q) att_2.push_back({r, c});
        }
    }
    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(bit_demo, demo_N), {
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
    }, Pos("chess_board","top",0, -320));
    av.auto_camera();
    av.end_frame_draw();

    // ====== 策略三：L, M, R 遮罩 ======
    av.start_frame_draw();
    vector<int> lmr_demo = {0, 8, 0, 0, 0, 0, 0, 0};
    vector<pair<int, int>> q_lmr = {{1, 4}};
    vector<pair<int, int>> m_cells, l_cells, r_cells;
    for(int r = 2; r < demo_N; r++) {
        m_cells.push_back({r, 4});
        if(4-(r-1) >= 0) l_cells.push_back({r, 4-(r-1)});
        if(4+(r-1) < 8) r_cells.push_back({r, 4+(r-1)});
    }
    vector<array2D_style> lmr_styles = {
        {{"background", "#bbdefb"}, m_cells},
        {{"background", "rgba(76, 175, 80, 0.46)"}, l_cells},
        {{"background", "#f8bbd0"}, r_cells},
        {{"background", "#6d6d6dff"}, q_lmr}
    };
    av.frame_draw("chess_board", Pos(0, 0), to_queen_board(lmr_demo, demo_N), lmr_styles, {}, "normal");
    av.colored_text({
        {{"策略三：L, M, R 的極速碰撞檢查","","","20"}},
        {{"\n接下來是這套演算法最精妙的地方：\n我們只用三個整數就能夠追蹤所有攻擊範圍\n"}},
        {{"{1. }"}}, {{"M (Middle)"}, "#bbdefb"}, {{"：代表 "}}, {{"垂直"}, "#bbdefb"}, {{" 方向的攻擊範圍。\n"}},
        {{"{2. }"}}, {{"L (Left)"}, "rgba(76, 175, 80, 0.46)"}, {{"：代表 "}}, {{"左下對角線"}, "rgba(76, 175, 80, 0.46)"}, {{" 的限制。往下傳遞時會將位元 " }}, {{"左移"}, "rgba(76, 175, 80, 0.46)"}, {{"。\n"}},
        {{"{3. }"}}, {{"R (Right)"}, "#f8bbd0"}, {{"：代表 "}}, {{"右下對角線"}, "#f8bbd0"}, {{" 的限制。往下傳遞時會將位元 "}}, {{"右移"}, "#f8bbd0"}, {{"。\n"}},
        {{"\n這三組限制會隨{著:ㄓㄜ˙}遞迴 "}}, {{"向下傳遞"}, "rgba(252, 255, 64, 0.46)"}, {{" 給下一列使用。\n"}},
        {{"在每一列，我們只需執行 "}}, {{"( L | M | R )"}, "rgba(252, 255, 64, 0.46)"},
        {{" 將所有 "}}, {{"攻擊範圍取聯集"}, "rgba(252, 255, 64, 0.46)"}, {{" ，\n就能瞬間找出所有受威脅的格子，一次搞定所有檢查！"}}
    }, Pos("chess_board","top",0, -280));
    av.auto_camera();
    av.end_frame_draw();
    } // end demo_N scope
    //}
    
    board.assign(N, 0); // 初始化全域 board
    dfs(0, 0, 0, 0);
    
    //draw{
    // 結尾看整棵樹
    av.start_frame_draw();
    av.accu_draw();
    tree.redraw(av);
    av.auto_camera(); // 縮放鏡頭讓整棵樹都能進入畫面
    av.end_frame_draw();
    
    av.end_draw();
    //}
    
    cout << "Total Solutions: " << ans << endl;
    return 0;
}