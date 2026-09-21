// Binary Indexed Tree Sample
#include <bits/stdc++.h>
using namespace std;

int n;
vector<long long> num, BIT;

// @defaults
// @camera auto zoom(1.05)
// @enddefaults

// 原始數列與 Binary Indexed Tree 使用相同的二進制索引，方便上下對照。
// @preset binary_indexed_tree_view
// @object num with range(1,n), labels(value,binary-index-padded)
// @object BIT render binary indexed tree with range(1,n), labels(value,binary-index-padded)
// @place BIT.top-left at num.bottom-left offset(0,70)
// @endpreset

// position 會顯示成 Binary Indexed Tree 上的具名指標。
// @preset binary_indexed_tree_pointer_view
// @object num with range(1,n), labels(value,binary-index-padded)
// @object BIT[position] render binary indexed tree with range(1,n), labels(value,binary-index-padded)
// @place BIT.top-left at num.bottom-left offset(0,70)
// @endpreset

// 將 delta 加到 num[position] 對應的所有 Binary Indexed Tree 節點。
void add(int position, long long delta) {
    while (position <= n) {
        int lowbit = position & -position;
        int left = position - lowbit + 1;

        // @frame use binary_indexed_tree_pointer_view
        // @style num[left:position] background AV_green
        // @style BIT[position] highlight,background AV_green
        // @text "索引 ${position} 的節點涵蓋 num[${left}..${position}]，準備加上 ${delta}" at num.top offset(0,-20)

        BIT[position] += delta;

        // @frame use binary_indexed_tree_pointer_view
        // @style num[left:position] background AV_green
        // @style BIT[position] highlight,background AV_green
        // @text "目前節點更新為 ${BIT[position]}；下一個索引是 ${position + lowbit}" at num.top offset(0,-20)

        position += lowbit;
    }
}

// 計算 num[1..position] 的前綴和。
long long prefix_sum(int position) {
    long long answer = 0;
    while (position > 0) {
        int lowbit = position & -position;
        int left = position - lowbit + 1;

        // @frame use binary_indexed_tree_pointer_view
        // @style num[left:position] background AV_blue
        // @style BIT[position] highlight,background AV_blue
        // @text "目前節點代表 num[${left}..${position}]，將 ${BIT[position]} 加入前綴和" at num.top offset(0,-20)

        answer += BIT[position];

        // @frame use binary_indexed_tree_pointer_view
        // @style num[left:position] background AV_blue
        // @style BIT[position] highlight,background AV_blue
        // @text "目前前綴和是 ${answer}；下一個索引是 ${position - lowbit}" at num.top offset(0,-20)

        position -= lowbit;
    }
    return answer;
}

int main() {
    cin >> n;
    num.assign(n + 1, 0);
    BIT.assign(n + 1, 0);
    for (int i = 1; i <= n; i++) cin >> num[i];

    // @frame use binary_indexed_tree_view
    // @events animate off
    // @text "上方是原始數列；下方是尚未建構的 Binary Indexed Tree" at num.top offset(0,-20)

    // 逐點加入，因此這個建構方式的時間複雜度是 O(n log n)。
    for (int i = 1; i <= n; i++) add(i, num[i]);

    // @frame use binary_indexed_tree_view
    // @text "Binary Indexed Tree 建構完成；每個寬格代表它負責的連續區間" at num.top offset(0,-20)

    int L, R;
    cin >> L >> R;

    // @frame use binary_indexed_tree_view
    // @style num[L:R] background AV_green
    // @text "查詢 num[${L}..${R}]：計算 prefix_sum(${R}) - prefix_sum(${L - 1})" at num.top offset(0,-20)

    long long right_prefix = prefix_sum(R);
    long long left_prefix = prefix_sum(L - 1);
    long long answer = right_prefix - left_prefix;

    // @frame use binary_indexed_tree_view
    // @style num[L:R] background AV_green
    // @text "區間和 = ${right_prefix} - ${left_prefix} = ${answer}" at num.top offset(0,-20)

    cout << "sum of L to R = " << answer << '\n';
    return 0;
}
