"""Build the editable Tower of Hanoi teaching deck and bundled animation."""

import gzip
import json
import re
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "guest-decks" / "hanoi-teaching.asmdeck"
SOURCE = ROOT / "algorithm_sample" / "Backtracking" / "hanoi-recursion.cpp"

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


def rect(x, y, w, h, fill=GREEN, radius=14, stroke=None, stroke_width=0):
    return {
        "type": "rect", "left": x, "top": y, "width": w, "height": h,
        "fill": fill, "rx": radius, "ry": radius, "stroke": stroke,
        "strokeWidth": stroke_width, "layerIndex": 1000, "ttsObjectId": uid()
    }


def txt(value, x, y, w, size=20, color=INK, bold=False, align="left"):
    return {
        "type": "textbox", "left": x, "top": y, "width": w, "text": value,
        "fontFamily": "Arial", "fontSize": size,
        "fontWeight": "bold" if bold else "normal", "fill": color,
        "textAlign": align, "lineHeight": 1.28, "splitByGrapheme": True,
        "styles": {},
        "layerIndex": 1100, "ttsObjectId": uid()
    }


def base(number, section, title, subtitle):
    objects = [
        rect(0, 0, 1280, 720, BG, 0),
        rect(64, 49, 32, 4, ACCENT, 0),
        txt(f"{number:02d} / {section.upper()}", 110, 36, 1000, 18, ACCENT, True),
        txt(title, 64, 91, 1150, 38, INK, True),
        txt(subtitle, 66, 158, 1120, 18, MUTED),
        rect(64, 655, 1152, 1, LINE, 0),
        txt("TOWER OF HANOI  ·  RECURSION VISUALIZATION", 64, 671, 850, 16, MUTED),
        txt(f"{number:02d}", 1150, 671, 65, 18, ACCENT, True),
    ]
    return {
        "id": uid(), "canvas": {"version": "5.3.0", "objects": objects},
        "widgets": [], "ttsScript": "", "ttsOrder": []
    }


def add(slide, *objects):
    slide["canvas"]["objects"].extend(objects)


