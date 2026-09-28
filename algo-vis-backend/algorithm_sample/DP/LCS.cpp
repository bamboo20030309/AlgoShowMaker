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
// @object LCS render matrix with labels(value), row-labels("",S), column-labels("",T)
// @for rr in [1:rows]
// @for cc in [1:columns]
// @arrow from LCS[rr-1][cc-1] to LCS[rr][cc] color AV_blue
//   when S[rr-1] == T[cc-1] && LCS[rr][cc] == LCS[rr-1][cc-1] + 1
// @endfor
// @endfor
// @endpreset

// @preset lcs_answers
// @object ans with labels(value)
// @place ans.left at LCS.right offset(80,0)
// @endpreset

// @preset lcs_build_cursor
// @object LCS[i][j] render matrix with labels(value), row-labels("",S), column-labels("",T)
// @style LCS.row-label[i] background AV_green! when S[i-1] == T[j-1]
// @style LCS.column-label[j] background AV_green! when S[i-1] == T[j-1]
// @style LCS.row-label[i] background AV_red! when S[i-1] != T[j-1]
// @style LCS.column-label[j] background AV_red! when S[i-1] != T[j-1]
// @endpreset

// @preset lcs_dfs_cursor
// @object LCS[x][y] render matrix with labels(value), row-labels("",S), column-labels("",T)
// @style LCS.row-label[x] background AV_green! when x > 0 && y > 0 && S[x-1] == T[y-1]
// @style LCS.column-label[y] background AV_green! when x > 0 && y > 0 && S[x-1] == T[y-1]
// @style LCS.row-label[x] background AV_red! when x > 0 && y > 0 && S[x-1] != T[y-1]
// @style LCS.column-label[y] background AV_red! when x > 0 && y > 0 && S[x-1] != T[y-1]
// @endpreset

void dfs(int x,int y,string now) {
    if (now.size()==LCS[S.size()][T.size()]){
        ans.insert(now);

        // @frame use lcs_view, lcs_answers, lcs_dfs_cursor
        // @style LCS[x][y] highlight
        // @style ans[0:ans.size()-1] background AV_green
        // @text [
        //   {"text": "回溯完成，目前累積字串就是 LCS：「"},
        //   {"text": "${now}", "background": "AV_green"},
        //   {"text": "」"}
        // ] at LCS.top offset(0,-24)
        return;
    }
    if (x==0||y==0)return;
    if (S[x-1]==T[y-1]){
        // @frame use lcs_view, lcs_answers, lcs_dfs_cursor
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y-1] background AV_green
        // @arrow from LCS[x][y] to LCS[x-1][y-1] color AV_green! width 3 until return
        // @text [
        //   {"text": "字元相同，往左上走並收下 ${S[x-1]}；目前累積字串：「"},
        //   {"text": "${S[x-1]}", "background": "AV_green"},
        //   {"text": "${now}", "background": "AV_green"},
        //   {"text": "」"}
        // ] at LCS.top offset(0,-24)

        dfs(x-1, y-1, S[x-1]+now);
    } else if (LCS[x-1][y]==LCS[x][y-1]){
        // @frame use lcs_view, lcs_answers, lcs_dfs_cursor
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y] background AV_green
        // @style LCS[x][y-1] background AV_blue
        // @arrow from LCS[x][y] to LCS[x-1][y] color AV_green! width 3 until return
        // @text [
        //   {"text": "字元不同，而且上方與左方一樣大；DFS 分叉，先往上走。目前累積字串：「"},
        //   {"text": "${now}", "background": "AV_blue"},
        //   {"text": "」"}
        // ] at LCS.top offset(0,-24)

        dfs(x-1, y, now);

        // @frame use lcs_view, lcs_answers, lcs_dfs_cursor
        // @style LCS[x][y] highlight
        // @style LCS[x][y-1] background AV_green
        // @style LCS[x-1][y] background AV_blue
        // @arrow from LCS[x][y] to LCS[x][y-1] color AV_green! width 3 until return
        // @text [
        //   {"text": "回到剛才的分叉，這次往左走。目前累積字串：「"},
        //   {"text": "${now}", "background": "AV_blue"},
        //   {"text": "」"}
        // ] at LCS.top offset(0,-24)

        dfs(x, y-1, now);
    } else if (LCS[x-1][y]>LCS[x][y-1]) {
        // @frame use lcs_view, lcs_answers, lcs_dfs_cursor
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y] background AV_green
        // @arrow from LCS[x][y] to LCS[x-1][y] color AV_green! width 3 until return
        // @text [
        //   {"text": "字元不同，挑較大的值；這裡往上走。目前累積字串：「"},
        //   {"text": "${now}", "background": "AV_blue"},
        //   {"text": "」"}
        // ] at LCS.top offset(0,-24)

        dfs(x-1, y, now);
    } else {
        // @frame use lcs_view, lcs_answers, lcs_dfs_cursor
        // @style LCS[x][y] highlight
        // @style LCS[x][y-1] background AV_green
        // @arrow from LCS[x][y] to LCS[x][y-1] color AV_green! width 3 until return
        // @text [
        //   {"text": "字元不同，挑較大的值；這裡往左走。目前累積字串：「"},
        //   {"text": "${now}", "background": "AV_blue"},
        //   {"text": "」"}
        // ] at LCS.top offset(0,-24)

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

                    // @frame use lcs_view, lcs_build_cursor
                    // @events animate off when i >= 3
                    // @style LCS[i][j] highlight
                    // @style LCS[i-1][j-1] background AV_green
                    // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_green width 3
                    // @text "字元相同，從左上取值加一" at LCS.top offset(0,-24)
                } else {
                    LCS[i][j] = max(LCS[i][j - 1], LCS[i - 1][j]);

                    // @frame use lcs_view, lcs_build_cursor
                    // @events animate off when i >= 3
                    // @style LCS[i][j] highlight
                    // @style LCS[i-1][j] background AV_blue
                    // @style LCS[i][j-1] background AV_orange
                    // @arrow from LCS[i-1][j] to LCS[i][j] color AV_blue width 3 when LCS[i-1][j] >= LCS[i][j-1]
                    // @arrow from LCS[i][j-1] to LCS[i][j] color AV_orange width 3 when LCS[i][j-1] >= LCS[i-1][j]
                    // @text "字元不相同，從左或上拿最大的過來" at LCS.top offset(0,-24)
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

        // @frame use lcs_view, lcs_answers
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
