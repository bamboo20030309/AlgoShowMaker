#include "AV.hpp"
#include <bits/stdc++.h>
using namespace std;

//draw{
AV av;
TreeLayout tree("tree", 1, Pos(500, 100), 80.0, 100.0);
map<pair<int, int>, string> node_vals;

int return_step = 0; // 0: 下降, 1: 拿回 x, 2: 算完 y

void update_node(int d, int o, int a, int b, string x, string y) {
    string val = to_string(a) + "," + to_string(b) + "," + x + "," + y;
    node_vals[{d, o}] = val;
    tree.vals[{d, o}] = val;
}

void gcd_demo(int a, int b) {
    vector<string> bar_a(a, "");
    vector<string> bar_b(b, "");

    // --- 第一部分：長條測量的原理說明 ---

    // 1. 初現與目標
    av.start_frame_draw();
    av.frame_draw("bar_a", Pos(500, 150), bar_a);
    av.frame_draw("bar_b", Pos(500, 230), bar_b);
    av.colored_text({
        {"歐幾里得算法 (輾轉相除法)\n", "", "", "24"},
        {"這是一個計算最大公因數的方法\n我們可以用 "}, {"{長:常}條測量", "rgba(252, 255, 64, 0.46)"}, {" 的觀點來理解\n"},
        {"假設有兩根長度 a 和 b，你想找一個長度 g 剛好能填滿這兩根\n"},
        {"這個最長的單位 g，就是 {gcd(a, b):最大公因數}"}
    }, Pos("bar_a", "top", 0, -20));
    av.auto_camera(0.85);
    av.sleep(600);
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
        {"{利用減法來縮減問題的規模}\n","","","20"},
        {"我們可以用 "},
        {"減法", "rgba(252, 255, 64, 0.46)"},
        {" 來不斷縮小問題的規模\n"},
        {"因為 {a:大的} 扣掉 {b:小的} 並不影響 gcd 的結果\n"},
        {"所以遞迴式可以寫成 {gcd(a, b) = gcd(b, a-b):b和 a 減 b 的 gcd}\n"},
        {"直到 a 減不動後 就可以換人繼續減"}
    }, Pos("bar_a", "top", 0, -20));
    av.auto_camera(0.85);
    av.sleep(900);
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
        {"{從連續減法到取餘數}\n", "", "", "20"},
        {"與其一次次減去 b，不如直接算 a 能裝下幾個 b。\n"},
        {"扣掉所有 b 之後剩下的紅色部分，就是 "},
        {"取餘數", "rgba(252, 255, 64, 0.46)"},
        {" (a%b)。\n"},
        {"然後遞迴式就簡化成 {gcd(a, b) = gcd(b, a%b):b和 a 餘 b 的 gcd}\n"},
        {"這樣就可以一次跳過中間所有的減法步驟"}
    }, Pos("bar_a", "top", 0, -20));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();

    // --- 第二部分：實例遞迴演示 ---
    
    int step = 0, old_a=a;
    av.start_frame_draw();
    av.frame_draw("a", Pos(500, 150), bar_a);
    av.frame_draw("b", Pos(500, 230), bar_b);
    av.accu_store("gcd_" + to_string(step++), Pos("b","raw left bottom", 0, 20+step*60), vector<int>{a,b});
    av.accu_draw();
    av.text("接下來看遞迴的過程", Pos("a", "top", 0, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();
    bar_a = vector<string>(a % b, "");

    while(a%=b){
                
        av.start_frame_draw();
        av.frame_draw("a", Pos(500, 150), bar_a);
        av.frame_draw("b", Pos(500, 230), bar_b);
        av.accu_draw();
        av.frame_draw("gcd_" + to_string(step), Pos("b","raw left bottom", 0, 20+step*100), vector<int>{a,b});
        av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
        av.arrow(Pos("gcd_"+to_string(step-1), 0,"center",0,0),Pos("gcd_"+to_string(step), 0,"center",0,0));
        av.text("先算 " + to_string(old_a) + " {/:除} " + to_string(b) + " 的餘數 = " + to_string(a%b), Pos("gcd_"+to_string(step),"bottom", 0 , 20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        old_a=b;
        bar_a = bar_b;
        bar_b = vector<string>(a % b, "");
        swap(a,b);
        
        av.start_frame_draw();
        av.frame_draw("a", Pos(500, 150), bar_a);
        av.frame_draw("b", Pos(500, 230), bar_b);
        av.accu_store("gcd_" + to_string(step), Pos("b","raw left bottom", 0, 20+step*100), vector<int>{a,b});
        av.accu_draw();
        av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
        av.arrow(Pos("gcd_"+to_string(step-1), 0,"center",0,0),Pos("gcd_"+to_string(step), 1,"center",0,0));
        av.accu_store_arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
        av.text("為了保持 a 大 b 小，把它左右交換再往下傳", Pos("gcd_"+to_string(step),"bottom", 0 , 20));
        av.auto_camera(0.85);
        av.end_frame_draw();
        bar_a = vector<string>(a % b, "");

        step++;
    }

    av.start_frame_draw();
    av.frame_draw("a", Pos(500, 150), bar_a);
    av.frame_draw("b", Pos(500, 230), bar_b);
    av.accu_draw();
    av.frame_draw("gcd_" + to_string(step), Pos("b","raw left bottom", 0, 20+step*100), vector<int>{a,b});
    av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.arrow(Pos("gcd_"+to_string(step-1), 0,"center",0,0),Pos("gcd_"+to_string(step), 0,"center",0,0));
    av.text("先算 " + to_string(old_a) + " {/:除} " + to_string(b) + " 的餘數 = " + to_string(a%b), Pos("gcd_"+to_string(step),"bottom", 0 , 20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    bar_a = bar_b;
    bar_b = vector<string>(a % b, "");
    swap(a,b);

    av.start_frame_draw();
    av.frame_draw("a", Pos(500, 150), bar_a);
    av.frame_draw("b", Pos(500, 230), bar_b);
    av.accu_draw();
    av.frame_draw("gcd_" + to_string(step), Pos("b","raw left bottom", 0, 20+step*100), vector<int>{a,b}, {{{"highlight"},{0}}});
    av.arrow(Pos("gcd_"+to_string(step-1),"bottom"),Pos("gcd_"+to_string(step),"top"), {{"color", "#000000ff"}, {"width", "2"}});
    av.arrow(Pos("gcd_"+to_string(step-1), 0,"center",0,0),Pos("gcd_"+to_string(step), 1,"center",0,0));
    av.text("遇到 0 回傳 a，找到最大公因數 a = " + to_string(a), Pos("gcd_"+to_string(step),"bottom", 0 , 20));
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
    if (d == 0) {
        tree.paint(av, "", -1, [&]{ 
            av.colored_text({
                {"我們要尋找一對 {x, y:x y} 使得\n"},
                {to_string(a) + "{x: x} + " + to_string(b) + "{y: y} = g"}
            }, tree.anchor(d, o, "bottom", 0, 20));
            av.auto_camera(0.85); 
        });
    }
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
            av.text("到達基底，因為 " + to_string(a) + "{x + 0y = g: x + 0 y = g}，所以 {x=1: x 直接放 1}, {y=0: y 直接放 0} 回傳\n( y 放甚麼數值都可以，但是放 0 的話算出來的 x,y 會是最小的)", tree.anchor(d, o, "bottom", 0, 20));
            av.auto_camera(0.85); 
            av.sleep(2000);
        });
        return_step = 2; // 基底回傳算完最後一步了
        //}
        return;
    } 
    
    //draw{
    tree.push(0);
    //}
    ext_euc(b,a%b,y,x);
    //draw{ 1. 回溯第一步：交換後的直接填入
    return_step = 1; // 剛拿回解，正在計算 x (目前標註在第四格)
    tree.pop();
    
    update_node(d, o, a, b, to_string(x), "?"); 
    tree.paint(av, "", -1, [&]{ 
        string cid = tree.get_id(d + 1, o * tree.degree + 0);
        string pid = tree.get_id(d, o);
        
        // 取得子節點數值並解析 (用於繪圖邏輯)
        string val_child = node_vals[{d + 1, o * tree.degree + 0}];
        vector<string> items_child;
        stringstream ss_child(val_child);
        string it;
        while (getline(ss_child, it, ',')) items_child.push_back(it);

        // 此幀這層變數標記
        av.draw_word("a", Pos(pid, 0, "bottom", 0, -1));
        av.draw_word("b", Pos(pid, 1, "bottom", 0, -1));
        av.draw_word("x", Pos(pid, 2, "bottom", 0, -1));
        av.draw_word("y", Pos(pid, 3, "bottom", 0, -1));
        
        // 此幀下層變數標記
        av.draw_word("b"  , Pos(cid, 0, "bottom", 0, -1));
        av.draw_word("a%b", Pos(cid, 1, "bottom", 0, -1));
        av.draw_word("u"  , Pos(cid, 2, "bottom", 0, -1));
        av.draw_word("v"  , Pos(cid, 3, "bottom", 0, -1));

        av.arrow(Pos(cid, 3, "top"), Pos(pid, 2, "bottom"), {{"color", "AV_green"}, {"width", "3"}});

        av.colored_text({
            {"回溯：底下的解，已計算完畢\n"},
            {"這層的 "},
            {"x", "AV_green"}, // 這裡會將 "x" 的背景塗成綠色
            {" 就是下一層的 "},
            {"v", "AV_green"}  // 這裡會將 "v" 的背景塗成綠色
        }, tree.anchor(d, o, "right", 20, 0)); 
        
        av.auto_camera(0.85); 
    });
    //}
    
    y-=a/b*x; 
    
    //draw{ 2. 回溯第二步：公式計算 (分成四幀逐步展示)
    update_node(d, o, a, b, to_string(x), to_string(y));

    // 共用的變數標記繪製
    auto draw_labels = [&]() {
        string cid = tree.get_id(d + 1, o * tree.degree + 0);
        string pid = tree.get_id(d, o);
        av.draw_word("a", Pos(pid, 0, "bottom", 0, -1));
        av.draw_word("b", Pos(pid, 1, "bottom", 0, -1));
        av.draw_word("x", Pos(pid, 2, "bottom", 0, -1));
        av.draw_word("y", Pos(pid, 3, "bottom", 0, -1));
        av.draw_word("b"  , Pos(cid, 0, "bottom", 0, -1));
        av.draw_word("a%b", Pos(cid, 1, "bottom", 0, -1));
        av.draw_word("u"  , Pos(cid, 2, "bottom", 0, -1));
        av.draw_word("v"  , Pos(cid, 3, "bottom", 0, -1));
    };
    Pos text_pos = Pos(tree.get_id(d, o), "right", 20, 0);

    // 幀 1: 顯示公式結構，只塗 y (綠)
    return_step = 2;
    tree.paint(av, "", -1, [&]{
        draw_labels();
        av.colored_text({
            {"{"},
            {"y", "AV_green"}, {" = u - (a/b) * v:這層的y就是}"}
        }, text_pos);
        av.auto_camera(0.85);
        av.sleep(400);
    });

    // 幀 2: 代入 u，塗 u (藍)
    return_step = 3;
    tree.paint(av, "", -1, [&]{
        draw_labels();
        av.colored_text({
            {"{"},
            {"y", "AV_green"}, {" = "}, {to_string(y + (a/b)*x), "AV_blue"}, {" - (a/b) * v:下層的 u}"}
        }, text_pos);
        av.auto_camera(0.85);
        av.sleep(600);
    });

    // 幀 3: 代入 a/b，塗 a,b (紅)
    return_step = 4;
    tree.paint(av, "", -1, [&]{
        draw_labels();
        av.colored_text({
            {"{"},
            {"y", "AV_green"}, {" = "}, {to_string(y + (a/b)*x), "AV_blue"}, {" - "}, {"(" + to_string(a) + "/" + to_string(b) + ")", "AV_red"}, {" * v:減掉 a 除以 b}"}
        }, text_pos);
        av.auto_camera(0.85);
        av.sleep(600);
    });

    // 幀 4: 代入 v，算出結果
    return_step = 5;
    tree.paint(av, "", -1, [&]{
        draw_labels();
        av.colored_text({
            {"{"},
            {"y", "AV_green"}, {" = "}, {to_string(y + (a/b)*x), "AV_blue"}, {" - "}, {"(" + to_string(a) + "/" + to_string(b) + ")", "AV_red"}, {" * "}, {to_string(x), "AV_yellow"}, {" = :呈上 v 等於}"}, {to_string(y), "AV_green"}
        }, text_pos);
        av.auto_camera(0.85);
        av.sleep();
    });

    // 留存最終公式
    vector<vector<string>> formula = {
        {"{"},
        {"y", "AV_green"}, {" = "}, {"u", "AV_blue"}, {" - "}, {"(a/b)", "AV_red"}, {" * "}, {"v", "AV_yellow"}, {"\n"},
        {"y", "AV_green"}, {" = "}, {to_string(y + (a/b)*x), "AV_blue"}, {" - "}, {"(" + to_string(a) + "/" + to_string(b) + ")", "AV_red"}, {" * "}, {to_string(x), "AV_yellow"}, {" = "}, {to_string(y), "AV_green"},
        {"}"}
    };
    av.accu_store_colored(formula, text_pos);
    //}
} //最後算出來x為模逆元

int main(){
    int a=16,b=6,x,y;
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
            if (items[i] == "?") st.push_back({{"background", "#cccccc"}, {i}});
        }

        // --- 回溯階段 1 的連動背景著色 ---
        if (return_step == 1) {
            if (d == tree.curr_d && o == tree.curr_o) {
                st.push_back({{"background", "AV_green"}, {2}});
            }
            if (d == tree.curr_d + 1 && o == tree.curr_o * tree.degree + 0) {
                st.push_back({{"background", "AV_green"}, {3}});
            }
        }

        // --- 回溯階段 2~5 的漸進式背景著色 ---
        // return_step >= 2: y (綠)
        if (return_step >= 2) {
            if (d == tree.curr_d && o == tree.curr_o) {
                st.push_back({{"background", "AV_green"}, {3}});
            }
        }
        // return_step >= 3: + u (藍)
        if (return_step >= 3) {
            if (d == tree.curr_d + 1 && o == tree.curr_o * tree.degree + 0) {
                st.push_back({{"background", "AV_blue"}, {2}});
            }
        }
        // return_step >= 4: + a, b (紅)
        if (return_step >= 4) {
            if (d == tree.curr_d && o == tree.curr_o) {
                st.push_back({{"background", "AV_red"}, {0, 1}});
            }
        }
        // return_step >= 5: + v (黃)
        if (return_step >= 5) {
            if (d == tree.curr_d + 1 && o == tree.curr_o * tree.degree + 0) {
                st.push_back({{"background", "AV_yellow"}, {3}});
            }
        }

        if (focus) { 
            if (return_step == 0) {
                st.push_back({{"highlight"}, {0}});
                st.push_back({{"point"}, {0}}); 
            } else if (return_step == 1) {
                st.push_back({{"highlight"}, {2}});
                st.push_back({{"point"}, {2}}); 
            } else if (return_step >= 2) {
                st.push_back({{"highlight"}, {3}});
                st.push_back({{"point"}, {3}}); 
            }
        }
        av.frame_draw(id, p, items, st);
    };
    av.start_draw();
    gcd_demo(16, 6);
    //}
    
    if (!(cin>>a>>b)) { a=16; b=6; }
    
    //draw{
    // Step 1: 貝祖定理與目標
    av.stop();
    av.start_frame_draw();
    av.colored_text({
        {"擴展歐幾里得算法\n", "", "", "20"},
        {"擴展歐幾里得到底擴展在哪?\n他在計算 {a,b:a b} 的過程中 還要去找到一對 {x,y:x y} 使得 {ax+by=gcd(a,b):a x + b y 能夠 = gcd a b}\n"},
        {"而這個 {x,y:x y} 可以做{甚:捨}麼呢?\n先說結論，它可以幫助你找到 "},
        {"模逆元", "rgba(252, 255, 64, 0.46)"},
        {" 來計算 "},
        {"模除法", "rgba(252, 255, 64, 0.46)"},
        {" ，\n比如說可以用來計算大數的組合數"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"擴展歐幾里得算法的原理\n", "", "", "20"},
        {"如果你手上有兩個整數 {a,b: a b}，數學家告訴我們：\n一定可以找到一組整數 (x,y) 滿足 {ax + by = gcd(a,b):a x + b y = gcd a b}\n這組神秘的 {x,y: x y} 稱為 貝祖數 ，我們今天的任務就是找出它們。\n\n"
         "{補充：}\n為什麼算式最後{得:ㄉㄟˇ}是 gcd 呢？\n因為 a 和 b 都是 gcd 的倍數。\n所以無論你怎麼線性組合 (ax + by)，其結果只會是 gcd 的倍數\n\n例如：\n你手邊只有 4 公升與 6 公升的水桶，\n不論你怎麼裝水、倒水，你能{量:ㄌㄧㄤˊ}出的水量一定是 2 公升 (gcd) 的倍數，\n絕對不可能{量:良}出 1 公升或 3 公升這種水量。"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();
    
    // Step 2: 問題轉換 (由大變小)
    av.start_frame_draw();
    av.colored_text({
        {"直接找 {x, y:x y} 的答案太難了，我們可以換個小一點的目標\n"},
        {"歐幾里得算法告訴我們 {gcd(a,b):a和b的最大公因數} = {gcd(b, a%b):：b和a於b, 的最大公因數}\n因此我們可以假設去找 {b* u:b成u} + {(a%b)* v:：a於b：成v} {= gcd(b, a%b)} 也是等價的！"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();

    // Step 3: 建立橋樑 (代換連結)
    av.start_frame_draw();
    av.colored_text({
        {"現在問題來了，我們知道 {ax + by = g:a x + b y,} 能夠被轉換成 {b* u + (a%b)* v = g:：b成u + ：a於b成v} \n"},
        {"但是你這 {x,y:x y} 和 {u,v:u v} 很明顯不一樣啊，那要怎樣才能夠拿回最原本的 {x,y:x y} 呢？\n\n\n"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep(750);
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{現在問題來了，我們知道 ax + by = g 能夠被轉換成 b* u + (a%b)* v = g} \n"},
        {"{但是你這 x,y 和 u,v 很明顯不一樣啊，那要怎樣才能夠拿回最原本的 x,y 呢？}\n\n"},
        {"如果我們能把 {b* u + (a%b)* v = g:原本的式子} 調整成 {a* (?) + b* (?):a成問號+b成問號} = g 的形式\n"},
        {"那不就能夠直接把原來的 {x,y:x y} 給求出來了嗎？"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep(900);
    av.end_frame_draw();

    // Step 4: 重新分組整理
        av.start_frame_draw();
    av.colored_text({
        {"目標：將 {b*u + (a%b)*v = g:原本的式ㄗ˙}, 調整成 {a* (?) + b* (?) = g:a成問號+b成問號=g} 的形式                  \n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n"},
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();

    av.start_frame_draw();
    av.colored_text({
        {"{目標：將 b*u + (a%b)*v = g, 調整成 a* (?) + b* (?) = g 的形式}\n\n"},
        {"首先最關鍵的一步，將 {(a % b) = }"},
        {"{a - (a/b)*b:a於b 變成 a減a除b成b：：}","rgba(252, 255, 64, 0.46)"},
        {" ，這樣就可以繞過 {a%b:a於b} 的計{算:算：：：：：}\n\n\n\n\n\n\n\n\n\n\n\n\n\n"},
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
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
    av.sleep();
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
    av.sleep();
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
    av.sleep();
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
        {"{再把它左右交換位置：}\n"},
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
    av.sleep();
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
        {"{再把它左右交換位置：}\n"},
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
        {"{最後把 "},
        {"b","rgba(34, 136, 219, 0.4)"},
        {" 提出來：}\n"},
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
        {"兩個問號分別就是 v 和 {u - (a/b)*v:u 減 a 除 b 成 v}"}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
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
        {" )   = gcd(b, a%b)}\n", "", ""},

        {"這麼一來與原式對照，你會發現其實 x 就是 {v:v} 而 y 就是 {u - (a/b)*v:u減a除b成v}\n這樣子 {x,y:x y} 和 {u,v:u v} 的遞迴關係就能夠串聯起來了\n接下來是程式流程，請觀察數值是如何交換與跳轉的。", "", ""}
    }, Pos(500, 10));
    av.auto_camera(0.85);
    av.sleep();
    av.end_frame_draw();
    //}
    
    av.accu_clear();
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