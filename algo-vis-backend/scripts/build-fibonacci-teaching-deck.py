"""Build the editable Fibonacci recursion and dynamic-programming teaching deck."""

import gzip
import json
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "guest-decks" / "fibonacci-teaching.asmdeck"
SOURCE = ROOT / "algorithm_sample" / "Backtracking" / "fibonacci.cpp"
DP_SOURCE = ROOT / "algorithm_sample" / "DP" / "fibonacci-dp.cpp"

BG = "#fbfcfa"
INK = "#1f282d"
MUTED = "#637577"
ACCENT = "#1d8f83"
GREEN = "#dff4ef"
GREEN_STRONG = "#a5d6a7"
PEACH = "#fae9e3"
RED = "#ef9a9a"
LINE = "#dce5e1"
GOLD = "#f4c95d"
BLUE = "#8bc6d1"


def uid():
    return str(uuid.uuid4())


def rect(x, y, w, h, fill=GREEN, radius=14, stroke=None, stroke_width=0,
         angle=0):
    return {
        "type": "rect", "left": x, "top": y, "width": w, "height": h,
        "fill": fill, "rx": radius, "ry": radius, "stroke": stroke,
        "strokeWidth": stroke_width, "angle": angle,
        "layerIndex": 1000, "ttsObjectId": uid()
    }


def line(x1, y1, x2, y2, color=LINE, width=3):
    return {
        "type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2,
        "stroke": color, "strokeWidth": width, "layerIndex": 1020,
        "ttsObjectId": uid()
    }


def txt(value, x, y, w, size=20, color=INK, bold=False, align="left"):
    return {
        "type": "textbox", "left": x, "top": y, "width": w, "text": value,
        "fontFamily": "Arial", "fontSize": size,
        "fontWeight": "bold" if bold else "normal", "fill": color,
        "textAlign": align, "lineHeight": 1.28, "splitByGrapheme": True,
        "styles": {}, "layerIndex": 1100, "ttsObjectId": uid()
    }


def base(number, section, title, subtitle):
    objects = [
        rect(0, 0, 1280, 720, BG, 0),
        rect(64, 49, 32, 4, ACCENT, 0),
        txt(f"{number:02d} / {section.upper()}", 110, 36, 1000, 18,
            ACCENT, True),
        txt(title, 64, 91, 1150, 38, INK, True),
        txt(subtitle, 66, 158, 1120, 18, MUTED),
        rect(64, 655, 1152, 1, LINE, 0),
        txt("FIBONACCI  ·  RECURSION & DYNAMIC PROGRAMMING",
            64, 671, 850, 16, MUTED),
        txt(f"{number:02d}", 1150, 671, 65, 18, ACCENT, True),
    ]
    return {
        "id": uid(), "canvas": {"version": "5.3.0", "objects": objects},
        "widgets": [], "ttsScript": "", "ttsOrder": []
    }


def add(slide, *objects):
    slide["canvas"]["objects"].extend(objects)


def card(slide, title, content, x, y, w, h, fill=GREEN, content_size=20):
    add(slide,
        rect(x, y, w, h, fill),
        txt(title, x + 24, y + 22, w - 48, 24, ACCENT, True),
        txt(content, x + 24, y + 76, w - 48, content_size, INK))


def widget(kind, content, x, y, w, h, size=20):
    result = {
        "id": uid(), "type": kind, "x": x, "y": y, "w": w, "h": h,
        "content": content, "fontSize": size, "scale": 1, "manualSize": True,
        "layerIndex": 2100, "ttsScript": "", "ttsScriptMode": "auto",
        "ttsCarrier": False, "ttsMuted": False, "ttsMutedOrderIndex": None,
        "transitionId": "", "fragmentEnabled": False, "fragmentStyle": "",
        "fragmentIndex": 0
    }
    if kind == "code":
        result.update(language="cpp", focusLines="", showLineNumbers=True)
    else:
        result.update(cropX=0, cropY=0)
    return result


