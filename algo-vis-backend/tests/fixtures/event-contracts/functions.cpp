#include <bits/stdc++.h>
using namespace std;
int solve(int value) {
    // @frame value
    // CASE E31
    int local = value + 1;
    // @frame value,local
    // CASE E33
    return local;
}
int main() {
    int ans = 0, source = 7, total = 0;
    // @frame ans,source,total
    // CASE E30
    // CASE E11
    ans = solve(source);
    // @frame ans,source,total
    for (int i = 0; i < 4; ++i) {
        // @frame ans,source,total,i
        // CASE E34_CONTINUE
        if (i == 1) continue;
        // CASE E34_BREAK
        if (i == 3) break;
        total += i;
        // @frame ans,source,total,i
    }
    // @frame ans,source,total
    // CASE E35
    cout << ans << ' ' << total << '\n';
    // CASE E32
    return 0;
}
