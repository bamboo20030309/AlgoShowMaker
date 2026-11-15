#include <bits/stdc++.h>
using namespace std;

/**
 * 維護以 i 為根節點的最大堆積。
 *
 * arr：使用 1-based index 的陣列，arr[0] 不使用
 * n：目前堆積的有效範圍為 arr[1...n]
 * i：準備向下調整的節點
 */

// @default 
// @camera focus arr zoom(1.6)
// @enddefault 

void heapify(vector<int>& arr, int n, int i) {
    // 假設目前節點 i 是三者之中最大的
    int Size=arr.size()-1;
    int largest = i;

    // 1-based heap 的左右子節點
    int l = 2 * i;
    int r = 2 * i + 1;

    // 如果左子節點存在，而且比目前最大值大
    // 就將最大值的位置改成左子節點
    if (l <= n && arr[l] > arr[largest]) {
        largest = l;
    }

    // 如果右子節點存在，而且比目前最大值大
    // 就將最大值的位置改成右子節點
    if (r <= n && arr[r] > arr[largest]) {
        largest = r;
    }

    // 最大值不在根節點時，需要交換並繼續向下調整
    if (largest != i) {
        // 顯示交換前的 heap
        // i 與 largest 會成為陣列上的註標
        // @frame arr render heap with range(1,Size) at keep.bottom offset(0,40)
        // @pointer i at arr
        // @pointer largest at arr
        // @style arr[i] highlight red
        // @style arr[i*2]   highlight red when arr[i*2]>arr[i*2+1]
        // @style arr[i*2+1] highlight red when arr[i*2]<arr[i*2+1]
        // @style arr[1:n] focus when n < Size
        // @text "左子節點比父節點還大" at arr.bottom when arr[l]>=arr[r]
        // @text "右子節點比父節點還大" at arr.bottom when arr[l]<arr[r]
        
        swap(arr[i], arr[largest]);

        // 顯示交換後的 heap
        // @frame arr render heap with range(1,Size) at keep.bottom offset(0,40)
        // @pointer i at arr
        // @pointer largest at arr
        // @style arr[i] highlight red
        // @style arr[i*2]   highlight red when i*2   == largest
        // @style arr[i*2+1] highlight red when i*2+1 == largest
        // @style arr[1:n] focus when n < Size
        // @text "將最大的換上來" at arr.bottom when largest * 2 > n
        // @text "將最大的換上來，\n因為父節點下沉後可能破壞子樹的堆積性質，所以還需要繼續向下檢查" at arr.bottom when largest * 2 <= n

        // 交換後，原本的 arr[i] 被放到 largest
        // 因此要繼續檢查 largest 的子樹
        heapify(arr, n, largest);
    }

    // 顯示這次 heapify 完成後的狀態
    // 注意：沒有交換時也會產生這一幀
    // @frame arr render heap with range(1,Size) when largest == i at keep.bottom offset(0,40)
    // @pointer i at arr
    // @pointer largest at arr
    // @style arr[i] highlight red when largest == i
    // @style arr[1:n] focus when n < Size and largest == i
    // @text "節點 ${i} 已大於子節點，不需交換" at arr.bottom
}

/**
 * 使用最大堆積進行排序。
 *
 * 排序過程分成兩個階段：
 * 1. 將原始陣列建立成最大堆積
 * 2. 不斷取出根節點的最大值，放到陣列尾端
 */
void heap_sort(vector<int>& arr, int n) {
    // 顯示建立 heap 前的陣列
    // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
    // @text "首先要將陣列建立成一個堆積才能開始排序，\n調整方式是從最後一個有小孩的節點開始一個一個往上調整，\n直到所有子樹都是堆積為止" at arr.bottom

    /*
     * 第一階段：建立最大堆積。
     *
     * index > n/2 的節點都是葉節點，不需要向下調整，
     * 所以從最後一個非葉節點 n/2 開始往前執行 heapify。
     */
    for (int i = n / 2; i >= 1; i--) {
        // 顯示目前準備調整的根節點 i
        // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
        // @pointer i at arr
        // @style arr[i] highlight red
        // @text "準備調整以 ${i} 為首的子樹" at arr.bottom
        heapify(arr, n, i);
    }

    // 顯示最大堆積建立完成
    // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
    // @text "完成將陣列調整成堆積樹" at arr.bottom

    // 保存建立完成的 heap，名稱為 round
    // @keep arr as "build_heap"

    /*
     * 第二階段：依序取出最大值。
     *
     * 最大堆積的根節點 arr[1] 是目前最大值。
     * 將它與有效範圍最後一格 arr[i] 交換，
     * 接著縮小 heap 的有效範圍，再重新維護最大堆積。
     */
    // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
    // @text "進入排序階段，排序方法為 逐一提取堆頂的最大值，\n並將其換到最下面，同時維護堆積的性質" at arr.bottom
    for (int i = n; i > 1; i--) {
        // 顯示最大值即將和尾端交換
        // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
        // @pointer 1 at arr
        // @pointer i at arr
        // @style arr[1,i] highlight red
        // @style arr[1:i] focus
        // @text "將最大值 ${arr[i]} 換到目前的末端 (索引 ${i}})" at arr.bottom
        
        // 將目前最大值放到已排序區域的最前端
        swap(arr[1], arr[i]);

        // 顯示最大值移到尾端後的狀態
        // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
        // @pointer 1 at arr
        // @pointer i at arr
        // @style arr[i] highlight red
        // @style arr[1:i-1] focus
        // @text "標記 ${arr[i]} 已排序，並向下維護堆積" at arr.bottom

        // arr[i] 已完成排序，因此只維護 arr[1...i-1]
        heapify(arr, i - 1, 1);
    }

    // 顯示 heap sort 完成
    // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)
    // @text "排序階段完成" at arr.bottom

    // 保存排序完成的狀態
    // @keep arr as "sorting_phase"
}

int main() {
    int n; cin>>n;

    // 多配置一格，讓資料使用 arr[1...n]
    // arr[0] 是未使用的佔位元素
    vector<int> arr(n + 1);

    // 讀入 n 個元素
    for (int i = 1; i <= n; i++)cin >> arr[i];

    // 顯示原始陣列
    // @frame arr at canva.top offset(0,80)
    // @style arr[0] background AV_grey
    // @text "Heap Sort (堆積排序 - 挑大)\n先將陣列建立成堆積，再逐一提取最大值並排序的方法" at arr.top
    // @camera auto zoom(1.6)

    // 保存原始陣列狀態
    // @keep arr as "init"
    
    // 顯示樹狀陣列
    // @frame arr render heap with range(1,n) at keep.bottom offset(0,40)

    // 保存樹狀陣列狀態
    // @keep arr as "tree_intro"
    // @text "為了方便看清楚陣列的關係，將它畫成樹狀圖" at arr.bottom

    heap_sort(arr, n);

    // 顯示最後排序結果
    // @frame arr at keep.bottom offset(0,40)
    // @style arr[0] background AV_grey
    // @text "最後重新畫回一般的陣列形狀" at arr.bottom

    // 顯示最後排序結果
    // @frame arr at keep.bottom offset(0,40)
    // @style arr[0] background AV_grey
    // @text "Heap Sort 完成！" at init.top
    // @camera auto zoom(1.6)

    return 0;
}