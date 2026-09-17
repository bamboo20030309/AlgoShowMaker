#include <bits/stdc++.h>
using namespace std;
void visit(vector<int>& arr, int i) {
    int value = i;
    // @frame arr[i],value
    if (i < 2) visit(arr, i + 1);
    // @frame arr[i],value
}
int main() {
    vector<int> arr = {4, 3, 2};
    int i = 0;
    // @frame arr[i]
    visit(arr, i);
    // @frame arr[i]
}
