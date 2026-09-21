"""Build the three editable teaching decks from the user's animation examples.

Usage: python scripts/build-teaching-decks.py C:/Users/user/Downloads
"""

import copy
import gzip
import json
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "guest-decks"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads"

BG = "#fbfcfa"
INK = "#1f282d"
MUTED = "#637577"
ACCENT = "#1d8f83"
GREEN = "#dff4ef"
PEACH = "#fae9e3"
LINE = "#dce5e1"


def uid():
    return str(uuid.uuid4())


def rect(x, y, w, h, fill=GREEN, radius=14):
    return {"type": "rect", "left": x, "top": y, "width": w, "height": h,
            "fill": fill, "rx": radius, "ry": radius, "stroke": None,
            "strokeWidth": 0, "layerIndex": 1000, "ttsObjectId": uid()}


def txt(value, x, y, w, size=20, color=INK, bold=False):
    return {"type": "textbox", "left": x, "top": y, "width": w,
            "text": value, "fontFamily": "Arial", "fontSize": size,
            "fontWeight": "bold" if bold else "normal", "fill": color,
            "lineHeight": 1.32, "styles": {}, "layerIndex": 1100,
            "ttsObjectId": uid()}


def base(deck, number, section, title, subtitle):
    objects = [rect(0, 0, 1280, 720, BG, 0), rect(64, 49, 32, 4, ACCENT, 0),
               txt(f"{number:02d} / {section.upper()}", 110, 36, 1000, 18, ACCENT, True),
               txt(title, 64, 91, 1150, 38, INK, True),
               txt(subtitle, 66, 158, 1120, 18, MUTED),
               rect(64, 655, 1152, 1, LINE, 0),
               txt(f"{deck}  ·  ALGORITHM VISUALIZATION", 64, 671, 850, 16, MUTED),
               txt(f"{number:02d}", 1150, 671, 65, 18, ACCENT, True)]
    return {"id": uid(), "canvas": {"version": "5.3.0", "objects": objects},
            "widgets": [], "ttsScript": "", "ttsOrder": []}


def label(slide, value, x, y, w, color=ACCENT, size=22):
    slide["canvas"]["objects"].append(txt(value, x, y, w, size, color, True))


def body(slide, value, x, y, w, size=20, color=INK):
    slide["canvas"]["objects"].append(txt(value, x, y, w, size, color))


def card(slide, title, content, x=65, y=228, w=548, h=300, fill=GREEN, size=21):
    slide["canvas"]["objects"].append(rect(x, y, w, h, fill))
    label(slide, title, x + 25, y + 23, w - 48, size=24)
    body(slide, content, x + 25, y + 78, w - 50, size)


def twocard(deck, number, section, title, subtitle, left, right, note=None):
    s = base(deck, number, section, title, subtitle)
    card(s, *left, x=65, y=230, w=548, h=292)
    card(s, *right, x=668, y=230, w=548, h=292, fill=PEACH)
    if note:
        body(s, note, 80, 555, 1110, 19, MUTED)
    return s


def steps(deck, number, section, title, subtitle, items, foot=None):
    s = base(deck, number, section, title, subtitle)
    width = (1150 - 22 * (len(items) - 1)) / len(items)
    for i, (heading, text) in enumerate(items):
        card(s, heading, text, 65 + i * (width + 22), 230, width, 285,
             GREEN if i % 2 == 0 else PEACH, 20)
    if foot:
        body(s, foot, 80, 551, 1110, 19, MUTED)
    return s


def widget(kind, content, x, y, w, h, size=20):
    common = {"id": uid(), "type": kind, "x": x, "y": y, "w": w, "h": h,
              "content": content, "fontSize": size, "scale": 1,
              "manualSize": True, "layerIndex": 2100, "ttsScript": "",
              "ttsScriptMode": "auto", "ttsCarrier": False, "ttsMuted": False,
              "ttsMutedOrderIndex": None, "transitionId": "",
              "fragmentEnabled": False, "fragmentStyle": "", "fragmentIndex": 0}
    if kind == "code":
        common.update(language="cpp", focusLines="", showLineNumbers=True)
    else:
        common.update(cropX=0, cropY=0)
    return common


