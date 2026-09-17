#include <bits/stdc++.h>
using namespace std;
void visit(vector<int>& arr, int depth) {
  // @frame arr
  if (depth > 0) visit(arr, depth - 1);
  // @frame arr
}
int main() {
  vector<int> arr = {1, 2};
  // @frame arr
  visit(arr, 1);
  // @frame arr
}
