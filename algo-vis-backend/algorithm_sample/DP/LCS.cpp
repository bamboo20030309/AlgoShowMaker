// Longest Common Subsequence Sample
#include <bits/stdc++.h>
using namespace std;

string S, T;
int n, m;
vector<vector<int>> dp;
vector<vector<int>> bridge;
vector<vector<int>> pathDirection;
set<string> answerSet;
vector<string> answers;
vector<char> rowLabels, columnLabels;

// @defaults
// @camera auto zoom(1.2) offset(0,-20)
// @enddefaults

// dp 的第 0 列與第 0 欄是空字串；在 row／column labels 前補一格空白即可對齊。
// @preset lcs_view
// @object dp render matrix with labels(value), row-labels("",rowLabels), column-labels("",columnLabels), marker-layout(none)
// @object answers with labels(value)
// @place answers.left at dp.right offset(80,0)
// @endpreset

void collectLCS(int r, int c, string reversed) {
    if ((int)reversed.size() == dp[n][m]) {
        string result = reversed;
        reverse(result.begin(), result.end());
        if (answerSet.insert(result).second) {
            answers.push_back(result);
        }

        // @frame use lcs_view
        // @style dp[r][c] highlight
        // @style answers[answers.size()-1] background AV_green
        // @for rr in [1:n]
        // @for cc in [1:m]
        // @arrow from dp[rr-1][cc-1] to dp[rr][cc] color AV_blue when bridge[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc] color AV_green width 3 when pathDirection[rr][cc] == 2
        // @arrow from dp[rr][cc] to dp[rr][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 3
        // @endfor
        // @endfor
        // @text [
        //   {"text": "回溯完成，找到 LCS："},
        //   {"text": "${result}", "background": "AV_green"}
        // ] at dp.top offset(0,-24)
        return;
    }
    if (r == 0 || c == 0) return;

    if (S[r - 1] == T[c - 1]) {
        pathDirection[r][c] = 1;

        // @frame use lcs_view
        // @style dp[r][c] highlight
        // @style dp[r-1][c-1] background AV_green
        // @for rr in [1:n]
        // @for cc in [1:m]
        // @arrow from dp[rr-1][cc-1] to dp[rr][cc] color AV_blue when bridge[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc] color AV_green width 3 when pathDirection[rr][cc] == 2
        // @arrow from dp[rr][cc] to dp[rr][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 3
        // @endfor
        // @endfor
        // @text [
        //   {"text": "S[${r-1}] 與 T[${c-1}] 都是 "},
        //   {"text": "${rowLabels[r-1]}", "background": "AV_green"},
        //   {"text": "，沿橋走向左上並收下這個字元"}
        // ] at dp.top offset(0,-24)

        collectLCS(r - 1, c - 1, reversed + S[r - 1]);
        pathDirection[r][c] = 0;
        return;
    }

    if (dp[r - 1][c] >= dp[r][c - 1]) {
        pathDirection[r][c] = 2;

        // @frame use lcs_view
        // @style dp[r][c] highlight
        // @style dp[r-1][c] background AV_green
        // @style dp[r][c-1] background AV_blue when dp[r-1][c] == dp[r][c-1]
        // @for rr in [1:n]
        // @for cc in [1:m]
        // @arrow from dp[rr-1][cc-1] to dp[rr][cc] color AV_blue when bridge[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc] color AV_green width 3 when pathDirection[rr][cc] == 2
        // @arrow from dp[rr][cc] to dp[rr][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 3
        // @endfor
        // @endfor
        // @text "字元不同，先沿較大的值往上回溯" at dp.top offset(0,-24)

        collectLCS(r - 1, c, reversed);
        pathDirection[r][c] = 0;
    }

    if (dp[r][c - 1] >= dp[r - 1][c]) {
        pathDirection[r][c] = 3;

        // @frame use lcs_view
        // @style dp[r][c] highlight
        // @style dp[r][c-1] background AV_green
        // @style dp[r-1][c] background AV_blue when dp[r-1][c] == dp[r][c-1]
        // @for rr in [1:n]
        // @for cc in [1:m]
        // @arrow from dp[rr-1][cc-1] to dp[rr][cc] color AV_blue when bridge[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 1
        // @arrow from dp[rr][cc] to dp[rr-1][cc] color AV_green width 3 when pathDirection[rr][cc] == 2
        // @arrow from dp[rr][cc] to dp[rr][cc-1] color AV_green width 3 when pathDirection[rr][cc] == 3
        // @endfor
        // @endfor
        // @text "字元不同，沿較大的值往左回溯" at dp.top offset(0,-24)

        collectLCS(r, c - 1, reversed);
        pathDirection[r][c] = 0;
    }
}

