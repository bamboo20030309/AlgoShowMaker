#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0, 2, 11};
  // @frame arr with range(1,2)
  // @style arr[1:2] highlight red
  // @style arr[1:2] background AV_green when value > 5
  // @style arr[1:2] background AV_red when value <= 5
  swap(arr[1], arr[2]);
  // @frame arr with range(1,2)
  // @style arr[1:2] highlight red
  // @style arr[1:2] background AV_green when value > 5
  // @style arr[1:2] background AV_red when value <= 5
  // @frame arr render heap with range(1,2)
  // @style arr[1:2] highlight red when value > 0
  // @style arr[1:2] background AV_green when value > 5
  // @style arr[1:2] background AV_red when value <= 5
  swap(arr[1], arr[2]);
  // @frame arr render heap with range(1,2)
  // @style arr[1:2] highlight red when value > 0
  // @style arr[1:2] background AV_green when value > 5
  // @style arr[1:2] background AV_red when value <= 5
  return 0;
}
