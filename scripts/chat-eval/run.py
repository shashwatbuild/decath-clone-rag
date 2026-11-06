"""Send a conversation set to /api/chat and print compact results. usage: python3 run.py cases.json"""
import json, sys, urllib.request
cases = json.load(open(sys.argv[1]))
def ask(msg, ctx=None, pid=None, hist=None, lst=None, foc=None):
    body = json.dumps({"message": msg, "contextIds": ctx or [], "listIds": lst or [], "lastFocusId": foc, "productId": pid, "history": hist or []}).encode()
    req = urllib.request.Request("http://localhost:3000/api/chat", body, {"content-type": "application/json"})
    text, meta = "", {}
    for line in urllib.request.urlopen(req, timeout=120).read().decode().splitlines():
        e = json.loads(line)
        if e["type"] == "meta": meta = e
        elif e["type"] == "text": text += e["delta"]
        elif e["type"] == "replace": text = e["text"]
    return text, meta
for case in cases:
    turns = case if isinstance(case, list) else [case]
    ctx, hist, lst, foc = [], [], [], None
    for t in turns:
        text, meta = ask(t, ctx, None, hist, lst, foc)
        prods = meta.get("products") or []
        ctx = [p["id"] for p in prods] or ctx
        if len(prods) > 1: lst = [p["id"] for p in prods]
        if len(prods) == 1: foc = prods[0]["id"]
        hist += [{"role": "user", "text": t}, {"role": "assistant", "text": text}]
        print(f"Q: {t}\n   cards={[p['shortName'] for p in prods][:5]}{' +compare' if meta.get('compare') else ''}{' ACTION='+str(meta.get('action')) if meta.get('action') else ''}\n   A: {text[:420].replace(chr(10),' | ')}\n")
    print("=" * 60)
