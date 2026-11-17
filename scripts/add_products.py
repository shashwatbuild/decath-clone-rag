"""Add real decathlon.in products to the catalogue (append only; existing ids are kept untouched).
usage: python3 -I add_products.py <pdp_cache_dir> <products.json>
Downloads each product page, parses it with parse_pdp, and appends it to products.json.
"""
import json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_pdp import parse
from catalog_common import build_product

# category -> sport (sport links gear for "Frequently bought together")
SPORT = {
    'Badminton Rackets': 'Badminton', 'Shuttlecocks': 'Badminton', 'Badminton Shoes': 'Badminton',
    'Badminton Bags': 'Badminton', 'Badminton Accessories': 'Badminton', 'Badminton Apparel': 'Badminton',
    'Running Shoes': 'Running', 'Running Shorts': 'Running', 'Running Tops': 'Running', 'Running Socks': 'Running',
    'Hydration & Nutrition': 'Running', 'Running Caps': 'Running', 'Running Watches': 'Running',
}

NEW = {
    'Shuttlecocks': {
        '8535103': 'PSC 500 Plastic Shuttles x6', '8651644': 'PSC 900 Plastic Shuttles x6',
        '8373140': 'FSC 100 Feather Shuttles x12', '8490802': 'FSC 560 Feather Shuttles x12',
        '8490815': 'FSC 930 Feather Shuttles x12', '8873099': 'PSC 130 Outdoor Shuttles x3',
    },
    'Badminton Shoes': {
        '8881788': 'BS 190 Strap Shoes', '8579816': 'BS 530 Shoes', '8736141': 'BS Lite 560 Shoes',
        '8804522': 'BS Sensation 530 Shoes',
    },
    'Badminton Bags': {'961592': 'BL 530 Kit Bag', '8807680': 'BL 560 Kit Bag', '8737293': 'BL 530 Kit Bag Blue'},
    'Badminton Accessories': {
        '8811889': 'Wave Overgrip', '8553109': 'Superior Grip x2', '8552628': 'Comfort Grip',
        '8579969': 'Comfort Overgrip x3',
    },
    'Badminton Apparel': {
        '8644134': 'Badminton T-Shirt 530', '8858600': 'Lite Badminton T-Shirt 560',
        '8843188': 'Badminton Shorts Sensation 530', '8891383': 'Badminton Shorts 560',
    },
    'Running Shoes': {
        '8936235': 'Run 50 Entry Shoes', '8873070': 'Kiprun Kipcore 500', '8960540': 'Kiprun Kipride',
        '8772865': 'Kiprun KS500 2 Long Distance',
    },
    'Running Shorts': {
        '8817443': 'Run 100 Running Shorts', '8588345': 'Run 500 Seamless Shorts',
        '8830912': 'Run 500 Comfort Shorts', '8960456': 'Run 500 2-in-1 Shorts',
    },
    'Running Tops': {
        '8941360': 'Run 100 Tank Top', '8882446': 'Run 500 Comfort Tank Top',
        '8970014': 'Run 900 Light Tank Top', '8978072': 'Run 900 Running T-Shirt',
    },
    'Running Socks': {
        '8296178': 'Essential Socks 3-Pack', '8810970': 'Run 500 Fine Socks x2',
        '8939333': 'Run 900 Compression Socks', '8901348': 'Run 900 Invisible Socks',
    },
    'Hydration & Nutrition': {
        '8759517': 'Running Belt 2x250ml', '8645720': 'Hydration & Gel Belt', '8488150': 'Race Number Belt',
        '8605419': 'Soft Flask 500ml',
    },
    'Running Caps': {'8912559': 'Ultra-light Running Cap', '8841147': 'Running Visor V2', '8487580': 'Adjustable Running Cap'},
    'Running Watches': {'1000001029': 'Coros Pace 3 GPS Watch', '1000005737': 'Coros Pace 4 GPS Watch', '8801209': 'Heart Rate Monitor Belt'},
}

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'


def fetch(pid, cache):
    path = os.path.join(cache, pid + '.html')
    if not os.path.exists(path):
        req = urllib.request.Request(f'https://www.decathlon.in/p/{pid}/x', headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=40) as r:
            open(path, 'wb').write(r.read())
        time.sleep(0.8)  # be polite
    return open(path, encoding='utf-8').read()


cache, out = sys.argv[1], sys.argv[2]
os.makedirs(cache, exist_ok=True)
catalogue = json.load(open(out))
have = {p['id'] for p in catalogue}
added, problems = [], []
for cat, items in NEW.items():
    for pid, short in items.items():
        if pid in have:
            continue
        try:
            d = parse(fetch(pid, cache))
            p = build_product(pid, d, cat, SPORT[cat], short)
        except Exception as e:  # keep going; report at the end
            problems.append((pid, repr(e)[:100]))
            continue
        if not p['price'] or not p['images'] or not p['name']:
            problems.append((pid, 'missing price/images/name'))
            continue
        catalogue.append(p)
        added.append(p)

# the existing rackets move into the new "Badminton Rackets" category
for p in catalogue:
    if p['category'] == 'Badminton':
        p['category'] = 'Badminton Rackets'

json.dump(catalogue, open(out, 'w'), indent=2, ensure_ascii=False)
for p in added:
    print(p['id'], p['category'], p['price'], p['mrp'], p['rating'], p['reviewCount'], len(p['images']), len(p['sizes']), p['inStock'], p['name'][:55])
print('added', len(added), 'problems', problems)
