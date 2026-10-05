#include <bits/stdc++.h>
using namespace std;

int N;
int ans = 0;
vector<int> board;

// @layout recursion as "queen_tree"
// @layout queen_tree branch-previews off

// keep 只保留棋盤和皇后，不保留教學箭頭或右側陣列。
// @preset queen_board_base_view
// @object bits(board, N) as chess_board render matrix with labels(none), display("${value == 1 ? '♕' : ''}") in queen_tree
// @style board background grey when value == 1
// @endpreset

// 繪圖集中於此：Q、L/M/R、合併 P 共用每格的 bit。
// @preset queen_scene_view
// @let bit = 1 << (N - 1 - column)
// @let queen = value == 1 ? '♕' : ''
// @let q_left = row == attack_row && (maskL & bit)
// @let q_down = row == attack_row && (maskM & bit)
// @let q_right = row == attack_row && (maskR & bit)
// @object bits(board, N) as chess_board render matrix with labels(none), display("${queen}${value == 1 ? '' : row == attack_row ? ((directions >= 1 && q_left) || (directions >= 2 && q_down) || (directions >= 3 && q_right) ? 1 : 0) : '　'}") in queen_tree
// @object bits(maskL, N) as mask_L render matrix with labels(none), display("${value ? '↙' : '　'}")
// @object bits(maskM, N) as mask_M render matrix with labels(none), display("${value ? '↓' : '　'}")
// @object bits(maskR, N) as mask_R render matrix with labels(none), display("${value ? '↘' : '　'}")
// @style board background grey when value == 1
// @style board background AV_red when (directions >= 1 && q_left) || (directions >= 2 && q_down) || (directions >= 3 && q_right)
// @style maskL, maskM, maskR background AV_red when value == 1
// @place mask_L.top-left at chess_board.top-right offset(40,0)
// @place mask_M.top-left at mask_L.bottom-left offset(0,20)
// @place mask_R.top-left at mask_M.bottom-left offset(0,20)
// @endpreset

// P 只在合併攻擊遮罩與計算候選位置時顯示。
// @preset union_view
// @object bits(maskP, N) as mask_union render matrix with labels(none), display("${value}")
// @style maskP background AV_red when value == 1
// @place mask_union.top-left at mask_R.bottom-left offset(0,20)
// @endpreset

// @preset lowbit_view
// @object bits(p, N) with labels(none), display("${value}")
// @style p background AV_red when value == 1
// @place p.bottom-left at mask_L.top-left offset(0,-20)
// @endpreset

// 取反後，紅色受攻擊格為 0，綠色可選格為 1。
// @preset p_board_view
// @object bits(board, N) as chess_board render matrix with labels(none), display("${queen}${value == 1 ? '' : row == attack_row ? (P & bit ? 1 : 0) : '　'}") in queen_tree
// @style board background AV_green when row == n && (P & bit)
// @style maskP background white when value == 0
// @style maskP background AV_green when value == 1
// @endpreset

// 各階段只指定資料，繪圖寫法不再重複。
// @preset current_masks
// @let maskL = L
// @let maskM = M
// @let maskR = R
// @let attack_row = n
// @let unionL = L
// @let unionM = M
// @let unionR = R
// @let maskP = L | M | R
// @endpreset

// 計算完成後，右側直接展示真正的 P，不用繪圖別名遮蔽它。
// @preset p_masks
// @let maskL = L
// @let maskM = M
// @let maskR = R
// @let attack_row = n
// @let maskP = P
// @endpreset

// @preset nextL_masks
// @let maskL = nextL
// @let maskM = M
// @let maskR = R
// @let attack_row = n + 1
// @let directions = 1
// @let unionL = L
// @let unionM = M
// @let unionR = R
// @let maskP = L | M | R
// @endpreset

// @preset nextM_masks
// @let maskL = nextL
// @let maskM = nextM
// @let maskR = R
// @let attack_row = n + 1
// @let directions = 2
// @let unionL = L
// @let unionM = M
// @let unionR = R
// @let maskP = L | M | R
// @endpreset

// @preset nextR_masks
// @let maskL = nextL
// @let maskM = nextM
// @let maskR = nextR
// @let attack_row = n + 1
// @let directions = 3
// @let unionL = L
// @let unionM = M
// @let unionR = R
// @let maskP = L | M | R
// @endpreset

