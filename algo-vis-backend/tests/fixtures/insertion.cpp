#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<int> arr(n);
    for (auto &v : arr) cin >> v;
    // @frame arr
    for (int i = 1; i < n; i++) {
        int key = arr[i];
        int j = i - 1;
        // pick: @frame arr,key
        // @pointer i at arr
        // @pointer j at arr
        while (j >= 0 && arr[j] > key) {
            arr[j+1] = arr[j];
            j--;
            // shift: @frame arr,key
            // @pointer i at arr
            // @pointer j at arr
        }
        arr[j+1] = key;
        // insert: @frame arr,key
        // @pointer i at arr
        // @pointer j at arr
    }
    // @frame arr
    return 0;
}
