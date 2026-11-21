"""Builds public/data/questions.json for the live show from the repo's kids question bank.
Retired question ids (from the server) are listed in tools/retired.txt."""
import json, pathlib
here = pathlib.Path(__file__).resolve().parent
root = here.parents[2]
ret = {'q_' + x for x in (here / 'retired.txt').read_text().strip().split(',') if x}
WORLD = {'legends': 'football'}
out = []
for line in (root / 'content/kids/questions.jsonl').open(encoding='utf-8'):
    r = json.loads(line)
    if r['id'] in ret: continue
    a = r['answers_he']
    if len(a) != 4 or len(set(a)) != 4: continue
    img = r.get('image') or None
    item = {'i': r['id'][2:], 'w': WORLD.get(r['category'], r['category']), 'd': r['difficulty'][0],
            'q': r['text_he'], 'a': a, 'e': r.get('explanation_he') or ''}
    if img and img.get('url'): item['m'] = img['url']
    out.append(item)
p = here.parent / 'public/data/questions.json'
p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
from collections import Counter
print(len(out), p.stat().st_size // 1024, 'KB', Counter(o['w'] for o in out), Counter(o['d'] for o in out), sum('m' in o for o in out))
