#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

//draw{
AV av;
TreeLayout tree("tree", 1, Pos(500, 100), 80.0, 100.0);
map<pair<int, int>, string> node_vals;

void update_node(int d, int o, int a, int b, string x, string y) {
    string val = to_string(a) + "," + to_string(b) + "," + x + "," + y;
    node_vals[{d, o}] = val;
    tree.vals[{d, o}] = val;
}

void gcd_demo(int a, int b) {
    int start_a = a, start_b = b;
    vector<int> bar_a = AV::AtoB(1,a);
    vector<int> bar_b = AV::AtoB(1,b);

    // --- 第一部分：長條測量的原理說明 ---

    // 1. 初現與目標
    av.start_frame_draw();
    av.frame_draw("bar_a", Pos(500, 150), bar_a);
    av.frame_draw("bar_b", Pos(500, 230), bar_b);
    av.colored_text({
        {"歐幾里得算法 (輾轉相除法)\n", "", "", "24"},
        {"這可以用 "}, {"長條測量", "rgba(252, 255, 64, 0.46)"}, {" 的觀點來理解：\n"},
        {"假設有兩根長度 a 和 b，你想找一個長度 g 剛好能填滿這兩根。\n"},
        {"這個最長的單位 g，就是 {gcd(a, b):最大公因數}。"}
    }, Pos("bar_a", "top", 0, -140));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // 2. 核心原理：差值不變性 (視覺化減法過程)
    av.start_frame_draw();
    // 定義 bar_a 的樣式：前 b 格用灰色(表示減去)，剩下的格數用藍色(表示保留)
    vector<array_style> st_a_sub = {
        {{"background", "#cccccc"}, AV::AtoB(0, b - 1)},       // 被減掉的部分
        {{"background", "#a5d6a7"}, AV::AtoB(b, b + b - 1)},       // 剩下的部分 (a-b)
        {{"background", "#ef9a9a"}, AV::AtoB(b + b, a - 1)}     
    };
    // bar_b 保持原樣或是用顯眼的顏色作為參考基準
    vector<array_style> st_b_ref = {
        {{"background", "#a5d6a7"}, AV::AtoB(0, b - 1)}        // 作為尺規的 b
    };
    av.frame_draw("bar_a", Pos(500, 150), bar_a, st_a_sub);
    av.frame_draw("bar_b", Pos(500, 230), bar_b, st_b_ref);
    av.colored_text({
        {"利用減法來縮減問題的規模\n","","","20"},
        {"我們可以用 "},
        {"減法", "rgba(252, 255, 64, 0.46)"},
        {" 來不斷縮小問題的規模\n"},
        {"因為 {a:大的} 扣掉 {b:小的} 並不影響 gcd 的結果\n"},
        {"所以遞迴式可以寫成 {gcd(a, b) = gcd(b, a-b):這樣}\n"},
        {"直到 a 減不動後 就可以換人繼續減"}
    }, Pos("bar_a", "top", 0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // 3. 連續減法轉取餘
    av.start_frame_draw();
    int q_init = a / b;
    vector<array_style> st_mod;
    for(int i=0; i < q_init; i++) {
        vector<int> idx;
        for(int j=0; j<b; j++) idx.push_back(i*b + j);
        st_mod.push_back({{"background", (i%2==0?"#c8e6c9":"#a5d6a7")}, idx});
    }
    st_mod.push_back({{"background", "#ef9a9a"}, AV::AtoB(q_init * b, a - 1)}); // 標示餘數

    av.frame_draw("bar_a", Pos(500, 150), bar_a, st_mod);
    av.frame_draw("bar_b", Pos(500, 230), bar_b, {{{"background", "#c8e6c9"}, AV::AtoB(0, b - 1)}});
    av.colored_text({
        {"從連續減法到取餘數\n", "", "", "20"},
        {"與其一次次減去 b，不如直接算 a 能裝下幾個 b。\n"},
        {"扣掉所有 b 之後剩下的紅色部分，就是 "},
        {"取餘數", "rgba(252, 255, 64, 0.46)"},
        {" (a%b)。\n"},
        {"然後遞迴式簡化成 {gcd(a, b) = gcd(b, a%b):這樣}\n"},
        {"這樣就可以一次跳過中間所有的減法步驟。"}
    }, Pos("bar_a", "top", 0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // --- 第二部分：實例遞迴演示 ---
    
    int step = 0;
    av.start_frame_draw();
    av.frame_draw("a", Pos(500, 150), bar_a);
    av.frame_draw("b", Pos(500, 230), bar_b);
    av.accu_store("gcd_" + to_string(step++), Pos("b","left bottom", 0, 20+step*60), vector<int>{a,b});
    av.accu_draw();
    av.auto_camera(0.85);
    av.end_frame_draw();
    bar_a = AV::AtoB(1,a%b);

    while(a%=b){
                
        av.start_frame_draw();
        av.frame_draw("a", Pos(500, 150), bar_a);
        av.frame_draw("b", Pos(500, 230), bar_b);
        av.accu_draw();
        av.frame_draw("gcd_" + to_string(step), Pos("b","left bottom", 0, 20+step*100), vector<int>{a,b});
        av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
        av.arrow(Pos("gcd_"+to_string(step-1), 0,"center",0,0),Pos("gcd_"+to_string(step), 0,"center",0,0));
        av.text("取餘數", Pos("gcd_"+to_string(step),"bottom", 0 , 20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        bar_a = bar_b;
        bar_b = AV::AtoB(1,a%b);
        swap(a,b);
        
        av.start_frame_draw();
        av.frame_draw("a", Pos(500, 150), bar_a);
        av.frame_draw("b", Pos(500, 230), bar_b);
        av.accu_store("gcd_" + to_string(step), Pos("b","left bottom", 0, 20+step*100), vector<int>{a,b});
        av.accu_draw();
        av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
        av.accu_store_arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
        av.text("左右交換往下傳", Pos("gcd_"+to_string(step),"bottom", 0 , 20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        bar_a = AV::AtoB(1,a%b);

        step++;
    }

    av.start_frame_draw();
    av.frame_draw("a", Pos(500, 150), bar_a);
    av.frame_draw("b", Pos(500, 230), bar_b);
    av.accu_draw();
    av.frame_draw("gcd_" + to_string(step), Pos("b","left bottom", 0, 20+step*100), vector<int>{a,b});
    av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.arrow(Pos("gcd_"+to_string(step-1), 0,"center",0,0),Pos("gcd_"+to_string(step), 0,"center",0,0));
    av.text("取餘數", Pos("gcd_"+to_string(step),"bottom", 0 , 20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    bar_a = bar_b;
    bar_b = AV::AtoB(1,a%b);
    swap(a,b);

    av.start_frame_draw();
    av.frame_draw("a", Pos(500, 150), bar_a);
    av.frame_draw("b", Pos(500, 230), bar_b);
    av.accu_draw();
    av.frame_draw("gcd_" + to_string(step), Pos("b","left bottom", 0, 20+step*100), vector<int>{a,b}, {{{"highlight"},{0}}});
    av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.text("遇到 0 ，找到最大公因數 a = " + to_string(a), Pos("gcd_"+to_string(step),"bottom", 0 , 20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.accu_clear();

}
//}

void ext_euc(int a,int b,int &x,int &y){//x,y不用放東西(code by reference)
    //draw{ 下降階段
    int d = tree.curr_d, o = tree.curr_o;
    tree.nodes.insert({d, o});
    update_node(d, o, a, b, "?", "?");
    tree.paint(av, "", -1, [&]{ 
        if (d > 0) {
            string pid = tree.get_id(d - 1, o / tree.degree);
            string cid = tree.get_id(d, o);
            av.arrow(Pos(pid, 1, "bottom"), Pos(cid, 0, "top"), {{"color", "#4caf50"}, {"width", "3"}});
        }
        av.text("尋找 " + to_string(a) + "{x: x} + " + to_string(b) + "{y: y} = g 的解\n將問題往下拆", tree.anchor(d, o, "bottom", 0, 20));
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
        string cid = tree.get_id(d + 1, o * tree.degree + 0);
        string pid = tree.get_id(d, o);
        av.arrow(Pos(cid, 3, "top"), Pos(pid, 2, "bottom"), {{"color", "#4caf50"}, {"width", "3"}});

        string msg = "回溯：下一層 f(" + to_string(b) + ", " + to_string(a%b) + ") 已計算完畢\n";
        msg += "這層的 x 就是下一層的 v";
        av.text(msg, tree.anchor(d, o, "top", 0, -80));
        av.auto_camera(0.85); 
    });
    //}
    
    y-=a/b*x; 
    
    //draw{ 2. 回溯第二步：公式計算
    update_node(d, o, a, b, to_string(x), to_string(y));
    tree.paint(av, "", -1, [&]{ 

        string msg = "代入公式計算這層的 y\n";
        msg += "{y = u - (a/b) * v\n";
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
        string val = tree.vals[{d, o}];
        if (val.empty()) return;
        
        vector<string> items;
        stringstream ss(val);
        string item;
        while (getline(ss, item, ',')) items.push_back(item);

        vector<array_style> st;
        for (int i = 0; i < (int)items.size(); ++i) {
            if (items[i] != "?") st.push_back({{"background", "#e8f5e9"}, {i}});
            else st.push_back({{"background", "#fff3e0"}, {i}});
        }
        if (focus) { 
            for (int i = 0; i < (int)items.size(); ++i) st.push_back({{"highlight"}, {i}});
            st.push_back({{"point"}, {0}}); 
        }
        av.frame_draw(id, p, items, st);
    };
    av.start_draw();
    gcd_demo(16, 6);
    //}
    
    if (!(cin>>a>>b)) { a=17; b=6; }
    
    //draw{
    // Step 1: 貝祖定理與目標
    av.stop();
    av.start_frame_draw();
    av.colored_text({
        {"擴展歐幾里得算法\n", "", "", "20"},
        {"擴展歐幾里得到底擴展在哪?\n他在計算 a,b 的過程中 還要去找到一對 {x,y:x y} 使得 {ax+by=gcd(a,b):a x + b y 能夠 = gcd a b}\n"},
        {"而這個 {x,y:x y} 可以做{甚:捨}麼呢?\n先說結論，它可以幫助你找到 "},
        {"模逆元", "rgba(252, 255, 64, 0.46)"},
        {" 來計算 "},
        {"模除法", "rgba(252, 255, 64, 0.46)"},
        {" ，\n比如說可以用來計算大數的組合數"}
    }, Pos(500, 10));
    av.camera(Pos(520, 100), 1.7);
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
        {"歐幾里得算法告訴我們 {gcd(a,b):a和b,的最大公因數,} = {gcd(b, a%b):,b和,a於b, 的最大公因數}\n因此我們可以假設去找 {b* u:b成u} + {(a%b)* v:,a於b,成v} {= gcd(b, a%b)} 也是等價的！"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Step 3: 建立橋樑 (代換連結)
    av.start_frame_draw();
    av.colored_text({
        {"現在問題來了，我們知道 {ax + by = g:a x + b y = g,} 能夠被轉換成 {b* u + (a%b)* v = g:,b成u + ,a於b成v} \n"},
        {"但是你這 {x,y:x y} 和 {u,v:u v} 很明顯不一樣啊，那要怎樣才能夠拿回最原本的 {x,y:x y} 呢？\n\n\n"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{現在問題來了，我們知道 ax + by = g 能夠被轉換成 b* u + (a%b)* v = g} \n"},
        {"{但是你這 x,y 和 u,v 很明顯不一樣啊，那要怎樣才能夠拿回最原本的 x,y 呢？}\n\n"},
        {"如果我們能把 {b* u + (a%b)* v = g:原本的式子} 調整成 {a* (?) + b* (?):a成問號+b成問號} = g 的形式\n"},
        {"那不就能夠直接把原來的 {x,y:x y} 給求出來了嗎？"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Step 4: 重新分組整理
        av.start_frame_draw();
    av.colored_text({
        {"目標：將 {b*u + (a%b)*v = g:原本的式子}, 調整成 {a* (?) + b* (?) = g:a成問號+b成問號=g} 的形式                  \n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n"},
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"首先最關鍵的一步，將 {(a % b) = }"},
        {"{a - (a/b)*b:a於b 變成 a減a除b成b：：}","rgba(252, 255, 64, 0.46)"},
        {" ，這樣就可以繞過 {a%b:a於b} 的計{算:算：：：：：}\n\n\n\n\n\n\n\n\n\n\n\n\n\n"},
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"{首先最關鍵的一步，將 (a % b) = }"},
        {"{a - (a/b)*b}","rgba(252, 255, 64, 0.46)"},
        {"{ ，這樣就可以繞過 a%b 的計算}\n\n"},
        {"然後將它代入底下的式子{：:：：：：}\n"},
        {"{"},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + ["},
        {"a - (a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"] * "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}"},
        {"\n\n\n\n\n\n\n\n\n\n\n"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    
    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"{首先最關鍵的一步，將 (a % b) = }"},
        {"{a - (a/b)*b}","rgba(252, 255, 64, 0.46)"},
        {"{ ，這樣就可以繞過 a%b 的計算}\n\n"},
        {"{然後將它代入底下的式子：}\n"},
        {"{"},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + ["},
        {"a - (a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"] * "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"接{著:ㄓㄜ˙}把 "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" 乘進去{：:：：：：}\n"},
        {"{b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + "},
        {"a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"\n\n\n\n\n\n"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"{首先最關鍵的一步，將 (a % b) = }"},
        {"{a - (a/b)*b}","rgba(252, 255, 64, 0.46)"},
        {"{ ，這樣就可以繞過 a%b 的計算}\n\n"},
        {"{然後將它代入底下的式子：}\n"},
        {"{"},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + ["},
        {"a - (a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"] * "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"{接著把 "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" 乘進去：}\n"},
        {"{b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + "},
        {"a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"再把它左右交換位置{：:：：：：}\n"},
        {"{a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" + "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"\n\n\n"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"{首先最關鍵的一步，將 (a % b) = }"},
        {"{a - (a/b)*b}","rgba(252, 255, 64, 0.46)"},
        {"{ ，這樣就可以繞過 a%b 的計算}\n\n"},
        {"{然後將它代入底下的式子：}\n"},
        {"{"},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + ["},
        {"a - (a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"] * "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"{接著把 "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" 乘進去：}\n"},
        {"{b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + "},
        {"a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"{再把它左右交換位置}\n"},
        {"{a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" + "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"最後把 "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {" 提出{來：:來就變成我們要的形式：：：：}\n"},
        {"{a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" + "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"("},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" - "},
        {"(a/b)","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {") = g}\n\n"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"{首先最關鍵的一步，將 (a % b) = }"},
        {"{a - (a/b)*b}","rgba(252, 255, 64, 0.46)"},
        {"{ ，這樣就可以繞過 a%b 的計算}\n\n"},
        {"{然後將它代入底下的式子：}\n"},
        {"{"},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + ["},
        {"a - (a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"] * "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"{接著把 "},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" 乘進去：}\n"},
        {"{b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" + "},
        {"a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"{再把它左右交換位置}\n"},
        {"{a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" + "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" - "},
        {"(a/b)*b","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" = g}\n\n"},
        {"最後把 "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {" 提出{來：:來就變成我們要的形式：：：：}\n"},
        {"{a","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {" + "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {"*"},
        {"("},
        {"u","rgba(244, 67, 54, 0.4)"},
        {" - "},
        {"(a/b)","rgba(252, 255, 64, 0.46)"},
        {"*"},
        {"v","rgba(76, 175, 80, 0.4)"},
        {") = g\n\n}"},
        {"兩個問號分別就是 v 和 u - (a/b)*v"}
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
        {"v", "rgba(76, 175, 80, 0.4)", ""},
        {"  + b*( ", "", ""},
        {"u - (a/b)*v", "rgba(244, 67, 54, 0.4)", ""},
        {" ) = gcd(b, a%b)}\n", "", ""},

        {"這麼一來與原式對照，你會發現其實 x 就是 {v:v} 而 y 就是 {u - (a/b)*v:u減a除b成v}\n這樣子 {x,y:x y} 和 {u,v:u v} 的遞迴關係就能夠串聯起來了\n接下來是程式流程，請觀察數值是如何交換與跳轉的。", "", ""}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.end_frame_draw();
    //}
    
    ext_euc(a,b,x,y);
    
    //draw{
    av.start_frame_draw();
    
    // 結尾展示算完的 (a, b, x, y) 四格陣列
    vector<string> final_items = {to_string(a), to_string(b), to_string(x), to_string(y)};
    vector<array_style> final_st = {
        {{"background", "#e8f5e9"}, {0, 1, 2, 3}}, // 全部綠色表示確定
        {{"color", "#2e7d32"}, {0, 1, 2, 3}}       // 文字顏色
    };
    av.frame_draw("ext_euc", Pos(500, 100), final_items, final_st);

    av.text("我們得到了其中一組解 x=" + to_string(x) + ", y=" + to_string(y) + "\n能夠滿足 " + to_string(a) + "{x: x} + " + to_string(b) + "{y: y} = gcd(" + to_string(a) + ", " + to_string(b) + ")", Pos(590, 20));
    
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.end_draw();
    //}
    
    cout<<x<<" "<<y<<endl;
    return 0;
}