def number_row(slide, values, x, y, cell_w=98, active=None, labels=True,
               label_prefix="F"):
    colors = [GREEN, PEACH, "#eef4f3", "#e9f2f8", "#f7efd8", "#e8f4ea",
              "#f5e7ea", "#e9edf7"]
    for index, value in enumerate(values):
        fill = GOLD if index == active else colors[index % len(colors)]
        add(slide,
            rect(x + index * cell_w, y, cell_w - 8, 70, fill, 10,
                 ACCENT if index == active else LINE, 2 if index == active else 1),
            txt(str(value), x + index * cell_w, y + 18, cell_w - 8, 24,
                INK, True, "center"))
        if labels:
            label = f"dp[{index}]" if label_prefix == "dp" else f"F({index})"
            add(slide, txt(label, x + index * cell_w, y + 78,
                           cell_w - 8, 15, MUTED, False, "center"))


def tree_node(slide, label, cx, cy, fill=GREEN, w=92):
    add(slide, rect(cx - w / 2, cy - 25, w, 50, fill, 12, ACCENT, 1),
        txt(label, cx - w / 2, cy - 10, w, 18, INK, True, "center"))


slides = []

# 01 — Cover
s = base(1, "FROM SEQUENCE TO ALGORITHM", "Fibonacci｜費式數列",
         "同一條遞迴公式，可以寫成直覺的遞迴，也可以整理成高效率的動態規劃。")
add(s,
    txt("從定義出發，理解為什麼會重複計算", 66, 238, 880, 32, INK, True),
    txt("數列 → 手算 → 遞迴樹 → 陣列 DP → 複雜度比較 → 完整動畫",
        68, 298, 1030, 21, MUTED),
    rect(68, 388, 238, 70, GREEN),
    txt("F(n−1)+F(n−2)", 84, 410, 206, 20, ACCENT, True, "center"),
    rect(326, 388, 238, 70, PEACH),
    txt("遞迴：重複展開", 342, 410, 206, 20, ACCENT, True, "center"),
    rect(584, 388, 238, 70, GREEN),
    txt("DP：保存答案", 600, 410, 206, 20, ACCENT, True, "center"),
    txt("最後一頁使用專案原生遞迴樹動畫，可逐幀查看每次函式呼叫與回傳。",
        68, 552, 1060, 18, MUTED))
number_row(s, [0, 1, 1, 2, 3, 5, 8], 866, 370, 48, labels=False)
slides.append(s)

# 02 — What is Fibonacci
s = base(2, "DEFINITION", "費式數列是什麼？",
         "從第 2 項開始，每一項都是前兩項的總和。")
s["widgets"].append(widget("latex",
    r"F(0)=0,\quad F(1)=1,\quad F(n)=F(n-1)+F(n-2)\;(n\ge 2)",
    150, 220, 980, 75, 28))
number_row(s, [0, 1, 1, 2, 3, 5, 8, 13], 116, 350, 132)
add(s,
    txt("例如：F(6) = F(5) + F(4) = 5 + 3 = 8",
        174, 506, 930, 25, ACCENT, True, "center"),
    txt("本投影片使用 F(0)=0、F(1)=1 的編號方式。",
        174, 558, 930, 17, MUTED, False, "center"))
slides.append(s)

# 03 — Manual calculation
s = base(3, "CALCULATION", "如何一步一步算出 F(5)？",
         "只要先知道前兩項，就能由左到右產生下一項。")
steps = [
    ("F(2)", "F(1)+F(0)", "1+0=1"),
    ("F(3)", "F(2)+F(1)", "1+1=2"),
    ("F(4)", "F(3)+F(2)", "2+1=3"),
    ("F(5)", "F(4)+F(3)", "3+2=5"),
]
for i, (title, formula, result) in enumerate(steps):
    x = 64 + i * 292
    add(s, rect(x, 225, 268, 206, GREEN if i % 2 == 0 else PEACH),
        txt(title, x + 22, 248, 224, 24, ACCENT, True),
        txt(formula, x + 22, 304, 224, 19, INK, False, "center"),
        txt(result, x + 22, 360, 224, 25, INK, True, "center"))
    if i < 3:
        add(s, txt("→", x + 266, 306, 28, 27, ACCENT, True, "center"))
number_row(s, [0, 1, 1, 2, 3, 5], 250, 498, 132, active=5)
slides.append(s)

# 04 — Recursive code
s = base(4, "RECURSIVE CODE", "遞迴：把公式直接寫成函式",
         "基本情況讓遞迴停止；其餘情況照定義呼叫兩個更小的問題。")
