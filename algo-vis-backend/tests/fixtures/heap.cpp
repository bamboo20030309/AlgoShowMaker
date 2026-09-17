#include <bits/stdc++.h>
using namespace std;
void heapify(vector<int>& arr,int n,int i) {
  int largest=i,l=2*i,r=2*i+1;
  if(l<=n && arr[l]>arr[largest]) largest=l;
  if(r<=n && arr[r]>arr[largest]) largest=r;
  // @frame arr[i,largest] render heap with range(1,arr.size()-1)
  if(largest!=i) {
    swap(arr[i],arr[largest]);
    // @frame arr[i,largest] render heap with range(1,arr.size()-1)
    heapify(arr,n,largest);
  }
}
int main() {
  int n; cin>>n; vector<int> arr(n+1);
  for(int i=1;i<=n;i++) cin>>arr[i];
  // @frame arr render heap with range(1,n)
  // @keep arr as "init"
  for(int i=n/2;i>=1;i--) heapify(arr,n,i);
  // @frame arr render heap with range(1,n)
}
