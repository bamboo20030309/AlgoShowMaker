#include <bits/stdc++.h>
using namespace std;
int main() {
  int n; cin >> n;
  vector<int> arr(n); for (int& v : arr) cin >> v;
  // @frame arr
  for (int i=0; i<n-1; i++) {
    int min_idx=i;
    // @frame arr
    // @pointer i at arr
    // @pointer min_idx at arr
    for (int j=i+1; j<n; j++) {
      if (arr[j]<arr[min_idx]) min_idx=j;
      // @frame arr
      // @pointer i at arr
      // @pointer min_idx at arr
      // @pointer j at arr
    }
    if (i!=min_idx) swap(arr[i],arr[min_idx]);
    // @frame arr
    // @pointer i at arr
    // @pointer min_idx at arr
    // @exit min_idx,i
    // @keep last
  }
  // @frame arr
}
