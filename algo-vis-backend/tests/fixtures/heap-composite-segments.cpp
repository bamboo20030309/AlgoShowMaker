#include <bits/stdc++.h>
using namespace std;
#define LM INT_MAX

int main() {
    vector<int> tree(16, 0), lazy(16, 0), sets(16, LM);
    tree[1] = 15;
    tree[2] = 7; lazy[2] = 3;
    tree[3] = 8; sets[3] = 8;
    tree[4] = 4; lazy[4] = 2; sets[4] = 9;

    // @frame tree render heap with range(1,15), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
    // @style lazy[2] background AV_blue
    // @style sets[3] background AV_orange
    // @segment tree[1][0:7] color AV_red as full
    // @segment tree[1][2:5] color AV_green as middle
    // @segment tree[2][2:3] color AV_blue as child_right
    // @segment tree[3][5:2] color AV_red as empty

    lazy[1] = 6;
    sets[2] = 10;
    // @frame tree render heap with range(1,15), fields(tree,lazy,sets), hide(lazy=0,sets=LM), separator(" / ")
    // @segment tree[1][-2:20] color AV_green as full when lazy[1] > 0

    lazy[1] = 7;
    // @frame tree render heap with range(1,15), fields(tree,lazy,sets), hide(lazy=0,sets=LM)
    // @segment tree[1][1:6] color AV_green as full

    vector<pair<int,int>> pairs = {{5,0},{0,5}};
    // @frame pairs with hide(second=0), separator(" / ")

    vector<tuple<int,int,int>> tuples = {{1,0,3},{0,0,0}};
    // @frame tuples

    vector<int> arr = {1,2,3,4};
    // @frame arr
    // @segment arr[1:2]
}
