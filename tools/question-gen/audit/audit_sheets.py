"""Downloads every picture question's photo and renders review sheets (12 per sheet) with the
question and its correct answer under each photo, shown whole (never cropped).
Input: tools/question-gen/audit/photos.tsv (id, world, url, w, h, question, answer).
Output: data/photo-audit/sheets/sNNN.jpg, data/photo-audit/index.tsv, data/photo-audit/failed.tsv"""
import concurrent.futures as cf, io, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont
from bidi.algorithm import get_display

SRC = 'tools/question-gen/audit/photos.tsv'
OUT = 'data/photo-audit'
UA = 'HaAlufTrivia/1.0 (photo review; https://github.com/IgorKarpivsski/MillionereApp)'
PREFIX = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'
CELL_W, IMG_H, TXT_H, COLS, ROWS = 400, 300, 92, 3, 4
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
BOLD = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)

rows = [l.rstrip('\n').split('\t') for l in open(SRC, encoding='utf-8') if l.strip()]
os.makedirs(f'{OUT}/sheets', exist_ok=True)

def fetch(r):
    url = r[2].replace('~', PREFIX, 1) if r[2].startswith('~') else r[2]
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return r[0], Image.open(io.BytesIO(resp.read())).convert('RGB'), ''
        except Exception as e:  # noqa: BLE001
            err = str(e)
            time.sleep(2 + attempt * 3)
    return r[0], None, err

imgs, failed = {}, []
with cf.ThreadPoolExecutor(6) as ex:
    for qid, im, err in ex.map(fetch, rows):
        if im is None:
            failed.append((qid, err))
        else:
            im.thumbnail((CELL_W - 10, IMG_H - 10))
            imgs[qid] = im

def wrap(text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if font.getlength(get_display(t)) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines[:2]

per = COLS * ROWS
index = []
for s in range(0, len(rows), per):
    sheet = Image.new('RGB', (COLS * CELL_W, ROWS * (IMG_H + TXT_H)), 'white')
    d = ImageDraw.Draw(sheet)
    for k, r in enumerate(rows[s:s + per]):
        x, y = (COLS - 1 - k % COLS) * CELL_W, (k // COLS) * (IMG_H + TXT_H)  # right to left
        n = s + k + 1
        d.rectangle([x, y, x + CELL_W - 1, y + IMG_H + TXT_H - 1], outline='#999')
        im = imgs.get(r[0])
        if im:
            sheet.paste(im, (x + (CELL_W - im.width) // 2, y + (IMG_H - im.height) // 2))
        else:
            d.text((x + 120, y + 130), 'FAILED TO LOAD', fill='red', font=BOLD)
        d.rectangle([x, y, x + 64, y + 26], fill='black')
        d.text((x + 4, y + 3), str(n), fill='yellow', font=BOLD)
        ty = y + IMG_H + 4
        for line in wrap(r[5], FONT, CELL_W - 12):
            d.text((x + CELL_W - 6 - FONT.getlength(get_display(line)), ty), get_display(line), fill='black', font=FONT); ty += 21
        ans = '✓ ' + r[6]
        d.text((x + CELL_W - 6 - BOLD.getlength(get_display(ans)), ty + 2), get_display(ans), fill='#0a7d2c', font=BOLD)
        index.append((n, s // per, r[0], r[1]))
    sheet.save(f'{OUT}/sheets/s{s // per:03d}.jpg', quality=72)

with open(f'{OUT}/index.tsv', 'w', encoding='utf-8') as f:
    for n, sh, qid, world in index:
        f.write(f'{n}\t{sh}\t{qid}\t{world}\n')
with open(f'{OUT}/failed.tsv', 'w', encoding='utf-8') as f:
    for qid, err in failed:
        f.write(f'{qid}\t{err}\n')
print('photos', len(rows), 'loaded', len(imgs), 'failed', len(failed), 'sheets', (len(rows) + per - 1) // per)
