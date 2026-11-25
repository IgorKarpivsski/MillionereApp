"""The sloth's wardrobe: 7 categories x 15 items. Art is built in tools/wardrobe (layers on a fixed base).
Run: python3 catalog.py  -> catalog.json (used by the migration and the app)."""
import json
C = {
 'hat': [('cap_red','כובע מצחייה אדום'),('crown','כתר זהב'),('wizard','כובע קוסם'),('beanie','כובע צמר'),('cowboy','כובע בוקרים'),('pirate','כובע פיראטים'),('chef','כובע שף'),('party','כובע מסיבה'),('tophat','מגבעת'),('flowers','זר פרחים'),('viking','קסדת ויקינגים'),('bucket','כובע טמבל'),('grad','כובע סיום'),('headphones','אוזניות'),('bunny','אוזני ארנב')],
 'glasses': [('classic','משקפיים קלאסיות'),('aviator','משקפי טייסים'),('hearts','משקפי לבבות'),('stars','משקפי כוכבים'),('3d','משקפי תלת-ממד'),('swim','משקפי שחייה'),('ski','משקפי סקי'),('monocle','מונוקל'),('cateye','משקפי חתול'),('rainbow','משקפי קשת'),('shutter','משקפי תריס'),('visor','מגן עתידני'),('pixel','משקפי פיקסלים'),('roundgold','משקפיים עגולות זהב'),('sport','משקפי ספורט')],
 'earrings': [('hoops','חישוקי זהב'),('pearls','עגילי פנינים'),('stars','עגילי כוכבים'),('hearts','עגילי לבבות'),('bolt','עגילי ברק'),('diamonds','עגילי יהלומים'),('cherries','עגילי דובדבנים'),('moons','עגילי ירח'),('rainbow','עגילי קשת'),('feathers','עגילי נוצות'),('notes','עגילי תווים'),('strawberry','עגילי תותים'),('flowers','עגילי פרחים'),('drops','עגילי טיפה'),('balls','עגילי כדורגל')],
 'bracelet': [('beads','צמיד חרוזים'),('bangles','צמידי זהב'),('smartwatch','שעון חכם'),('friendship','צמיד חברות'),('diamond','צמיד יהלומים'),('sweat','מגיני זיעה'),('silver','שרשרת כסף'),('charms','צמיד קמעות'),('neon','צמידים זוהרים'),('shells','צמיד צדפים'),('rope','צמיד ימאים'),('wood','חרוזי עץ'),('goldwatch','שעון זהב'),('flowers','צמיד פרחים'),('pearl','צמיד פנינים')],
 'necklace': [('medal','מדליית זהב'),('chain','שרשרת זהב'),('pearls','מחרוזת פנינים'),('sharktooth','שן כריש'),('diamond','תליון יהלום'),('locket','תליון לב'),('lei','זר הוואי'),('bowtie','פפיון'),('tie','עניבה'),('scarf','צעיף'),('whistle','משרוקית'),('star','תליון כוכב'),('bandana','בנדנה'),('crystal','תליון קריסטל'),('bulb','תליון נורה')],
 'outfit': [('hoodie',"קפוצ'ון"),('tux','חליפה'),('hero','חליפת גיבור'),('jersey','חולצת ספורט'),('stardress','שמלת כוכבים'),('space','חליפת חלל'),('doctor','חלוק רופא'),('chefcoat','מעיל שף'),('pirate','בגדי פיראט'),('robe','גלימת קוסם'),('hawaii','חולצת הוואי'),('puffer','מעיל פוך'),('overalls',"סרבל ג'ינס"),('armor','שריון אביר'),('gown','שמלת נסיכה')],
 'shoes': [('sneakers','סניקרס'),('rainboots','מגפי גשם'),('flipflops','כפכפים'),('cowboy','מגפי בוקרים'),('ballet','נעלי בלט'),('cleats','נעלי כדורגל'),('space','מגפי חלל'),('skates','גלגיליות'),('slippers','נעלי בית'),('curly','נעלי קוסם'),('gold','נעלי זהב'),('hiking','נעלי הליכה'),('lightup','נעליים מאירות'),('clown','נעלי ליצן'),('iceskates','מחליקיים')],
}
# premium (gems) items: shiny / gold / diamond / showpieces
GEMS = {'hat_crown':150,'hat_viking':80,'glasses_aviator':60,'glasses_visor':80,'earrings_diamonds':80,'earrings_hoops':50,
        'bracelet_diamond':100,'bracelet_goldwatch':80,'necklace_diamond':100,'necklace_chain':70,'outfit_armor':150,'outfit_gown':120,
        'outfit_space':100,'shoes_gold':100}
COIN_STEPS = [400, 400, 700, 700, 1100, 1100, 1600, 1600, 2400, 2400, 3300, 3300, 4500]
FREE = {'glasses_classic'}
# only from the login streak (not sold): days -> item
STREAK = {'glasses_stars': 7, 'necklace_star': 14, 'shoes_lightup': 21, 'outfit_hero': 30}
CAT_BONUS = {'hat': 1.0, 'glasses': 0.8, 'earrings': 0.6, 'bracelet': 0.6, 'necklace': 0.8, 'outfit': 1.5, 'shoes': 1.0}
items = []
for cat, lst in C.items():
    k = 0
    for slug, he in lst:
        iid = f'{cat}_{slug}'
        if iid in FREE:
            price, cur = 0, 'coins'
        elif iid in STREAK:
            price, cur = 0, 'coins'
        elif iid in GEMS:
            price, cur = GEMS[iid], 'gems'
        else:
            price, cur = int(round(COIN_STEPS[min(k, len(COIN_STEPS) - 1)] * CAT_BONUS[cat] / 50) * 50), 'coins'
            k += 1
        it = {'id': 'w_' + iid, 'cat': cat, 'name': he, 'price': price, 'currency': cur}
        if iid in STREAK: it['streak'] = STREAK[iid]
        items.append(it)
json.dump(items, open('catalog.json', 'w'), ensure_ascii=False, indent=1)
print(len(items))
