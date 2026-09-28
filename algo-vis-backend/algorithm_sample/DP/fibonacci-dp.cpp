/*
 * 範例：用陣列計算費式數列
 *
 * 由 dp[0]、dp[1] 開始，依序計算 dp[i]=dp[i-1]+dp[i-2]。
 * 每個子問題只計算一次，時間 O(n)、空間 O(n)。
 */

#include <bits/stdc++.h>
using namespace std;

// @defaults
// @camera auto zoom(1.15)
// @enddefaults

// @preset fibonacci_dp_view
// @object dp with labels(value,index)
// @place dp.top at canvas.top offset(0,150)
// @endpreset

int main() {
    int n;
    cin >> n;

    vector<int> dp(n+1);

    // @frame use fibonacci_dp_view
    // @text "先建立 dp[0...${n}]；dp[0] 預設為 0" at dp.top offset(0,-28)

    dp[1]=1;

    // @frame use fibonacci_dp_view
    // @style dp[0:1] background AV_green
    // @text "基本答案：dp[0] = 0，dp[1] = 1" at dp.top offset(0,-28)

    for(int i=2;i<=n;i++) {
        dp[i]=dp[i-1]+dp[i-2];

        // @frame use fibonacci_dp_view
        // @style dp[0:i] focus
        // @style dp[i-2:i-1] background AV_green
        // @style dp[i] highlight
        // @text "dp[${i}] = dp[${i-1}] + dp[${i-2}] = ${dp[i]}" at dp.top offset(0,-28)
    }

    // @frame use fibonacci_dp_view
    // @style dp[0:n] background AV_green
    // @text "F(${n}) = dp[${n}] = ${dp[n]}" at dp.top offset(0,-28)

    cout << dp[n] << '\n';
    return 0;
}
