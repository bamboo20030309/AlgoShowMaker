#include <bits/stdc++.h>
using namespace std;
int main() {
    int a = 1, b = 3, c = 8;
    vector<int> arr = {4, 7};
    // @frame a,b,c,arr
    // CASE E01
    int uninitialized;
    // @frame a,b,c,arr,uninitialized
    // CASE E02
    int initialized = b;
    // @frame a,b,c,arr,initialized
    // CASE E02_CONTAINER
    vector<int> copied = arr;
    // @frame a,b,c,arr,initialized,copied
    // CASE E03
    a = b;
    // @frame a,b,c,arr,initialized
    // CASE E04
    arr[1] = arr[0];
    // @frame a,b,c,arr,initialized
    // CASE E05
    a = b + c;
    // @frame a,b,c,arr,initialized
    // CASE E06
    a += b;
    // @frame a,b,c,arr,initialized
    // CASE E07
    a = 8;
    // @frame a,b,c,arr,initialized
    // CASE E08
    a = b + b;
    // @frame a,b,c,arr,initialized
    // CASE E09
    a = a;
    // @frame a,b,c,arr,initialized
    cout << a << ' ' << initialized << ' ' << arr[0] << ' ' << arr[1] << '\n';
}
