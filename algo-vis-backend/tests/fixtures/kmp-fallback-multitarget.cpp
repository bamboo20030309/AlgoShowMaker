#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main(){string s;cin>>s;int n=s.size();vector<int> p(n,0);
// @default
// @camera auto zoom(1.6)
// @enddefault
// @preset kmp_view
// @object char(s) with labels(value,index)
// @object p with labels(value,index)
// @place s.left-bottom at p.left-top offset(0,-90)
// @endpreset
// @preset kmp_cursor
// @pointer i at s
// @pointer j at s
// @pointer i-1 at p
// @style p[0:i-1] focus
// @endpreset
// @frame use kmp_view
// @style p[0] focus
// @text "prefix function" at p.bottom
for(int i=1;i<n;i++){
int j=p[i-1];
// @frame use kmp_view,kmp_cursor
// @arrow from s[i] to p[i-1] color AV_green!
// @arrow from p[i-1] to s[j].index-label.bottom color AV_green!
// @text "start" at p.bottom
while(j>0 && s[i]!=s[j]){
j=p[j-1];
// @frame use kmp_view,kmp_cursor
// @pointer j at p
// @let _j = before(j)
// @arrow from p[_j] to p[_j-1] as "fallback-index" color AV_red!
// @arrow from p[_j-1] to s[p[_j-1]].index-label.bottom as "fallback-target" color AV_red!
// @text "fallback ${_j} to ${j}" at p.bottom
}
// @frame use kmp_view,kmp_cursor
// @text "compare" at p.bottom
if(s[i]==s[j]){j++;
// @frame use kmp_view,kmp_cursor
// @text "match" at p.bottom
}
p[i]=j;
// @frame use kmp_view,kmp_cursor
// @style p[0:i] focus
// @arrow from p[j].index-label.top to p[i] color AV_green!
// @text "write" at p.bottom
}
// @frame use kmp_view
// @style p[0:n-1] focus
// @text "done" at p.bottom
for(int i=0;i<n;i++)cout<<p[i]<<(i+1==n?'\n':' ');
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */
