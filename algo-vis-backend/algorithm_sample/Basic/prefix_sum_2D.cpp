// Two-dimensional Prefix Sum Sample
#include <bits/stdc++.h>
using namespace std;

int n, m;
int r, c;
int r1, c1, r2, c2;
int ans;
vector<vector<int>> num, pre;

// @defaults
// @camera auto zoom(1)
// @enddefaults

// num 與 pre 都在第 0 列、第 0 欄補 0，實際資料從 [1][1] 開始。
// matrix 預設會顯示數值、row／column index、格線與 outerframe，因此不必重複寫 with。
// @preset prefix_sum_2d_view
// @object pre render matrix
// @object num render matrix
// @place num.left at pre.right offset(100,0)
// @endpreset

// 保留 r、c 與 pre[r][c] 的追蹤關係，但這個範例不畫索引指標。
// @preset prefix_sum_2d_cursor
// @object pre[r][c] render matrix with marker-layout(none)
// @endpreset

int main() {
    cin >> n >> m;
    num.assign(n + 1, vector<int>(m + 1, 0));
    pre.assign(n + 1, vector<int>(m + 1, 0));

    for (r = 1; r <= n; r++) {
        for (c = 1; c <= m; c++) {
            cin >> num[r][c];
        }
    }

    r = 1;
    c = 1;

    // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
    // @events animate off
    // @style pre[0:n][0] background AV_grey
    // @style pre[0][0:m] background AV_grey
    // @style num[0:n][0] background AV_grey
    // @style num[0][0:m] background AV_grey
    // @text "二維前綴和在第 0 列與第 0 欄補 0，避免建表時另外判斷邊界" at pre.top offset(0,-24)

    for (r = 1; r <= n; r++) {
        for (c = 1; c <= m; c++) {
            // Step 1：先放入上方前綴和。
            pre[r][c] = pre[r - 1][c];

            // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
            // @style pre[r][c] highlight
            // @style pre[r-1][c] background AV_blue
            // @style num[0:r-1][0:c] background AV_blue
            // @arrow from pre[r-1][c] to pre[r][c] as "from_up" color AV_blue
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + pre[${r}][${c-1}] - pre[${r-1}][${c-1}] + num[${r}][${c}]"}
            // ] as build_up_num at num.top offset(0,-24) when r <= n / 2
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + pre[${r}][${c-1}] - pre[${r-1}][${c-1}] + num[${r}][${c}]"}
            // ] as build_up_pre at pre.top offset(175,-24) when r > n / 2
            // @camera focus num zoom(1.7) when r <= n / 2 && (r > 1 || c > 1)

            // Step 2：加上左方前綴和。
            pre[r][c] += pre[r][c - 1];

            // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
            // @style pre[r][c] highlight
            // @style pre[r-1][c] background AV_blue
            // @style pre[r][c-1] background AV_orange
            // @style num[0:r-1][0:c] background AV_blue
            // @style num[0:r][0:c-1] background AV_orange
            // @arrow from pre[r-1][c] to pre[r][c] as "from_up" color AV_blue
            // @arrow from pre[r][c-1] to pre[r][c] as "from_left" color AV_orange
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + "},
            //   {"text": "pre[${r}][${c-1}]", "background": "AV_orange"},
            //   {"text": " - pre[${r-1}][${c-1}] + num[${r}][${c}]"}
            // ] as build_left_num at num.top offset(0,-24) when r <= n / 2
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + "},
            //   {"text": "pre[${r}][${c-1}]", "background": "AV_orange"},
            //   {"text": " - pre[${r-1}][${c-1}] + num[${r}][${c}]"}
            // ] as build_left_pre at pre.top offset(175,-24) when r > n / 2
            // @camera focus num zoom(1.7) when r <= n / 2 && (r > 1 || c > 1)

            // Step 3：扣掉被重複計算的左上角。
            pre[r][c] -= pre[r - 1][c - 1];

            // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
            // @style pre[r][c] highlight
            // @style pre[r-1][c] background AV_blue
            // @style pre[r][c-1] background AV_orange
            // @style pre[r-1][c-1] background AV_red
            // @style num[0:r-1][0:c] background AV_blue
            // @style num[0:r][0:c-1] background AV_orange
            // @style num[0:r-1][0:c-1] background AV_red
            // @arrow from pre[r-1][c] to pre[r][c] as "from_up" color AV_blue
            // @arrow from pre[r][c-1] to pre[r][c] as "from_left" color AV_orange
            // @arrow from pre[r-1][c-1] to pre[r][c] as "remove_overlap" color AV_red
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + "},
            //   {"text": "pre[${r}][${c-1}]", "background": "AV_orange"},
            //   {"text": " - "},
            //   {"text": "pre[${r-1}][${c-1}]", "background": "AV_red"},
            //   {"text": " + num[${r}][${c}]"}
            // ] as build_overlap_num at num.top offset(0,-24) when r <= n / 2
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + "},
            //   {"text": "pre[${r}][${c-1}]", "background": "AV_orange"},
            //   {"text": " - "},
            //   {"text": "pre[${r-1}][${c-1}]", "background": "AV_red"},
            //   {"text": " + num[${r}][${c}]"}
            // ] as build_overlap_pre at pre.top offset(175,-24) when r > n / 2
            // @camera focus num zoom(1.7) when r <= n / 2 && (r > 1 || c > 1)

            // Step 4：最後加上目前資料格。
            pre[r][c] += num[r][c];

            // @frame use prefix_sum_2d_view, prefix_sum_2d_cursor
            // @style pre[r][c] highlight
            // @style pre[r-1][c] background AV_blue
            // @style pre[r][c-1] background AV_orange
            // @style pre[r-1][c-1] background AV_red
            // @style num[r][c] background AV_green
            // @style num[0:r-1][0:c] background AV_blue
            // @style num[0:r][0:c-1] background AV_orange
            // @style num[0:r-1][0:c-1] background AV_red
            // @arrow from num[r][c] to pre[r][c] as "add_value" color AV_green
            // @arrow from pre[r-1][c] to pre[r][c] as "from_up" color AV_blue
            // @arrow from pre[r][c-1] to pre[r][c] as "from_left" color AV_orange
            // @arrow from pre[r-1][c-1] to pre[r][c] as "remove_overlap" color AV_red
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + "},
            //   {"text": "pre[${r}][${c-1}]", "background": "AV_orange"},
            //   {"text": " - "},
            //   {"text": "pre[${r-1}][${c-1}]", "background": "AV_red"},
            //   {"text": " + "},
            //   {"text": "num[${r}][${c}]", "background": "AV_green"},
            //   {"text": " = ${pre[r][c]}"}
            // ] as build_value_num at num.top offset(0,-24) when r <= n / 2
            // @text [
            //   {"text": "pre[${r}][${c}] = "},
            //   {"text": "pre[${r-1}][${c}]", "background": "AV_blue"},
            //   {"text": " + "},
            //   {"text": "pre[${r}][${c-1}]", "background": "AV_orange"},
            //   {"text": " - "},
            //   {"text": "pre[${r-1}][${c-1}]", "background": "AV_red"},
            //   {"text": " + "},
            //   {"text": "num[${r}][${c}]", "background": "AV_green"},
            //   {"text": " = ${pre[r][c]}"}
            // ] as build_value_pre at pre.top offset(175,-24) when r > n / 2
            // @camera focus num zoom(1.7) when r <= n / 2 && (r > 1 || c > 1)
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
        // @style num[r1:r2][c1:c2] background AV_green
        // @style pre[r2][c2] background AV_green
        // @style pre[r1-1][c2] background AV_red
        // @style pre[r2][c1-1] background AV_red
        // @style pre[r1-1][c1-1] background AV_green
        // @text "查詢 (${r1-1},${c1-1}) 到 (${r2-1},${c2-1})：${pre[r2][c2]} - ${pre[r1-1][c2]} - ${pre[r2][c1-1]} + ${pre[r1-1][c1-1]} = ${ans}" at pre.top offset(0,-24)

        cout << ans << '\n';
    }

    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventSettings": {
      "autoFixedEnabled": true,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
