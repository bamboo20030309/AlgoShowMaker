#include <bits/stdc++.h>
using namespace std;
int main() {
    vector<int> a = {1, 2}, b = {3, 8, 5}, same = {8, 8};
    // @frame a,b,same
    // CASE E10
    a = b;
    // @frame a,b,same
    // CASE E21
    swap(a[0], a[1]);
    // @frame a,b,same
    // CASE E22
    swap(same[0], same[1]);
    // @frame a,b,same
    // CASE E23
    swap(a[0], a[0]);
    // @frame a,b,same
    // CASE E24
    a.insert(a.begin() + 1, 9);
    // @frame a,b,same
    // CASE E25
    a.erase(a.begin() + 1);
    // @frame a,b,same
    // CASE E26
    a.resize(5, 6);
    // @frame a,b,same
    // CASE E27
    a.clear();
    // @frame a,b,same
    // CASE E28
    a.assign(3, 7);
    // @frame a,b,same
    // CASE E29
    a = move(b);
    // @frame a,b,same
    for (int x : a) cout << x << ' ';
    cout << '\n';
}
