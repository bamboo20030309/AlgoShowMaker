#include <bits/stdc++.h>
using namespace std;
int N;
unsigned long long solutions, work;
chrono::steady_clock::time_point started;
bool expired() {
    ++work;
    return (work & 4095) == 0 && chrono::duration<double>(chrono::steady_clock::now()-started).count() >= 5;
}
struct Limit {};
void array_dfs(int row, const vector<int>& L, const vector<int>& M, const vector<int>& R) {
    if (expired()) throw Limit();
    if (row == N) { ++solutions; return; }
    for (int c=0;c<N;++c) {
        if (L[c] || M[c] || R[c]) continue;
        vector<int> nextL(N), nextM=M, nextR(N);
        nextM[c]=1;
        for (int j=0;j<N;++j) {
            if (j+1<N) nextL[j]=L[j+1] || j+1==c;
            if (j>0) nextR[j]=R[j-1] || j-1==c;
        }
        array_dfs(row+1,nextL,nextM,nextR);
    }
}
void bit_dfs(unsigned long long L, unsigned long long M, unsigned long long R, unsigned long long all) {
    if (expired()) throw Limit();
    if (M == all) { ++solutions; return; }
    unsigned long long P=all & ~(L|M|R);
    while(P) {
        unsigned long long p=P & -P;
        P ^= p;
        bit_dfs((L|p)<<1,M|p,(R|p)>>1,all);
    }
}
void loop_solve() {
    vector<int> pos(N);
    bool more=true;
    while(more) {
        if(expired()) throw Limit();
        bool valid=true;
        for(int r=0;r<N && valid;++r)
            for(int k=0;k<r;++k)
                if(pos[k]==pos[r] || abs(pos[k]-pos[r])==r-k) { valid=false; break; }
        if(valid) ++solutions;
        int row=N-1;
        while(row>=0 && ++pos[row]==N) { pos[row]=0; --row; }
        more=row>=0;
    }
}
int main(int argc,char**argv) {
    if(argc!=3) return 2;
    string method=argv[1]; N=atoi(argv[2]);
    started=chrono::steady_clock::now(); bool complete=true;
    try {
        if(method=="loop") loop_solve();
        else if(method=="array") array_dfs(0,vector<int>(N),vector<int>(N),vector<int>(N));
        else if(method=="bits") bit_dfs(0,0,0,(1ULL<<N)-1);
        else return 2;
    } catch(Limit&) { complete=false; }
    double seconds=chrono::duration<double>(chrono::steady_clock::now()-started).count();
    cout<<"{\"method\":\""<<method<<"\",\"n\":"<<N<<",\"complete\":"<<(complete?"true":"false")
        <<",\"seconds\":"<<setprecision(8)<<seconds<<",\"solutions\":"<<solutions<<",\"work\":"<<work<<"}"<<endl;
}
