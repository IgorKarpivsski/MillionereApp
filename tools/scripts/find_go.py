"""Prints the centre "x y" of the n-th (1-based) blue mission "go" button in a screenshot,
   counting from the top. Usage: find_go.py shot.png n"""
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
n = int(sys.argv[2])
W, H = im.size
px = im.load()
rows = {}
for y in range(int(H * 0.3), int(H * 0.88), 4):
    xs = [x for x in range(0, W // 2, 4) if abs(px[x, y][0] - 62) < 25 and abs(px[x, y][1] - 142) < 25 and abs(px[x, y][2] - 247) < 25]
    if len(xs) > 10:
        rows[y] = xs
clusters = []
for y in sorted(rows):
    if clusters and y - clusters[-1][-1] <= 8:
        clusters[-1].append(y)
    else:
        clusters.append([y])
clusters = [c for c in clusters if c[-1] - c[0] >= H * 0.025]
if len(clusters) < n:
    sys.exit(1)
c = clusters[n - 1]
xs = [x for y in c for x in rows[y]]
print((min(xs) + max(xs)) // 2, (c[0] + c[-1]) // 2)
