#include <bits/stdc++.h>
using namespace std;
// @defaults
// @camera focus arr offset(0,20) zoom(2)
// @style arr[0] highlight AV_red
// @enddefaults
// @preset close_view
// @camera auto zoom(1.2)
// @style arr[0] highlight AV_green
// @endpreset
int main() {
    vector<int> arr = {3,1,2};
    // @frame arr
    swap(arr[0],arr[1]);
    // @frame use close_view
    // @object arr
    swap(arr[1],arr[2]);
    // @frame arr
    // @camera auto
}
