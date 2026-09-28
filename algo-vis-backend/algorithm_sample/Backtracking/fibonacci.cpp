/*
 * 範例：遞迴費波那契
 *
 * 用途與核心步驟：示範 F(n)=F(n-1)+F(n-2) 的呼叫樹、基本情況與回傳合併過程。
 * 輸入、輸出與複雜度：輸入非負整數 n；輸出 F(n)。未記憶化版本時間 O(2^n)、呼叫堆疊 O(n)。
 *
 * 視覺化約定：`@frame`、`@layout`、`@style` 等註解由 AlgoShowMaker
 * 分析器讀取；它們描述畫面切點與呈現方式，不參與 C++ 演算法運算。
 */

#include <bits/stdc++.h>
using namespace std;

// 每次 F 呼叫會成為遞迴樹的一個節點。
// 父子關係與左右順序由實際的遞迴 activation 自動建立。
// @layout recursion as "fib_tree" at canvas.top offset(0,80)
// @layout fib_tree branch-previews off

// ─────────────────────────────────────────────────────────────────────────────
// 演算法與視覺化輔助程序：前者維護核心不變條件，後者只建立展示資料。
// ─────────────────────────────────────────────────────────────────────────────

int F(int n) {
    // 先保存目前呼叫，讓後續兩個遞迴呼叫接在它的下方。
    // 節點下方的 F 與格內的 n 合起來表示 F(n)。
    // @keep n as "F" in fib_tree
    // @frame n in fib_tree with display("F(${call})")
    // @let call = n
    // @text "目前呼叫 F(${call})" at n.bottom

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

// ─────────────────────────────────────────────────────────────────────────────
// 範例入口：準備輸入與初始畫面，執行核心算法，最後輸出結果／收尾畫面。
// ─────────────────────────────────────────────────────────────────────────────

int main() {
    int n;
    cin >> n;

    int result = F(n);
    cout << result << '\n';
    return 0;
}
