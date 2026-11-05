#include <bits/stdc++.h>
using namespace std;
int main() {
    int n=5, b=2, c=3;
    vector<int> arr={1,8,3,4,5};
    // @frame arr,b,n
    int literal=9;
    int hidden=c;
    int copied=arr[1];
    int computed=b+c;
    vector<int> repeated(n,0);
    vector<int> values={1,2,3};
    vector<vector<int>> grid(2,vector<int>(3,0));
    vector<int> cloned=arr;
    int i=2;
    int k=b;
    int later;
    later=b;
    int newSource=6;
    int fromNew=newSource;
    int selected=min(b,c);
    // @frame arr,b,n,literal,hidden,copied,computed,repeated,values,cloned,later,newSource,fromNew,selected,grid
    // @pointer i,k at arr
    i=4;
    // @frame arr,b,n,literal,hidden,copied,computed,repeated,values,cloned,later,newSource,fromNew,selected,grid
    // @pointer i,k at arr
    i=4;
    // @frame arr,b,n,literal,hidden,copied,computed,repeated,values,cloned,later,newSource,fromNew,selected,grid
    // @pointer i,k at arr
}
