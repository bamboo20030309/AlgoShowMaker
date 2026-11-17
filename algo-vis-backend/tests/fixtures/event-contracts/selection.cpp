#include <bits/stdc++.h>
using namespace std;
int main() {
    int a = 0, b = 3, c = 8, d = 2;
    bool result = false;
    // @frame a,b,c,d,result
    // CASE E15
    result = b < c;
    // @frame a,b,c,d,result
    // CASE E16
    result = b != c;
    // @frame a,b,c,d,result
    // CASE E17
    a = min(b, c);
    // @frame a,b,c,d,result
    // CASE E17_MAX
    a = max(b, c);
    // @frame a,b,c,d,result
    // CASE E18
    a = result ? b : c;
    // @frame a,b,c,d,result
    // CASE E19
    a = min(b, c) + d;
    // @frame a,b,c,d,result
    // CASE E20
    result = false && (++d > 0);
    // @frame a,b,c,d,result
    // CASE E20_OR
    result = true || (++d > 0);
    // @frame a,b,c,d,result
    // CASE E16_EQUAL
    result = b == b;
    // @frame a,b,c,d,result
    // CASE E17_TIE
    a = min(b, b);
    // @frame a,b,c,d,result
    cout << a << ' ' << b << ' ' << c << ' ' << d << ' ' << result << '\n';
}
