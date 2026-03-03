#include <bits/stdc++.h>
#include "AV.hpp"
using namespace std;
//draw{
AV av;

// 輔助繪圖函式：由外部決定 ID 與位置
void _draw_frame(const vector<int>& arr, string text, string _draw_id, Pos _draw_pos, string _draw_last_id, string _draw_layout = "heap", const vector<int>& _draw_highlights = {}, const vector<int>& _draw_marks = {}) {
    av.start_frame_draw();
    av.accu_draw();
    
    // 繪製堆積結構
    av.frame_draw(_draw_id, _draw_pos, arr, {
        {{"highlight"}, _draw_highlights},
        {{"mark"}, _draw_marks}
    }, {0}, _draw_layout, 0, 1);

    if (_draw_id != "init" && !_draw_last_id.empty()) {
        av.arrow(Pos(_draw_last_id, "bottom"), Pos(_draw_id, "top"));
    }
    
    av.text(text, Pos(_draw_id, "bottom", 0, 40));
    // 鏡頭對焦於物件底部
    av.camera(Pos(_draw_id, "bottom"), 1.5);
    av.end_frame_draw();
}
//}

void heapify(vector<int>& arr, int n, int i, const vector<int>& _draw_marks, string _draw_id, Pos _draw_pos, string _draw_last_id) {
    int largest = i;
    int l = 2 * i;
    int r = 2 * i + 1;

    if (l <= n && arr[l] > arr[largest]) largest = l;
    if (r <= n && arr[r] > arr[largest]) largest = r;

    if (largest != i) {
        //draw{
        _draw_frame(arr, "因為 " + to_string(arr[i]) + " < " + to_string(arr[largest]) + " ，所以交換位置", _draw_id, _draw_pos, _draw_last_id, "heap", {i, largest}, _draw_marks);
        //}
        swap(arr[i], arr[largest]);
        //draw{
        static bool _draw_first_swap_reason = true;
        if (2 * largest <= n) { // 還有子節點，需說明向下檢查的原因
            if (_draw_first_swap_reason) {
                _draw_frame(arr, "因為父節點下沉後可能破壞子樹的堆積性質，所以還需要繼續向下檢查", _draw_id, _draw_pos, _draw_last_id, "heap", {i, largest}, _draw_marks);
                _draw_first_swap_reason = false;
            } else {
                _draw_frame(arr, "{因為父節點下沉後可能破壞子樹的堆積性質，所以還需要}繼續向下檢查", _draw_id, _draw_pos, _draw_last_id, "heap", {i, largest}, _draw_marks);
            }
        } else {
            _draw_frame(arr, "到底了，完成交換", _draw_id, _draw_pos, _draw_last_id, "heap", {i, largest}, _draw_marks);
        }
        //}
        heapify(arr, n, largest, _draw_marks, _draw_id, _draw_pos, _draw_last_id);
    } else {
        //draw{
        if (l <= n) {
            _draw_frame(arr, "節點 " + to_string(i) + " 已大於子節點，不需交換", _draw_id, _draw_pos, _draw_last_id, "heap", {i}, _draw_marks);
        }
        //}
    }
}

