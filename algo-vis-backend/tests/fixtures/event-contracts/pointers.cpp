#include <bits/stdc++.h>
using namespace std;
int main() {
    vector<int> s = {8, 4, 6}, p = {0, 0, 1};
    int i = 0;
    // @frame s,p
    // @pointer i at s
    // CASE P01
    int j = 1;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P02
    i++;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P03
    j = i - 1;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P04
    j = p[2];
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P05
    j = 0;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P06
    j = 2;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // @pointer i-1 at p
    // CASE P07
    i++;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // @pointer i-1 at p
    // CASE P08
    j = -1;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P08_RIGHT
    j = 3;
    // @frame s,p
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P09
    bool ordered = i < j;
    // @frame s,p,ordered
    // @pointer i at s
    // @pointer j at s
    // @pointer j at p
    // CASE P10
    // @exit j
    // @frame s,p
    // @pointer i at s
    cout << i << ' ' << j << ' ' << ordered << '\n';
}
