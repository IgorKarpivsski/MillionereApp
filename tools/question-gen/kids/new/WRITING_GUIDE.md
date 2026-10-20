# Writing new kids questions for "טריוויה - האלוף"

Audience: Israeli kids and teens (about 8-16). Hebrew only. Players answer in a few seconds.

## Hard rules
1. **Simple and well known.** A curious 11-year-old should have a fair chance. No obscure facts, no trivia only experts know. At most ~20% of lines may be marked slightly harder with a leading `*`.
2. **No "which year / which century / which decade" questions,** and no 4-digit years in the question text at all.
3. **One certainly-correct answer; three certainly-wrong answers** that are still plausible (same type: all animals, all countries, all numbers...). Never "all of the above", never trick wording, never jokes as options.
4. **Only facts you are 100% sure of** and that do not change (no "current" champions, prices, records that may be broken, populations, who currently holds an office, "the newest", "the latest"). If unsure, leave it out.
5. **No sensitive content:** no war violence detail, terror, the Holocaust, crime, disasters with deaths, politics/politicians from the last 50 years, religion disputes, sex, drugs, alcohol.
6. **No song lyrics or quotes from books/films.** Facts about a film/book/song (who wrote it, what it is about) are fine.
7. Correct Hebrew: natural Israeli Hebrew, correct gender agreement, standard Hebrew spelling as on Hebrew Wikipedia. Numbers as digits ("8" not "שמונה") when the answer is a number.
8. Answers at most 60 characters; question 8-200 characters. The correct answer must not appear inside the question.
9. Do not repeat a fact that is already in the existing bank (`tools/question-gen/kids/<world>.txt` and `<world>.img.txt`) even in other words. Read those files first.
10. Explanation: one short, fun, accurate sentence that teaches something (shown after answering).

## Line formats (one question per line, fields separated by ` | `, correct answer first)
Text file `kids/new/<world>.txt`:
```
question | correct | wrong1 | wrong2 | wrong3 | explanation
```
Photo file `kids/new/<world>.img.txt`:
```
question | correct | wrong1 | wrong2 | wrong3 | explanation | Hebrew Wikipedia article title
```
The photo shown is the **lead image of that Hebrew Wikipedia article** (or the Wikidata image of its item). So:
- the title must be the exact, existing Hebrew Wikipedia article title (as it appears on he.wikipedia.org, without underscores),
- its lead photo must clearly show the correct answer (an animal → its article; a landmark → its article; a country flag → the article "דגל <country>"; a food → its article; an instrument → its article; a famous person → their article, historical/public figures only),
- every photo question uses a **different** title, never one already used in the existing `.img.txt` files,
- the question must be answerable from the photo ("איזו חיה רואים בתמונה?", "איזה מבנה מפורסם רואים בתמונה?", "של איזו מדינה הדגל שבתמונה?", "איזה כלי נגינה רואים בתמונה?"...), and the wrong options should look different enough that a kid who knows can tell.
- **Never:** logos, club crests, cartoon or film characters, film posters, album covers, video-game screenshots, brands, living children, or photos of anything copyrighted. Real animals, places, objects, foods, flags, plants, natural phenomena, planets, historical/public figures are fine.

## Process
1. Read this guide and the existing files for your world.
2. Write in chunks of about 80-100 lines, appending to your files (create them with the two `#` header lines copied from the existing files of your world).
3. After every few chunks run `python3 tools/question-gen/check_new.py <world>` from the repo root and fix every reported line (rewrite or delete).
4. When you reach the target, do a careful self-review pass over **every** line: is the correct answer surely right? is each wrong answer surely wrong? is it simple? Hebrew correct? Delete anything doubtful. Better 10% fewer than one wrong question.
5. Run the checker a final time; it must print `problems: 0`.
