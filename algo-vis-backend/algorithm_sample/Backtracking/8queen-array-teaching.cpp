#include <bits/stdc++.h>
using namespace std;
int N, ans=0;
vector<vector<int>> board;
// @layout recursion as "array_tree"
// @layout array_tree branch-previews off
// @preset array_scene
// @object board render matrix with labels(none), display("${value ? '♕' : '　'}") in array_tree
// @style board background grey when value == 1
// @object L, M, R
// @place L.top-left at board.top-right offset(40,0)
// @place M.top-left at L.bottom-left offset(0,25)
// @place R.top-left at M.bottom-left offset(0,25)
// @style L, M, R background AV_red when value == 1
// @endpreset
// @defaults
// @camera focus board
// @enddefaults
void dfs(int row, vector<int> L, vector<int> M, vector<int> R) {
    // @keep board as "Q" in array_tree use array_scene
    // @frame use array_scene
    // @style board[row][0:N-1] background AV_green when !(L[column] || M[column] || R[column])
    // @style board[row][0:N-1] background AV_red when L[column] || M[column] || R[column]
    // @text "第 ${row} 列：只嘗試尚未受到攻擊的欄位" at board.top when row < N
    // @text "每一列都已放置皇后，找到一組解" at board.top when row == N
    if(row==N) { ans++; return; }
    // @code hide
    bool has_move=false;
    // @endcode
    for(int col=0;col<N;col++) {
        if(L[col] || M[col] || R[col]) continue;
        // @code hide
        has_move=true;
        // @endcode
        board[row][col]=1;
        vector<int> nextL(N,0), nextM=M, nextR(N,0);
        // 左斜方攻擊
        for(int j=0;j<N;j++) {
            if(j+1<N) nextL[j]=L[j+1];
        }
        // 新皇后會攻擊下一列的左一欄。
        if(col>0) nextL[col-1]=1;
        // 直線攻擊
        nextM[col]=1;
        // 右斜方攻擊
        for(int j=0;j<N;j++) {
            if(j>0) nextR[j]=R[j-1];
        }
        // 新皇后會攻擊下一列的右一欄。
        if(col+1<N) nextR[col+1]=1;
        // @frame use array_scene
        // @object nextL, nextM, nextR
        // @place nextL.top-left at L.top-right offset(30,0)
        // @place nextM.top-left at M.top-right offset(30,0)
        // @place nextR.top-left at R.top-right offset(30,0)
        // @style nextL, nextM, nextR background AV_red when value == 1
        // @style board[row+1][0:N-1] background AV_green when !(nextL[column] || nextM[column] || nextR[column])
        // @style board[row+1][0:N-1] background AV_red when nextL[column] || nextM[column] || nextR[column]
        // @style board[row][col] highlight
        // @text "放置皇后後，逐格計算下一列的攻擊狀態" at board.top
        dfs(row+1,nextL,nextM,nextR);
        board[row][col]=0;
        // @frame use array_scene
        // @text "移除第 ${row} 列的皇后，繼續嘗試下一欄" at board.top
    }
    // @frame use array_scene when !has_move
    // @text "第 ${row} 列沒有可放皇后的位置，這個分支無法完成。\n返回上一列，嘗試其他欄位。" at board.top
}
int main() {
    N=4; cin>>N;
    board.assign(N,vector<int>(N,0));
    dfs(0,vector<int>(N,0),vector<int>(N,0),vector<int>(N,0));
    // @frame
    // @camera auto
    // @text "已搜尋所有分支，共 ${ans} 組解" at array_tree.top
    cout<<"Total Solutions: "<<ans<<endl;
    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventInstructionStates": {
      "return:dfs:return;": false,
      "declare:dfs:L": false,
      "declare:dfs:M": false,
      "declare:dfs:R": false,
      "assign:dfs:nextM = M": false,
      "declare:dfs:nextM": false,
      "declare:dfs:nextR": false,
      "declare:dfs:nextL": false
    },
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
