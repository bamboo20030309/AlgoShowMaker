// Two-dimensional Prefix Sum Sample
#include <bits/stdc++.h>
using namespace std;

int n, m;
int row, column;
int r1, c1, r2, c2;
int ans;
vector<vector<int>> num, pre;

// @defaults
// @camera auto zoom(0.85)
// @enddefaults

// num 與 pre 都在第 0 列、第 0 欄補 0，實際資料從 [1][1] 開始。
// matrix 預設會顯示數值、row／column index、格線與 outerframe，因此不必重複寫 with。
// @preset prefix_sum_2d_view
// @object pre render matrix
// @object num render matrix
// @place num.left at pre.right offset(100,0)
// @endpreset

// 建表時讓 row 在左側移動，column 進入目前 row 後水平移動；不顯示 inner index。
// @preset prefix_sum_2d_cursor
// @object pre[row][column] render matrix with marker-layout(inner)
// @endpreset

int main() {
    cin >> n >> m;
    num.assign(n + 1, vector<int>(m + 1, 0));
    pre.assign(n + 1, vector<int>(m + 1, 0));

    for (row = 1; row <= n; row++) {
        for (column = 1; column <= m; column++) {
            cin >> num[row][column];
        }
    }

    row = 1;
    column = 1;

    // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
    // @events animate off
    // @style pre[0][0] background AV_grey
    // @style num[0][0] background AV_grey
    // @text "二維前綴和在第 0 列與第 0 欄補 0，避免建表時另外判斷邊界" at pre.top offset(0,-24)

    for (row = 1; row <= n; row++) {
        for (column = 1; column <= m; column++) {
            pre[row][column] = num[row][column]
                + pre[row - 1][column]
                + pre[row][column - 1]
                - pre[row - 1][column - 1];

            // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
            // @style pre[row][column] highlight
            // @style pre[row-1][column] background AV_blue
            // @style pre[row][column-1] background AV_orange
            // @style pre[row-1][column-1] background AV_red
            // @style num[row][column] background AV_green
            // @arrow from pre[row-1][column] to pre[row][column] as "from_up" color AV_blue
            // @arrow from pre[row][column-1] to pre[row][column] as "from_left" color AV_orange
            // @arrow from pre[row-1][column-1] to pre[row][column] as "remove_overlap" color AV_red
            // @arrow from num[row][column] to pre[row][column] as "add_value" color AV_green
            // @text "pre[${row}][${column}] = ${pre[row-1][column]} + ${pre[row][column-1]} - ${pre[row-1][column-1]} + ${num[row][column]} = ${pre[row][column]}" at pre.top offset(0,-24)
        }
    }

    // @frame use prefix_sum_2d_view
    // @text "二維前綴和建表完成；接著可用四個角在 O(1) 查詢子矩陣總和" at pre.top offset(0,-24)

    int queryCount;
    cin >> queryCount;
    while (queryCount--) {
        // 輸入使用 0-based 座標；加 1 後對應有補零邊界的 pre。
        cin >> r1 >> c1 >> r2 >> c2;
        r1++; c1++; r2++; c2++;

        ans = pre[r2][c2]
            - pre[r1 - 1][c2]
            - pre[r2][c1 - 1]
            + pre[r1 - 1][c1 - 1];

        // @frame use prefix_sum_2d_view
        // @for r in [r1:r2]
        // @for c in [c1:c2]
        // @style num[r][c] background AV_green
        // @endfor
        // @endfor
        // @style pre[r2][c2] background AV_green
        // @style pre[r1-1][c2] background AV_red
        // @style pre[r2][c1-1] background AV_red
        // @style pre[r1-1][c1-1] background AV_green
        // @text "查詢 (${r1-1},${c1-1}) 到 (${r2-1},${c2-1})：${pre[r2][c2]} - ${pre[r1-1][c2]} - ${pre[r2][c1-1]} + ${pre[r1-1][c1-1]} = ${ans}" at pre.top offset(0,-24)

        cout << ans << '\n';
    }

    return 0;
}
