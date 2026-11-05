# Gera editor/js/tutorial/data/*.json a partir dos recursos extraídos do Tutorial.exe.
import json, re, glob, os, sys
T = sys.argv[1]          # pasta tut/ com *_js e *_qm.json
OUT = sys.argv[2]        # editor/js/tutorial/data
os.makedirs(OUT, exist_ok=True)
LANGS = {"ja_JP": "00044f18_qm.json", "en": "0004f621_qm.json", "zh_CN": "0005bbec_qm.json"}
tr = {}
for lang, f in LANGS.items():
    for m in json.load(open(os.path.join(T, f), encoding="utf-8"))["messages"]:
        v = (m.get("translations") or [None])[0]
        if v is not None:
            tr.setdefault((m["context"], m["source"]), {})[lang] = v

def parse_scenario(src):
    body = src[src.index("["):src.rindex("]") + 1]
    body = re.sub(r'qsTr\("([^"]*)"\)', r'"\1"', body)
    return json.loads(body)

files = {}
for f in sorted(glob.glob(os.path.join(T, "*_js"))):
    s = open(f, encoding="utf-8-sig").read()
    if s.lstrip().startswith("var list"):
        continue
    files[f] = parse_scenario(s)

def norm(x):
    return re.sub(r"\s+", "", (x or "").replace("...", ""))[:12]

mapping = {}
for f, sc in files.items():
    best = None
    for k in range(1, 20):
        ctx = f"TutorialStep{k}"
        score = 0
        for e in sc:
            j = tr.get((ctx, e["hint"]), {}).get("ja_JP")
            if j and norm(j) == norm(e["name"]):
                score += 1
        if not best or score > best[1]:
            best = (k, score)
    mapping[f] = best
used = sorted(b[0] for b in mapping.values())
assert used == list(range(1, 20)), (used, mapping)

ICONS = set()
steps = []
for f, sc in files.items():
    k = mapping[f][0]
    ctx = f"TutorialStep{k}"
    items = []
    for e in sc:
        t = tr.get((ctx, e["hint"]), {})
        ICONS.add(e["icon"])
        items.append({
            "id": e["id"], "folder": e["folder"], "x": e["x"], "y": e["y"], "windowKey": e["windowKey"],
            "condition": e["condition"], "icon": e["icon"], "jump": e["jump"], "jumpNo": e["jumpNo"],
            "command": e["command"], "showArrow": e["showArrow"], "prohibited": e["prohibited"],
            "text": {"en": t.get("en", ""), "ja_JP": t.get("ja_JP", e["name"]), "zh_CN": t.get("zh_CN", "")}
        })
    title = tr.get(("TutorialList", f"#{k}"), {})
    data = {"step": k, "title": title, "items": items}
    json.dump(data, open(os.path.join(OUT, f"step{k}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    steps.append({"step": k, "file": f"step{k}.json", "title": title, "count": len(items)})
steps.sort(key=lambda s: s["step"])
json.dump(steps, open(os.path.join(OUT, "list.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# textos de interface do Tutorial.exe (contexto "Tutorial" = textos dos dados de exemplo; "TutorialManager")
ui = {}
for (c, s), v in tr.items():
    if c in ("TutorialManager", "main", "TutorialSettingItem", "AlertDialog"):
        ui.setdefault(c, {})[s] = v
json.dump(ui, open(os.path.join(OUT, "ui.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", {os.path.basename(f): v for f, v in mapping.items()}, ICONS)
