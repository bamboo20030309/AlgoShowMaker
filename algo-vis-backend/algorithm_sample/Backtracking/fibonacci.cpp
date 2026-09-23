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
    string call = "F(" + to_string(n) + ")";

    // 先保存目前呼叫，讓後續兩個遞迴呼叫接在它的下方。
    // @frame call in fib_tree
    // @text "進入 ${call}" at call.bottom
    // @keep last as "call" in fib_tree

    if (n <= 1) {
        int result = n;

        // @frame result at canvas.top-left offset(120,100)
        // @text "${call} 命中基底條件，回傳 ${result}" at result.bottom
        return result;
    }

    int left = fibonacci(n - 1);
    int right = fibonacci(n - 2);
    int result = left + right;

    // @frame left,right,result at canvas.top-left offset(120,100)
    // @text "${call} = ${left} + ${right} = ${result}" at result.bottom
    return result;
}

int main() {
    int n;
    cin >> n;

    // @frame n
    // @text "用遞迴計算費氏數列 F(${n})" at n.bottom

    int result = fibonacci(n);

    // @frame result at canvas.top-left offset(120,100)
    // @text "F(${n}) 的答案是 ${result}" at result.bottom

    cout << result << '\n';
    return 0;
}
