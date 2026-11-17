#include <bits/stdc++.h>
using namespace std;

void quick_sort(vector<int>& arr, int low, int high) {
    
    if (low >= high) return;
    
    int pivot = arr[high];
    int i = low;
    
    // @frame arr,pivot
    // @pointer i at arr
    // @segment arr[low:high]
    // @style arr[high:high] point red
    // @text "準備對這段區間做分區，選取區間最右點 ${arr[high]} 當作基準點" at arr.bottom offset(-1.44,16.88)
    for (int j=low; j<high; j++) {

        if (arr[j] < pivot) {
            if (i != j) {
                swap(arr[i], arr[j]);
            }
            i++;
        }
        // @frame arr,pivot
        // @pointer i at arr
        // @pointer j at arr
        // @segment arr[low:high]
        // @style arr[low:j] background AV_green when value<pivot
        // @style arr[low:j] background AV_red when value>pivot
        // @text "{arr[${j}]:第${j}個元素} 比 {pivot:基準點} 小，所以 i j 交換，並且將 i 向右移一格" when pivot>arr[j] at arr.bottom
        // @text "{arr[${j}]:第${j}個元素 } 沒比 {pivot:基準點}小，所以不用交換" when pivot<=arr[j] at arr.bottom
    }

    if (i != high) {
        swap(arr[i], arr[high]);
    }
    // @frame arr,pivot
    // @pointer i at arr
    // @pointer high at arr
    // @segment arr[low:high]
    // @style arr[low:high] background AV_green when value<pivot
    // @style arr[low:high] background AV_red when value>pivot
    // @text "將 {pivot:基準點} 和 i 交換到正確位置 繼續處理遞迴兩側" at arr.bottom offset(-1.44,16.88)

    quick_sort(arr, low, i - 1);
    quick_sort(arr, i + 1, high);
}

int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for (int i=0; i<n; i++) cin>>arr[i];
    // @frame arr
    // @text "Quick Sort (快速排序)\n選取基準點 並進行分區來排序的方法" at arr.bottom offset(0.35,14.33)
    
    quick_sort(arr, 0, n - 1);
    // @frame arr
    // @text "Quick Sort 完成" at arr.bottom offset(0.35,14.33)
    
    for (int i=0; i<n; i++) cout<<arr[i]<<" ";cout<<endl;
    return 0;
}

/* @asm-view
{
  "version": 1,
  "rules": [],
  "skins": {},
  "studio": {
    "cameraRules": [
      {
        "id": "camera-frame-mu19agfo",
        "name": "鏡頭範圍",
        "zoom": 1.91,
        "centerX": 640,
        "centerY": 106,
        "binding": {
          "targetVariable": {
            "name": "arr",
            "functionName": "main"
          }
        },
        "autoCapture": false,
        "manualFrame": true,
        "allFrames": true
      }
    ],
    "codePanelPosition": {
      "x": 0.0252,
      "y": 0.0273
    },
    "eventInstructionStates": {
      "compare:quick_sort:low >= high": false,
      "compare:quick_sort:j < high": false,
      "declare:quick_sort:arr": false,
      "declare:main:arr": false,
      "scope-exit:main:i": false,
      "scope-exit:quick_sort:i": true,
      "scope-exit:quick_sort:high": true,
      "function-enter:quick_sort:void quick_sort(vector<int>& arr, int low, int high) { if (low >= high) return; int pivot = arr[high]; int i = low; // @frame arr[i],pivot // @segment arr[low:high] // @style arr[high:high] point red // @text \"準備對這段區間做分區，選取區間最右點 ${arr[high]": false,
      "call:main:quick_sort(arr, 0, n - 1)": true,
      "call:quick_sort:quick_sort(arr, low, i - 1)": true,
      "call:quick_sort:quick_sort(arr, i + 1, high)": true
    }
  }
}
@asm-view */
