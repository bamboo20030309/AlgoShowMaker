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
        av.text("遞迴下降：尋找 " + to_string(a) + "x + " + to_string(b) + "y = g 的解\n此時 x, y 為未知引用，標記為問號 ?", Pos("tree_" + to_string(d) + "_" + to_string(o), "right", 20, 0));
        av.auto_camera(0.85); 
    });
    //}
    
    if(!b){
        x=1,y=0;
        //draw{ 基底階段
        update_node(d, o, a, b, to_string(x), to_string(y));
        tree.paint(av, "", -1, [&]{ 
            av.text("到達基底 b=0\n這層可以直接求出 x=1, y=0", Pos("tree_" + to_string(d) + "_" + to_string(o), "right", 20, 0));
            av.auto_camera(0.85); 
        });
        av.stop();
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
        msg += "因為呼叫時交換了參數順序，這層的 x 直接獲得了下一層的 y'=" + to_string(x);
        av.text(msg, Pos("tree_" + to_string(d) + "_" + to_string(o), "right", 20, 0));
        av.auto_camera(0.85); 
    });
    //}
    
    y-=a/b*x; 
    
    //draw{ 2. 回溯第二步：公式計算
    update_node(d, o, a, b, to_string(x), to_string(y));
    tree.paint(av, "", -1, [&]{ 
        string msg = "回溯：利用公式計算這層的 y\n";
        msg += "y = y_old - (a/b) * x = " + to_string(y + (a/b)*x) + " - (" + to_string(a) + "/" + to_string(b) + ") * " + to_string(x) + " = " + to_string(y);
        av.text(msg, Pos("tree_" + to_string(d) + "_" + to_string(o), "right", 20, 0));
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
    
    ext_euc(a,b,x,y);
    
    //draw{
    av.stop();
    av.end_draw();
    //}
    
    cout<<x<<" "<<y<<endl;
    return 0;
}