recursive_code = """int F(int n) {
    if (n <= 1) return n;

    int left = F(n - 1);
    int right = F(n - 2);
    return left + right;
}"""
s["widgets"].append(widget("code", recursive_code, 64, 220, 720, 350, 20))
card(s, "閱讀順序",
     "① n≤1：直接回傳 n\n\n② 完整算完左子樹 F(n−1)\n\n"
     "③ 再算右子樹 F(n−2)\n\n④ 把兩個答案相加",
     824, 220, 392, 350, PEACH, 19)
add(s, txt("程式很接近數學定義，因此容易理解；代價是大量重複呼叫。",
           82, 600, 1110, 18, MUTED))
slides.append(s)

# 05 — Native recursion animation
with SOURCE.open("r", encoding="utf-8", newline="") as source_file:
    recursion_source = source_file.read()


def animation_slide(code, input_text):
    return {
        "id": uid(), "kind": "algorithm-animation", "ttsScript": "", "ttsOrder": [],
        "canvas": {"objects": []}, "widgets": [],
        "animation": {
            "mode": "trace", "code": code, "input": input_text,
            "sliceMode": "manual", "watches": [],
            "rebuild": {
                "view": {"version": 1, "rules": [], "skins": {}, "studio": {
                    "eventSettings": {
                        "autoFixedEnabled": False,
                        "autoLoopBoundaryEnabled": False
                    }
                }},
                "globals": {
                    "eventSettings": {
                        "gapMs": 500,
                        "autoFixedEnabled": False,
                        "autoLoopBoundaryEnabled": False,
                        "defaultEnabled": {"declare": True},
                        "timelineTypes": {"declare": True, "read": False}
                    }
                }
            }
        }
    }


slides.append(animation_slide(recursion_source, "5\n"))

# 06 — Full recursion tree and repeated work
s = base(6, "WHY RECURSION IS SLOW", "完整展開後，重複計算會非常明顯",
         "每個 F(2) 都會繼續呼叫 F(1) 與 F(0)；相同子問題不會共享答案。")
tree_edges = []
tree_nodes = []
leaf_index = 0


def build_fib_tree(n, depth):
    global leaf_index
    y = 230 + depth * 76
    if n <= 1:
        x = 150 + leaf_index * 140
        leaf_index += 1
    else:
        left_x = build_fib_tree(n - 1, depth + 1)
        right_x = build_fib_tree(n - 2, depth + 1)
        x = (left_x + right_x) / 2
        child_y = 230 + (depth + 1) * 76
        tree_edges.extend([(x, y, left_x, child_y), (x, y, right_x, child_y)])
    tree_nodes.append((n, x, y))
    return x


build_fib_tree(5, 0)
for edge in tree_edges:
    add(s, line(*edge, "#b6c7c2", 2))
for n, x, y in tree_nodes:
    fill = GOLD if n == 5 else PEACH if n == 3 else BLUE if n == 2 else GREEN
    tree_node(s, f"F({n})", x, y, fill, 68)
add(s,
    txt("三個 F(2) 都各自展開成 F(1) 與 F(0)。",
        108, 589, 610, 20, ACCENT, True),
    txt("n 越大，重複的整棵子樹越多。", 782, 589, 390, 18, MUTED))
slides.append(s)

# 07 — DP idea
s = base(7, "DYNAMIC PROGRAMMING", "動態規劃：把算過的答案存進陣列",
         "每一格只依賴左邊兩格；算過一次後就不再展開遞迴樹。")
number_row(s, [0, 1, 1, 2, 3, 5, 8], 146, 284, 142, active=6,
           label_prefix="dp")
add(s,
    txt("dp[4]", 334, 430, 150, 19, MUTED, True, "center"),
    txt("＋", 486, 430, 50, 25, ACCENT, True, "center"),
    txt("dp[5]", 534, 430, 150, 19, MUTED, True, "center"),
    txt("＝", 682, 430, 50, 25, ACCENT, True, "center"),
    txt("dp[6]", 732, 430, 150, 19, ACCENT, True, "center"),
    txt("3", 334, 475, 150, 30, INK, True, "center"),
    txt("＋", 486, 475, 50, 30, INK, True, "center"),
    txt("5", 534, 475, 150, 30, INK, True, "center"),
    txt("＝", 682, 475, 50, 30, INK, True, "center"),
    txt("8", 732, 475, 150, 30, ACCENT, True, "center"),
    txt("陣列由小到大填滿：每一個子問題只計算一次。",
        244, 568, 790, 21, MUTED, False, "center"))
