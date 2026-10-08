# Question generator

Builds the Hebrew question bank from open data. No question is written by hand
or by a language model: every question is a template filled with a fact from a
dataset, and every fact keeps its source links.

## Sources (both CC0 / public domain)

| Source | What | How it is fetched |
| --- | --- | --- |
| [Wikidata](https://www.wikidata.org) | Competition winners, players, clubs, stadiums, Ballon d'Or, Hebrew names (via Hebrew Wikipedia titles) | `fetch-wikidata*.mjs`, run by the `Fetch football data` workflow |
| [openfootball](https://github.com/openfootball) | World Cup matches 1930–2026, league results 2010/11 onwards | `git clone` |

## Accuracy rules

- Hebrew names come from Hebrew Wikipedia article titles (vetted), not Wikidata labels (vandalism was found in labels).
- Winners covered by both sources (World Cup, top-5 league champions since 2010/11) must agree, or the fact is dropped.
- Two different winners recorded for one season → dropped.
- Birth years, founding years and stadiums need a cited Wikidata statement (or, for founding years and stadiums, a very well-known club).
- Distractors are checked against the full data: a "which club did X play for" option is never a club X played for, including reserve teams.
- People famous for something other than football are excluded; ambiguous names are excluded.
- Facts that change (stadiums, title counts) are flagged `volatile` and get a review date.
- Women players get feminine verb forms.

## Run

```bash
git clone --depth 1 https://github.com/openfootball/worldcup.json   $OF/worldcup.json
git clone --depth 1 https://github.com/openfootball/football.json   $OF/football.json
python3 tools/question-gen/generate.py --openfootball $OF --out content/questions
```

Output: `content/questions/questions.jsonl` (one question per line, answer 0 is correct)
and `content/questions/report.json` (counts, rejections, cross-check results).

## General knowledge (13 worlds)

`fetch-general.mjs` (GitHub Actions, `Fetch general knowledge data` on the data-fetch branch) pulls
countries, cities, rivers, landmarks, animals, elements, people, books, films, paintings, music and more
from Wikidata, Hebrew Wikipedia titles for every name, and author + license for every Wikimedia Commons image.

```bash
python3 tools/question-gen/gen_general.py --data data/general --out content/general
```

Every photo question carries `image: {kind: "photo", url, credit, license, page}`; the app shows the
credit line under the picture. Sensitive subjects (terror, the Holocaust, notorious figures) are filtered out.
