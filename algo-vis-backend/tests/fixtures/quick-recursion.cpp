#include <bits/stdc++.h>
using namespace std;
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
void quick_sort(vector<int>& arr,int low,int high) {
  if(low>=high) return;
  int pivot=arr[high]; int i=low;
  // @frame arr[i],pivot with range(low,high) in quick_tree
  // @place pivot at arr.right offset(30,0)
  for(int j=low;j<high;j++) {
    if(arr[j]<pivot) { if(i!=j) swap(arr[i],arr[j]); i++; }
    // @frame arr[i,j],pivot with range(low,high) in quick_tree
    // @place pivot at arr.right offset(30,0)
    // @style arr[low:j] background AV_green when value<pivot
    // @style arr[low:j] background AV_red when value>pivot
  }
  if(i!=high) swap(arr[i],arr[high]);
  // @frame arr[i,high],pivot with range(low,high) in quick_tree
  // @keep arr as "partition" in quick_tree
  quick_sort(arr,low,i-1); quick_sort(arr,i+1,high);
}
int main() {
  int n; cin>>n; vector<int> arr(n); for(int& v:arr) cin>>v;
  // @frame arr
  quick_sort(arr,0,n-1);
  // @frame arr
}
