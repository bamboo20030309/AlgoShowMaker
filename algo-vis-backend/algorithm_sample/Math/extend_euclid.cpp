#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

//draw{
AV av;
TreeLayout tree(1, Pos(500, 100), 80.0, 100.0);
map<pair<int, int>, string> node_vals;

void update_node(int d, int o, int a, int b, string x, string y) {
    string val = "f(" + to_string(a) + ", " + to_string(b) + ", " + x + ", " + y + ")";
    node_vals[{d, o}] = val;
    tree.vals[{d, o}] = val;
}
//}

void ext_euc(int a,int b,int &x,int &y){//x,y不用放東西(code by reference)
    //draw{ 下降階段
    int d = tree.curr_d, o = tree.curr_o;
    tree.nodes.insert({d, o});
    update_node(d, o, a, b, "?", "?");
    tree.paint(av, "", -1, [&]{ 
        av.text("尋找 " + to_string(a) + "{x: x} + " + to_string(b) + "{y: y} = g 的解\n將問題往下拆", tree.anchor(d, o, "top", 0, -80));
        av.auto_camera(0.85); 
    });
    //}
    
    if(!b){
        x=1,y=0;
        //draw{ 基底階段
        update_node(d, o, a, b, to_string(x), to_string(y));
        tree.paint(av, "", -1, [&]{ 
            av.text("到達基底\n把 x{=:設為}1, y{=:設為}0 回傳", tree.anchor(d, o, "top", 0, -80));
            av.auto_camera(0.85); 
        });
        //}
        return;
    } 
    
    //draw{
    tree.push(0);
    //}
    ext_euc(b,a%b,y,x);
    //draw{ 1. 回溯第一步：交換後的直接填入
    tree.pop();
    // 此時 y 承接了 child 傳回來的 x, x 承接了 child 傳回來的 y
    // 注意：在 main 的視野裡，這層的 x 拿到的是 child 的 y
    update_node(d, o, a, b, to_string(x), "?"); 
    tree.paint(av, "", -1, [&]{ 
        string msg = "回溯：下一層 f(" + to_string(b) + ", " + to_string(a%b) + ") 已計算完畢\n";
        msg += "這層的 x 就是下一層的 {y':y prime}";
        av.text(msg, tree.anchor(d, o, "top", 0, -80));
        av.auto_camera(0.85); 
    });
    //}
    
    y-=a/b*x; 
    
    //draw{ 2. 回溯第二步：公式計算
    update_node(d, o, a, b, to_string(x), to_string(y));
    tree.paint(av, "", -1, [&]{ 
        string msg = "代入公式計算這層的 y\n";
        msg += "{y = x' - (a/b) * y'\n";
        msg += "y = " + to_string(y + (a/b)*x) + " - (" + to_string(a/b) + ") * " + to_string(x) + "} = " + to_string(y);
        av.text(msg, tree.anchor(d, o, "top", 0, -80));
        av.auto_camera(0.85); 
    });
    //}
} //最後算出來x為模逆元

