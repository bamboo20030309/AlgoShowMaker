/*
 * 範例：埃拉托斯特尼篩法
 *
 * 用途與核心步驟：從最小未標記數開始，將其倍數標為合數，最後保留所有質數。
 * 輸入、輸出與複雜度：輸入上界 n；輸出不大於 n 的質數。時間 O(n log log n)、空間 O(n)。
 *
 * 視覺化約定：`@frame`、`@layout`、`@style` 等註解由 AlgoShowMaker
 * 分析器讀取；它們描述畫面切點與呈現方式，不參與 C++ 演算法運算。
 */

//Sieve_of_Eratosthenes Sample
#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;

// ─────────────────────────────────────────────────────────────────────────────
// 範例入口：準備輸入與初始畫面，執行核心算法，最後輸出結果／收尾畫面。
// ─────────────────────────────────────────────────────────────────────────────

int main() {
    int n; cin>>n;
    vector<int> isprime(n+5,1);
    vector<int> prime;
    isprime[0] = isprime[1] = 0;
    //draw{
    av.start_draw();
    av.start_frame_draw();
    av.frame_draw("prime" , Pos(0,0),   isprime, {}, {1,n}, "normal", 10, 2);
    av.text("這是埃篩{的演算法範例}", Pos("prime", "top", 0, -20));
    av.camera(Pos("prime", "center", 0, -30), 1.2);
    av.end_frame_draw();
    vector<int> _draw_focus;
    for(int i=1;i<=n;i++)_draw_focus.push_back(i);
    _draw_focus.erase(find(_draw_focus.begin(), _draw_focus.end(), 1));
    av.start_frame_draw();
    av.frame_draw("prime" , Pos(0,0),   isprime, {{{"highlight"},{1}}, {{"focus"}, _draw_focus} }, {1,n}, "normal", 10, 2);
    av.text("先把1刪掉", Pos("prime", "top", 0, -20));
    av.camera(Pos("prime", "center", 0, -30), 1.2);
    av.end_frame_draw();
    //}
    
    for(int i=2;i*i<=n;i++) {
        //draw{
        int _k=0;
        av.start_frame_draw();
        av.frame_draw("prime" , Pos(0,0),   isprime, {{{"highlight"},{i}}, {{"focus"},_draw_focus}, {{"point"},{i}} }, {1,n}, "normal", 10, 2);
        if(isprime[i])av.colored_text({ {"因為 "}, {to_string(i)+"是質數", "rgba(47, 255, 82, 0.44)"}, {" 所以把"+to_string(i)+"的倍數全部塗黑"}}, Pos("prime", "top", 0, -20));
        else          av.colored_text({ {"因為 "}, {to_string(i)+"不是質數", "rgba(234, 64, 64, 0.44)"}, {" 所以可以直接跳過"}}, Pos("prime", "top", 0, -20));
        if(isprime[i]) {
            int k=i;
            vector<int> _draw_highlight = {k};
            vector<int> _draw_modify;
            
            while(k+i<=n){
                k+=i;
                _draw_highlight.push_back(k);
                _draw_modify.push_back(k);
            }
            av.key_frame_draw("prime" , Pos(0,0),   isprime, {{{"highlight"},_draw_highlight}, {{"focus"},_draw_focus}, {{"point"},{i}} }, {1,n}, "normal", 10, 2);
            av.key_colored_text({{"因為 "},{to_string(i)+"是質數", "rgba(47, 255, 82, 0.44)"},{" 把"+to_string(i)+"的倍數全部塗黑"}}, Pos("prime", "top", 0, -20));
        }
        av.camera(Pos("prime", "center", 0, -30), 1.2);
        av.end_frame_draw();
        //}
        if(isprime[i]) {
            prime.push_back(i);
            int k=i;
            
            while(k+i<=n){
                k+=i;
                isprime[k]=0;
                //draw{
                if(_k++>8)av.fast();
                auto p = find(_draw_focus.begin(), _draw_focus.end(), k);
                if(p!=_draw_focus.end()) _draw_focus.erase(p);
                av.start_frame_draw();
                av.frame_draw("prime" , Pos(0,0),   isprime, {{{"highlight"},{i,k}}, {{"focus"},_draw_focus}, {{"point"},{i}}, {{"background"},{k} }}, {1,n}, "normal", 10, 2);
                av.colored_text({ {"塗黑 "+to_string(k)}}, Pos("prime", "top", 0, -20));
                av.camera(Pos("prime", "center", 0, -30), 1.2);
                av.end_frame_draw();
                //}
            }
        }
    }
    
    //draw{
    av.start_frame_draw();
    av.frame_draw("prime" , Pos(0,0),   isprime, { {{"focus"},_draw_focus} }, {1,n}, "normal", 10, 2);
    av.text("{最後就完成了}", Pos("prime", "top", 0, -20));
    av.camera(Pos("prime", "center", 0, -30), 1.2);
    av.end_frame_draw();
    av.end_draw();
    //}
    return 0;
}