// @preset nextR_merged_masks
// @let maskL = nextL
// @let maskM = nextM
// @let maskR = nextR
// @let attack_row = n + 1
// @let directions = 3
// @let unionL = nextL
// @let unionM = nextM
// @let unionR = nextR
// @endpreset

// @defaults
// @camera focus board
// @enddefaults

void dfs(int n, int L, int M, int R) {
    // @keep board as "Q" in queen_tree use queen_board_base_view
    // @frame use current_masks, queen_scene_view
    // @let directions = 0
    // @text "dfs(${n})：已放置 ${n} 個皇后，嘗試在第 ${n} 列放置下一個皇后" at chess_board.top when n < N
    // @text "已放置 N 個互不攻擊的皇后，找到一組解" at chess_board.top when n == N

    if (n == N) {
        ans++;
        return;
    }

    // 一次計算目前列的可選位置，Q 與 P 同幀顯示結果。
    int P = ((1 << N) - 1) & ~(L | M | R);
    // @frame use p_masks, queen_scene_view, union_view, p_board_view
    // @let directions = 3
    // @text "L | M | R 的 1 表示受攻擊、不能放皇后。\n取反後，未受攻擊的位置變成 1，成為可選位置；\n再與 (1 << N) - 1 做 AND，只保留棋盤的 N 個位元。" at chess_board.top

    // @frame use p_masks, queen_scene_view, union_view, p_board_view when P == 0
    // @let directions = 3
    // @text "第 ${n} 列沒有可放皇后的位置，這個分支無法完成。\n返回上一列，嘗試其他欄位。" at chess_board.top

    while (P > 0) {
        int p = P & -P;
        P ^= p;

        // @code hide
        int selected_column = N - 1 - __builtin_ctz(p);
        // @endcode
        board[n] = p;
        // @frame use p_masks, queen_scene_view, union_view, p_board_view, lowbit_view
        // @let directions = 3
        // @style board[n][selected_column] highlight
        // @text "p = P & -P：取出最右側的 1，選擇第 ${selected_column} 欄\nP ^= p：移除這個候選位置，之後再嘗試其他位置" at chess_board.top

        int nextL = L | p;
        // @frame use nextL_masks, queen_scene_view, lowbit_view
        // @style board[n][selected_column] highlight
        // @text "nextL = L | p：把新皇后的位置加入左斜線攻擊遮罩" at chess_board.top
        nextL <<= 1;
        // @frame use nextL_masks, queen_scene_view, lowbit_view
        // @style board[n][selected_column] highlight
        // @text "nextL <<= 1：進入下一列時，左斜線攻擊位置往左移一欄" at chess_board.top

        int nextM = M | p;
        // @frame use nextM_masks, queen_scene_view, lowbit_view
        // @style board[n][selected_column] highlight
        // @text "nextM = M | p：新皇后封鎖同一欄，下一列仍不能放在這一欄" at chess_board.top

        int nextR = R | p;
        // @frame use nextR_masks, queen_scene_view, lowbit_view
        // @style board[n][selected_column] highlight
        // @text "nextR = R | p：把新皇后的位置加入右斜線攻擊遮罩" at chess_board.top
        nextR >>= 1;
        // @frame use nextR_masks, queen_scene_view, lowbit_view
        // @style board[n][selected_column] highlight
        // @text "nextR >>= 1：進入下一列時，右斜線攻擊位置往右移一欄" at chess_board.top

        // @frame use nextR_merged_masks, queen_scene_view
        // @style board[n][selected_column] highlight
        // @text "把 nextL、nextM、nextR 傳入 dfs(n + 1)，\n繼續搜尋下一列可放皇后的位置" at chess_board.top

        dfs(n + 1, nextL, nextM, nextR);
        board[n] = 0;
    }
}

int main() {
    N = 4;
    cin >> N;
    board.assign(N, 0);
    dfs(0, 0, 0, 0);

    // @frame
    // @text "完成八皇后問題的搜索" at queen_tree.top
    // @camera auto
    cout << "Total Solutions: " << ans << endl;
    return 0;
}
