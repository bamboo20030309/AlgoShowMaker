#include <bits/stdc++.h>
using namespace std;
int main() {
    vector<int> a = {1,2,3}, b = {4,5,6};
    int total = 0;
    // @frame a,b
    // @style a[0:2] focus when value > 0
    // @style b[0:2] focus when value > 0
    total += a[0]+b[0];
    // @frame a,b
    // @automark a
    // @style a[0:2] focus when value > 0
    // @style b[0:2] focus when value > 0
    total += a[1]+b[1];
    // @frame a,b
    // @automark a,b
    // @style a[0:2] focus when value > 0
    // @style b[0:2] focus when value > 0
    total += a[2]+b[2];
    // @frame a,b
    // @automark none
    // @style b[0] mark blue
    // @frame a,b
    cout << total;
}
