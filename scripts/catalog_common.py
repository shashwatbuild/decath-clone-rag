"""Shared helpers for turning a parsed decathlon.in PDP into a catalogue product."""


def clean(s):
    return (s or '').strip().strip('"').strip()


def kv(lst):
    return [{'name': clean(x.get('name')).capitalize() if x.get('name', '').isupper() else clean(x.get('name')),
             'value': clean(x.get('description'))}
            for x in sorted(lst or [], key=lambda x: x.get('order', 0)) if x.get('description')]


TAGS = {'new': 'New arrival', 'drop': 'Price drop', 'clearance': 'Clearance', 'onlyonline': 'Only online'}


def build_product(pid, d, cat, sport, short=None):
    price = d.get('price') or {}
    review = d.get('review') or {}
    images = [m['url'] for m in sorted(d.get('media') or [], key=lambda m: m.get('order', 0))
              if m.get('type') == 'image'][:7]
    sizes = [a['value'] for a in sorted(d.get('articles') or [], key=lambda a: a.get('order', 0))
             if a.get('value') and a.get('value') not in ('NO SIZE', 'No Size')]
    sticker = (d.get('stickers') or {}).get('name')
    return {
        'id': pid,
        'slug': d.get('slug'),
        'name': clean(d.get('productName')),
        'shortName': short or clean(d.get('productName')),
        'brand': d.get('brand'),
        'category': cat,
        'sport': sport,
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
        'tag': TAGS.get(sticker, None),
        'offers': list(dict.fromkeys(clean(p.get('shortDescription')) for p in d.get('promotions') or [] if p.get('shortDescription'))),
        'benefits': [{'name': clean(b.get('name')).capitalize(), 'value': clean(b.get('description'))}
                     for b in d.get('benefits') or []],
        'technicalInformation': kv(d.get('technicalInformation')),
        'specifications': kv(d.get('productSpecifications')),
        'materialAndCare': kv(d.get('materialAndCare')),
        'breadcrumbs': [b['name'] for b in sorted(d.get('breadcrumbs') or [], key=lambda b: -b.get('order', 0))],
        'sourceUrl': f"https://www.decathlon.in/p/{pid}/{d.get('slug')}",
    }
