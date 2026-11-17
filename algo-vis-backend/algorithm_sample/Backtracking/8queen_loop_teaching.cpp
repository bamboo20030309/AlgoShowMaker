#include <bits/stdc++.h>
using namespace std;
int main() {
    int N=4; cin>>N;
    vector<int> pos(N,0);
    int ans=0, attempt=0;
    bool more=true;
    // @code hide
    vector<vector<int>> board(N,vector<int>(N,0));
    // @endcode
    // @preset board_view
    // @object board render matrix with labels(none), display("${value ? '♕' : '　'}")
    // @object pos
    // @pointer r,c at pos
    // @place pos.top-left at board.top-right offset(60,0)
    // @style board background grey when value == 1
    // @endpreset
    while(more) {
        ++attempt;
        bool valid=true;
        int r=0,c=0;
        for(r=0;r<N && valid;r++) {
            for(c=0;c<r;c++) {
                if(pos[c]==pos[r] || abs(pos[c]-pos[r])==r-c) {
                    valid=false;
                    break;
                }
            }
        }
        if(valid) ans++;
        // @code hide
        board.assign(N,vector<int>(N,0));
        for(int row=0;row<N;row++) board[row][pos[row]]=1;
        // @endcode
        // 每一組配置各自成幀，避免未取幀的迴圈事件累積到合法解。
        // @frame use board_view
        // @text "第 ${attempt} 組：有皇后互相攻擊，繼續下一組" at board.top when !valid
        // @text "第 ${attempt} 組：找到一組解，累計 ${ans} 組" at board.top when valid
        // @style board background AV_red when value == 1 && !valid
        int row=N-1;
        while(row>=0 && ++pos[row]==N) {
            pos[row]=0;
            row--;
        }
        more=row>=0;
    }
    // @frame
    // @object board render matrix with labels(none), display("${value ? '♕' : '　'}")
    // @object pos
    // @place pos.top-left at board.top-right offset(60,0)
    // @text "全部 ${attempt} 組配置檢查完成，共 ${ans} 組解" at board.top
    cout<<"Total Solutions: "<<ans<<endl;
    return 0;
}

// 教學播放以每組完整配置為一步；內部賦值與暫存物件事件仍保留，可在 Studio 開啟。
/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventInstructionStates": {
      "assign:main:c=0": true,
      "assign:main:r=0": false,
      "compare:main:c < r": false
    },
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false,
      "readHighlightEnabled": false,
      "readHighlightColor": "red"
    }
  }
}
@asm-view */
