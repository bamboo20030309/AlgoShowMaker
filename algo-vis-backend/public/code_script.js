(function() {
    let track = 0;
    function renderFrame(f) {
        clearAllEditorHighlights();
        clearCanvas();
        switch(f) {
            case 0:
                if (track === 0) {
                    drawColoredText([{text: "這是一個在每個格子塗上顏色 \n並觀察他在過了k天後的擴散情況的模擬問題 \n首先先看看巧妙的陣列編排 \n將0的位置定義為 "},{text: "黑色", bg_color: "rgba(55, 55, 55, 0.46)"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(15);
                    drawArray('color', 0, 0, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 1:
                if (track === 0) {
                    drawColoredText([{text: "再來是最重要的部分\n將原色分別排在 "},{text: "1", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " , "},{text: "2", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "4", bg_color: "rgba(63, 120, 253, 0.46)"},{text: "\n為什麼這樣排?\n因為 "},{text: "1", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " , "},{text: "2", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "4", bg_color: "rgba(63, 120, 253, 0.46)"},{text: " 在二進位上分別是 "},{text: "001", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " , "},{text: "010", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "{100:一零零}", bg_color: "rgba(63, 120, 253, 0.46)"},{text: "\n每個 {bit:位元} 分別代表有沒有那個顏色的意思 (有是 1 沒有是 0)\n"},{text: "所以\n"},{text: "001", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " 代表 "},{text: "沒藍色"},{text: " , "},{text: "沒綠色"},{text: " , "},{text: "有紅色", bg_color: "rgba(255, 45, 45, 0.46)"},{text: "\n"},{text: "010", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " 代表 "},{text: "沒藍色"},{text: " , "},{text: "有綠色", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "沒紅色\n"},{text: "{100:一零零}", bg_color: "rgba(63, 120, 253, 0.46)"},{text: " 代表 "},{text: "有藍色", bg_color: "rgba(63, 120, 253, 0.46)"},{text: " , "},{text: "沒綠色"},{text: " , "},{text: "沒紅色"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(64);
                    drawArray('color', 0, 110, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 2:
                if (track === 0) {
                    drawColoredText([{text: "而這樣排的好處很自然的就是\n"},{text: "011", bg_color: "rgba(250, 250, 69, 0.46)"},{text: " = "},{text: "沒藍色"},{text: " , "},{text: "有綠色", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "有紅色", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " = "},{text: "黃色", bg_color: "rgba(250, 250, 69, 0.46)"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(84);
                    drawArray('color', 0, -40, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 3:
                if (track === 0) {
                    drawColoredText([{text: "{100:一零一}", bg_color: "rgba(241, 87, 216, 0.46)"},{text: " = "},{text: "有藍色", bg_color: "rgba(63, 120, 253, 0.46)"},{text: " , "},{text: "沒綠色"},{text: " , "},{text: "有紅色", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " = "},{text: "品紅色", bg_color: "rgba(241, 87, 216, 0.46)"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(104);
                    drawArray('color', 0, -60, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 4:
                if (track === 0) {
                    drawColoredText([{text: "{100:一一零}", bg_color: "rgba(58, 221, 250, 0.46)"},{text: " = "},{text: "有藍色", bg_color: "rgba(63, 120, 253, 0.46)"},{text: " , "},{text: "有綠色", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "沒紅色"},{text: " = "},{text: "青色", bg_color: "rgba(58, 221, 250, 0.46)"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(125);
                    drawArray('color', 0, -60, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 5:
                if (track === 0) {
                    drawColoredText([{text: "全部都有自然就是\n"},{text: "{111:一一一}", bg_color: "white"},{text: " = "},{text: "有藍色", bg_color: "rgba(63, 120, 253, 0.46)"},{text: " , "},{text: "有綠色", bg_color: "rgba(102, 250, 102, 0.46)"},{text: " , "},{text: "有紅色", bg_color: "rgba(255, 45, 45, 0.46)"},{text: " = "},{text: "白色", bg_color: "white"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(148);
                    drawArray('color', 0, -40, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 6:
                if (track === 0) {
                    drawColoredText([{text: "這樣子就將顏色表建立完成了\n而接下來計算顏色蔓延也很簡單\n只需要每個格子從周圍的格子去將顏色 "},{text: "{or:或}", bg_color: "rgba(241, 255, 47, 0.44)"},{text: " 過來 ({or 的操作符號就是 | ，比如說 }"},{text: "{001}", bg_color: "rgba(255, 45, 45, 0.46)"},{text: "{ | }"},{text: "{010}", bg_color: "rgba(102, 250, 102, 0.46)"},{text: "{ = }"},{text: "{011}", bg_color: "rgba(250, 250, 69, 0.46)"},{text: " )\n這樣只需要一個數字就可以分別完成三個原色的顏色擴散計算"}], -10, -130);
                }
                if (track === 0) {
                    addEditorHighlight(171);
                    drawArray('color', 0, 0, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                if (track === 1) {
                    drawColoredText([{text: "利用二進制編排建立顏色表"}], -10, -70);
                }
                if (track === 1) {
                    addEditorHighlight(184);
                    drawArray('color', 0, 0, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                break;
            case 7:
                if (track === 0) {
                    drawColoredText([{text: "這是輸入的初始狀態也就是 {char:character} 的形式"}], 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(209);
                    drawArray('color', 0, -80, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                if (track === 0) {
                    addEditorHighlight(219);
                    draw2DArray('board', 0, 120, [[' ',' ',' ',' ',' '],[' ','R','N','G',' '],[' ','N','N','N',' '],[' ','B','N','N',' '],[' ',' ',' ',' ',' ']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 8:
                if (track === 0) {
                    drawColoredText([{text: "透過 {color:顏色}表 將顏色轉成數字 { color.find(n) }"}], 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(240);
                    drawArray('color', 0, -80, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                if (track === 0) {
                    addEditorHighlight(250);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 9:
                if (track === 0) {
                    drawText("接{著:ㄓㄜ˙}是最關鍵的地方\n開一個新表來記錄下一輪的變化狀況", 0, 20);
                }
                if (track === 0) {
                    addEditorHighlight(265);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(275);
                    draw2DArray('new_board', 200, 120, [['000','000','000','000','000'],['000','000','000','000','000'],['000','000','000','000','000'],['000','000','000','000','000'],['000','000','000','000','000']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,1],[1,2],[1,3],[2,1],[2,2],[2,3],[3,1],[3,2],[3,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 10:
                if (track === 0) {
                    drawText("從原來的 {board:舊陣列} 將十字的部分全部 {or:或} 起來 儲存在 {new_board:新陣列}\n邊界可以透過填補一圈0 簡單解決", 0, 20);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','001','000',''],['','001','000','000',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,3],[2,2],[2,3],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[1,2],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: []},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,1],[1,0],[0,1],[1,2],[2,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 11:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','001','000',''],['','001','000','000',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,3],[2,2],[2,3],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[1,2],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: []},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,2],[1,1],[0,2],[1,3],[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 12:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','001','000','010',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,3],[1,2],[0,3],[1,4],[2,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 13:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','001','000','010',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,1],[2,0],[1,1],[2,2],[3,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 14:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','001','000','010',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,2],[2,1],[1,2],[2,3],[3,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 15:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','001','000','010',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,3],[2,2],[1,3],[2,4],[3,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 16:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,1],[3,0],[2,1],[3,2],[4,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 17:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,2],[3,1],[2,2],[3,3],[4,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 18:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','000','010',''],['','000','000','000',''],['','100','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,3],[3,2],[2,3],[3,4],[4,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 19:
                if (track === 0) {
                    drawText("計算完一天後將 {new_board:新的陣列} 取代 {board:舊的陣列}\n({注意如果直接 board=new_board}\n{ 他會去抄一個複製本給 board}\n{ 並不是常數時間的}\n{ 所以請用 board=move(new_board)}\n{ 他會直接轉移名字})", 0, -50);
                }
                if (track === 0) {
                    addEditorHighlight(337);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 1) {
                    drawText("第1天的擴散情況", 0, 40);
                }
                if (track === 1) {
                    addEditorHighlight(348);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 20:
                if (track === 0) {
                    drawText("開啟新的一天的擴散計算", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','001','001','000',''],['','001','000','000',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[1,3],[2,2],[2,3],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1],[1,2],[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: []},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: []},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,1],[1,0],[0,1],[1,2],[2,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 21:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','011','011','011',''],['','001','011','000',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,3],[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: []},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,1],[1,2],[1,3],[2,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,2],[1,1],[0,2],[1,3],[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 22:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','011','011','011',''],['','001','011','010',''],['','000','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[3,1],[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,1],[1,2],[1,3],[2,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: []},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[1,3],[1,2],[0,3],[1,4],[2,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 23:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: [[1,1],[2,2]]},{ type: "highlight", elements: [[2,1],[2,0],[1,1],[2,2],[3,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 24:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','000','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[3,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: [[1,1],[2,2]]},{ type: "highlight", elements: [[2,2],[2,1],[1,2],[2,3],[3,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 25:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[2,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','000','010',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3],[3,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: []},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: [[1,1],[2,2]]},{ type: "highlight", elements: [[2,3],[2,2],[1,3],[2,4],[3,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 26:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','100','010',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3],[3,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: [[1,1],[2,2]]},{ type: "highlight", elements: [[3,1],[3,0],[2,1],[3,2],[4,1]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 27:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','100','110',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [[3,3]]},{ type: "background", color: "white", elements: [[1,1],[2,2]]},{ type: "highlight", elements: [[3,2],[3,1],[2,2],[3,3],[4,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 28:
                if (track === 0) {
                    drawText("{利用 or 計算}擴散{部分}", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(304);
                    draw2DArray('board', 0, 120, [['','','','',''],['','001','011','010',''],['','101','000','010',''],['','100','100','000',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [[2,2],[3,3]]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [[1,1]]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[1,3],[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,1],[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: []},{ type: "background", color: "white", elements: []},{ type: "highlight", elements: [[3,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 0) {
                    addEditorHighlight(315);
                    draw2DArray('new_board', 200, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','100','110',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [[3,3]]},{ type: "background", color: "white", elements: [[1,1],[2,2]]},{ type: "highlight", elements: [[3,3],[3,2],[2,3],[3,4],[4,3]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 29:
                if (track === 0) {
                    drawText("計算完一天後將 {new_board:新的陣列} 取代 {board:舊的陣列}\n({注意如果直接 board=new_board}\n{ 他會去抄一個複製本給 board}\n{ 並不是常數時間的}\n{ 所以請用 board=move(new_board)}\n{ 他會直接轉移名字})", 0, -50);
                }
                if (track === 0) {
                    addEditorHighlight(337);
                    draw2DArray('board', 0, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','100','110',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [[3,3]]},{ type: "background", color: "white", elements: [[1,1],[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 1) {
                    drawText("第2天的擴散情況", 0, 40);
                }
                if (track === 1) {
                    addEditorHighlight(348);
                    draw2DArray('board', 0, 120, [['','','','',''],['','111','011','011',''],['','101','111','010',''],['','101','100','110',''],['','','','','']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [[3,3]]},{ type: "background", color: "white", elements: [[1,1],[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
            case 30:
                if (track === 0) {
                    drawText("最後利用 {color:顏色}表 再將數字轉回 {char:character} 的形式輸出", 0, 40);
                }
                if (track === 0) {
                    addEditorHighlight(368);
                    drawArray('color', 0, -80, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                if (track === 0) {
                    addEditorHighlight(378);
                    draw2DArray('board', 0, 120, [[' ',' ',' ',' ',' '],[' ','W','Y','Y',' '],[' ','M','W','G',' '],[' ','M','B','C',' '],[' ',' ',' ',' ',' ']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [[3,3]]},{ type: "background", color: "white", elements: [[1,1],[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                if (track === 1) {
                    drawText("最後利用 {color:顏色}表 再將數字轉回 {char:character} 的形式輸出", 0, 40);
                }
                if (track === 1) {
                    addEditorHighlight(389);
                    drawArray('color', 0, -80, ['N','R','G','Y','B','M','C','W'],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: [0]},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: [1]},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [2]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [3]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [4]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [5]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [6]},{ type: "background", color: "white", elements: [7]}], [0], "normal", 0, 4, [],  [],  [],  [],  []);
                }
                if (track === 1) {
                    addEditorHighlight(399);
                    draw2DArray('board', 0, 120, [[' ',' ',' ',' ',' '],[' ','W','Y','Y',' '],[' ','M','W','G',' '],[' ','M','B','C',' '],[' ',' ',' ',' ',' ']],  [{ type: "background", color: "rgba(55, 55, 55, 0.7)", elements: []},{ type: "background", color: "rgba(255, 45, 45, 0.7)", elements: []},{ type: "background", color: "rgba(102, 250, 102, 0.7)", elements: [[2,3]]},{ type: "background", color: "rgba(250, 250, 69, 0.7)", elements: [[1,2],[1,3]]},{ type: "background", color: "rgba(63, 120, 253, 0.7)", elements: [[3,2]]},{ type: "background", color: "rgba(241, 87, 216, 0.7)", elements: [[2,1],[3,1]]},{ type: "background", color: "rgba(58, 221, 250, 0.7)", elements: [[3,3]]},{ type: "background", color: "white", elements: [[1,1],[2,2]]}], [[1,1],[3,3]],  "normal", 0);
                }
                break;
        }
    }
    let currentFrame = 0;
    const totalFrames = 31;
    const keyFrames = [6,19,29,30,30];
    const stopFrames = [30];
    const fastFrames = [];
    const fastonFrames = [];
    const skipFrames = [];

    function findNextKey(frame) {
        let L = 0, R = keyFrames.length - 1;
        let ans = (keyFrames.length > 0?keyFrames[keyFrames.length-1] : totalFrames - 1);
        while (L <= R) {
            const M = Math.floor((L + R) / 2);
            if (keyFrames[M] > frame) {
                ans = keyFrames[M];
                R = M - 1;
            } else {
                L = M + 1;
            }
        }
        return ans;
    }

    function findPrevKey(frame) {
        let L = 0, R = keyFrames.length - 1;
        let ans = (keyFrames.length > 0?keyFrames[0] : 0);
        while (L <= R) {
        const M = Math.floor((L + R) / 2);
            if (keyFrames[M] < frame) {
                ans = keyFrames[M];
                L = M + 1;
            } else {
                R = M - 1;
            }
        }
        return ans;
    }

    window.CodeScript = {
        next() {
            track = 0;
            if (currentFrame < totalFrames - 1) {
                currentFrame++;
                renderFrame(currentFrame);
            }
        },
        prev() {
            track = 0;
            if (currentFrame > 0) {
                currentFrame--;
                renderFrame(currentFrame);
            }
        },
        next_key_frame() {
            if (keyFrames.length > 0){
                track = 1;
                currentFrame = findNextKey(currentFrame);
                renderFrame(currentFrame);
            }
        },
        prev_key_frame() {
            if (keyFrames.length > 0){
                track = 1;
                currentFrame = findPrevKey(currentFrame);
                renderFrame(currentFrame);
            }
        },
        reset() {
            track = 0;
            currentFrame = 0;
            renderFrame(0);
        },
        goto(n) {
            if (n >= 0 && n < totalFrames) {
                track = 0;
                currentFrame = n;
                renderFrame(n);
            } else if (n == -1) {
                track = 0;
                currentFrame = totalFrames - 1;
                renderFrame(totalFrames - 1);
            }
        },
        get_frame_count() {
            return totalFrames;
        },
        get_current_frame_index() {
            return currentFrame;
        },
        get_key_frames() {
            return keyFrames;
        },
        get_stop_frames() {
            return stopFrames;
        },
        is_stop_frame() {
            return stopFrames.includes(currentFrame);
        },
        is_fast_frame() {
            return fastFrames.includes(currentFrame);
        },
        is_faston_frame() {
            return fastonFrames.includes(currentFrame);
        },
        is_skip_frame() {
            return skipFrames.includes(currentFrame);
        }
    };
    document.addEventListener('DOMContentLoaded', () => {
        CodeScript.reset();
    });
})();

