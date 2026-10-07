"""Picture questions: "which club's home is marked on the map?"

Sources: Wikidata (CC0) club coordinates (home city P159 → P625, else the
stadium's P625) and hewiki titles for names. Maps: tools/maps/gen-maps.py.

Distractors are clubs whose home is far from the pin (25 km in Israel,
300 km in Europe), so no other option can sit under the same marker.

    python3 tools/question-gen/gen_maps.py <data/wikidata dir> > maps.sql
"""
import hashlib, json, math, random, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from qcore import GEN_VERSION, clean_he_title  # noqa: E402

D = Path(sys.argv[1])
rng = random.Random(20261007)

def load(n):
    return json.load(open(D / f"{n}.json"))

def point(s):
    lon, lat = s.removeprefix("Point(").removesuffix(")").split()
    return float(lon), float(lat)

def km(a, b):
    (lo1, la1), (lo2, la2) = a, b
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))

BBOX = {"israel": (33.95, 29.35, 36.05, 33.45), "europe": (-11.5, 35.0, 31.0, 61.5)}
def inside(m, ll, pad):
    lon0, lat0, lon1, lat1 = BBOX[m]
    return lon0 + pad <= ll[0] <= lon1 - pad and lat0 + pad <= ll[1] <= lat1 - pad

coords = {}
for r in load("club_coords"):
    c = r["c"]
    if r.get("cityCoord"):
        coords[c] = ("city", point(r["cityCoord"]))
    elif r.get("venueCoord") and coords.get(c, ("", None))[0] != "city":
        coords[c] = ("venue", point(r["venueCoord"]))

city_he = {}
for r in load("club_facts"):
    name = r.get("cityHe") or r.get("venueCityHe")
    if name and r["c"] not in city_he:
        city_he[r["c"]] = name

def clubs(file, israeli):
    """One entry per display name; women's/youth sides dropped by their raw title, best-known kept."""
    best = {}
    for r in load(file):
        c, he, sl = r["c"], r.get("he"), int(r.get("sl") or 0)
        if not he or c not in coords:
            continue
        if any(w in he for w in ("בנות", "נשים", "נוער", "עד גיל")) or he.startswith("נבחרת"):
            continue
        name = clean_he_title(he)
        if len(name) > 28:
            continue
        if name not in best or best[name]["sl"] < sl:
            best[name] = {"c": c, "he": name, "sl": sl, "ll": coords[c][1], "israeli": israeli}
    return list(best.values())

CITY_ALIAS = {"סח'נין": "סכנין"}

def city_in_name(city, name):
    """The club's own name confirms the city (guards against wrong HQ data)."""
    city = CITY_ALIAS.get(city, city)
    flat = lambda t: t.replace("-", " ").replace("'", "").replace('"', "")
    n = flat(name).replace(" ", "")
    return any(len(tok) >= 3 and tok in n for tok in flat(city).split())

isr = [x for x in clubs("clubs_israeli", True)
       if inside("israel", x["ll"], 0.05) and x["sl"] >= 3 and city_he.get(x["c"]) and city_in_name(city_he[x["c"]], x["he"])]
eur = sorted((x for x in clubs("clubs_top", False) if inside("europe", x["ll"], 0.4) and x["sl"] >= 35), key=lambda x: -x["sl"])[:130]
print(f"-- israeli clubs {len(isr)}, european clubs {len(eur)}", file=sys.stderr)

rows = []
for pool, mapname, min_km, top_sl in ((isr, "israel", 25, 60), (eur, "europe", 300, 150)):
    pool = sorted(pool, key=lambda x: -x["sl"])
    for pos, club in enumerate(pool):
        far = [o for o in pool if o["c"] != club["c"] and km(o["ll"], club["ll"]) >= min_km]
        # Distractors: other well-known clubs, spread over the map.
        cand = sorted(far, key=lambda o: -o["sl"])[:40]
        if len(cand) < 3:
            continue
        wrong = rng.sample(cand, 3)
        lon, lat = club["ll"]
        obsc = round(0.25 + 0.7 * pos / max(1, len(pool) - 1), 4)
        diff = "easy" if obsc < 0.4 else "medium" if obsc < 0.6 else "hard" if obsc < 0.8 else "expert"
        city = city_he.get(club["c"])
        if city and city_in_name(city, club["he"]):
            expl = f"{club['he']} משחקת ב{CITY_ALIAS.get(city, city)}."
        else:
            expl = f"המיקום המסומן הוא הבית של {club['he']}."
        qid = "q_" + hashlib.sha1(f"map:{club['c']}".encode()).hexdigest()[:16]
        rows.append({
            "id": qid, "cat": "israeli_football" if club["israeli"] else "clubs",
            "diff": diff, "text": "המיקום שמסומן במפה הוא הבית של איזו קבוצה?",
            "expl": expl, "tags": {"club": club["c"]}, "template": f"map:club_home:{mapname}",
            "src": [f"https://www.wikidata.org/wiki/{club['c']}"], "obsc": obsc,
            "image": {"kind": "map", "map": mapname, "lon": round(lon, 4), "lat": round(lat, 4)},
            "answers": [club["he"]] + [w["he"] for w in wrong],
        })

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

print("begin;")
for r in rows:
    print(
        "insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, tags, template, source_urls, verified_by, generator, obscurity, image) values ("
        f"{q(r['id'])}, {q(r['cat'])}, 'clubs', {q(r['diff'])}, {q(r['text'])}, {q(r['expl'])}, {q(json.dumps(r['tags']))}::jsonb, {q(r['template'])}, "
        f"array[{', '.join(q(s) for s in r['src'])}], 'wikidata', {q(GEN_VERSION + '-maps')}, {r['obsc']}, {q(json.dumps(r['image']))}::jsonb) on conflict (id) do nothing;"
    )
    vals = ", ".join(f"({q(r['id'])}, {i}, {q(a)}, {'true' if i == 0 else 'false'})" for i, a in enumerate(r["answers"]))
    print(f"insert into public.question_answers (question_id, position, text_he, is_correct) values {vals} on conflict do nothing;")
print("select public.refresh_question_ranks();")
print("commit;")
print(f"-- {len(rows)} map questions", file=sys.stderr)
