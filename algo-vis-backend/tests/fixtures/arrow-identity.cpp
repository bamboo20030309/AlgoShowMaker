#include <bits/stdc++.h>
using namespace std;
int main() {
    vector<int> arr = {5,2,7,1};
    // @frame arr
    // @arrow from arr[0] to arr[1] as "link" color #ff0000 width 2
    // @arrow from arr[1] to arr[2]
    // @frame arr
    // @arrow from arr[0] to arr[3] as "link" color #0000ff width 4
    // @arrow from arr[2] to arr[3]
    swap(arr[0], arr[3]);
    // @frame arr
    // @arrow from arr[0] to arr[3] as "link" color #0000ff width 4
    // @arrow from arr[2] to arr[3]
}
