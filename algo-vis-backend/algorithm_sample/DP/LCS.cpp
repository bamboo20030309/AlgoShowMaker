// LCS Sample
#include <bits/stdc++.h>
using namespace std;

string S,T;
vector<vector<int>> LCS;
set<string> ans;

// @defaults
// @camera auto zoom(1.2) offset(0,-20)
// @enddefaults

// @preset lcs_view
// @let rows = S.size()
// @let columns = T.size()
// @object LCS render matrix with labels(value), row-labels("",S), column-labels("",T), marker-layout(none)
// @object ans with labels(value)
// @place ans.left at LCS.right offset(80,0)
// @for rr in [1:rows]
// @for cc in [1:columns]
// @arrow from LCS[rr-1][cc-1] to LCS[rr][cc] color AV_blue
//   when S[rr-1] == T[cc-1] && LCS[rr][cc] == LCS[rr-1][cc-1] + 1
// @endfor
// @endfor
// @endpreset

void dfs(int x,int y,string now) {
    if (now.size()==LCS[S.size()][T.size()]){
        ans.insert(now);

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style ans[0:ans.size()-1] background AV_green
        // @text [
        //   {"text": "回溯完成，找到 LCS："},
        //   {"text": "${now}", "background": "AV_green"}
        // ] at LCS.top offset(0,-24)
        return;
    }
    if (x==0||y==0)return;
    if (S[x-1]==T[y-1]){
        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y-1] background AV_green
        // @arrow from LCS[x][y] to LCS[x-1][y-1] color AV_green width 3
        // @text [
        //   {"text": "遇到字元 "},
        //   {"text": "相同", "background": "AV_green"},
        //   {"text": "，直接走左上方的橋並收下 ${S[x-1]}"}
        // ] at LCS.top offset(0,-24)

        dfs(x-1, y-1, now+S[x-1]);
    } else if (LCS[x-1][y]==LCS[x][y-1]){
        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y] background AV_green
        // @style LCS[x][y-1] background AV_blue
        // @arrow from LCS[x][y] to LCS[x-1][y] color AV_green width 3
        // @text "字元不同，而且上方與左方一樣大；DFS 分叉，先往上走" at LCS.top offset(0,-24)

        dfs(x-1, y, now);

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x][y-1] background AV_green
        // @style LCS[x-1][y] background AV_blue
        // @arrow from LCS[x][y] to LCS[x][y-1] color AV_green width 3
        // @text "回到剛才的分叉，這次往左走" at LCS.top offset(0,-24)

        dfs(x, y-1, now);
    } else if (LCS[x-1][y]>LCS[x][y-1]) {
        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y] background AV_green
        // @arrow from LCS[x][y] to LCS[x-1][y] color AV_green width 3
        // @text "字元不同，挑較大的值；這裡往上走" at LCS.top offset(0,-24)

        dfs(x-1, y, now);
    } else {
        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x][y-1] background AV_green
        // @arrow from LCS[x][y] to LCS[x][y-1] color AV_green width 3
        // @text "字元不同，挑較大的值；這裡往左走" at LCS.top offset(0,-24)

        dfs(x, y-1, now);
    }
}

int main() {
    while (getline(cin,S) && getline(cin,T)){
        LCS.assign(S.size()+1,vector<int>(T.size()+1));

        for (int i = 1; i <= S.size(); i++) {
            for (int j = 1; j <= T.size(); j++) {
                if (S[i - 1] == T[j - 1]) {
                    LCS[i][j] = LCS[i - 1][j - 1] + 1;

                    // @frame use lcs_view
                    // @events animate off when i >= 3
                    // @style LCS[i][j] highlight
                    // @style LCS[i-1][j-1] background AV_green
                    // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_green width 3
                    // @text [
                    //   {"text": "S[${i-1}] = T[${j-1}] = "},
                    //   {"text": "${S[i-1]}", "background": "AV_green"},
                    //   {"text": "，LCS[${i}][${j}] = LCS[${i-1}][${j-1}] + 1 = ${LCS[i][j]}"}
                    // ] at LCS.top offset(0,-24)
                } else {
                    LCS[i][j] = max(LCS[i][j - 1], LCS[i - 1][j]);

                    // @frame use lcs_view
                    // @events animate off when i >= 3
                    // @style LCS[i][j] highlight
                    // @style LCS[i-1][j] background AV_blue
                    // @style LCS[i][j-1] background AV_orange
                    // @arrow from LCS[i-1][j] to LCS[i][j] color AV_blue width 3 when LCS[i-1][j] >= LCS[i][j-1]
                    // @arrow from LCS[i][j-1] to LCS[i][j] color AV_orange width 3 when LCS[i][j-1] >= LCS[i-1][j]
                    // @text [
                    //   {"text": "S[${i-1}] = ${S[i-1]}、T[${j-1}] = ${T[j-1]}，字元不同；"},
                    //   {"text": "LCS[${i}][${j}] = max(LCS[${i}][${j-1}], LCS[${i-1}][${j}]) = ${LCS[i][j]}"}
                    // ] at LCS.top offset(0,-24)
                }
            }
        }

        // @frame use lcs_view
        // @style LCS[rows][columns] highlight
        // @text "LCS 建表完成，長度是 ${LCS[rows][columns]}；接著從右下角回溯所有答案" at LCS.top offset(0,-24)

        for (int i=1;i<=S.size();i++,cout<<endl)for (int j=1;j<=T.size();j++)cout<<LCS[i][j]<<" ";cout<<endl;
        cout<<LCS[S.size()][T.size()]<<endl;

        dfs(S.size(), T.size(), "");
        for (auto&v:ans)cout<<v<<endl;

        // @frame use lcs_view
        // @style LCS[rows][columns] highlight
        // @style ans[0:ans.size()-1] background AV_green
        // @text "所有最長共同子序列皆已列在右側" at LCS.top offset(0,-24)
    }
    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventSettings": {
      "autoFixedEnabled": true,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
