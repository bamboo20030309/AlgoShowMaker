#include <bits/stdc++.h>
using namespace std;
int main() {
 vector<int> arr(1000, 0);
 vector<vector<int>> grid(100, vector<int>(100, 0));
 for(int i=0;i<100;i++){
  for(int j=0;j<100;j++){
   if((i+j)%2==1)grid[i][j]=1;
  }
 }
 // @frame arr,grid
 // @style grid background AV_green when value==1
 // @style grid background AV_red when value==0
 cout << "完成";
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */