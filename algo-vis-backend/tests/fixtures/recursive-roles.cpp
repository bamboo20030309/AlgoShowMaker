#include <bits/stdc++.h>
using namespace std;
void visit(vector<int>& arr, int i) {
    int value = i;
    // @frame arr,value
    // @pointer i at arr
    if (i < 2) visit(arr, i + 1);
    // @frame arr,value
    // @pointer i at arr
}
int main() {
    vector<int> arr = {4, 3, 2};
    int i = 0;
    // @frame arr
    // @pointer i at arr
    visit(arr, i);
    // @frame arr
    // @pointer i at arr
}
