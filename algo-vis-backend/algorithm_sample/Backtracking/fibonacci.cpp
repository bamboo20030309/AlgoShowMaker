#include <bits/stdc++.h>
using namespace std;

// 每次 F 呼叫會成為遞迴樹的一個節點。
// 父子關係與左右順序由實際的遞迴 activation 自動建立。
// @layout recursion as "fib_tree" at canvas.top offset(0,80)
// @layout fib_tree direction top-down
// @layout fib_tree mode compact
// @layout fib_tree sibling-gap 32
// @layout fib_tree level-gap 88
// @layout fib_tree degree 2
// @layout fib_tree flow-arrows on

int F(int n) {
    // 先保存目前呼叫，讓後續兩個遞迴呼叫接在它的下方。
    // 節點下方的 F 與格內的 n 合起來表示 F(n)。
    // @keep n as "F" in fib_tree
    // @frame n in fib_tree with display("F(${call})")
    // @let call = n
    // @text "進入 F(${call})" at n.bottom

    if (n <= 1) {
        // @keep n as "F" in fib_tree
        // @frame n in fib_tree
        // @let call = n
        // @text "到底了回傳 ${n}" at n.bottom
        return n;
    }

    // 分成兩個敘述，明確保證左子樹完整返回後才呼叫右子樹。
    // left、right 沒有 @keep，因此不會額外畫在畫布上。
    int left = F(n - 1);
    int right = F(n - 2);
    int sum = left + right;

    // 不另外畫 left、right 或 result；直接更新目前 activation 的節點。
    // @keep sum as "F" in fib_tree
    // @frame sum in fib_tree
    // @let call = n
    // @text "F(${call}) 回傳 ${sum}" at sum.bottom
    return sum;
}

int main() {
    int n;
    cin >> n;

    int result = F(n);
    cout << result << '\n';
    return 0;
}