int main(){
    int a=17,b=6,x,y;
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool focus) {
        vector<array_style> st;
        string val = tree.vals[{d, o}];
        if (val.find("?") == string::npos) st.push_back({{"background", "#e8f5e9"}, {0}});
        else if (val.find("?, ?") == string::npos) st.push_back({{"background", "#fff3e0"}, {0}});
        if (focus) { st.push_back({{"highlight"}, {0}}); st.push_back({{"point"}, {0}}); }
        av.frame_draw(id, p, vector<string>{val}, st);
    };
    av.start_draw();
    //}
    
    if (!(cin>>a>>b)) { a=17; b=6; }
    
    //draw{
    // Step 1: 貝祖定理與目標
    av.start_frame_draw();
    av.colored_text({
        {"擴展歐幾里得算法\n", "", "", "20"},
        {"擴展歐幾里得到底有{甚:捨}麼用?\n先說結論，可以幫助你找到 "},
        {"模逆元", "rgba(252, 255, 64, 0.46)"},
        {" 來計算 "},
        {"模除法", "rgba(252, 255, 64, 0.46)"},
        {" ，\n比如說可以用來計算大數的組合數"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"擴展歐幾里得算法的原理\n", "", "", "20"},
        {"如果你手上有兩個整數 a, b，數學家告訴我們：\n一定可以找到一組整數 (x, y) 滿足 ax + by = {gcd(a, b):gcd a b}\n這組神秘的 x, y 稱為 貝祖數 ，我們今天的任務就是找出它們。\n\n"
         "{補充}：\n為什麼算式最後{得:ㄉㄟˇ}是 gcd 呢？\n因為 a 和 b 都是 gcd 的倍數。\n所以無論你怎麼線性組合 (ax + by)，其結果只會是 gcd 的倍數\n\n例如：\n你手邊只有 4 公升與 6 公升的水桶，\n不論你怎麼裝水、倒水，你能{量:ㄌㄧㄤˊ}出的水量一定是 2 公升 (gcd) 的倍數，\n絕對不可能量出 1 公升或 3 公升這種水量。"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    
    // Step 2: 問題轉換 (由大變小)
    av.start_frame_draw();
    av.colored_text({
        {"直接找 {a, b:a b} 的答案太難了，我們可以換個小一點的目標：\n"},
        {"歐幾里得算法告訴我們 {gcd(a,b):a和b,的最大公因數,} = {gcd(b, a%b):,b和,a於b, 的最大公因數}\n所以我們可以假設去找 {b* x':b成x prime} + {(a%b)* y':,a於b,成y prime} {= gcd(b, a%b)} 也是等價的！"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Step 3: 建立橋樑 (代換連結)
    av.start_frame_draw();
    av.colored_text({
        {"現在問題來了，我們知道 {ax + by = gcd(a, b):a x + b y = gcd a b,} 能夠被轉換成 {b* x' + (a%b)* y' = gcd(b, a%b):,b成x prime + ,a於b成y prime} \n"},
        {"但是你這 {x,y:x y} 和 {x',y':x y prime} 很明顯不一樣啊，那要怎樣才能夠拿回最原本的 {x,y:x y} 呢？\n\n"
         "我們可以將算式改寫一下\n透過除法定理，我們知道 {(a % b) = a - (a/b)*b:a於b = a減a除b成b}\n把這個代入樓下的式子： {b*x' + [a - (a/b)*b] * y' = gcd(b, a%b):b x prime + ,a減a除b成b,再成y prime}\n這樣就可以繞過 {a%b:a b} 的計算"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Step 4: 重新分組整理
    av.start_frame_draw();
    av.colored_text({
        {"{b*x' + [a - (a/b)*b]*y' = gcd(b, a%b)}\n\n"},
        {"接{著:ㄓㄜ˙}把上式括號拆掉：\n{b*x' + a*y' - (a/b)*b*y' = gcd(b, a%b):b x prime + a y prime 減 a除b成b再成y prime}\n\n左右交換位置後變為：\n{a*y' + b*(x' - (a/b)*y') = gcd(b, a%b):a成y prime + b成x prime減a除b成b再成y prime}"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Step 5: 驚喜的對照得出結果
    av.start_frame_draw();
    av.colored_text({
        {"{a* ", "", ""},
        {"x", "rgba(76, 175, 80, 0.4)", ""},
        {"   + b*         ", "", ""},
        {"y", "rgba(244, 67, 54, 0.4)", ""},
        {"            = gcd(a, b) => \na* ", "", ""},
        {"y'", "rgba(76, 175, 80, 0.4)", ""},
        {"  + b*( ", "", ""},
        {"x' - (a/b)*y'", "rgba(244, 67, 54, 0.4)", ""},
        {" ) = gcd(b, a%b)}\n", "", ""},

        {"這麼一來與原式對照，你會發現其實 x 就是 {y':y prime} 而 y 就是 {x' - (a/b)*y':x prime減a除b成y prime}\n這樣子 {x,y:x y} 和 {x',y':x y prime} 的遞迴關係就能夠串聯起來了\n接下來是程式流程，請觀察數值是如何交換與跳轉的。", "", ""}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    //}
    
    ext_euc(a,b,x,y);
    
    //draw{
    av.start_frame_draw();
    av.text("我們得到了其中一組解 x=" + to_string(x) + ", y=" + to_string(y) + "\n能夠滿足 " + to_string(a) + "{x: x} + " + to_string(b) + "{y: y} = gcd(" + to_string(a) + ", " + to_string(b) + ")", Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.end_draw();
    //}
    
    cout<<x<<" "<<y<<endl;
    return 0;
}