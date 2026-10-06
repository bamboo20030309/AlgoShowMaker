#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for(auto&v:arr)cin>>v;
    // @frame arr
    // @text "Selection Sort (選擇排序{ - 選小})\n每一輪在未排序部分找最小值，並與未排序部分的第一個位置交換來排序的排序法" at arr.top
    // @camera focus arr zoom(2.0)
    for (int i=0; i<n-1; i++) {
        int min_idx = i;
        // @frame arr[i,min_idx]
        // @text "設第 i 個元素為 {min_idx:目前最小值}" at arr.bottom
        // @camera focus arr zoom(2.0)
        for (int j=i+1; j<n; j++) {
            if (arr[j] < arr[min_idx]) {
                min_idx = j;
                // @frame arr[i,min_idx,j]
                // @text "第 ${prev(min_idx)} 格比 第 ${j} 格元素小 將 {min_idx:目前最小值} 移動到 j" at arr.bottom
                // @camera focus arr zoom(2.0)
            }
            // @frame arr[i,min_idx,j] when arr[min_idx]<arr[j]
            // @text "第 ${min_idx} 格沒比 第 ${j} 格元素小" at arr.bottom when arr[min_idx]<arr[j]
            // @camera focus arr zoom(2.0)
        }
        if (min_idx != i) {
            swap(arr[min_idx], arr[i]);
        }
        // @frame arr[min_idx,i]
        // @text "將第 ${i} 格與第 ${min_idx} 格交換 完成前 ${i+1} 個元素的排序" at arr.bottom when min_idx!=i
        // @text "自己就是最小值不用交換" at arr.bottom when min_idx==i
        // @exit min_idx,i
        // @keep last
        // @camera focus arr zoom(2.0)
    }
    // @frame arr
    // @text "Selection Sort 完成" at arr.bottom
    // @camera auto
    return 0;
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":true,"autoLoopBoundaryEnabled":false},"frameMaps":{"objectStyles":[{"allFrames":true,"value":{"studio:auto-frame-binding-main:min_idx@341-main:arr@100-1":{"fill":"#ff5858","stroke":"#333333"},"studio:auto-frame-binding-main:min_idx@341-main:arr@100-0":{"fill":"#ff5151","stroke":"#333333"}}}]}},"variableReferences":{"main:arr@100":{"name":"arr","functionName":"main"},"main:min_idx@341":{"name":"min_idx","functionName":"main"}}}
@asm-view */
