/*
 * 範例：一維前綴和
 *
 * 用途與核心步驟：建立 prefix[i] 表示前 i 個元素總和，再用兩個前綴值相減回答區間總和。
 * 輸入、輸出與複雜度：輸入長度 n 的序列與區間；輸出區間和。預處理 O(n)、每次查詢 O(1)、空間 O(n)。
 *
 * 視覺化約定：`@frame`、`@layout`、`@style` 等註解由 AlgoShowMaker
 * 分析器讀取；它們描述畫面切點與呈現方式，不參與 C++ 演算法運算。
 */

// One-dimensional Prefix Sum Sample
#include <bits/stdc++.h>
using namespace std;

int n;
vector<int> num, pre;

// @default
// @camera auto zoom(1.05)
// @enddefault

// num[0] 與 pre[0] 是保留格，實際資料從 index 1 開始。
// @preset prefix_sum_view
// @object num with labels(value,index)
// @object pre with labels(value,index)
// @style num[0] background AV_grey
// @style pre[0] background AV_grey
// @place num.left-bottom at pre.left-top offset(0,-70)
// @endpreset

// ─────────────────────────────────────────────────────────────────────────────
// 範例入口：準備輸入與初始畫面，執行核心算法，最後輸出結果／收尾畫面。
// ─────────────────────────────────────────────────────────────────────────────

int main() {
    cin >> n;
    num.resize(n + 1);
    pre.resize(n + 1);
    for (int i = 1; i <= n; i++) cin >> num[i];

    // @frame use prefix_sum_view
    // @events animate off
    // @text "pre[0] 保留為 0；接著從左到右累加每個數字" at num.top offset(0,-20)

    for (int i = 1; i <= n; i++) {
        pre[i] = pre[i - 1] + num[i];

        // @frame use prefix_sum_view
        // @style num[1:i] focus
        // @style pre[0:i] focus
        // @style num[i] highlight
        // @style pre[i-1:i] highlight
        // @style num[1:i] background AV_green
        // @style pre[i] background AV_green
        // @text "pre[${i}] = pre[${i - 1}] + num[${i}] = ${pre[i]}" at num.top offset(0,-20)
    }

    // @frame use prefix_sum_view
    // @text "一維前綴和建構完成；pre[i] 是前 i 個數字的總和" at num.top offset(0,-20)

    int L, R;
    cin >> L >> R;

    // @frame use prefix_sum_view
    // @style num[L:R] background AV_green
    // @style pre[R] background AV_green
    // @style pre[L-1] background AV_red
    // @text "第 ${L} 到第 ${R} 個數字的總和 = pre[${R}] - pre[${L - 1}]" at num.top offset(0,-20)

    int ans = pre[R] - pre[L - 1];

    // @frame use prefix_sum_view
    // @style num[L:R] background AV_green
    // @style pre[R] background AV_green
    // @style pre[L-1] background AV_red
    // @text "區間和 = ${pre[R]} - ${pre[L - 1]} = ${ans}" at num.top offset(0,-20)

    cout << "sum of L to R = " << ans << '\n';
    return 0;
}
