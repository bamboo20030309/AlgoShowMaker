#include <bits/stdc++.h>
using namespace std;
int main() {
  int n; cin >> n;
  vector<int> arr(n); for (int& v : arr) cin >> v;
  // @frame arr
  for (int i=0; i<n-1; i++) {
    int min_idx=i;
    // @frame arr[i,min_idx]
    for (int j=i+1; j<n; j++) {
      if (arr[j]<arr[min_idx]) min_idx=j;
      // @frame arr[i,min_idx,j]
    }
    if (i!=min_idx) swap(arr[i],arr[min_idx]);
    // @frame arr[i,min_idx]
    // @exit min_idx,i
    // @keep last
  }
  // @frame arr
}
