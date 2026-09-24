#include <bits/stdc++.h>
using namespace std;

// 每次 fibonacci 呼叫會成為遞迴樹的一個節點。
// 父子關係與左右順序由實際的遞迴 activation 自動建立。
// @layout recursion as "fib_tree" at canvas.top offset(0,80)
// @layout fib_tree direction top-down
// @layout fib_tree mode compact
// @layout fib_tree sibling-gap 32
// @layout fib_tree level-gap 88
// @layout fib_tree degree 2

int fibonacci(int n) {
    int value = n;

    // 先保存目前呼叫，讓後續兩個遞迴呼叫接在它的下方。
    // 節點下方的 F 與格內的 n 合起來表示 F(n)。
    // @keep value as "F" in fib_tree
    // @frame value in fib_tree
    // @let call = n
    // @text "進入 F(${call})" at value.bottom

    if (n <= 1) {
        // 基底節點的初始值就是回傳值，不需要再建立另一個畫面物件。
        return value;
    }

    int left = fibonacci(n - 1);
    int right = fibonacci(n - 2);
    value = left + right;

    // 不另外畫 left、right 或 result；直接更新目前 activation 的節點。
    // @keep value as "F" in fib_tree
    // @frame value in fib_tree
    // @let call = n
    // @text "F(${call}) 回傳 ${value}" at value.bottom
    return value;
}

int main() {
    int n;
    cin >> n;

    int result = fibonacci(n);
    cout << result << '\n';
    return 0;
}
