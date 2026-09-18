#include <bits/stdc++.h>
using namespace std;

// @preset compact_sieve
// @object isprime with columns(10), labels(index)
// @object prime with labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
// @events animate off
// @arrow for j in "sieve_loop"
//   from prime[j].top to isprime[i*prime[j]].bottom
//   as "sieve_links" color AV_green when i*prime[j] <= n
// @endpreset

int main() {
  int n=30;
  vector<int> isprime(n+1,1), prime;
  isprime[0]=isprime[1]=0;
  // @frame isprime,prime
  for(int i=2;i<=n;i++) {
    if(isprime[i]) prime.push_back(i);
    // @frame use compact_sieve when i>7
    // @loop as "sieve_loop"
    for(int j=0;j<prime.size();j++) {
      if(i*prime[j]>n) break;
      isprime[i*prime[j]]=0;
      // @frame isprime[i],prime when i<=7
      if(i%prime[j]==0) break;
    }
  }
  // @frame isprime,prime
  return 0;
}
