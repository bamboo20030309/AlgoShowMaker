// LCS Sample
#include <bits/stdc++.h>
using namespace std;

string S, T;
vector<vector<int>> LCS;
set<string> ans;

// 僅供新版繪圖指令記錄橋、目前的回溯路徑與自訂標籤。
int n, m;
vector<vector<int>> bridge;
vector<vector<int>> pathDirection;
vector<string> answerList;
vector<char> rowLabels, columnLabels;

// @defaults
// @camera auto zoom(1.2) offset(0,-20)
// @enddefaults

// @preset lcs_view
// @object LCS render matrix with labels(value), row-labels("",rowLabels), column-labels("",columnLabels), marker-layout(none)
// @object answerList with labels(value)
// @place answerList.left at LCS.right offset(80,0)
// @endpreset

void dfs(int x, int y, string now) {
    if ((int)now.size() == LCS[S.size()][T.size()]) {
        string result = now;
        reverse(result.begin(), result.end());
        if (ans.insert(result).second) {
            answerList.push_back(result);
        }

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style answerList[answerList.size()-1] background AV_green
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j-1] color AV_green width 3 when pathDirection[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j] color AV_green width 3 when pathDirection[i][j] == 2
        // @arrow from LCS[i][j] to LCS[i][j-1] color AV_green width 3 when pathDirection[i][j] == 3
        // @endfor
        // @endfor
        // @text [
        //   {"text": "回溯完成，找到 LCS："},
        //   {"text": "${result}", "background": "AV_green"}
        // ] at LCS.top offset(0,-24)
        return;
    }
    if (x == 0 || y == 0) return;

    if (S[x - 1] == T[y - 1]) {
        pathDirection[x][y] = 1;

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y-1] background AV_green
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j-1] color AV_green width 3 when pathDirection[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j] color AV_green width 3 when pathDirection[i][j] == 2
        // @arrow from LCS[i][j] to LCS[i][j-1] color AV_green width 3 when pathDirection[i][j] == 3
        // @endfor
        // @endfor
        // @text [
        //   {"text": "遇到字元 "},
        //   {"text": "相同", "background": "AV_green"},
        //   {"text": "，直接走左上方的橋並收下 ${rowLabels[x-1]}"}
        // ] at LCS.top offset(0,-24)

        dfs(x - 1, y - 1, now + S[x - 1]);
        pathDirection[x][y] = 0;
    } else if (LCS[x - 1][y] == LCS[x][y - 1]) {
        pathDirection[x][y] = 2;

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y] background AV_green
        // @style LCS[x][y-1] background AV_blue
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j-1] color AV_green width 3 when pathDirection[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j] color AV_green width 3 when pathDirection[i][j] == 2
        // @arrow from LCS[i][j] to LCS[i][j-1] color AV_green width 3 when pathDirection[i][j] == 3
        // @endfor
        // @endfor
        // @text "字元不同，而且上方與左方一樣大；DFS 分叉，先往上走" at LCS.top offset(0,-24)

        dfs(x - 1, y, now);

        pathDirection[x][y] = 3;

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x][y-1] background AV_green
        // @style LCS[x-1][y] background AV_blue
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j-1] color AV_green width 3 when pathDirection[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j] color AV_green width 3 when pathDirection[i][j] == 2
        // @arrow from LCS[i][j] to LCS[i][j-1] color AV_green width 3 when pathDirection[i][j] == 3
        // @endfor
        // @endfor
        // @text "回到剛才的分叉，這次往左走" at LCS.top offset(0,-24)

        dfs(x, y - 1, now);
        pathDirection[x][y] = 0;
    } else if (LCS[x - 1][y] > LCS[x][y - 1]) {
        pathDirection[x][y] = 2;

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x-1][y] background AV_green
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j-1] color AV_green width 3 when pathDirection[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j] color AV_green width 3 when pathDirection[i][j] == 2
        // @arrow from LCS[i][j] to LCS[i][j-1] color AV_green width 3 when pathDirection[i][j] == 3
        // @endfor
        // @endfor
        // @text "字元不同，挑較大的值；這裡往上走" at LCS.top offset(0,-24)

        dfs(x - 1, y, now);
        pathDirection[x][y] = 0;
    } else {
        pathDirection[x][y] = 3;

        // @frame use lcs_view
        // @style LCS[x][y] highlight
        // @style LCS[x][y-1] background AV_green
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j-1] color AV_green width 3 when pathDirection[i][j] == 1
        // @arrow from LCS[i][j] to LCS[i-1][j] color AV_green width 3 when pathDirection[i][j] == 2
        // @arrow from LCS[i][j] to LCS[i][j-1] color AV_green width 3 when pathDirection[i][j] == 3
        // @endfor
        // @endfor
        // @text "字元不同，挑較大的值；這裡往左走" at LCS.top offset(0,-24)

        dfs(x, y - 1, now);
        pathDirection[x][y] = 0;
    }
}

int main() {
    while (getline(cin, S) && getline(cin, T)) {
        n = (int)S.size();
        m = (int)T.size();
        LCS.assign(S.size() + 1, vector<int>(T.size() + 1));
        bridge.assign(S.size() + 1, vector<int>(T.size() + 1));
        pathDirection.assign(S.size() + 1, vector<int>(T.size() + 1));
        ans.clear();
        answerList.clear();
        rowLabels.assign(S.begin(), S.end());
        columnLabels.assign(T.begin(), T.end());

        for (int i = 1; i <= (int)S.size(); i++) {
            for (int j = 1; j <= (int)T.size(); j++) {
                if (S[i - 1] == T[j - 1]) {
                    LCS[i][j] = LCS[i - 1][j - 1] + 1;
                    bridge[i][j] = 1;

                    // @frame use lcs_view
                    // @events animate off when i >= 3
                    // @style LCS[i][j] highlight
                    // @style LCS[i-1][j-1] background AV_green
                    // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_green width 3
                    // @text [
                    //   {"text": "S[${i-1}] = T[${j-1}] = "},
                    //   {"text": "${rowLabels[i-1]}", "background": "AV_green"},
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
                    //   {"text": "S[${i-1}] = ${rowLabels[i-1]}、T[${j-1}] = ${columnLabels[j-1]}，字元不同；"},
                    //   {"text": "LCS[${i}][${j}] = max(LCS[${i}][${j-1}], LCS[${i-1}][${j}]) = ${LCS[i][j]}"}
                    // ] at LCS.top offset(0,-24)
                }
            }
        }

        // @frame use lcs_view
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @endfor
        // @endfor
        // @style LCS[n][m] highlight
        // @text "LCS 建表完成，長度是 ${LCS[n][m]}；接著從右下角回溯所有答案" at LCS.top offset(0,-24)

        for (int i = 1; i <= (int)S.size(); i++, cout << '\n') {
            for (int j = 1; j <= (int)T.size(); j++) {
                cout << LCS[i][j] << ' ';
            }
        }
        cout << '\n' << LCS[S.size()][T.size()] << '\n';

        dfs(S.size(), T.size(), "");

        for (const string &value : ans) {
            cout << value << '\n';
        }

        // @frame use lcs_view
        // @for i in [1:n]
        // @for j in [1:m]
        // @arrow from LCS[i-1][j-1] to LCS[i][j] color AV_blue when bridge[i][j] == 1
        // @endfor
        // @endfor
        // @style LCS[n][m] highlight
        // @style answerList[0:answerList.size()-1] background AV_green
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
