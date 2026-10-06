#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main() {
    string s;
    cin >> s;
    int n = s.size();
    vector<int> p(n, 0);
    vector<string> pat(n);
    for (int k = 0; k < n; ++k) pat[k] = string(1, s[k]);
    // @frame pat
    // @object p with labels(value,index)
    // @place pat.left-bottom at p.left-top offset(0,-90)
    // @style p[0] point
    // @text "上排是字串 pat，下排是 prefix function 陣列 p。p[0] = 0，因為單一字元沒有非空的相等真前後綴。" at p.bottom
    for (int i = 1; i < n; i++) {
        int j = p[i - 1];
        // @frame pat[i,j]
        // @object p with labels(value,index)
        // @place pat.left-bottom at p.left-top offset(0,-90)
        // @style p[i-1] point
        // @text "開始計算 p[${i}]。先令 j = p[${i-1}] = ${j}，表示先嘗試延續上一格找到的最長前後綴。" at p.bottom
        while (j > 0 && s[i] != s[j]) {
            // @frame pat[i,j]
            // @object p with labels(value,index)
            // @place pat.left-bottom at p.left-top offset(0,-90)
            // @style p[j-1] focus
            // @text "失配：s[${i}] = '${s[i]}'，s[${j}] = '${s[j]}'。長度 ${j} 不能直接延續，所以準備把 j 回退到 p[${j-1}]。" at p.bottom
            j = p[j - 1];
            // @frame pat[i,j]
            // @object p with labels(value,index)
            // @place pat.left-bottom at p.left-top offset(0,-90)
            // @text "回退後 j = ${j}。注意 i 不前進，仍然用同一個 s[${i}] 繼續比較。" at p.bottom
        }
        // @frame pat[i,j]
        // @object p with labels(value,index)
        // @place pat.left-bottom at p.left-top offset(0,-90)
        // @text "while 結束後，現在比較 s[${i}] 與 s[${j}]，檢查目前長度 j 是否可以再延長。" at p.bottom
        if (s[i] == s[j]) {
            // @frame pat[i,j]
            // @object p with labels(value,index)
            // @place pat.left-bottom at p.left-top offset(0,-90)
            // @text "匹配成功：s[${i}] 與 s[${j}] 相同，所以目前共同前後綴可以延長 1。" at p.bottom
            j++;
            // @frame pat[i,j]
            // @object p with labels(value,index)
            // @place pat.left-bottom at p.left-top offset(0,-90)
            // @text "延長後 j = ${j}。" at p.bottom
        } else {
            // @frame pat[i,j]
            // @object p with labels(value,index)
            // @place pat.left-bottom at p.left-top offset(0,-90)
            // @text "無法延長：此時 j = ${j}，而且已沒有更長的候選可回退，所以 p[${i}] 會寫入 ${j}。" at p.bottom
        }
        p[i] = j;
        // @frame pat[i]
        // @object p with labels(value,index)
        // @place pat.left-bottom at p.left-top offset(0,-90)
        // @style p[i] point
        // @text "寫入 p[${i}] = ${p[i]}。" at p.bottom
    }
    // @frame pat
    // @object p with labels(value,index)
    // @place pat.left-bottom at p.left-top offset(0,-90)
    // @style p[0:n-1] focus
    // @text "prefix function 建表完成。" at p.bottom
    for (int i = 0; i < n; i++) cout << p[i] << (i + 1 == n ? '\n' : ' ');
}
