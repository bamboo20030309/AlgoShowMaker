#include <bits/stdc++.h>
using namespace std;

// @defaults
// @camera focus arr offset(0,20) zoom(2.0)
// @enddefaults

int main() {
    int n; cin>>n;
    vector<int> arr(n);
    for(auto&v:arr) cin>>v;

    // @frame arr
    // @text "Insertion Sort (插入排序)\n將元素不斷與左側鄰居交換，直到鑽到正確位置" at arr.top
    for (int i = 1; i < n; i++) {
        int j = i - 1;
        int key = arr[i];

        // 顯示即將取出的元素與比較位置
        // @frame arr,key
        // @pointer j at arr
        // @pointer j+1 at arr
        // @style arr[0:i] background AV_red when value <= key && index != j+1
        // @style arr[0:i] background AV_green when value > key && index != j+1
        // @text "拿第 ${j+1} 個元素當成 key 準備插入" at arr.bottom
        while (j >= 0 && arr[j] > key) {
            // 顯示 arr[j] 準備向右搬移
            // @frame arr,key
            // @pointer j at arr
            // @pointer j+1 at arr
            // @style arr[0:i] background AV_red when value <= key && index != j+1
            // @style arr[0:i] background AV_green when value > key && index != j+1
            // @text "第 ${j} 個元素比 key 大" at arr.bottom when arr[j]>key
            arr[j + 1] = arr[j];

            // 顯示搬移完成的狀態
            // @frame arr,key
            // @pointer j at arr
            // @pointer j+1 at arr
            // @style arr[0:i] background AV_red when value <= key && index != j
            // @style arr[0:i] background AV_green when value > key && index != j
            // @text "將 ${arr[j]} 往右推" at arr.bottom
            j--;
            
        }

        // 將 key 插入空出來的位置
        arr[j + 1] = key;

        // j 可能是 -1，但 j+1 一定是插入位置
        // @frame arr,key
        // @pointer j at arr
        // @pointer j+1 at arr
        // @style arr[0:i] background AV_red when value <= key && index != j+1
        // @style arr[0:i] background AV_green when value > key && index != j+1
        // @text "到達最左邊 插入到最左邊" at arr.bottom when j<0
        // @text "因為 第 ${j} 格比 key 小 所以插入第 ${j+1} 格" at arr.bottom when j>=0
    }

    // @frame arr
    // @text "Insertion Sort 完成" at arr.bottom
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
        "id": "camera-frame-mu2x7rnd",
        "name": "鏡頭範圍",
        "zoom": 2,
        "centerX": 640,
        "centerY": 152,
        "binding": {
          "targetAnchor": "bottom",
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
    "eventInstructionStates": {
      "write:main:j--": true,
      "assign:main:key = arr[i]": true,
      "compare:main:i < n": false,
      "write:main:i++": false,
      "declare:main:j": true,
      "declare:main:key": true,
      "scope-exit:main:j": true,
      "scope-exit:main:key": true,
      "scope-exit:main:i": false,
      "assign:main:j = i - 1": true,
      "compare:main:j >= 0": false,
      "assign:main:i = 1": false,
      "declare:main:i": false,
      "declare:main:arr": false
    },
    "codePanelPosition": {
      "x": 0.052,
      "y": 0.3671
    },
    "frameMaps": {
      "objectStyles": [
        {
          "sourceSelectors": [
            {
              "kind": "manual-frame",
              "functionName": "main",
              "directiveKey": "manual-frame:pwnn7m:0",
              "logicalDirectiveKey": "manual-frame-logical:qrkyj4:0"
            }
          ],
          "value": {
            "text:line-10": {
              "fontSize": 10
            }
          }
        }
      ],
      "eventStates": [
        {
          "sourceFrameSelectors": [
            {
              "selector": {
                "kind": "manual-frame",
                "functionName": "main",
                "directiveKey": "manual-frame:1xp020n:2",
                "logicalDirectiveKey": "manual-frame-logical:5jprzp:2"
              },
              "occurrence": 2
            }
          ],
          "value": {
            "read:main:21:arr[j]::0": false,
            "assign:main:21:arr[j + 1] = arr[j]::0": true
          }
        }
      ]
    }
  }
}
@asm-view */