def formula(deck, number, section, title, subtitle, equations, left, right):
    s = base(deck, number, section, title, subtitle)
    card(s, *left, x=65, y=229, w=548, h=300)
    card(s, *right, x=668, y=229, w=548, h=300, fill=PEACH)
    y = 538
    for eq in equations:
        s["widgets"].append(widget("latex", eq, 100, y, 1080, 67, 29))
        y += 54
    return s


def code_slide(deck, number, section, title, subtitle, code, right_title, right_body, foot=""):
    s = base(deck, number, section, title, subtitle)
    s["widgets"].append(widget("code", code.strip(), 66, 214, 736, 408, 17))
    card(s, right_title, right_body, x=833, y=214, w=382, h=408, size=19)
    if foot:
        body(s, foot, 850, 558, 340, 16, MUTED)
    return s


def cover(deck, title, subtitle, tagline, number, tags):
    s = base(deck, number, "ALGORITHM FROM FIRST PRINCIPLES", title, subtitle)
    label(s, tagline, 66, 254, 850, size=32)
    body(s, "問題 → 由來 → 原理 → 範例動畫 → 延伸應用", 67, 316, 900, 23, MUTED)
    for i, tag in enumerate(tags):
        x = 67 + i * 229
        s["canvas"]["objects"].append(rect(x, 402, 208, 72, GREEN if i % 2 == 0 else PEACH))
        label(s, tag, x + 16, 422, 178, size=20)
    body(s, "使用專案既有演算法動畫、code 與 LaTeX 元件；投影片內容可直接編輯。", 68, 548, 1100, 18, MUTED)
    return s


def animation_slide(source, index):
    s = copy.deepcopy(source[index])
    s["id"] = uid()
    return s


def source_deck(name):
    raw = (SOURCE / f"{name}.asmdeck").read_bytes()
    assert raw[:9] == b"ASMDECK1\n", name
    return json.loads(gzip.decompress(raw[9:]))["body"]["deck"]


def animations(deck):
    return [group["slides"][0] for group in deck["groups"]]


def function(code, signature):
    start = code.index(signature)
    brace = code.index("{", start)
    depth = 0
    for i in range(brace, len(code)):
        if code[i] == "{":
            depth += 1
        elif code[i] == "}":
            depth -= 1
            if depth == 0:
                raw = code[start:i + 1]
                lines = [line for line in raw.splitlines() if "@" not in line and not line.lstrip().startswith("//")]
                return "\n".join(lines)
    raise ValueError(signature)


