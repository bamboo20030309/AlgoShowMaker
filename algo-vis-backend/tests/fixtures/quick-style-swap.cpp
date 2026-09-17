#include <bits/stdc++.h>
using namespace std;
void quick_sort(vector<int>& arr, int low, int high) {
  if (low >= high) return;
  int pivot = arr[high];
  int i = low;
  // @frame arr[i],pivot
  // @segment arr[low:high]
  // @style arr[high] point red
  for (int j=low; j<high; j++) {
    if (arr[j] < pivot) {
      if (i != j) swap(arr[i],arr[j]);
      i++;
    }
    // @frame arr[i,j],pivot
    // @segment arr[low:high]
    // @style arr[low:j] background AV_green when value < pivot
    // @style arr[low:j] background AV_red when value > pivot
  }
  if (i != high) swap(arr[i],arr[high]);
  // @frame arr[i,high],pivot
  quick_sort(arr,low,i-1);
  quick_sort(arr,i+1,high);
}
int main() {
  int n; cin>>n;
  vector<int> arr(n);
  for (int i=0;i<n;i++) cin>>arr[i];
  // @frame arr
  quick_sort(arr,0,n-1);
  // @frame arr
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventInstructionStates":{"compare:quick_sort:low >= high":false,"compare:quick_sort:j < high":false,"declare:quick_sort:arr":false,"declare:main:arr":false,"scope-exit:main:i":false}}}
@asm-view */
