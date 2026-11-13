#include <bits/stdc++.h>
using namespace std;int main(){vector<int> v={3,8,6,2};int x=0,i=0;
// @frame v,x,i
max(v[0],v[1]);
x=max(min(v[1],v[2]),max(v[0],v[3]));
int initial=min(max(v[0],v[1]),v[2]);
x=1+max(v[0],v[1]);
x=max(i++,i++);
// @frame v,x,i,initial
cout<<x<<' '<<i<<' '<<initial;
}