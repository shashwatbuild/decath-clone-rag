"""Build a clean products.json from downloaded PDP HTML files.
usage: python3 -I build_catalog.py <pdp_dir> <out.json>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_pdp import parse

CATS = {
    'Running Shoes': ['8960547', '8958673', '8940046', '9001242'],
    'Yoga Pants': ['9030986', '9030989', '8881558', '8975729', '8966109', '8737177', '8935688', '8603213',
                   '8935716', '8560854', '8872652', '8827357'],
    'Backpacks': ['8735043', '8581388', '8751964', '8843416'],
    'Footballs': ['8789910', '8827905', '8968122', '8968127'],
    'Yoga Mats': ['8665059', '8965434', '8600557', '8600698'],
    'Badminton': ['8515767', '8851501', '8579601', '8826725'],
    'Cycles': ['8515669', '8988443', '8389398', '8591166'],
    'T-Shirts': ['8842237', '8660163', '8667940', '8488034'],
}
SPORT = {'Running Shoes': 'Running', 'Yoga Pants': 'Yoga', 'Backpacks': 'Hiking',
         'Footballs': 'Football', 'Yoga Mats': 'Yoga', 'Badminton': 'Badminton',
         'Cycles': 'Cycling', 'T-Shirts': 'Gym & Fitness'}

# Short display names used by the chat assistant (the full catalogue titles are long)
SHORT = {
    '8960547': 'Kiprun Kipride Max', '8958673': 'Kiprun Kipcore Premium', '8940046': 'Kiprun KS900 Support',
    '9001242': 'Kiprun Kipclimb Trail', '9030986': 'Soft Flared Yoga Trackpants', '9030989': 'High-Waisted Yoga Capri',
    '8881558': 'Dhoti Yoga Pants', '8975729': 'Velour Yoga & Pilates Trousers', '8735043': 'MT100 50L Backpack',
    '8581388': 'MT500 Air 50+10L Backpack', '8751964': 'MT900 Symbium 70+10L Backpack', '8843416': 'MT900 Ultra-light 50L Backpack',
    '8789910': 'Machine-Stitched Training Ball', '8827905': 'Thermobonded FIFA Quality Pro Ball', '8968122': 'Club Ball Resist',
    '8968127': 'FIFA Quality Match Ball', '8665059': '8mm Gentle Yoga Mat', '8965434': '4mm Beginner Yoga Mat',
    '8600557': '6mm Grip Yoga Mat', '8600698': '1.3mm Foldable Travel Yoga Mat', '8515767': 'BR 100 Racket',
    '8851501': 'BR 130 Family Racket Set', '8579601': 'BR 160 Racket', '8826725': 'BR Lite 900 Racket',
    '8515669': 'Triban RC100 Road Bike', '8988443': 'Rockrider Explore 40 MTB', '8389398': 'Riverside 120 Hybrid',
    '8591166': 'Rockrider ST120 MTB', '8842237': 'Gym Compression T-Shirt', '8660163': 'Recycled Polyester Gym T-Shirt',
    '8667940': 'Sportee Cotton T-Shirt', '8488034': 'Kiprun 100 Running T-Shirt',
    '8966109': 'Second-Skin Long Yoga Leggings', '8737177': '7/8 Seamless Dynamic Yoga Leggings',
    '8935688': 'Seamless Yoga & Pilates Leggings', '8603213': 'High-Waisted 7/8 Yoga Leggings',
    '8935716': 'Loose-Fit Flared Yoga Trackpants', '8560854': 'Gentle Maternity Yoga Trackpants',
    '8872652': 'Adjustable Yoga Trackpants 500', '8827357': 'Yoga Retreat Bottoms',
}


def clean(s):
    return (s or '').strip().strip('"').strip()


def kv(lst):
    return [{'name': clean(x.get('name')).capitalize() if x.get('name', '').isupper() else clean(x.get('name')),
             'value': clean(x.get('description'))}
            for x in sorted(lst or [], key=lambda x: x.get('order', 0)) if x.get('description')]


pdp_dir, out = sys.argv[1], sys.argv[2]
products = []
for cat, ids in CATS.items():
    for pid in ids:
        d = parse(open(os.path.join(pdp_dir, pid + '.html')).read())
        price = d.get('price') or {}
        review = d.get('review') or {}
        images = [m['url'] for m in sorted(d.get('media') or [], key=lambda m: m.get('order', 0))
                  if m.get('type') == 'image'][:7]
        sizes = [a['value'] for a in sorted(d.get('articles') or [], key=lambda a: a.get('order', 0))
                 if a.get('value') and a.get('value') not in ('NO SIZE', 'No Size')]
        sticker = (d.get('stickers') or {}).get('name')
        products.append({
            'id': pid,
            'slug': d.get('slug'),
            'name': clean(d.get('productName')),
            'shortName': SHORT.get(pid) or clean(d.get('productName')),
            'brand': d.get('brand'),
            'category': cat,
            'sport': SPORT[cat],
            'gender': 'Unisex' if (d.get('gender') or 'NO').upper().startswith('NO') else d['gender'].title(),
            'price': price.get('sellingPrice'),
            'mrp': price.get('mrp'),
            'rating': round(review.get('averageRating') or 0, 1),
            'reviewCount': review.get('count') or 0,
            'recommendedCount': review.get('countRecommended') or 0,
            'images': images,
            'description': clean(d.get('description')),
            'madeFor': clean(d.get('madeFor')),
            'warrantyYears': int(d['warranty']) if str(d.get('warranty') or '').isdigit() else None,
            'madeIn': d.get('madeIn'),
            'sizes': sizes,
            'weightKg': min((a['weight'] for a in d.get('articles') or [] if isinstance(a.get('weight'), (int, float)) and a['weight'] > 0), default=None),
            'inStock': bool(d.get('inStock')),
            'tag': {'new': 'New arrival', 'drop': 'Price drop', 'clearance': 'Clearance',
                    'onlyonline': 'Only online'}.get(sticker, None),
            'offers': list(dict.fromkeys(clean(p.get('shortDescription')) for p in d.get('promotions') or [] if p.get('shortDescription'))),
            'benefits': [{'name': clean(b.get('name')).capitalize(), 'value': clean(b.get('description'))}
                         for b in d.get('benefits') or []],
            'technicalInformation': kv(d.get('technicalInformation')),
            'specifications': kv(d.get('productSpecifications')),
            'materialAndCare': kv(d.get('materialAndCare')),
            'breadcrumbs': [b['name'] for b in sorted(d.get('breadcrumbs') or [], key=lambda b: -b.get('order', 0))],
            'sourceUrl': f"https://www.decathlon.in/p/{pid}/{d.get('slug')}",
        })

json.dump(products, open(out, 'w'), indent=2, ensure_ascii=False)
for p in products:
    print(p['id'], p['category'], p['price'], p['mrp'], p['rating'], p['reviewCount'], len(p['images']), len(p['sizes']), p['tag'], p['name'][:60])
