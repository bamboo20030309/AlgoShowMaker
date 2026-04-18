//prefix_sum_2D Sample
#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;

int main() {
    int n, m; cin>>n>>m;
    vector<vector<int>> num(n+1, vector<int>(m+1, 0));
    vector<vector<int>> pre(n+1, vector<int>(m+1, 0));
    
    for (int i=1;i<=n;i++)for(int j=1; j<=m;j++)cin>>num[i][j];

    //draw{
    av.start_draw();
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, {}, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, {}, {{0,0},{n,m}});
    av.text("這是二維前綴和的範例\n這個方法透過排容原理，可以快速計算出子矩陣的和\n一般來說我們會在左上邊補 0，這樣可以避免邊界的問題\n前綴和建表方式如下：", Pos("pre", "top", 175, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    const string color_up     = "rgba(100, 149, 237, 0.4)"; // CornflowerBlue
    const string color_left   = "rgba(255, 165, 0, 0.4)";   // Orange
    const string color_upleft = "rgba(255, 80, 80, 0.6)";   // Red
    const string color_done   = "rgba(47, 255, 82, 0.4)";   // Green

    // 說明公式 (拆分為四步教學)
    //draw{
    int demo_i = 2, demo_j = 2;
    vector<pair<int,int>> _demo_current = {{demo_i, demo_j}};
    vector<pair<int,int>> _demo_up      = {{demo_i-1, demo_j}};
    vector<pair<int,int>> _demo_left    = {{demo_i, demo_j-1}};
    vector<pair<int,int>> _demo_upleft  = {{demo_i-1, demo_j-1}};

    vector<pair<int,int>> _demo_num_up     = AV::AtoB(0, 0, demo_i-1, demo_j);
    vector<pair<int,int>> _demo_num_left   = AV::AtoB(0, 0, demo_i, demo_j-1);
    vector<pair<int,int>> _demo_num_upleft = AV::AtoB(0, 0, demo_i-1, demo_j-1);

    // Frame 1: Up
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _demo_current}, {{ "background", color_up }, _demo_up} }, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_up }, _demo_num_up} }, {{0,0},{n,m}});
    av.arrow(Pos("pre", demo_i-1, demo_j), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.colored_text({
        {{"1. 加上上方的前綴和 {"}}, {{"pre["+to_string(demo_i-1)+"]["+to_string(demo_j)+"]", color_up}}, {{"}\n"}},
        {{"它代表了右邊表格內藍色區域所有數值的總和。"}}
    }, Pos("pre", "top", 175, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Frame 2: Left
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _demo_current}, {{ "background", color_up }, _demo_up}, {{ "background", color_left }, _demo_left} }, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_up }, _demo_num_up}, {{ "background", color_left }, _demo_num_left} }, {{0,0},{n,m}});
    av.arrow(Pos("pre", demo_i-1, demo_j), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.arrow(Pos("pre", demo_i, demo_j-1), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.colored_text({
        {{"2. 加上左方的前綴和 {"}}, {{"pre["+to_string(demo_i)+"]["+to_string(demo_j-1)+"]", color_left}}, {{"}\n"}},
        {{"現在我們把左邊橘色區域的和也加進來。"}}
    }, Pos("pre", "top", 175, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Frame 3: UpLeft
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _demo_current}, {{ "background", color_up }, _demo_up}, {{ "background", color_left }, _demo_left}, {{ "background", color_upleft }, _demo_upleft} }, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_up }, _demo_num_up}, {{ "background", color_left }, _demo_num_left}, {{ "background", color_upleft }, _demo_num_upleft} }, {{0,0},{n,m}});
    av.arrow(Pos("pre", demo_i-1, demo_j), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.arrow(Pos("pre", demo_i, demo_j-1), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.arrow(Pos("pre", demo_i-1, demo_j-1), Pos("pre", demo_i, demo_j), {{"color", "red"}});
    av.colored_text({
        {{"3. 減去重疊的左上角 {"}}, {{"pre["+to_string(demo_i-1)+"]["+to_string(demo_j-1)+"]", color_upleft}}, {{"}\n"}},
        {{"因為左上角區域在剛才兩次相加中被算了兩次，必須扣掉一次。"}}
    }, Pos("pre", "top", 175, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();

    // Frame 4: Current
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, { 
        {{ "background", color_up }, _demo_up}, 
        {{ "background", color_left }, _demo_left}, 
        {{ "background", color_upleft }, _demo_upleft}, 
        {{"highlight"}, _demo_current} 
    }, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, { 
        {{ "background", color_up }, _demo_num_up}, 
        {{ "background", color_left }, _demo_num_left}, 
        {{ "background", color_upleft }, _demo_num_upleft}, 
        {{ "background", color_done }, _demo_current} 
    }, {{0,0},{n,m}});
    av.arrow(Pos("pre", demo_i-1, demo_j), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.arrow(Pos("pre", demo_i, demo_j-1), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.arrow(Pos("pre", demo_i-1, demo_j-1), Pos("pre", demo_i, demo_j), {{"color", "red"}});
    av.arrow(Pos("num", demo_i, demo_j), Pos("pre", demo_i, demo_j), {{"color", "limegreen"}});
    av.colored_text({
        {{"4. 最後加上現在的值 {"}}, {{"num["+to_string(demo_i)+"]["+to_string(demo_j)+"]", color_done}}, {{"}\n"}},
        {{"這樣就完成一個點的前綴和計算\n"}},
        {{"{pre[i][j] = "}}, 
        {{"pre[i-1][j]", color_up}}, {{" + "}}, 
        {{"pre[i][j-1]", color_left}}, {{" - "}}, 
        {{"pre[i-1][j-1]", color_upleft}}, {{" + "}}, 
        {{"num[i][j]", color_done}}, {{"}"}}
    }, Pos("pre", "top", 175, -20));
    av.auto_camera(0.85);
    av.end_frame_draw();
    // 說明建表流程開始
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, {}, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, {}, {{0,0},{n,m}});
    av.text("接下來是實際的建表流程：", Pos("pre", "top", 175, -20));
    av.auto_camera(0.85); 
    av.end_frame_draw();
    //}

    vector<pair<int,int>> _done_cells;
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= m; j++) {
            //draw{
            vector<pair<int,int>> _draw_current = {{i, j}};
            vector<pair<int,int>> _draw_up      = {{i-1, j}};
            vector<pair<int,int>> _draw_left    = {{i, j-1}};
            vector<pair<int,int>> _draw_upleft  = {{i-1, j-1}};

            vector<pair<int,int>> _num_up, _num_left, _num_upleft;
            for(int r=0; r<=i-1; r++) for(int c=0; c<=j; c++) _num_up.push_back({r,c});
            for(int r=0; r<=i; r++)   for(int c=0; c<=j-1; c++) _num_left.push_back({r,c});
            for(int r=0; r<=i-1; r++) for(int c=0; c<=j-1; c++) _num_upleft.push_back({r,c});

            vector<vector<int>> vis_pre = pre;
            vis_pre[i][j] = 0;

            Pos textPos = (i <= n / 2) ? Pos("num", "top", 0, -20) : Pos("pre", "top", 175, -20);

            if(i==1 && j==1){
                av.start_frame_draw();
                av.frame_draw("pre", Pos(0, 0), pre, { {{"mark"}, _done_cells} }, {{0,0},{n,m}});
                av.frame_draw("num", Pos("pre", "right", 100, 0), num, {}, {{0,0},{n,m}});
                av.text("這個陣列是原始數字的部分，我們先看前綴和原理", Pos("num", "top", 0, -20));
                av.camera(Pos("num"), 2.0); 
                av.end_frame_draw();
            }
            if(i == n / 2 + 1  && j==1){
                av.start_frame_draw();
                av.frame_draw("pre", Pos(0, 0), pre, { {{"mark"}, _done_cells} }, {{0,0},{n,m}});
                av.frame_draw("num", Pos("pre", "right", 100, 0), num, {}, {{0,0},{n,m}});
                av.text("另外一個陣列是前綴和的表，接下來來看實際上是如何建表的", Pos("pre", "top", 175, -20));
                av.auto_camera(0.85);
                av.end_frame_draw();
            }

            if(i==2 && j==1) av.fast();
            if(i==n / 2 + 2 && j==1) av.fast();

            // Step 1: Up
            vis_pre[i][j] = pre[i-1][j];
            av.start_frame_draw();
            av.frame_draw("pre", Pos(0, 0), vis_pre, { {{"mark"}, _done_cells}, {{"highlight"}, _draw_current}, {{ "background", color_up }, _draw_up} }, {{0,0},{n,m}});
            av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_up }, _num_up} }, {{0,0},{n,m}});
            if (i > n / 2) av.arrow(Pos("pre", i-1, j), Pos("pre", i, j), {{"color", "limegreen"}});
            av.colored_text({ 
                {{"{pre[" + to_string(i) + "][" + to_string(j) + "] = }"}}, 
                {{"{pre[" + to_string(i-1) + "][" + to_string(j) + "]:加上上方的前綴和}"}, color_up}, 
                {{"{ + }"}},
                {{"{pre[" + to_string(i) + "][" + to_string(j-1) + "]}"}},
                {{"{ - }"}},
                {{"{pre[" + to_string(i-1) + "][" + to_string(j-1) + "]}"}},
                {{"{ + }"}},
                {{"{num[" + to_string(i) + "][" + to_string(j) + "]}"}},
            }, textPos);
            if (i <= n / 2) av.camera(Pos("num"), 2.0); else av.auto_camera(0.85); 
            av.end_frame_draw();

            // Step 2: Left
            vis_pre[i][j] += pre[i][j-1];
            av.start_frame_draw();
            av.frame_draw("pre", Pos(0, 0), vis_pre, { {{"mark"}, _done_cells}, {{"highlight"}, _draw_current}, {{ "background", color_up }, _draw_up}, {{ "background", color_left }, _draw_left} }, {{0,0},{n,m}});
            av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_up }, _num_up}, {{ "background", color_left }, _num_left} }, {{0,0},{n,m}});
            if (i > n / 2) {
                av.arrow(Pos("pre", i-1, j), Pos("pre", i, j), {{"color", "limegreen"}});
                av.arrow(Pos("pre", i, j-1), Pos("pre", i, j), {{"color", "limegreen"}});
            }
            av.colored_text({ 
                {{"{pre[" + to_string(i) + "][" + to_string(j) + "] = }"}}, 
                {{"{pre[" + to_string(i-1) + "][" + to_string(j) + "]}"}, color_up}, 
                {{"{ + }"}},
                {{"{pre[" + to_string(i) + "][" + to_string(j-1) + "]:加上左方的前綴和}", color_left}},
                {{"{ - }"}},
                {{"{pre[" + to_string(i-1) + "][" + to_string(j-1) + "]}"}},
                {{"{ + }"}},
                {{"{num[" + to_string(i) + "][" + to_string(j) + "]}"}},
            }, textPos);
            if (i <= n / 2) av.camera(Pos("num"), 2.0); else av.auto_camera(0.85); 
            av.end_frame_draw();

            // Step 3: UpLeft
            vis_pre[i][j] -= pre[i-1][j-1];
            av.start_frame_draw();
            av.frame_draw("pre", Pos(0, 0), vis_pre, { {{"mark"}, _done_cells}, {{"highlight"}, _draw_current}, {{ "background", color_up }, _draw_up}, {{ "background", color_left }, _draw_left}, {{ "background", color_upleft }, _draw_upleft} }, {{0,0},{n,m}});
            av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_up }, _num_up}, {{ "background", color_left }, _num_left}, {{ "background", color_upleft }, _num_upleft} }, {{0,0},{n,m}});
            if (i > n / 2) {
                av.arrow(Pos("pre", i-1, j), Pos("pre", i, j), {{"color", "limegreen"}});
                av.arrow(Pos("pre", i, j-1), Pos("pre", i, j), {{"color", "limegreen"}});
                av.arrow(Pos("pre", i-1, j-1), Pos("pre", i, j), {{"color", "red"}});
            }
            av.colored_text({ 
                {{"{pre[" + to_string(i) + "][" + to_string(j) + "] = }"}}, 
                {{"{pre[" + to_string(i-1) + "][" + to_string(j) + "]}"}, color_up}, 
                {{"{ + }"}},
                {{"{pre[" + to_string(i) + "][" + to_string(j-1) + "]}", color_left}},
                {{"{ - }"}},
                {{"{pre[" + to_string(i-1) + "][" + to_string(j-1) + "]:扣掉左上角重複的前綴和}"}, color_upleft},
                {{"{ + }"}},
                {{"{num[" + to_string(i) + "][" + to_string(j) + "]}"}},
            }, textPos);
            if (i <= n / 2) av.camera(Pos("num"), 2.0); else av.auto_camera(0.85); 
            av.end_frame_draw();

            // Step 4: Final
            vis_pre[i][j] += num[i][j];
            av.start_frame_draw();
            if (j == m) {
                av.key_frame_draw("pre", Pos(0, 0), vis_pre, { {{"mark"}, _done_cells}, {{"highlight"}, _draw_current}, {{ "background", color_up }, _draw_up}, {{ "background", color_left }, _draw_left}, {{ "background", color_upleft }, _draw_upleft} }, {{0,0},{n,m}});
                av.key_frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_done }, _draw_current}, {{ "background", color_up }, _num_up}, {{ "background", color_left }, _num_left}, {{ "background", color_upleft }, _num_upleft} }, {{0,0},{n,m}});
                av.key_colored_text({ 
                {{"{pre[" + to_string(i) + "][" + to_string(j) + "] = }"}}, 
                {{"{pre[" + to_string(i-1) + "][" + to_string(j) + "]}"}, color_up}, 
                {{"{ + }"}},
                {{"{pre[" + to_string(i) + "][" + to_string(j-1) + "]}", color_left}},
                {{"{ - }"}},
                {{"{pre[" + to_string(i-1) + "][" + to_string(j-1) + "]}"}, color_upleft},
                {{"{ + }"}},
                {{"{num[" + to_string(i) + "][" + to_string(j) + "]:快轉}", color_done}},
            }, textPos);
            } 
            av.frame_draw("pre", Pos(0, 0), vis_pre, { {{"mark"}, _done_cells}, {{"highlight"}, _draw_current}, {{ "background", color_up }, _draw_up}, {{ "background", color_left }, _draw_left}, {{ "background", color_upleft }, _draw_upleft} }, {{0,0},{n,m}});
            av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{ "background", color_done }, _draw_current}, {{ "background", color_up }, _num_up}, {{ "background", color_left }, _num_left}, {{ "background", color_upleft }, _num_upleft} }, {{0,0},{n,m}});
            if (i > n / 2) {
                av.arrow(Pos("pre", i-1, j), Pos("pre", i, j), {{"color", "limegreen"}});
                av.arrow(Pos("pre", i, j-1), Pos("pre", i, j), {{"color", "limegreen"}});
                av.arrow(Pos("pre", i-1, j-1), Pos("pre", i, j), {{"color", "red"}});
                av.arrow(Pos("num", i, j), Pos("pre", i, j), {{"color", "limegreen"}});
            }
            av.colored_text({ 
                {{"{pre[" + to_string(i) + "][" + to_string(j) + "] = }"}}, 
                {{"{pre[" + to_string(i-1) + "][" + to_string(j) + "]}"}, color_up}, 
                {{"{ + }"}},
                {{"{pre[" + to_string(i) + "][" + to_string(j-1) + "]}", color_left}},
                {{"{ - }"}},
                {{"{pre[" + to_string(i-1) + "][" + to_string(j-1) + "]}"}, color_upleft},
                {{"{ + }"}},
                {{"{num[" + to_string(i) + "][" + to_string(j) + "]:加上原來的數值}", color_done}},
            }, textPos);
            if (i <= n / 2) av.camera(Pos("num"), 2.0); else av.auto_camera(0.85); 
            av.end_frame_draw();
            _done_cells.push_back({i, j});
            //}
            pre[i][j] = num[i][j] + pre[i-1][j] + pre[i][j-1] - pre[i-1][j-1];
        }
    }
    //draw{
    av.start_frame_draw();
    av.frame_draw("pre", Pos(0, 0), pre, { {{"mark"}, _done_cells} }, {{0,0},{n,m}});
    av.frame_draw("num", Pos("pre", "right", 100, 0), num, {}, {{0,0},{n,m}});
    av.text("二維前綴和建表完成", Pos("pre", "top", 175, -20));
    av.key_frame_draw("pre", Pos(0, 0), pre, { {{"mark"}, _done_cells} }, {{0,0},{n,m}});
    av.key_frame_draw("num", Pos("pre", "right", 100, 0), num, {}, {{0,0},{n,m}});
    av.key_text("二維前綴和建表完成", Pos("pre", "top", 175, -20));
    av.auto_camera(0.85); 
    av.end_frame_draw();
    //}
    int T; cin >> T;
    while (T--) {
        int r1, c1, r2, c2; cin>>r1>>c1>>r2>>c2;
        r1++; c1++; r2++; c2++;
        int ans = pre[r2][c2] - pre[r1-1][c2] - pre[r2][c1-1] + pre[r1-1][c1-1];

        //draw{
        vector<pair<int,int>> _dq_p_total = {{r2, c2}}, _dq_p_up = {{r1-1, c2}}, _dq_p_left = {{r2, c1-1}}, _dq_p_corner = {{r1-1, c1-1}};
        vector<pair<int,int>> _dq_highlight = AV::AtoB(r1, c1, r2, c2);
        vector<pair<int,int>> _num_f1, _num_f2, _num_f3_red, _num_f3_green, _num_f4;

        for(int r=0; r<=r2; r++) for(int c=0; c<=c2; c++) _num_f1.push_back({r,c});
        for(int r=r1; r<=r2; r++) for(int c=0; c<=c2; c++) _num_f2.push_back({r,c});
        for(int r=0; r<=r1-1; r++) for(int c=0; c<=c1-1; c++) _num_f3_red.push_back({r,c});
        for(int r=r1; r<=r2; r++)   for(int c=c1; c<=c2; c++)   _num_f3_green.push_back({r,c});
        for(int r=r1; r<=r2; r++) for(int c=c1; c<=c2; c++) _num_f4.push_back({r,c});

        // Frame Query Preview (新影格)
        av.start_frame_draw();
        av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _dq_highlight} }, {{0,0},{n,m}});
        av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f4}}, {{0,0},{n,m}});
        av.text("查詢目標範圍：(" + to_string(r1-1) + "," + to_string(c1-1) + ") {~} (" + to_string(r2-1) + "," + to_string(c2-1) + ")", Pos("pre", "top", 175, -20));
        av.auto_camera(0.85); av.end_frame_draw();

        // Frame Query 1: Total (+)
        av.start_frame_draw();
        av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _dq_p_total} }, {{0,0},{n,m}});
        av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f1} }, {{0,0},{n,m}});
        av.colored_text({ 
            {{"{ans = "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c2) + "]"}, color_done},
            {{" - "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c2) + "]"}},
            {{" - "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c1-1) + "]"}},
            {{" + "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c1-1) + "]:先取大矩陣總和}"}},
        }, Pos("pre", "top", 175, -20));
        av.auto_camera(0.85); av.end_frame_draw();

        // Frame Query 2: Subtract Up (-)
        av.start_frame_draw();
        av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _dq_p_total}, {{"background", color_upleft}, _dq_p_up} }, {{0,0},{n,m}});
        av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f2} }, {{0,0},{n,m}});
        av.colored_text({ 
            {{"{ans = "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c2) + "]"}, color_done},
            {{" - "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c2) + "]"}, color_upleft},
            {{" - "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c1-1) + "]"}},
            {{" + "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c1-1) + "]:扣除上方部分}"}},
        }, Pos("pre", "top", 175, -20));
        av.auto_camera(0.85); av.end_frame_draw();

        // Frame Query 3: Subtract Left (-)
        av.start_frame_draw();
        av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _dq_p_total}, {{"background", color_upleft}, _dq_p_up}, {{"background", color_upleft}, _dq_p_left} }, {{0,0},{n,m}});
        av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f3_green}, {{"background", color_upleft}, _num_f3_red} }, {{0,0},{n,m}});
        av.colored_text({ 
            {{"{ans = "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c2) + "]"}, color_done},
            {{" - "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c2) + "]"}, color_upleft},
            {{" - "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c1-1) + "]"}, color_upleft},
            {{" + "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c1-1) + "]:扣除左方部分}"}},
        }, Pos("pre", "top", 175, -20));
        av.auto_camera(0.85); av.end_frame_draw();

        // Frame Query 4: Add Corner (+)
        av.start_frame_draw();
        av.frame_draw("pre", Pos(0, 0), pre, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _dq_p_total}, {{"background", color_upleft}, _dq_p_up}, {{"background", color_upleft}, _dq_p_left}, {{"background", color_done}, _dq_p_corner} }, {{0,0},{n,m}});
        av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f4}}, {{0,0},{n,m}});
        av.colored_text({ 
            {{"{ans = "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c2) + "]"}, color_done},
            {{" - "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c2) + "]"}, color_upleft},
            {{" - "}},
            {{"pre[" + to_string(r2) + "][" + to_string(c1-1) + "]"}, color_upleft},
            {{" + "}},
            {{"pre[" + to_string(r1-1) + "][" + to_string(c1-1) + "]:加回多扣的左上角}", color_done}},
        }, Pos("pre", "top", 175, -20));
        av.auto_camera(0.85); av.end_frame_draw();

        av.start_frame_draw();
        av.frame_draw("pre", Pos(0, 0), pre, { 
            {{"highlight"}, _dq_highlight},
            {{"background", color_done}, _dq_p_total}, {{"background", color_upleft}, _dq_p_up},
            {{"background", color_upleft}, _dq_p_left}, {{"background", color_done}, _dq_p_corner} 
        }, {{0,0},{n,m}});
        av.frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f4}}, {{0,0},{n,m}});
        av.colored_text({ {{"查詢結果：{ans:答案} = " + to_string(ans)}} }, Pos("pre", "top", 175, -20));
        
        av.key_frame_draw("pre", Pos(0, 0), pre, { 
            {{"highlight"}, _dq_highlight},
            {{"background", color_done}, _dq_p_total}, {{"background", color_upleft}, _dq_p_up},
            {{"background", color_upleft}, _dq_p_left}, {{"background", color_done}, _dq_p_corner} 
        }, {{0,0},{n,m}});
        av.key_frame_draw("num", Pos("pre", "right", 100, 0), num, { {{"highlight"}, _dq_highlight}, {{"background", color_done}, _num_f4}}, {{0,0},{n,m}});
        
        av.key_text("查詢結果：{ans:答案} = " + to_string(ans), Pos("pre", "top", 175, -50));
        av.auto_camera(0.85); av.end_frame_draw();
        //}
        cout << ans << endl;
    }
    //draw{
    av.end_draw();
    //}
    return 0;
}
