#include <bits/stdc++.h>
using namespace std;

// @preset completed_view
// @object nums
// @text "${prime[0:iteration.last(j)]}" as completed
// @endpreset

int main() {
    int nums[4] = {10,20,30,40};
    vector<int> prime = {2,3,5,7};
    vector<int> empty;
    vector<vector<int>> matrix = {{2,3},{5,7}};
    vector<string> words = {"a","b"};
    int factor = 11;
    // @frame nums
    // @text "${factor}*${prime}" as full
    // @text "${prime[1:2]}" as slice
    // @text "${nums[:]}" as c_array
    // @text "${matrix}" as nested
    // @text "${words}" as strings
    // @text "${empty}" as empty_array
    // @text [{"text":"範圍：${prime[1:2]}","color":"AV_green","fontSize":18}] as json_text
    // @text "{${factor}*${prime}:質數清單 ${prime[1:2]}}" as spoken
    for (int i=2; i<=3; i++) {
        // @frame use completed_view
        // @for k in [0:1]
        //     @text "${matrix[k][:]}" as row
        // @endfor
        for (int j=0; j<i; j++) {
            // @frame nums
        }
    }
    prime.push_back(11);
    // @frame nums
    // @text "${factor}*${prime}" as full
}
