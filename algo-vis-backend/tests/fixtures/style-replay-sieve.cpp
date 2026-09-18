#include <bits/stdc++.h>
using namespace std;
// @preset sieve_view
// @object isprime with range(1,n), columns(10), labels(index)
// @object prime with columns(10), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
// @style isprime[1:n] focus when value == 1
// @endpreset
// @preset sieve_view_i
// @object isprime[i] with range(1,n), columns(10), labels(index)
// @object prime with columns(10), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
// @style isprime[1:n] focus when value == 1
// @style prime[0:iteration.last(j)] focus when i * value <= n
// @endpreset
// @preset camera
// @camera focus isprime offset(0,40) zoom(1.1)
// @endpreset
int n=100;
vector<int> isprime(n+5,1);
vector<int> prime;
void prime_table(){
  isprime[0]=isprime[1]=0;
  // @frame use sieve_view,camera
  // @style isprime[1] highlight
  // @style isprime[1] background rgba(223,127,255)
  // @text "首先因為 1 不是{質:直}數 所以先刪掉" at isprime.top offset(0,-20)
  for(int i=2;i<=n;i++){
    if(isprime[i])prime.push_back(i);
    // @frame use sieve_view_i,camera when i<=7
    // @text "因為 {isprime[${i}]=true:${i}是直樹}\n所以將其放入 prime" at isprime.top offset(0,-20) when isprime[i]==1
    // @text "因為 {isprime[${i}]=false:${i}不是直樹}\n所以不將其放入 prime" at isprime.top offset(0,-20) when isprime[i]==0
    // @frame use sieve_view_i,camera when i>7
    // @events animate off
    // @style isprime[i] highlight
    // @for j
    //     @style isprime[i*prime[j]] highlight when i*prime[j]<=n
    //     @arrow from prime[j] to isprime[i*prime[j]] color rgba(51, 168, 51, 0.7) width 3 when i*prime[j]<=n
    // @endfor
    // @text "一次殺掉這幾個" at isprime.top offset(0,-20)
    for(int j=0;j<prime.size();j++){
      // @frame use sieve_view_i,camera when i*prime[j]<=n and i<=7
      // @style isprime[i,i*prime[j]] highlight
      // @style prime[j] highlight
      // @arrow from isprime[i] to prime[j] color rgba(13, 102, 13, 0.8) width 3
      // @arrow from prime[j] to isprime[i*prime[j]] color rgba(51, 168, 51, 0.7) width 3
      // @text "因為 ${i}{×:乘}${prime[j]}{=:等於}${i*prime[j]}\n所以殺掉 ${i*prime[j]}" at isprime.top offset(0,-20)
      if(i*prime[j]>n)break;
      isprime[i*prime[j]]=0;
      // @frame use sieve_view_i,camera when i%prime[j]==0 and j<prime.size()-1 and i<=7
      // @style isprime[i,i*prime[j+1]] highlight
      // @style prime[j+1] highlight
      // @style isprime[i*prime[j+1]] background AV_red
      // @arrow from isprime[i] to prime[j+1] color rgba(255, 0, 0, 0.7) width 3
      // @arrow from prime[j+1] to isprime[i*prime[j+1]] color rgba(255, 62, 62, 0.7) width 3
      // @text "因為 ${i}{%:除}${prime[j]}{=:等於}0\n所以後面留著給其他人殺" at isprime.top offset(0,-20)
      if(i%prime[j]==0)break;
    }
  }
}
int main(){
  cin>>n;
  // @frame use sieve_view,camera
  // @text "這是線篩的演算法視覺化範例\n是一種只需要線性時間就能完成的{質:直}數篩選法" at isprime.top offset(0,-20)
  prime_table();
  // @frame use sieve_view,camera
  // @text "線篩完成" at isprime.top offset(0,-20)
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "eventInstructionStates": {
      "assign:prime_table:isprime[i*v]=0": false,
      "assign:prime_table:isprime[1]=0": false,
      "scope-exit:prime_table:i": false,
      "assign:prime_table:isprime[i*prime[j]]=0": false,
      "assign:prime_table:isprime[1] = 0": false,
      "assign:prime_table:isprime[i * prime[j]] = 0": false
    },
    "codePanelFontSize": 14
  }
}
@asm-view */