def card(slide, title, content, x, y, w, h, fill=GREEN, title_color=ACCENT,
         content_size=20):
    add(slide,
        rect(x, y, w, h, fill),
        txt(title, x + 24, y + 22, w - 48, 24, title_color, True),
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


def draw_peg(slide, center_x, base_y, disks, scale=1.0, label=""):
    """Draw a peg. disks are listed bottom-to-top using values 4..1."""
    rod_w = 10 * scale
    add(slide,
        rect(center_x - 83 * scale, base_y, 166 * scale, 9 * scale,
             "#9aa9a5", 3),
        rect(center_x - rod_w / 2, base_y - 116 * scale, rod_w, 116 * scale,
             "#9aa9a5", 3))
    colors = {1: "#f8d57e", 2: "#8bc6d1", 3: "#ef9a9a", 4: "#a5d6a7"}
    for level, value in enumerate(disks):
        width = (46 + value * 24) * scale
        y = base_y - (level + 1) * 22 * scale
        add(slide,
            rect(center_x - width / 2, y, width, 18 * scale,
                 colors.get(value, GOLD), 8, "#6e7d79", 1),
            txt(str(value), center_x - 15 * scale, y - 1 * scale,
                30 * scale, 13 * scale, INK, True, "center"))
    if label:
        add(slide, txt(label, center_x - 36 * scale, base_y + 13 * scale,
                       72 * scale, 15 * scale, MUTED, True, "center"))


def draw_scene(slide, x, y, w, peg_disks, scale=0.62):
    centers = [x + w * 0.17, x + w * 0.5, x + w * 0.83]
    for center, name in zip(centers, ["A", "B", "C"]):
        draw_peg(slide, center, y, peg_disks.get(name, []), scale, name)


slides = []

# 01 — Cover
s = base(1, "RECURSION FROM FIRST PRINCIPLES", "Tower of Hanoi｜河內塔",
         "三根柱子、大小不同的盤子，以及一個自然長成遞迴的解法。")
add(s,
    txt("把大問題拆成兩個相同的小問題", 66, 244, 790, 32, INK, True),
    txt("由來 → 規則 → 移花／搬動底盤／接木 → 完整動畫", 68, 302, 900, 22, MUTED),
    rect(68, 395, 212, 70, GREEN), txt("一次一個盤子", 86, 417, 178, 20, ACCENT, True),
    rect(300, 395, 212, 70, PEACH), txt("小盤在大盤上", 318, 417, 178, 20, ACCENT, True),
    rect(532, 395, 212, 70, GREEN), txt("三段遞迴", 550, 417, 178, 20, ACCENT, True),
    txt("本範例最後一頁使用專案原生動畫，可逐幀播放並開啟程式碼面板。",
        68, 552, 980, 18, MUTED))
draw_scene(s, 820, 520, 370, {"A": [4, 3, 2, 1], "B": [], "C": []}, 0.75)
slides.append(s)

# 02 — Origin
s = base(2, "ORIGIN", "由來：1883 年的數學益智遊戲",
         "真實歷史與 64 個黃金盤子的傳說要分開理解。")
card(s, "真實歷史",
     "法國數學家 Édouard Lucas 在 1883 年推出河內塔益智遊戲。\n\n"
     "它以「N. Claus de Siam」之名販售；這個名字是 Lucas d’Amiens 的字母重排。",
     64, 226, 548, 316, GREEN)
card(s, "遊戲傳說",
     "故事描述寺院中的僧侶，要依規則搬完 64 個黃金盤子；完成時世界將終結。\n\n"
     "這是伴隨遊戲流傳的包裝故事，不是古老事件的歷史紀錄。",
     668, 226, 548, 316, PEACH)
add(s,
    txt("64 個盤子最少需要 2⁶⁴−1 步；即使每秒一步，也要約 5,845 億年。",
        82, 570, 1110, 18, MUTED),
    txt("史料參考：ETH Zurich Library〈Tower of Hanoi〉；Lucas（1883）。",
        82, 607, 1110, 15, MUTED))
slides.append(s)

# 03 — Rules
s = base(3, "RULES", "規則：每一步都必須保持合法",
         "目標是把整座塔從 A 搬到 C；B 是過程中的輔助柱。")
card(s, "① 一次只能拿一個",
     "一次移動一個盤子，不能把一疊盤子當成同一個物件搬走。",
     64, 224, 355, 240, GREEN, content_size=19)
card(s, "② 只能拿最上面",
     "每根柱子只有最上方的盤子可以被取走。下面被壓住的盤子不能直接移動。",
     462, 224, 355, 240, PEACH, content_size=19)
card(s, "③ 小盤才能放大盤上",
     "盤子只能放在空柱，或放到比自己更大的盤子上；大盤不能壓在小盤上。",
     860, 224, 355, 240, GREEN, content_size=19)
draw_scene(s, 85, 576, 1110, {"A": [4, 3, 2, 1], "B": [], "C": []}, 0.58)
add(s,
    txt("起點", 144, 482, 160, 20, MUTED, True, "center"),
    txt("輔助", 560, 482, 160, 20, MUTED, True, "center"),
    txt("目標", 948, 482, 160, 20, MUTED, True, "center"))
slides.append(s)

# 04 — Recursive insight
s = base(4, "RECURSIVE INSIGHT", "為什麼自然會想到遞迴？",
         "若要搬動最大的底盤，必須先讓它上方的所有盤子離開。")
add(s, rect(64, 223, 440, 350, "#f5f8f6"))
draw_scene(s, 100, 510, 370, {"A": [4, 3, 2, 1], "B": [], "C": []}, 0.78)
add(s,
    txt("n 個盤子", 180, 248, 210, 27, ACCENT, True, "center"),
    txt("上面的 n−1 個盤子形成一座更小的河內塔。",
        105, 304, 360, 20, INK, False, "center"),
    rect(560, 222, 656, 104, GREEN),
    txt("先解決同一個問題：把 n−1 個盤子搬到輔助柱",
        590, 252, 596, 23, ACCENT, True),
    rect(560, 348, 656, 104, PEACH),
    txt("最大的底盤露出後，才能把它搬到目標柱",
        590, 378, 596, 23, ACCENT, True),
    rect(560, 474, 656, 104, GREEN),
    txt("最後再解一次 n−1：從輔助柱搬到目標柱",
        590, 504, 596, 23, ACCENT, True))
slides.append(s)

# 05 — Three stages
s = base(5, "THREE RECURSIVE STAGES", "移花、搬動底盤、接木",
         "以下以 4 個盤子從 A 搬到 C 為例；B 是中間柱。")
stages = [
    ("① 移花", "先把上面 3 個盤子\n從 A 搬到 B", GREEN,
     {"A": [4], "B": [3, 2, 1], "C": []}),
    ("② 搬動底盤", "把盤子 4\n從 A 搬到 C", PEACH,
     {"A": [], "B": [3, 2, 1], "C": [4]}),
    ("③ 接木", "把 3 個盤子\n從 B 搬到 C", GREEN,
     {"A": [], "B": [], "C": [4, 3, 2, 1]}),
]
for index, (heading, content, fill, state) in enumerate(stages):
    x = 64 + index * 398
    add(s, rect(x, 224, 356, 348, fill),
        txt(heading, x + 24, 244, 308, 24, ACCENT, True),
        txt(content, x + 24, 290, 308, 19, INK))
    draw_scene(s, x + 18, 520, 320, state, 0.48)
    if index < 2:
        add(s, txt("→", x + 361, 380, 34, 28, ACCENT, True, "center"))
add(s, txt("兩次 n−1 的遞迴，中間只直接搬動一次最大的底盤。",
           82, 600, 1110, 18, MUTED))
slides.append(s)

# 06 — Code mapping
s = base(6, "RECURSIVE CODE", "三個動作如何對應到程式碼？",
         "函式只需要描述一層；更小的塔交給同一個函式處理。")
pseudo = """void hanoi(int n, string from, string to, string aux) {
    if (n == 0) return;

    hanoi(n - 1, from, aux, to);  // 1. 移花
    move_one_disk(from, to);      // 2. 搬動底盤
    hanoi(n - 1, aux, to, from);  // 3. 接木
}"""
s["widgets"].append(widget("code", pseudo, 64, 222, 704, 352, 19))
card(s, "讀法",
     "from：目前來源柱\nto：這一層的目標柱\naux：暫存盤子的輔助柱\n\n"
     "基本情況 n=0：沒有盤子，不必做任何事。",
     808, 222, 408, 352, PEACH, content_size=19)
s["widgets"].append(widget("latex", r"T(n)=2T(n-1)+1=2^n-1",
                           274, 584, 760, 54, 28))
slides.append(s)

# 07 — Animation guide
s = base(7, "ANIMATION GUIDE", "接著播放完整動畫",
         "動畫使用 4 個盤子，同時呈現左側盤面、右側遞迴樹與搬運紀錄。")
card(s, "先看左側盤面",
     "紅色：這一層需要先移走的上方盤子。\n綠色：這一層真正要搬動的底盤。",
     64, 228, 354, 290, GREEN, content_size=19)
card(s, "再看遞迴樹",
     "每個節點表示一次 hanoi 呼叫。\n三個分支依序對應移花、Move、接木。",
     463, 228, 354, 290, PEACH, content_size=19)
card(s, "最後看右側 ans",
     "每次真正搬動一個盤子，Move 節點會用箭頭連到一筆搬運紀錄。",
     862, 228, 354, 290, GREEN, content_size=19)
add(s,
    txt("操作提示：下一頁可逐幀前進、返回上一幀，並開啟程式碼面板對照目前事件。",
        82, 560, 1110, 19, MUTED),
    txt("輸入：N = 4", 82, 604, 260, 20, ACCENT, True))
slides.append(s)

# 08 — Native algorithm animation
source = SOURCE.read_text(encoding="utf-8")
view_match = re.search(r"/\*\s*@asm-view\s*(\{.*?\})\s*@asm-view\s*\*/", source, re.S)
if not view_match:
    raise RuntimeError("Hanoi source is missing @asm-view JSON")
view = json.loads(view_match.group(1))
slides.append({
    "id": uid(), "kind": "algorithm-animation", "ttsScript": "", "ttsOrder": [],
    "canvas": {"objects": []}, "widgets": [],
    "animation": {
        "mode": "trace", "code": source, "input": "4\n", "sliceMode": "manual",
        "watches": [],
        "rebuild": {
            "view": view,
            "globals": {
                "eventSettings": {
                    "gapMs": 500,
                    "autoFixedEnabled": True,
                    "autoLoopBoundaryEnabled": False,
                    "defaultEnabled": {"declare": True},
                    "timelineTypes": {"declare": True, "read": False}
                }
            }
        }
    }
})


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
    "engineVersion": "8/1", "exportedAt": datetime.now(timezone.utc).isoformat(),
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
