#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
AV av;
int main() {
    //draw{
    av.start_draw();

    // --- 教學動畫：聚光燈模式 ---
    int temp_n = 5; 
    vector<int> t_init = {1,2,3,4,5};
    vector<int> t_train = {5,4,1,2,3}; // 修改目標
    stack<int> t_st;

    // 1. 介紹佈局
    av.start_frame_draw();
    av.colored_text(
        {{{"題意：\n","","","20"}},
         {{"總共有 n 個車廂 和 1 個中繼站\n"}},
         {{"{一開始車廂按照升序排序 (1, 2, ..., n)\n}"}},
         {{"{每次能移動一個車廂到中繼站 或是 將中繼站最尾端的車廂移到終點\n}"}},
         {{"{判斷能否透過中繼站將車廂排成目標排序，成功輸出 Yes，失敗輸出 No}"}}
        }, Pos(350, 50));
    av.frame_draw("target", Pos(100, 250), t_train, {}, {5, 5});
    av.frame_draw("station", Pos("target", "right", 50, temp_n * 40 + 50), t_st);
    av.frame_draw("init", Pos("target", "top right", 170, 0), vector<int>{}, {}, {0, 4});
    av.auto_camera(0.65);
    av.end_frame_draw();

    // 2. 介紹初始排序
    av.start_frame_draw();
    av.colored_text(
        {{{"{題意：}\n","","","20"}},
         {{"{總共有 n 個車廂 和 1 個中繼站\n}"}},
         {{"一開始車廂按照升序排序 (1, 2, ..., n)\n"}},
         {{"{每次能移動一個車廂到中繼站 或是 將中繼站最尾端的車廂移到終點\n}"}},
         {{"{判斷能否透過中繼站將車廂排成目標排序，成功輸出 Yes，失敗輸出 No}"}}
        }, Pos(350, 50));
    av.frame_draw("target", Pos(100, 250), t_train, {}, {5, 5});
    av.frame_draw("station", Pos("target", "right", 50, temp_n * 40 + 50), t_st);
    av.frame_draw("init", Pos("target", "top right", 170, 0), t_init, {}, {0, 4});
    av.auto_camera(0.65);
    av.end_frame_draw();

    // 3. 演示進站規則 (演示移動車廂 5)
    for(int i=1;i<=4;i++) t_st.push(i); // 預填 1~4
    av.start_frame_draw();
    av.colored_text(
        {{{"{題意：}\n","","","20"}},
         {{"{總共有 n 個車廂 和 1 個中繼站\n}"}},
         {{"{一開始車廂按照升序排序 (1, 2, ..., n)\n}"}},
         {{"每次能移動一個車廂到中繼站 "}},
         {{"{或是 將中繼站最尾端的車廂移到終點\n}"}},
         {{"{判斷能否透過中繼站將車廂排成目標排序，成功輸出 Yes，失敗輸出 No}"}}
        }, Pos(350, 50));
    // init 1~4 已處理(變灰)，5 號高亮進入中繼站
    av.frame_draw("target", Pos(100, 250), t_train, { {{"background", "#cccccc"}, AV::AtoB(0, 4)} }, {0, 4});
    av.frame_draw("station", Pos("target", "right", 50, temp_n * 40 + 50), t_st);
    av.frame_draw("init", Pos("target", "top right", 170, 0), t_init, { {{"background", "#cccccc"}, AV::AtoB(0, 3)}, {{"highlight"}, {4}} }, {0, 4});
    av.arrow(Pos("init", 4, "center"), Pos("station", 4, "center"), {{"color", "#4CAF50"}, {"width", "4"}});
    av.auto_camera(0.65);
    av.end_frame_draw();

    // 4. 演示出站規則 (演示移動車廂 5 彈出)
    t_st.push(5);
    av.start_frame_draw();
    av.colored_text(
        {{{"{題意：}\n","","","20"}},
         {{"{總共有 n 個車廂 和 1 個中繼站\n}"}},
         {{"{一開始車廂按照升序排序 (1, 2, ..., n)\n}"}},
         {{"{每次能移動一個車廂到中繼站 }"}},
         {{"或是 將中繼站最尾端的車廂移到終點\n"}},
         {{"{判斷能否透過中繼站將車廂排成目標排序，成功輸出 Yes，失敗輸出 No}"}}
        }, Pos(350, 50));
    av.frame_draw("target", Pos(100, 250), t_train, { 
        {{"background", "#cccccc"}, AV::AtoB(1, 4)},
        {{"highlight"}, {0}}
    }, {0, 5});
    av.frame_draw("station", Pos("target", "right", 50, temp_n * 40 + 50), t_st, { {{"highlight"}, {4}} });
    av.frame_draw("init", Pos("target", "top right", 170, 0), t_init, { {{"background", "#cccccc"}, AV::AtoB(0, 4)} }, {0, 5});
    av.arrow(Pos("station", 4, "center"), Pos("target", 0, "center"), {{"color", "#4CAF50"}, {"width", "4"}});
    av.auto_camera(0.65);
    av.end_frame_draw();

    // 5. 判定規則結語
    t_st.pop();
    t_st.pop();
    av.start_frame_draw();
    av.colored_text(
        {{{"{題意：}\n","","","20"}},
         {{"{總共有 n 個車廂 和 1 個中繼站\n}"}},
         {{"{一開始車廂按照升序排序 (1, 2, ..., n)\n}"}},
         {{"{每次能移動一個車廂到中繼站 或是 將中繼站最尾端的車廂移到終點\n}"}},
         {{"判斷能否透過中繼站將車廂排成目標排序，成功輸出 Yes，失敗輸出 {No:no}"}}
        }, Pos(350, 50));
    av.frame_draw("target", Pos(100, 250), t_train, {{{"background", "#cccccc"}, AV::AtoB(2, 4)}}, {0, 4});
    av.frame_draw("station", Pos("target", "right", 50, temp_n * 40 + 50), t_st);
    av.frame_draw("init", Pos("target", "top right", 170, 0), t_init, { {{"background", "#cccccc"}, AV::AtoB(0, 4)} }, {0, 5});
    av.auto_camera(0.65);
    av.end_frame_draw();

    //}
    int n; string s; 
    while(cin>>n&&n){getline(cin,s);
        while(getline(cin,s)&&s!="0"){
            vector<int> train(n);
            istringstream sin(s);
            for(auto&v:train)sin>>v;
            //draw{
            vector<int> init(n); for(int i=0;i<n;i++) init[i]=i+1;
            //}
            stack<int> st; int now=0;
            for(int i=1;i<=n;i++){
                //draw{ 1. 初始狀態
                av.start_frame_draw();
                av.frame_draw("target", Pos(100, 200), train, { 
                    {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                    {{"mark"}, AV::AtoB(0, now - 1)} 
                });
                av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st);
                av.frame_draw("init", Pos("target", "top right", 170, 0), init, { 
                    {{"background", "#cccccc"}, AV::AtoB(0, i - 2)},
                    {{"highlight"}, {i - 1}},
                    {{"point"}, {i - 1}} 
                }, {0, n});
                av.text("先將新的車廂 " + to_string(i) + " 開進車站", Pos("init","bottom", 0, 20));
                av.auto_camera();
                av.end_frame_draw();
                //}
                st.push(i);
                //draw{ 2. 進站中
                av.start_frame_draw();
                av.frame_draw("target", Pos(100, 200), train, { 
                    {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                    {{"mark"}, AV::AtoB(0, now - 1)} 
                });
                av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st, {
                    {{"highlight"}, {(int)st.size() - 1}},
                    {{"point"}, {(int)st.size() - 1}}
                });
                av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, i - 1)} }, {0, n});
                av.arrow(Pos("init", i - 1, "center"), Pos("station", (int)st.size() - 1, "center"), {{"color", "#4CAF50"}, {"width", "4"}});
                av.text("車廂 " + to_string(i) + " 進入車站", Pos("init","bottom", 0, 20));
                av.auto_camera();
                av.end_frame_draw();
                //}
                while(st.size()){
                    //draw{ 3. 比對
                    string arrowColor = (st.top() == train[now]) ? "#4CAF50" : "#F44336";
                    av.start_frame_draw();
                    av.frame_draw("target", Pos(100, 200), train, { 
                        {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                        {{"mark"}, AV::AtoB(0, now - 1)},
                        {{"highlight"}, {now}},
                        {{"point"}, {now}}
                    });
                    av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st, {
                        {{"highlight"}, {(int)st.size() - 1}},
                        {{"point"}, {(int)st.size() - 1}}
                    });
                    av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, i - 1)} }, {0, n}); 
                    av.arrow(Pos("station", (int)st.size() - 1, "center"), Pos("target", now, "center"), {{"color", arrowColor}, {"width", "4"}});
                    av.text("比對車站最外側的車廂與目標車廂是否相同", Pos("target","bottom", 0, 20));
                    av.auto_camera();
                    av.end_frame_draw();
                    //}
                    if(st.top() == train[now]){
                        now++;
                        st.pop();
                        //draw{ 4. 成功出站更新畫面
                        av.start_frame_draw();
                        av.frame_draw("target", Pos(100, 200), train, { 
                            {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                            {{"mark"}, AV::AtoB(0, now - 1)} 
                        });
                        av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st);
                        av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, i - 1)} }, {0, n}); 
                        av.text("相同的話就可以出站", Pos("target","bottom", 0, 20));
                        av.auto_camera();
                        av.end_frame_draw();
                        //}
                    } else {
                        //draw{ 不相同
                        av.start_frame_draw();
                        av.frame_draw("target", Pos(100, 200), train, { 
                            {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                            {{"mark"}, AV::AtoB(0, now - 1)} 
                        });
                        av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st);
                        av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, i - 1)} }, {0, n}); 
                        av.text("不相同，這台車還不到出站的時候", Pos("target","bottom", 0, 20));
                        av.auto_camera();
                        av.end_frame_draw();
                        //}
                        break;
                    }
                }
                //draw{ 車站空了說明
                if (st.empty() && i < n) {
                    av.start_frame_draw();
                    av.frame_draw("target", Pos(100, 200), train, { 
                        {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                        {{"mark"}, AV::AtoB(0, now - 1)} 
                    });
                    av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st);
                    av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, i - 1)} }, {0, n});
                    av.text("車站沒車了，先去軌道拉新車", Pos("station","top", 0, -60));
                    av.auto_camera();
                    av.end_frame_draw();
                }
                //}
            }

            if(st.size()){
                //draw{ 判定失敗
                av.start_frame_draw();
                av.frame_draw("target", Pos(100, 200), train, { 
                    {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                    {{"mark"}, AV::AtoB(0, now - 1)} 
                });
                av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st);
                av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, n - 1)} }, {0, n}); 
                av.text("判定失敗，輸出 No", Pos("target","bottom", 0, 20));

                // 關鍵影格記錄 (放在 camera 之前)
                av.key_frame_draw("target", Pos(100, 200), train, { 
                    {{"background", "#cccccc"}, AV::AtoB(now, n - 1)},
                    {{"mark"}, AV::AtoB(0, now - 1)} 
                });
                av.key_frame_draw("station", Pos("target", "right", 50, n * 40 + 50), AV::to_vector(st), { {{"highlight"}, {(int)st.size() - 1}} }, {}, "stack");
                av.key_frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, n - 1)} }, {0, n}); 
                av.key_text("判定失敗，輸出 No", Pos("target","bottom", 0, 20));

                av.auto_camera();
                av.end_frame_draw();
                //}
                cout<<"No"<<endl;
            } else {
                //draw{ 判定成功
                av.start_frame_draw();
                av.frame_draw("target", Pos(100, 200), train, { {{"mark"}, AV::AtoB(0, n - 1)} });
                av.frame_draw("station", Pos("target", "right", 50, n * 40 + 50), st);
                av.frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, n - 1)} }, {0, n}); 
                av.text("判定成功，輸出 Yes", Pos("target","bottom", 0, 20));

                // 關鍵影格記錄 (放在 camera 之前)
                av.key_frame_draw("target", Pos(100, 200), train, { {{"mark"}, AV::AtoB(0, n - 1)} });
                av.key_frame_draw("station", Pos("target", "right", 50, n * 40 + 50), AV::to_vector(st), {}, {}, "stack");
                av.key_frame_draw("init", Pos("target", "top right", 170, 0), init, { {{"background", "#cccccc"}, AV::AtoB(0, n - 1)} }, {0, n}); 
                av.key_text("判定成功，輸出 Yes", Pos("target","bottom", 0, 20));

                av.auto_camera();
                av.end_frame_draw();
                //}
                cout<<"Yes"<<endl;
            }
        }
        cout<<endl;
    }
    //draw{
    av.end_draw();
    //}
    return 0;
}