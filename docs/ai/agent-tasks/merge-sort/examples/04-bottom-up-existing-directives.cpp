#include <bits/stdc++.h>
using namespace std;

using ll = long long;

vector<ll> num(500005, 0);

// 比較過程固定顯示原陣列與暫存陣列，避免每一幀重複寫位置設定。
// @preset merge_step
// @object num with range(0,n-1) at canvas.top offset(0,80)
// @object temp with range(0,n-1) at num.bottom offset(0,72)
// @pointer left at num
// @pointer right at num
// @pointer t at temp
// @endpreset

void mergesort(ll n) {
    // num 是 long long，temp 也必須使用 long long，避免大數被截斷。
    vector<ll> temp(n);
    ll sum = 0;

    // @frame num with range(0,n-1) at canvas.top offset(0,80)
    // @text "一開始，每個元素各自是一個長度為 1 的有序區間" at num.bottom

    for (ll width = 1; width < n; width <<= 1) {
        ll t = 0;

        // @frame num with range(0,n-1) at canvas.top offset(0,80)
        // @text "本輪把相鄰的長度 ${width} 區間兩兩合併" at num.bottom

        for (ll L = 0; L < n; L += (width << 1)) {
            ll mid = min(L + width, n);
            ll R = min(L + (width << 1), n);
            ll left = L;
            ll right = mid;

            // @frame use merge_step
            // @style num[L:mid-1] background AV_blue
            // @style num[mid:R-1] background AV_yellow when mid < R
            // @text "合併藍色區間 [${L}:${mid-1}] 與黃色區間 [${mid}:${R-1}]" at temp.bottom

            while (left < mid && right < R) {
                if (num[left] <= num[right]) {
                    temp[t] = num[left];

                    // @frame use merge_step
                    // @style num[L:mid-1] background AV_blue
                    // @style num[mid:R-1] background AV_yellow
                    // @style temp[L:t] background AV_green!
                    // @text "左邊較小，放入暫存陣列" at temp.bottom

                    left++;
                } else {
                    temp[t] = num[right];
                    sum += mid - left;

                    // @frame use merge_step
                    // @style num[L:mid-1] background AV_blue
                    // @style num[mid:R-1] background AV_yellow
                    // @style temp[L:t] background AV_green!
                    // @text "右邊較小，放入暫存陣列；新增 ${mid-left} 組逆序對" at temp.bottom

                    right++;
                }
                t++;
            }

            while (left < mid) {
                temp[t] = num[left];

                // @frame use merge_step
                // @style num[L:mid-1] background AV_blue
                // @style num[mid:R-1] background AV_yellow when mid < R
                // @style temp[L:t] background AV_green!
                // @text "右半邊已取完，依序補上左半邊" at temp.bottom

                left++;
                t++;
            }

            while (right < R) {
                temp[t] = num[right];

                // @frame use merge_step
                // @style num[L:mid-1] background AV_blue
                // @style num[mid:R-1] background AV_yellow
                // @style temp[L:t] background AV_green!
                // @text "左半邊已取完，依序補上右半邊" at temp.bottom

                right++;
                t++;
            }
        }

        for (ll j = 0; j < n; j++) {
            num[j] = temp[j];
        }

        // @frame
        // @object num with range(0,n-1) at canvas.top offset(0,80)
        // @object temp with range(0,n-1) at num.bottom offset(0,72)
        // @style num[0:n-1] background AV_green!
        // @text "每側長度 ${width} 的合併輪次完成，結果寫回 num" at temp.bottom
        // @keep num as "merge pass"
    }

    // @frame num with range(0,n-1) at canvas.top offset(0,80)
    // @style num[0:n-1] background AV_green!
    // @text "排序完成；逆序對數量為 ${sum}" at num.bottom

    cout << sum << '\n';
}

int main() {
    ll n;
    cin >> n;
    for (ll i = 0; i < n; i++) cin >> num[i];

    mergesort(n);

    for (ll i = 0; i < n; i++) cout << num[i] << ' ';
    cout << '\n';
    return 0;
}
