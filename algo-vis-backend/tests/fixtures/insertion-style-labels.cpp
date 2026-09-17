#include <bits/stdc++.h>
using namespace std;
// @defaults
// @camera focus arr offset(0,20) zoom(2.0)
// @enddefaults
int main() {
    int n; cin >> n;
    vector<int> arr(n);
    for(auto&v:arr) cin >> v;
    // @frame arr
    // @text "Insertion Sort" at arr.top
    for (int i=1; i<n; i++) {
        int j=i-1;
        int key=arr[i];
        // @frame arr[j,j+1],key
        // @style arr[0:i] background AV_red when value <= key && index != j+1
        // @style arr[0:i] background AV_green when value > key && index != j+1
        while (j >= 0 && arr[j] > key) {
            // @frame arr[j,j+1],key
            // @style arr[0:i] background AV_red when value <= key && index != j+1
            // @style arr[0:i] background AV_green when value > key && index != j+1
            arr[j+1]=arr[j];
            // @frame arr[j,j+1],key
            // @style arr[0:i] background AV_red when value <= key && index != j
            // @style arr[0:i] background AV_green when value > key && index != j
            j--;
        }
        arr[j+1]=key;
        // @frame arr[j,j+1],key
        // @style arr[0:i] background AV_red when value <= key && index != j+1
        // @style arr[0:i] background AV_green when value > key && index != j+1
    }
    // @frame arr
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventInstructionStates":{"write:main:j--":true,"assign:main:key = arr[i]":true,"compare:main:i < n":false,"write:main:i++":false,"declare:main:j":true,"declare:main:key":true,"scope-exit:main:j":true,"scope-exit:main:key":true,"scope-exit:main:i":false,"assign:main:j = i - 1":true,"compare:main:j >= 0":false,"assign:main:i = 1":false,"declare:main:i":false,"declare:main:arr":false}}}
@asm-view */