slides.append(s)

# 08 — Concise DP code
s = base(8, "DP CODE", "用陣列做簡單的動態規劃",
         "先放入兩個已知答案，再由索引 2 一路算到 n。")
dp_code = """vector<int> dp(n+1);
dp[1]=1;
for(int i=2;i<=n;i++) dp[i]=dp[i-1]+dp[i-2];"""
s["widgets"].append(widget("code", dp_code, 64, 235, 742, 285, 22))
card(s, "陣列中的意義",
     "dp[i] 表示 F(i) 的答案。\n\n"
     "當迴圈走到 i 時，dp[i−1] 與 dp[i−2] 已經存在，所以只做一次加法。\n\n"
     "這種由小問題往大問題填表的方式，稱為「由下而上」。",
     846, 215, 370, 350, GREEN, 18)
add(s, txt("vector<int> 初始化時，dp[0] 自動為 0。",
           82, 590, 700, 18, MUTED))
slides.append(s)

# 09 — Native DP animation
with DP_SOURCE.open("r", encoding="utf-8", newline="") as source_file:
    dp_source = source_file.read()
slides.append(animation_slide(dp_source, "5\n"))

# 10 — Complexity comparison
s = base(10, "COMPLEXITY", "複雜度比較：差別來自有沒有重複計算",
         "兩種方法得到相同答案，但執行成本非常不同。")
headers = ["方法", "時間複雜度", "空間複雜度", "原因"]
xs = [64, 292, 548, 778]
ws = [220, 248, 222, 438]
for x, w, header in zip(xs, ws, headers):
    add(s, rect(x, 222, w, 62, ACCENT, 0),
        txt(header, x + 12, 241, w - 24, 19, "#ffffff", True, "center"))
rows = [
    ("單純遞迴", "O(φⁿ)\n常見上界 O(2ⁿ)", "O(n)",
     "相同的 F(k) 在不同分支反覆計算；呼叫堆疊最深為 n。", PEACH),
    ("陣列 DP", "O(n)", "O(n)",
     "每個 dp[i] 只算一次；陣列保存 n+1 個答案。", GREEN),
]
for row_index, row in enumerate(rows):
    y = 292 + row_index * 140
    method, time_text, space_text, reason, fill = row
    values = [method, time_text, space_text, reason]
    for x, w, value in zip(xs, ws, values):
        add(s, rect(x, y, w, 132, fill, 0, "#ffffff", 2),
            txt(value, x + 16, y + 27, w - 32, 18, INK,
                value == method, "center" if value != reason else "left"))
add(s,
    txt("φ ≈ 1.618（黃金比例）。若只保留前兩個值，DP 空間還可降為 O(1)。",
        82, 593, 1110, 17, MUTED))
slides.append(s)


deck = {"ttsSettings": {}, "groups": [{"id": uid(), "slides": [slide]} for slide in slides]}
body = {"deck": deck, "assets": {}}
body_text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
js_hash = subprocess.run(
    ["node", "-e", (
        "const c=require('crypto');let a=[];process.stdin.on('data',x=>a.push(x));"
        "process.stdin.on('end',()=>console.log(c.createHash('sha256')"
        ".update(JSON.stringify(JSON.parse(Buffer.concat(a).toString('utf8'))))"
        ".digest('hex')));"
    )],
    input=body_text, text=True, encoding="utf-8", capture_output=True, check=True
).stdout.strip()
manifest = {
    "format": "AlgoShowMaker.asmdeck", "packageVersion": 1,
    "engineVersion": "10/1", "exportedAt": datetime.now(timezone.utc).isoformat(),
    "contentHash": js_hash, "assetHashes": []
}
payload = {"manifest": manifest, "body": body}
OUT.write_bytes(
    b"ASMDECK1\n" + gzip.compress(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        mtime=0
    )
)
print(f"{OUT}: {len(slides)} slides, {OUT.stat().st_size} bytes")
