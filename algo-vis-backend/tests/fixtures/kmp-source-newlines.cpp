#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    string s;
    cin >> s;
    int n = s.size();
    vector<int> p(n, 0);
    // 教學顯示用：把字串拆成一格一格，方便視覺化
    vector<string> pat(n);
    for (int k = 0; k < n; ++k) pat[k] = string(1, s[k]);
    // @preset kmp_view
    // @object pat with labels(value,index)
    // @object p with labels(value,index)
    // @place pat.left-bottom at p.left-top offset(0,-90)
    // @endpreset
    // @frame use kmp_view
    // @text "字元陣列 pat 與 prefix function 陣列 p。p[i] 代表 s[0..i] 的最長相等真前後綴長度。" at p.bottom
    for (int i = 1; i < n; i++) {
        int j = p[i - 1];
        // @frame use kmp_view
        // @style pat[i] highlight AV_red
        // @style p[i - 1] highlight AV_green
        // @text "開始計算 p[${i}]：先把 j 設為 p[${i-1}] = ${j}。" at p.bottom
        while (j > 0 && s[i] != s[j]) {
            // @frame use kmp_view
            // @style pat[i] highlight AV_red
            // @style pat[j] highlight AV_orange
            // @style p[j - 1] highlight AV_blue
            // @text "失配：目前比較 s[${i}] 與 s[${j}]，兩者不同，所以依 KMP 規則把 j 回退到 p[${j-1}]。" at p.bottom
            j = p[j - 1];
            // @frame use kmp_view
            // @style pat[i] highlight AV_red
            // @style p[0:i - 1] focus AV_blue
            // @text "回退後 j = ${j}。注意 i 不前進，仍然用同一個 s[${i}] 繼續比較。" at p.bottom
        }
        // @frame use kmp_view
        // @style pat[i] highlight AV_red
        // @style pat[j] highlight AV_orange
        // @text "while 結束後，現在檢查 s[${i}] 是否能接在目前長度 j 的後面。" at p.bottom
        if (s[i] == s[j]) {
            // @frame use kmp_view
            // @style pat[i] highlight AV_red
            // @style pat[j] highlight AV_green
            // @text "匹配成功：s[${i}] 與 s[${j}] 相同，因此目前的共同前後綴可以再延長 1。" at p.bottom
            j++;
            // @frame use kmp_view
            // @style pat[i] highlight AV_red
            // @text "延長後 j = ${j}。" at p.bottom
        } else {
            // @frame use kmp_view
            // @style pat[i] highlight AV_red
            // @style pat[j] highlight AV_orange
            // @text "無法延長：此時 j = ${j}，且 s[${i}] 與 s[${j}] 不同，所以 p[${i}] 會維持 ${j}。" at p.bottom
        }
        p[i] = j;
        // @frame use kmp_view
        // @style pat[i] highlight AV_red
        // @style p[i] highlight AV_green
        // @text "寫入 p[${i}] = ${p[i]}。" at p.bottom
    }
    // @frame use kmp_view
    // @style p[0:n - 1] focus AV_green
    // @text "prefix function 建表完成。" at p.bottom
    for (int i = 0; i < n; i++)
        cout << p[i] << (i + 1 == n ? '\n' : ' ');
}
