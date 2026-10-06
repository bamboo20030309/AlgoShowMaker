#include <bits/stdc++.h>
using namespace std;

// @layout linear as merge_passes at canvas.center
// @layout merge_passes direction top-down
// @layout merge_passes align center
// @layout merge_passes gap 70

// @preset merge_step
// @object num[l,r] with range(0,n-1) in merge_passes
// @object temp with range(0,n-1)
// @place temp.top-left at num.bottom-left offset(0,72)
// @endpreset

void mergesort(vector<int>& num, int n) {

    // @frame num with range(0,n-1) in merge_passes
    // @text "這是倍增版的 Merge Sort 範例\n一開始，每個元素都是長度為 1 的有序區間" at num.bottom
    // @keep num as "original" in merge_passes

    for (int width = 1; width < n; width = width * 2) {
        // @frame num with range(0,n-1) in merge_passes
        // @text "本輪把相鄰的長度 ${width} 區間兩兩合併" at num.bottom

        vector<int> temp;

        for (int L = 0; L < n; L = L + width * 2) {
            int mid = (L + width < n ? L + width : n);
            int R = (L + width * 2 < n ? L + width * 2 : n);
            int l = L, r = mid;

            // @frame use merge_step
            // @style num[L:mid-1] background AV_blue
            // @style num[mid:R-1] background AV_yellow when mid < R
            // @text "合併藍色區間 [${L}{：:到}${mid-1}] 與黃色區間 [${mid}{：:到}${R-1}]" at temp.bottom

            while (l < mid && r < R) {
                if (num[l] <= num[r]) {
                    temp.push_back(num[l]);
                    l++;
                } else {
                    temp.push_back(num[r]);
                    r++;
                }

                // @frame use merge_step
                // @style num[L:mid-1] background AV_blue
                // @style num[mid:R-1] background AV_yellow
                // @style temp[L:n-1] background AV_green!
                // @text "比較兩側開頭，較小值寫入 temp" at temp.bottom
            }

            while (l < mid) {
                temp.push_back(num[l]);
                l++;
                // @frame use merge_step
                // @style num[L:mid-1] background AV_blue
                // @style num[mid:R-1] background AV_yellow when mid < R
                // @style temp[L:n-1] background AV_green!
                // @text "右半邊已取完，補上左半邊" at temp.bottom
            }
            while (r < R) {
                temp.push_back(num[r]);
                r++;
                // @frame use merge_step
                // @style num[L:mid-1] background AV_blue
                // @style num[mid:R-1] background AV_yellow when mid < R
                // @style temp[L:n-1] background AV_green!
                // @text "左半邊已取完，補上右半邊" at temp.bottom
            }
        }

        num = temp;

        // @keep num as "merge pass" in merge_passes
        // @frame num with range(0,n-1) in merge_passes
        // @for block in [0:n-1] step width*2
        // @style num[block:block+width-1] background AV_blue
        // @style num[block+width:block+width*2-1] background AV_yellow when block+width < n
        // @endfor
        // @text "長度 ${width} 的合併輪次完成，結果寫回 num" at num.bottom
    }

    // @frame num with range(0,n-1) in merge_passes
    // @text "Merge Sort 完成" at num.bottom

}

int main() {
    int n;
    cin >> n;
    vector<int> num(n);
    for (int i = 0; i < n; i++) cin >> num[i];

    mergesort(num, n);

    for (int i = 0; i < n; i++) cout << num[i] << ' ';
    cout << '\n';
    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "codePanelFontSize": 11,
    "eventInstructionStates": {
      "return:main:return 0;": false,
      "output:main:cout << '\\n';": false,
      "output:main:cout << num[i] << ' ';": false
    },
    "eventSettings": {
      "autoFixedEnabled": false,
      "autoLoopBoundaryEnabled": false
    }
  }
}
@asm-view */
