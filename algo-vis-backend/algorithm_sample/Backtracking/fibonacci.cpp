#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;

//draw{
AV av;
TreeLayout tree("tree", 2, Pos(500, 100), 80.0, 120.0);
//}

int F(int n) {
    //draw{
    int d = tree.curr_d;
    int o = tree.curr_o;
    
    tree.paint(av, "F(" + to_string(n) + ")", -1, [&]{
        if (d > 0 && o % 2 == 1) av.addEditorHighlight(39);
        else av.addEditorHighlight(33);
    }); 
    //}
    if (n <= 1) {
        //draw{
        tree.edge_colors[{d, o}] = "black";
        tree.paint(av, n, n, [&]{
            av.addEditorHighlight(28);
            av.text("遇到擋板，回傳 " + to_string(n), Pos(tree.get_id(d, o), "bottom", 0, 20));
        });
        //}
        return n;
    }
    //draw{
    tree.push(0); 
    //}
    int a = F(n - 1);
    //draw{
    tree.pop();

    tree.push(1); 
    //}
    int b = F(n - 2);
    //draw{
    tree.pop();
    //}
    int res = a + b;
    //draw{
    tree.paint(av, to_string(a) + " + " + to_string(b), -1, [&]{
        av.addEditorHighlight(43);
        av.text("合併結果", Pos(tree.get_id(d, o), "bottom", 0, 20));
    }); 
    
    tree.edge_colors[{d, o}] = "black";
    tree.paint(av, res, res, [&]{
        av.addEditorHighlight(57);
        av.text("回傳 " + to_string(res), Pos(tree.get_id(d, o), "bottom", 0, 20));
    }); 
    //}
    
    return res;
}

int main() {
    //draw{
    tree.renderer = [](string id, Pos p, int d, int o, bool is_focus) {
        string val = tree.vals[{d, o}];
        int res = tree.results.count({d, o}) ? tree.results[{d, o}] : -1;

        
        av.frame_draw(id, p, vector<string>{val}); 
        if(is_focus) av.camera(p, 1.3);
        
    };
    //}
    int n=5; cin>>n;
    //draw{
    av.start_draw();

    // --- 開頭說明 ---
    av.start_frame_draw();
    av.frame_draw("tree", Pos(500, 100), vector<string>{"F(" + to_string(n) + ")"}); 
    av.text("遞迴的費氏數列 (Fibonacci Sequence) \n我們即將計算 {F(" + to_string(n) + "):費式數列的第" + to_string(n) + "項}", Pos("tree","top",0, -20));
    av.auto_camera();
    av.end_frame_draw();
    //}

    int result = F(n);

    //draw{
    // --- 結尾說明 ---
    av.start_frame_draw();
    av.accu_draw();
    tree.redraw(av); 
    av.text("計算完成！\n{F(" + to_string(n) + "):費式數列的第" + to_string(n) + "項} 的最終結果為：" + to_string(result), Pos("tree_0_0","top",0, -20));
    av.auto_camera();
    av.end_frame_draw();

    av.end_draw();
    //}
    return 0;
}
