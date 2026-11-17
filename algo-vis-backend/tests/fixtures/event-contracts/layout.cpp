#include <bits/stdc++.h>
using namespace std;
// @layout linear as history at canvas.center
// @layout history direction top-down
// @layout history gap 70
int main() {
    vector<int> arr = {3, 8};
    // @frame arr in history
    // @camera focus arr
    // CASE L01
    // @keep arr as "before" in history
    arr[0] = 5;
    // @frame arr in history
    // @camera focus arr
    // CASE L02
    // @keep arr as "after" in history
    arr[1] = 9;
    // @frame arr in history
    // @camera focus arr
    cout << arr[0] << ' ' << arr[1] << '\n';
}