void heap_sort(vector<int>& arr, int n) {
    //draw{
    vector<int> _draw_marks;
    string _draw_init_id = "init";
    Pos _draw_init_pos(350.0, 100.0);
    int _draw_y_gap = 60; // 極限緊湊垂直間距
    // 第一幀：呈現原始陣列 (Normal)
    av.start_frame_draw();
    av.frame_draw(_draw_init_id, _draw_init_pos, arr, {}, {0}, "normal", 0, 1);
    av.text("一開始的原始陣列 (1-based Indexing)", Pos(_draw_init_id, "bottom", 0, 40));
    av.auto_camera();
    av.end_frame_draw();

    av.accu_store(_draw_init_id, _draw_init_pos, arr, {}, {0}, "normal", 0, 1);

    string _draw_tree_id = "tree_intro";
    Pos _draw_tree_pos(_draw_init_id, "bottom-left", 0.0, 50.0); // 綁定在左下角，y 偏移縮減
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(_draw_tree_id, _draw_tree_pos, arr, {}, {0}, "heap", 10, 1);
    av.arrow(Pos(_draw_init_id, "bottom"), Pos(_draw_tree_id, "top"));
    av.text("為了方便看清楚陣列的關係，將它畫成樹狀圖", Pos(_draw_tree_id, "bottom", 0, 40));
    av.camera(Pos(_draw_tree_id, "bottom"), 1.5);
    av.end_frame_draw();

    av.accu_store(_draw_tree_id, _draw_tree_pos, arr, {}, {0}, "heap", 10, 1);
    av.accu_store_arrow(Pos(_draw_init_id, "bottom"), Pos(_draw_tree_id, "top"));

    // --- 建立堆積階段 ---
    string _draw_build_id = "build_heap";
    Pos _draw_build_pos(_draw_tree_id, "bottom-left", 0.0, (double)_draw_y_gap);

    _draw_frame(arr, "首先要將陣列建立成一個堆積才能開始排序，\n調整方式是從最後一個有小孩的節點開始一個一個往上調整，\n直到所有子樹都是堆積為止", _draw_build_id, _draw_build_pos, _draw_tree_id, "heap", {}, {});
    //}

    for (int i=n/2; i>=1; i--) {
        //draw{
        _draw_frame(arr, "準備調整以索引 " + to_string(i) + " 為首的子樹", _draw_build_id, _draw_build_pos, _draw_tree_id, "heap", {i}, _draw_marks);
        //}
        heapify(arr, n, i, _draw_marks, _draw_build_id, _draw_build_pos, _draw_tree_id);
    }
    // 建堆完成
    //draw{
    av.accu_store(_draw_build_id, _draw_build_pos, arr, {}, {0}, "heap", 10, 1);
    av.accu_store_arrow(Pos(_draw_tree_id, "bottom"), Pos(_draw_build_id, "top"));

    // --- 排序階段 ---
    string _draw_sort_id = "sorting_phase";
    Pos _draw_sort_pos(_draw_build_id, "bottom-left", 0.0, (double)_draw_y_gap);

    _draw_frame(arr, "進入排序階段，排序方法為 逐一提取堆頂的最大值，\n並將其換到最下面，同時維護堆積的性質", _draw_sort_id, _draw_sort_pos, _draw_build_id, "heap", {}, _draw_marks);
    //}

    for (int i=n; i>1; i--) {
        //draw{
        _draw_frame(arr, "將最大值 " + to_string(arr[1]) + " 交至目前的末端 (索引 " + to_string(i) + " 的位置)", _draw_sort_id, _draw_sort_pos, _draw_build_id, "heap", {1, i}, _draw_marks);
        //}
        swap(arr[1], arr[i]);
        
        //draw{
        _draw_marks.push_back(i);
        _draw_frame(arr, "標記 " + to_string(arr[i]) + " 已排序，並向下維護堆積", _draw_sort_id, _draw_sort_pos, _draw_build_id, "heap", {i}, _draw_marks);
        //}
        heapify(arr, i - 1, 1, _draw_marks, _draw_sort_id, _draw_sort_pos, _draw_build_id);
    }
    //draw{
    _draw_marks.push_back(1);
    
    // 1. 堆積佈局完成影格
    av.start_frame_draw();
    av.accu_draw();
    av.frame_draw(_draw_sort_id, _draw_sort_pos, arr, {{{"mark"}, AV::AtoB(1, n)}}, {0}, "heap", 10, 1);
    av.arrow(Pos(_draw_build_id, "bottom"), Pos(_draw_sort_id, "top"));
    av.text("排序階段完成", Pos(_draw_sort_id, "bottom", 0, 40));
    av.camera(Pos(_draw_sort_id, "bottom"), 1.5);
    av.end_frame_draw();
    
    // 存入累積
    av.accu_store(_draw_sort_id, _draw_sort_pos, arr, {{{"mark"}, AV::AtoB(1, n)}}, {0}, "heap", 10, 1);
    av.accu_store_arrow(Pos(_draw_build_id, "bottom"), Pos(_draw_sort_id, "top"));

    // 2. 映射回 Normal 陣列佈局 (往下拉一行)
    string _draw_final_id = "final_result";
    Pos _draw_final_pos(_draw_sort_id, "bottom-left", 0.0, (double)_draw_y_gap);
    _draw_frame(arr, "最後重新畫回一般的陣列形狀", _draw_final_id, _draw_final_pos, _draw_sort_id, "normal", {}, AV::AtoB(1, n));
    
    // 存入累積
    av.accu_store(_draw_final_id, _draw_final_pos, arr, {{{"mark"}, AV::AtoB(1, n)}}, {0}, "normal", 0, 1);
    av.accu_store_arrow(Pos(_draw_sort_id, "bottom"), Pos(_draw_final_id, "top"));

    // 3. 最終總計畫面
    av.start_frame_draw();
    av.accu_draw();
    av.text("Heap Sort 完成！", Pos(_draw_init_id, "top", 0.0, -50.0));
    av.auto_camera();
    av.end_frame_draw();
    //}
}

int main() {
    int n; cin>>n;
    vector<int> arr(n+1);
    for (int i=1; i<=n; i++) cin>>arr[i];
    //draw{
    av.start_draw();
    //}
    heap_sort(arr, n);
    //draw{
    av.end_draw();
    //}

    return 0;
}
