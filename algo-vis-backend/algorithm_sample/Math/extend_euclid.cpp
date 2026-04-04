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
    // Step 1: 原理說明
    vector<vector<int>> rect(start_b, vector<int>(start_a, 0));
    int g = __gcd(start_a, start_b);
    vector<pair<int, int>> checked_cells;
    for(int i=0;i<start_b;i++){
        for(int j=0;j<start_a;j++){
            if(((i/g)+(j/g))%2==0) {
                rect[i][j] = 1;
                checked_cells.push_back({i, j});
            }
        }
    }

    av.start_frame_draw();
    vector<array2D_style> chess_st = {
        {{"background", "#c8e6c9"}, checked_cells}
    };
    av.frame_draw("rect", Pos(500, 150), rect, chess_st, {{0,0},{start_b-1,start_a-1}}, "clear");
    av.colored_text({
        {"歐幾里得算法 (輾轉相除法)\n", "", "", "20"},
        {"在進入擴展歐幾里得之前，我們先複習最基礎的 GCD 計算方式。\n"},
        {"這可以用 "},
        {"長方形填滿","rgba(252, 255, 64, 0.46)"},
        {" 的觀點來理解：\n"},
        {"假設你有一個 a {x:成} b 的大長方形，你想用最大的正方形把它填滿且不留空隙。\n"},
        {"那麼這個最大正方形的邊{長:常}，就是 {gcd(a, b):最大公因數}。"}
    }, Pos("rect","top",0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();


    rect = vector<vector<int>>(start_b, vector<int>(start_a, 0));
    av.start_frame_draw();
    av.frame_draw("rect", Pos(500, 150), rect, {}, {{0,0},{start_b-1,start_a-1}}, "clear");
    av.colored_text({
        {"{歐幾里得算法原理}\n", "", "", "20"},
        {"在{長:常}方形中，我們不斷用較短的那一邊作為正方形邊{長:常}進行剪裁。\n"},
        {"{每一次剪完剩下的部分，其長寬的正公因數集合都與原長方形相同。}\n"},
        {"{遞迴關係式： gcd(a, b) = gcd(b, a % b)}\n"},
        {"{現在讓我們觀察數字是如何變化的。}"}
    }, Pos("rect","top",0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();


    rect = vector<vector<int>>(start_b, vector<int>(start_a, 0));
    av.start_frame_draw();
    vector<array2D_style> chess_st_v2 = {
        { {"background", "#313131ff"}, AV::AtoB(0, abs(start_b-a), start_b-1, start_a-1) }
    };
    av.frame_draw("rect", Pos(500, 150), rect, chess_st_v2, {{0,0},{start_b-1,start_a-1}}, "clear");
    av.colored_text({
        {"{歐幾里得算法原理}\n", "", "", "20"},
        {"{在長方形中，我們不斷用較短的那一邊作為正方形邊長進行剪裁。}\n"},
        {"每一次剪完剩下的部分{，其長寬的正公因數集合都與原長方形相同。}\n"},
        {"{遞迴關係式： gcd(a, b) = gcd(b, a % b)}\n"},
        {"{現在讓我們觀察數字是如何變化的。}"}
    }, Pos("rect","top",0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();


    rect = vector<vector<int>>(start_b, vector<int>(start_a, 0));
    av.start_frame_draw();
    chess_st_v2 = {
        { {"background", "#313131ff"}, AV::AtoB(0, a%start_b, start_b-1, start_a-1) }
    };
    av.frame_draw("rect", Pos(500, 150), rect, chess_st_v2, {{0,0},{start_b-1,start_a-1}}, "clear");
    av.colored_text({
        {"{歐幾里得算法原理}\n", "", "", "20"},
        {"{在長方形中，我們不斷用較短的那一邊作為正方形邊長進行剪裁。}\n"},
        {"{每一次剪完剩下的部分}，其{長:常}寬的正公因數集合{都與原長方形相同。}\n"},
        {"{遞迴關係式： gcd(a, b) = gcd(b, a % b)}\n"},
        {"{現在讓我們觀察數字是如何變化的。}"}
    }, Pos("rect","top",0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();

    
    rect = vector<vector<int>>(start_b, vector<int>(start_a, 0));
    av.start_frame_draw();
    chess_st_v2 = {
        { {"background", "#313131ff"}, AV::AtoB(0, a%start_b, start_b-1, start_a-1) },
        { {"background", "#313131ff"}, AV::AtoB(2, 0, start_b-1, start_a-1) }
    };
    av.frame_draw("rect", Pos(500, 150), rect, chess_st_v2, {{0,0},{start_b-1,start_a-1}}, "clear");
    av.colored_text({
        {"{歐幾里得算法原理}\n", "", "", "20"},
        {"{在長方形中，我們不斷用較短的那一邊作為正方形邊長進行剪裁。}\n"},
        {"{每一次剪完剩下的部分，其長寬的正公因數集合}都與原長方形相同。\n"},
        {"{遞迴關係式： gcd(a, b) = gcd(b, a % b)}\n"},
        {"{現在讓我們觀察數字是如何變化的。}"}
    }, Pos("rect","top",0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();


    rect = vector<vector<int>>(start_b, vector<int>(start_a, 0));
    av.start_frame_draw();
    chess_st_v2 = {
        { {"background", "#313131ff"}, AV::AtoB(0, 2, start_b-1, start_a-1) },
        { {"background", "#313131ff"}, AV::AtoB(2, 0, start_b-1, start_a-1) },
        { {"background","rgba(76, 175, 80, 0.4)"}, AV::AtoB(0, 0, 1, 1) }
    };
    av.frame_draw("rect", Pos(500, 150), rect, chess_st_v2, {{0,0},{start_b-1,start_a-1}}, "clear");
    av.colored_text({
        {"{歐幾里得算法原理}\n", "", "", "20"},
        {"{在長方形中，我們不斷用較短的那一邊作為正方形邊長進行剪裁。}\n"},
        {"{每一次剪完剩下的部分，其長寬的正公因數集合都與原長方形相同。}\n"},
        {"遞迴關係式： {gcd(a, b) = gcd(b, a % b):a 和 b 的最大公因數 等於 b 和 a除以b的餘數 的最大公因數}\n"},
        {"現在讓我們觀察數字是如何變化的。"}
    }, Pos("rect","top",0, -160));
    av.auto_camera(0.85);
    av.end_frame_draw();


    // Step 2: 實例演示
    
    vector<array_style> st = {{{"highlight"}, {0}}};

    av.start_frame_draw();
    av.frame_draw("gcd", Pos(500, 10), vector<int>{a,b});
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.frame_draw("gcd", Pos(500, 10), vector<int>{a,b});
    av.frame_draw("gcd_1", Pos("gcd","left bottom",0, 50), vector<int>{b,a%b});
    av.arrow(Pos("gcd","bottom"), Pos("gcd_1","top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.arrow(Pos("gcd",1), Pos("gcd_1",0), {{"color", "rgba(76, 175, 79, 1)"}, {"width", "2"}});
    av.auto_camera(0.85);
    av.end_frame_draw();

    av.start_frame_draw();
    av.frame_draw("gcd", Pos(500, 10), vector<int>{a,b});
    av.frame_draw("gcd_1", Pos("gcd","left bottom",0, 50), vector<int>{b,a%b});
    av.frame_draw("gcd_2", Pos("gcd_1","left bottom",0, 50), vector<int>{a%b,b%a%b}, st);
    av.arrow(Pos("gcd","bottom"), Pos("gcd_1","top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.arrow(Pos("gcd_1","bottom"), Pos("gcd_2","top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.arrow(Pos("gcd",1), Pos("gcd_1",0), {{"color", "rgba(76, 175, 79, 1)"}, {"width", "2"}});
    av.arrow(Pos("gcd_1",1), Pos("gcd_2",0), {{"color", "rgba(76, 175, 79, 1)"}, {"width", "2"}});
    av.text("gcd = 4", Pos("gcd_2","bottom",0, 20));
    av.auto_camera(0.85);
    av.end_frame_draw();

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
    av.start_frame_draw();
    av.colored_text({
        {"擴展歐幾里得算法\n", "", "", "20"},
        {"擴展歐幾里得到底有{甚:捨}麼用? 又擴展在哪裡?\n先說結論，它可以幫助你找到 "},
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