int main() {
    while (getline(cin, S) && getline(cin, T)) {
        n = (int)S.size();
        m = (int)T.size();
        dp.assign(n + 1, vector<int>(m + 1, 0));
        bridge.assign(n + 1, vector<int>(m + 1, 0));
        pathDirection.assign(n + 1, vector<int>(m + 1, 0));
        answerSet.clear();
        answers.clear();
        rowLabels.assign(S.begin(), S.end());
        columnLabels.assign(T.begin(), T.end());

        for (int r = 1; r <= n; r++) {
            for (int c = 1; c <= m; c++) {
                if (S[r - 1] == T[c - 1]) {
                    dp[r][c] = dp[r - 1][c - 1] + 1;
                    bridge[r][c] = 1;

                    // @frame use lcs_view
                    // @events animate off when r >= 3
                    // @style dp[r][c] highlight
                    // @style dp[r-1][c-1] background AV_green
                    // @arrow from dp[r-1][c-1] to dp[r][c] color AV_green width 3
                    // @text [
                    //   {"text": "S[${r-1}] = T[${c-1}] = "},
                    //   {"text": "${rowLabels[r-1]}", "background": "AV_green"},
                    //   {"text": "，dp[${r}][${c}] = dp[${r-1}][${c-1}] + 1 = ${dp[r][c]}"}
                    // ] at dp.top offset(0,-24)
                } else {
                    dp[r][c] = max(dp[r - 1][c], dp[r][c - 1]);

                    // @frame use lcs_view
                    // @events animate off when r >= 3
                    // @style dp[r][c] highlight
                    // @style dp[r-1][c] background AV_blue
                    // @style dp[r][c-1] background AV_orange
                    // @arrow from dp[r-1][c] to dp[r][c] color AV_blue width 3 when dp[r-1][c] >= dp[r][c-1]
                    // @arrow from dp[r][c-1] to dp[r][c] color AV_orange width 3 when dp[r][c-1] >= dp[r-1][c]
                    // @text [
                    //   {"text": "S[${r-1}] = ${rowLabels[r-1]}、T[${c-1}] = ${columnLabels[c-1]}，字元不同；"},
                    //   {"text": "dp[${r}][${c}] = max(dp[${r-1}][${c}], dp[${r}][${c-1}]) = ${dp[r][c]}"}
                    // ] at dp.top offset(0,-24)
                }
            }
        }

        // @frame use lcs_view
        // @for r in [1:n]
        // @for c in [1:m]
        // @arrow from dp[r-1][c-1] to dp[r][c] color AV_blue when bridge[r][c] == 1
        // @endfor
        // @endfor
        // @style dp[n][m] highlight
        // @text "DP 建表完成，LCS 長度是 ${dp[n][m]}；接著從右下角回溯所有答案" at dp.top offset(0,-24)

        collectLCS(n, m, "");

        cout << dp[n][m] << '\n';
        for (const string &answer : answers) {
            cout << answer << '\n';
        }

        // @frame use lcs_view
        // @for r in [1:n]
        // @for c in [1:m]
        // @arrow from dp[r-1][c-1] to dp[r][c] color AV_blue when bridge[r][c] == 1
        // @endfor
        // @endfor
        // @style dp[n][m] highlight
        // @style answers[0:answers.size()-1] background AV_green
        // @text "所有最長共同子序列皆已列在右側" at dp.top offset(0,-24)
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