def save(name, slides):
    deck = {"ttsSettings": {}, "groups": [{"id": uid(), "slides": [s]} for s in slides]}
    body = {"deck": deck, "assets": {}}
    # Browser import verifies the exact JavaScript JSON.stringify representation.
    # Python differs for some floating-point values carried in the source animations.
    js_hash = subprocess.run(
        ["node", "-e", "const c=require('crypto');let chunks=[];process.stdin.on('data',x=>chunks.push(x));process.stdin.on('end',()=>console.log(c.createHash('sha256').update(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString('utf8')))).digest('hex')));"],
        input=json.dumps(body, ensure_ascii=False, separators=(",", ":")),
        text=True, encoding="utf-8", capture_output=True, check=True).stdout.strip()
    manifest = {"format": "AlgoShowMaker.asmdeck", "packageVersion": 1,
                "engineVersion": "8/1", "exportedAt": datetime.now(timezone.utc).isoformat(),
                "contentHash": js_hash,
                "assetHashes": []}
    payload = {"manifest": manifest, "body": body}
    target = OUT / f"{name}.asmdeck"
    target.write_bytes(b"ASMDECK1\n" + gzip.compress(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
    print(f"{target}: {len(slides)} slides, {target.stat().st_size} bytes")


heap_anim = animations(source_deck("heap"))
bit_anim = animations(source_deck("Binary Indexed Tree"))
seg_anim = animations(source_deck("Segment Tree"))
for slide in seg_anim[:3]:
    # The supplied samples mixed the 64-bit clzll intrinsic with a 32-bit
    # width. n=11 then produces -28 and shifts by a negative count.
    slide["animation"]["code"] = slide["animation"]["code"].replace(
        "#define Hbit(X) (32-__builtin_clzll(X))",
        "#define Hbit(X) ((X) == 0 ? 0 : 64-__builtin_clzll(X))")
# In the combined add/set example, apply only the parent's newly propagated
# delta to a child sum. Its stored lazy total already includes older deltas.
advanced_code = seg_anim[2]["animation"]["code"]
for child in ("now << 1", "now << 1 | 1"):
    advanced_code = advanced_code.replace(
        f"tree[{child}] += M * lazy[{child}]",
        f"tree[{child}] += M * lazy[now]")
seg_anim[2]["animation"]["code"] = advanced_code

# ── Heap ──────────────────────────────────────────────────────────────
h = []
H = "HEAP"
h.append(cover(H, "Heap｜堆積", "用一棵完整二元樹，隨時取得目前最重要的元素。", "把最大值放在看得見的地方", 1,
               ["優先佇列", "完整二元樹", "上浮／下沉", "O(log n)"]))
h.append(twocard(H, 2, "THE PROBLEM", "我們要解決什麼問題？", "資料會持續加入，也會反覆取走目前最大的值。",
                 ("反覆找最大值", "若每次都掃描 n 個元素，取出最大值要 O(n)。\n資料不斷變動時，單次排序也難以直接沿用。"),
                 ("堆積的回答", "維持局部的父子大小關係，讓最大值永遠在根節點。\n插入與取出只沿著一條樹路徑調整。"),
                 "情境：排程器每次派發最高優先級的任務；新任務仍可加入。"))
h.append(twocard(H, 3, "ORIGIN", "由來：為排序與優先佇列而生", "J. W. J. Williams 於 1964 年提出 Heapsort（Algorithm 232）。",
                 ("核心想法", "先把資料整理成堆積，再反覆取出根節點。\n不需要把整個陣列保持完全排序。"),
                 ("今天的用途", "除了堆積排序，最大堆／最小堆更常作為優先佇列。\n只保證根是極值，不保證同層或兄弟間的順序。"),
                 "史料：Williams, Algorithm 232: Heapsort, Communications of the ACM 7(6), 1964。"))
h.append(formula(H, 4, "INVARIANT", "原理：只維護父子關係", "這份範例使用 1-based 最大堆，heap[0] 保留不用。",
                 [r"\mathrm{parent}(i)=\lfloor i/2\rfloor,\quad \mathrm{left}(i)=2i,\quad \mathrm{right}(i)=2i+1"],
                 ("形狀條件", "完整二元樹：最後一層從左到右填滿。\n因此可以直接放入連續陣列，不需要指標節點。"),
                 ("順序條件", "對每個存在的子節點，都有 heap[parent] ≥ heap[child]。\n所以根 heap[1] 一定是最大值。")))
h.append(steps(H, 5, "INSERT", "插入：新值從最後一格上浮", "範例：已有 [9, 6, 8, 2]，再插入 7。",
               [("① 放在尾端", "[9, 6, 8, 2, 7]\n先保住完整二元樹形狀。"),
                ("② 比較父節點", "7 > 6，交換。\n得到 [9, 7, 8, 2, 6]。"),
                ("③ 停止", "7 ≤ 9。最大堆條件已恢復。")],
               "每次只往上一層，最多經過樹高 O(log n)。"))
h.append(code_slide(H, 6, "SOURCE CODE", "程式碼：上浮來自範例動畫", "保留附件 heap.asmdeck 的 C++ 邏輯；動畫頁含完整 @frame 設定。",
                    function(heap_anim[0]["animation"]["code"], "void heap_push(int value)"),
                    "對照三個動作", "push_back 放在尾端；與 parent 比大小；需要時 swap 並向上。\n這份程式實作的是逐一插入建堆。"))
h.append(steps(H, 7, "REMOVE MAX", "取出最大值：根與尾交換後下沉", "根移除後，暫放在根的新值可能比子節點小。",
               [("① 交換並刪尾", "根的最大值已取出；尾端值移到根。"),
                ("② 選較大子節點", "與左右孩子中較大的值比較。"),
                ("③ 持續下沉", "若孩子更大就交換，直到父子條件恢復。")],
               "只檢查根到葉的一條路徑，取出最大值也是 O(log n)。"))
h.append(code_slide(H, 8, "SOURCE CODE", "程式碼：下沉來自範例動畫", "取出時要選較大的孩子；只與左孩子比較會破壞最大堆。",
                    "\n".join([
                        "int largest = now;",
                        "if (heap[left] > heap[largest]) largest = left;",
                        "if (right <= heapSize && heap[right] > heap[largest]) largest = right;",
                        "if (largest == now) break;",
                        "swap(heap[now], heap[largest]);",
                        "now = largest;",
                    ]),
                    "觀察重點", "根與尾交換並刪尾後，\n從根往下比較。\n每次選較大的孩子；\n沒有更大的孩子就停止。"))
h.append(twocard(H, 9, "ANIMATION", "接著操作原始動畫", "下一頁直接沿用 heap.asmdeck 的完整程式與逐幀設定。",
                 ("先看插入", "逐個讀入數值；留意新值如何從葉節點往上。"),
                 ("再看取出", "觀察根與最後一格交換，及下沉時選擇較大的孩子。"),
                 "動畫頁保留原始輸入與指令，程式碼可在動畫編輯器中繼續修改。"))
h.append(animation_slide(heap_anim, 0))
h.append(twocard(H, 11, "COMPLEXITY", "複雜度：建堆方式要分清楚", "同樣叫「建堆」，逐一插入與由底往上整理的成本不同。",
                 ("這份動畫：逐一插入", "n 次 heap_push，每次最多 O(log n)。\n總成本 O(n log n)。"),
                 ("另一種：bottom-up heapify", "從最後一個非葉節點向前 sift-down。\n靠近底部的節點很多但路徑短，總成本 O(n)。"),
                 "之後的單次 top 為 O(1)；push／pop 為 O(log n)。"))
h.append(twocard(H, 12, "WHEN TO USE", "何時用堆積？", "先看題目要的是「最重要的一個」，還是「任意區間」。",
                 ("適合", "動態取最大／最小、Top K、排程、Dijkstra 中的候選點。\n只需極值，不需整個序列排序。"),
                 ("不適合", "堆積不支援快速查詢任意區間和，也不能直接找第 k 小。\n需要這些操作時改選其他結構。"),
                 "延伸：把比較方向反轉，就得到最小堆。"))
save("heap-teaching", h)

# ── Binary Indexed Tree ──────────────────────────────────────────────
b = []
B = "BINARY INDEXED TREE"
b.append(cover(B, "Binary Indexed Tree｜樹狀陣列", "把前綴和拆成由二進位索引決定的小區段。", "用 lowbit 找到下一個應更新的區間", 1,
               ["動態前綴和", "1-based", "lowbit", "O(log n)"]))
b.append(twocard(B, 2, "THE PROBLEM", "我們要解決什麼問題？", "陣列反覆修改，同時要查詢任意連續區間的總和。",
                 ("只有前綴和", "sum(l..r) 可以 O(1) 查詢。\n但一個元素改變，後面所有前綴和都要重算，最壞 O(n)。"),
                 ("只有原始陣列", "單點修改 O(1)，但區間和每次都要逐項加總，最壞 O(n)。"),
                 "BIT 用 O(n) 空間，把單點加值與前綴查詢都降到 O(log n)。"))
b.append(twocard(B, 3, "ORIGIN", "由來：動態累積頻率表", "Peter M. Fenwick 於 1994 年提出 Binary Indexed Tree。",
                 ("原始需求", "在資料壓縮的自適應算術編碼中，符號頻率會變；又要快速取得累積頻率。"),
                 ("設計轉換", "把一個長前綴拆成少數二進位區段。\n每個 BIT[i] 只保管一個固定的尾端區段。"),
                 "來源：Fenwick, A New Data Structure for Cumulative Frequency Tables, Software: Practice and Experience 24(3), 1994。"))
b.append(formula(B, 4, "LOWBIT", "原理：lowbit 決定節點的責任範圍", "附件程式以 1-based 索引運作；BIT[0] 不參與查詢或更新。",
                 [r"\mathrm{lowbit}(i)=i\mathbin{\&}(-i)",
                  r"BIT[i]=\sum_{k=i-\mathrm{lowbit}(i)+1}^{i}a[k]"],
                 ("例：BIT[6]", "6 的二進位是 110，lowbit(6)=2。\n因此 BIT[6] 管理 a[5]+a[6]。"),
                 ("例：BIT[8]", "8 的二進位是 1000，lowbit(8)=8。\n因此 BIT[8] 管理 a[1] 到 a[8]。")))
b.append(steps(B, 5, "POINT UPDATE", "單點加值：往上走所有受影響區段", "若 a[5] 加上 Δ，哪些 BIT 節點必須跟著變？",
               [("從 5 開始", "BIT[5] 管理 [5,5]。"),
                ("加 lowbit", "5 → 6 → 8。\nBIT[6] 管理 [5,6]。"),
                ("到邊界停止", "BIT[8] 管理 [1,8]；\n下一步 16 已超出 n。")],
               "每一步 i += i & -i；每次更新的是「包含該位置」的更大區段。"))
b.append(code_slide(B, 6, "SOURCE CODE", "程式碼：建樹動畫中的更新路徑", "附件的 build(i) 用同一條更新路徑把 num[i] 加入 BIT。",
                    function(bit_anim[0]["animation"]["code"], "void build(int i)"),
                    "讀程式時留意", "k 是原始位置；i 沿 BIT 的責任區段往上走。\n這份動畫逐一 build(i)，總建樹時間 O(n log n)。"))
b.append(twocard(B, 7, "ANIMATION", "動畫 ①：逐一建立 BIT", "下一頁沿用 Binary Indexed Tree.asmdeck 的建樹動畫。",
                 ("看 num[k]", "每個輸入值固定在原始位置 k。"),
                 ("看 BIT[i]", "i 隨 lowbit 跳到下一個包含 k 的責任區段。"),
                 "觀察 [5] → [6] → [8] 的更新路徑，並對照每個 BIT 格子涵蓋的範圍。"))
b.append(animation_slide(bit_anim, 0))
b.append(steps(B, 9, "PREFIX QUERY", "前綴查詢：往下拆成不重疊區段", "查詢 sum(7) 的路徑是 7 → 6 → 4 → 0。",
               [("BIT[7]", "先取得 a[7]。"),
                ("BIT[6]", "再取得 a[5..6]。"),
                ("BIT[4]", "最後取得 a[1..4]。")],
               "三段剛好拼成 a[1..7]，沒有重疊，也沒有遺漏。"))
b.append(formula(B, 10, "RANGE QUERY", "區間和＝兩個前綴和相減", "對 1-based 且兩端包含的 [L,R]，先算右前綴再扣左前綴。",
                 [r"\mathrm{sum}(L,R)=\mathrm{prefix}(R)-\mathrm{prefix}(L-1)"],
                 ("例：[3,7]", "prefix(7) 包含 a[1..7]。\nprefix(2) 包含 a[1..2]。"),
                 ("相減留下", "a[3]+a[4]+a[5]+a[6]+a[7]。\n兩次查詢各 O(log n)。")))
b.append(code_slide(B, 11, "SOURCE CODE", "程式碼：前綴查詢來自動畫", "範例中的 sum(i) 依 lowbit 逐段相加。",
                    function(bit_anim[1]["animation"]["code"], "int sum(int i)"),
                    "對照區間查詢", "先算 sum(R)，\n再算 sum(L - 1)。\n動畫中綠色是右前綴，\n紅色是要扣掉的左前綴。"))
b.append(twocard(B, 12, "ANIMATION", "動畫 ②：查詢 [L,R]", "下一頁沿用附件的範圍查詢動畫與原始程式碼。",
                 ("綠色路徑", "沿 R → R-lowbit(R) 累加右端前綴。"),
                 ("紅色路徑", "沿 L-1 往前走，把左端多算的前綴扣掉。"),
                 "若 L=1，左前綴是 prefix(0)=0；不進入迴圈。"))
b.append(animation_slide(bit_anim, 1))
b.append(twocard(B, 14, "LIMITS", "BIT 能處理哪些題型？", "先確認查詢操作可否由前綴結果還原目標區間。",
                 ("直接適用", "單點加值＋區間和。\n對可逆運算，也可用 prefix(R) 與 prefix(L−1) 合成區間答案。"),
                 ("需要變形或換結構", "區間加值＋單點查詢可用差分 BIT；區間加值＋區間和常用兩棵 BIT。\n任意區間最小值／最大值無法用兩個前綴值直接相減，通常改用線段樹。"),
                 "可用 O(n) 的線性建樹，但附件採較直觀的 O(n log n) 逐點更新。"))
save("binary-indexed-tree-teaching", b)

# ── Segment Tree ──────────────────────────────────────────────────────
s = []
S = "SEGMENT TREE"
s.append(cover(S, "Segment Tree｜線段樹", "把區間分成可合併的樹節點，支援多種區段操作。", "將大區間切成少數完整的小區間", 1,
               ["區間查詢", "單點／區間更新", "lazy 標記", "O(log n)"]))
s.append(twocard(S, 2, "THE PROBLEM", "我們要解決什麼問題？", "資料反覆修改，題目又反覆詢問不同的 [L,R]。",
                 ("靜態前綴和不夠", "固定陣列的區間和很好算；但一旦值被修改，舊前綴資料就失效。"),
                 ("多樣操作更難", "題目可能要 sum、min、max、gcd，還可能整段加值或覆蓋。\n需要能保存每個區段的摘要。"),
                 "線段樹的關鍵不是特定答案，而是「節點摘要能由兩個子區段合併」。"))
s.append(twocard(S, 3, "ORIGIN", "設計由來：重複利用區間分解", "不再每次從頭掃描，先為常用區段建立階層式摘要。",
                 ("對半切", "把 [L,R] 分為左右兩半，一直切到單點。\n每個節點記錄它代表的區間。"),
                 ("自底向上合併", "父節點 = merge(左子節點, 右子節點)。\n查詢只走與目標區間相交的少數節點。"),
                 "這裡說的是區間聚合的資料結構；不把它歸給單一發明者。"))
s.append(formula(S, 4, "INVARIANT", "核心不變量：每個節點是自己的區段摘要", "以區間和為例，父區段的答案等於兩個子區段答案相加。",
                 [r"\mathrm{tree}[v]=\mathrm{merge}(\mathrm{tree}[2v],\mathrm{tree}[2v+1])"],
                 ("完全包含", "若查詢範圍完整蓋住節點區段，就直接取該節點摘要。"),
                 ("部分相交", "若只覆蓋一部分，遞迴檢查有交集的孩子，再合併答案。")))
s.append(steps(S, 5, "RANGE DECOMPOSITION", "範例：查詢 [2,7] 的區間和", "以 1..8 的陣列為例，根 [1,8] 不是完整答案。",
               [("走左半", "[1,4] 僅交 [2,4]；\n需要再拆分。"),
                ("走右半", "[5,8] 僅交 [5,7]；\n需要再拆分。"),
                ("合併摘要", "將完全落在 [2,7] 的節點相加。")],
               "只要 merge 可結合，這些小區段的合併結果就是整個查詢。"))
s.append(code_slide(S, 6, "STANDARD LAYOUT", "標準寫法：節點記錄 [l,r]", "附件的 Standard Segment Tree 以 build(now,l,r) 遞迴建構。",
                    function(seg_anim[3]["animation"]["code"], "void build(int now, int l, int r)"),
                    "標準座標", "根是 now=1, [1,n]。\n往左：now*2, [l,mid]；往右：now*2+1, [mid+1,r]。\n常以 4n+5 配置陣列。"))
s.append(twocard(S, 7, "YOUR LAYOUT", "你的寫法：先固定葉層，再由下往上建樹", "附件的 Segment_Tree_easy_build 用位元遮罩定位葉節點。",
                 ("葉節點的位置", "Tmask 是不小於 n 的 2 次方。\n原始第 1 個值放 tree[Tmask]，最後一個放 tree[Tmask+n−1]。"),
                 ("建樹路徑", "從最後一個內部節點倒著走到根；tree[i] = tree[2i] + tree[2i+1]。\n不需要用遞迴把輸入放到葉子。"),
                 "注意：這是陣列佈局與建樹的迭代化；附件的查詢／lazy 操作仍使用遞迴。"))
s.append(code_slide(S, 8, "YOUR CODE", "程式碼：你的迭代建樹", "直接取自 Segment Tree.asmdeck 第一段動畫的 build()。",
                    function(seg_anim[0]["animation"]["code"], "void build()")
                    .replace("Tmask = 1 << Hbit(n - 1), Tsize = Tmask + n, Tdeep = Hbit(n - 1) + 1;",
                             "Tmask = 1 << Hbit(n - 1),\n    Tsize = Tmask + n,\n    Tdeep = Hbit(n - 1) + 1;"),
                    "對照變數", "Tmask：葉層起點。\nTsize：有效葉結束位置。\nTdeep：樹的層數。\n所有葉子在固定深度。"))
s.append(twocard(S, 9, "ANIMATION", "動畫 ①：你的迭代建樹", "下一頁直接播放附件中的 Segment_Tree_easy_build。",
                 ("先看葉層", "輸入值直接存進 tree[Tmask..Tmask+n−1]。"),
                 ("再看內部節點", "從較大索引往根節點回填兩個孩子之和。"),
                 "對 n 非 2 的冪次，葉層右側仍是空位；不參與本例的有效資料。"))
s.append(animation_slide(seg_anim, 0))
s.append(twocard(S, 11, "COMPARE", "標準遞迴 vs 你的迭代佈局", "兩者都能做 O(log n) 的區間操作，但節點對應方式不同。",
                 ("標準寫法", "build(1,1,n) 依實際區間中點切分；葉節點深度可能不同。\n節點代表的 [l,r] 在遞迴參數中很直觀。"),
                 ("你的寫法", "所有原始值從 Tmask 開始，固定在同一葉層；O(n) 由下往上建構。\n查詢時以 Tmask 映射範圍，仍遞迴走樹。"),
                 "不能只把標準遞迴的 now 對應到你的 tree[now]，還需同步轉換區間座標。"))
s.append(code_slide(S, 12, "QUERY CODE", "你的查詢：陣列佈局＋遞迴走訪", "附件的 Segment_Tree_easy 使用 query(l,r,L,R,now)。",
                    function(seg_anim[1]["animation"]["code"], "void query(int l, int r, int L, int R, int now)"),
                    "界線要一致", "根區間從 Tmask 到\n2×Tmask−1。\n輸入位置 x 映射到\n(x−1)|Tmask。\nL,R 都包含端點。"))
s.append(twocard(S, 13, "ANIMATION", "動畫 ②：你的區間查詢", "下一頁沿用 Segment_Tree_easy 的區間查詢動畫。",
                 ("完整覆蓋", "節點區段全落在查詢範圍內，直接加入 sum。"),
                 ("部分覆蓋", "依中點只往有交集的孩子遞迴。"),
                 "綠色片段標示目前查詢範圍；追蹤節點摘要如何累加。"))
s.append(animation_slide(seg_anim, 1))
s.append(twocard(S, 15, "OPERATIONS", "題目可能要求什麼區段摘要？", "先決定節點要存什麼，再決定 merge 規則。",
                 ("容易合併", "sum → 加法；min/max → 取極值；gcd → 最大公因數；xor → 位元 XOR。\n單點改值後只需重算祖先。"),
                 ("不能直接套用", "平均值需要同時保存 sum 與 count。\n最大子陣列和需保存 sum、前綴最大、後綴最大、最佳答案四個欄位。"),
                 "merge 需具結合性；對不具交換性的運算，要保留左到右的順序。"))
s.append(twocard(S, 16, "UPDATE TYPES", "單點、整段加值、整段覆蓋", "更新類型決定是否需要 lazy propagation。",
                 ("單點更新", "找到一片葉，再沿路重算祖先。\n時間 O(log n)，不必使用 lazy。"),
                 ("區間更新", "完整覆蓋某節點時，直接修改其摘要並留下標記；只在需要走孩子前下推。\n區間 add 或 set 均可做到 O(log n)。"),
                 "若每次區間加值都逐點修改，單次最壞退化為 O(n log n)。"))
s.append(formula(S, 17, "LAZY TAGS", "lazy 的關鍵：操作組合次序", "對 sum 節點，完整區段的加值與覆蓋可以直接改摘要。",
                 [r"\mathrm{add}(d):\ sum\leftarrow sum+d\cdot len\qquad \mathrm{set}(v):\ sum\leftarrow v\cdot len"],
                 ("先 set 後 add", "若已有 set=v，再加 d，應轉成 set=v+d。\n這樣不會留下互相矛盾的兩個標記。"),
                 ("先 add 後 set", "新的 set=v 會覆蓋此前的 add。\n往孩子下推時，必須先傳 set，再傳 add。")))
s.append(twocard(S, 18, "ANIMATION", "動畫 ③：你的 add／set／query", "附件第三段使用 tree、lazy、sets 三組資料展示區間操作。",
                 ("紫色與橘色", "紫色表示 add 標記；橘色表示 set 標記。"),
                 ("綠色", "查詢範圍中的節點摘要累加。\n注意標記何時被推送到孩子。"),
                 "這份原始程式以遞迴處理區間，並搭配固定葉層佈局。"))
s.append(animation_slide(seg_anim, 2))
s.append(twocard(S, 20, "STANDARD ANIMATION", "動畫 ④：標準遞迴寫法對照", "最後一段附件動畫直接使用 [1,n] 區間的標準節點表示。",
                 ("看 build", "從根分割 [l,r]；每片葉對應原始值。"),
                 ("看 push", "若要往下走，先把 set/add 標記套用到左右孩子。"),
                 "對照前一段動畫：操作目標相同，主要不同在節點區間如何編碼。"))
s.append(animation_slide(seg_anim, 3))
s.append(twocard(S, 22, "DECISION GUIDE", "讀題時如何選結構？", "把更新與查詢列成一對，再決定實作。",
                 ("前綴和／BIT", "沒有更新：前綴和最簡單。\n單點加值＋區間和：BIT 通常更短。"),
                 ("線段樹", "區間 min/max/gcd、區間 add/set＋查詢、需要找第一個符合條件的位置時，線段樹更靈活。"),
                 "進階：值域很大可做座標壓縮或動態開點；第 k 個元素可在計數樹上依左右子樹數量下降。"))
s.append(twocard(S, 23, "CHECKLIST", "實作前最後核對", "大多數錯誤出在座標、摘要定義與標記組合。",
                 ("界線與單位", "索引是 0-based 還是 1-based？區間是閉區間還是半開？\n節點摘要使用原始長度還是壓縮後長度？"),
                 ("操作代數", "merge 的單位元素為何？\nset/add 標記誰先套用？\n空區段怎麼處理？"),
                 "這三份動畫分別提供建樹、查詢、複合更新和標準寫法，可回頭逐步對照。"))
save("segment-tree-teaching", s)
