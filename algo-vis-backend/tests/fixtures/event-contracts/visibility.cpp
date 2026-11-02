#include <bits/stdc++.h>
using namespace std;
int main() {
    int a = 1, b = 3, c = 8;
    // @frame a
    // CASE E12
    a = b;
    // @frame a,b
    // CASE E13
    a = b + c;
    // @frame a,b
    // CASE E14
    c = b;
    // @frame a,b
    cout << a << ' ' << b << ' ' << c << '\n';
}
