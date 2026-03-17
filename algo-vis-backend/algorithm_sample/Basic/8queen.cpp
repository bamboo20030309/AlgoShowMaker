#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

AV av;
// 初始化 TreeLayout，分支度最大為 N (這裡預設先給 8，後面 main 會根據 N 更新)
// 調整了 dx 跟 dy 把每個盤面的間距拉開
TreeLayout tree(8, Pos(800, 100), 10, 180.0, 200.0);

// 用來儲存每個 (深度, 順序) 對應的 2D 盤面狀態
map<pair<int,int>, vector<vector<int>>> node_boards;

int N = 8;
int ans = 0;

void dfs(int n, int L, int M, int R, vector<int> board) {
    // 取得當前節點在樹上的位置
    int d = tree.curr_d;
    int o = tree.curr_o;

    // 將 1D 的位元數組轉成 2D 矩陣並存起來，給 renderer 畫圖用
    node_boards[{d, o}] = AV::to_2Darray(board, 0, N - 1, N - 1, 0);

    // 觸發畫圖，畫出當前的盤面節點
    tree.paint(av, "", -1, [&]{
        if (n == N) {
            av.text("找到解！", Pos(tree.get_id(d, o), 0, "bottom", 0, 40));
            // 可以把找到解的路徑標成紅色
            tree.edge_colors[{d, o}] = "red"; 
        }
    });

    if (n == N) {
        ans++;
        return;
    }

    int P = ((1 << N) - 1) & ~(L | M | R); // 可放皇后的位置 (1代表可以放)
    int branch_idx = 0; // 紀錄目前往下長的是第幾個分支
    
    while (P > 0) {
        int p = P & -P; // 取得最右邊的 1
        P -= p;
        
        vector<int> next_board = board;
        next_board[n] = p; // 在第 n 列標記皇后的位置
        
        // 進入遞迴前，把樹的游標往下推一個分支
        tree.push(branch_idx);
        dfs(n + 1, (L | p) << 1, M | p, (R | p) >> 1, next_board);
        // 遞迴結束後，把游標退回父節點
        tree.pop();
        
        branch_idx++;
    }
}

int main() {
    // 建議畫圖時 N 先設小一點 (例如 4 或 5) 比較好觀察整棵樹的結構
    N = 4;
    tree.degree = N; // 動態更新樹的最大分支度
    
    // 設定每個節點長什麼樣子
    tree.renderer = [](string id, Pos p, int d, int o, bool is_focus) {
        // 從我們存好的 map 中拿出對應的 2D 陣列
        if (node_boards.count({d, o})) {
            // 用 binary 模式畫出 2D 矩陣
            av.frame_draw(id, p, node_boards[{d, o}], {}, {}, "binary", 3);
        }
        // 如果是當前專注的節點，讓鏡頭跟過去
        if (is_focus) {
            av.camera(p, 1.2);
        }
    };

    av.start_draw();
    
    // 開頭說明
    av.start_frame_draw();
    av.text(to_string(N) + " 皇后 DFS 過程", Pos("tree_0_0", "top", 0, -80));
    av.end_frame_draw();
    
    dfs(0, 0, 0, 0, vector<int>(N, 0));
    
    // 結尾看整棵樹
    av.start_frame_draw();
    av.accu_draw();
    tree.redraw(av);
    av.auto_camera(100.0); // 縮放鏡頭讓整棵樹都能進入畫面
    av.end_frame_draw();
    
    av.end_draw();
    
    cout << "Total Solutions: " << ans << endl;
    return 0;
}