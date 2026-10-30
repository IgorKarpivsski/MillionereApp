# New picture questions, batch 2026-10-30 (read WRITING_GUIDE.md first; this brief overrides it where they differ)

The owner wants MANY more picture questions, and they must be beautiful and certain. Last week we
retired 650 picture questions for these reasons: face not visible, subject cut off, unclear or distant
photo, photo fits several answers equally (generic beach, cloud, forest; look-alike flags), photo shows
something else, the answer written in the photo. Write only lines that cannot fail that way.

## Hard rules for this batch
1. **No people at all.** No portraits, no athletes, no "who is this". No flags, no logos, no brands, no
   cartoon/film content, no maps.
2. **One clear subject that fills the photo:** a single animal, plant, fruit, dish, object, instrument,
   a famous building or monument, a planet, a distinctive natural landmark. Skip subjects whose Wikipedia
   lead photo is likely a diagram, a map, a group of things, a herbarium sheet, a distant landscape, or a
   close-up of a detail.
3. **Distinctive look.** A kid who knows the answer must be able to tell it from the 3 wrong options *by
   the picture alone*. The wrong options are the same kind (all animals / all buildings / all fruits) but
   look clearly different from the correct one (no "crocodile vs alligator", "hare vs rabbit",
   "lemon vs lime"-type traps, no two breeds that look alike).
4. **Famous to Israeli kids 8-14.** Prefer candidates with a high fame number (third column); never below 40.
5. **Reuse the same question text** inside each kind, exactly character for character, e.g.
   `איזו חיה רואים בתמונה?`, `איזה פרי רואים בתמונה?`, `איזה מאכל רואים בתמונה?`,
   `איזה כלי נגינה רואים בתמונה?`, `איזה מבנה מפורסם רואים בתמונה?`, `איזה צמח רואים בתמונה?`,
   `איזה כוכב לכת רואים בתמונה?`, `איזה ענף ספורט משחקים בכדור שבתמונה?`, `איזה אתר בישראל רואים בתמונה?`.
   (These shared texts also let the game build "find the right picture" questions.)
6. Answers short (at most 22 characters), in the plain everyday Hebrew name a kid uses
   (for "בצל הגינה" the answer is "בצל"). The answer must not appear in the question.
7. Titles: ONLY exact titles from `candidates/*.tsv` (they exist and have a free photo), never one already
   used in any `kids/*.img.txt` file, never one used twice. Never invent a title.
8. Do not repeat an answer already in the bank. The list of existing answers per world is in
   `/tmp/claude-0/-home-claude/cc8d2f7d-a5ea-5923-b529-2e154883f9ec/scratchpad/qa/existing_answers.txt`.
   (A different photo of an existing answer is still a repeat; skip it.)
9. Explanation: one short, fun, surely-true sentence.

## Files
Write `tools/question-gen/kids/new/<world>.img.txt` (copy the two `#` header lines from
`kids/<world>.img.txt`). Check with `python3 tools/question-gen/check_new.py <world>` from the repo root
(/home/claude/kimg) until it prints `problems: 0`. Then do a final strict self-review of every line and
delete anything doubtful: fewer lines beat one bad line.
Also append every title you used, one per line, to `tools/question-gen/kids/new/titles_<your agent letter>.list`.
Do not touch any other file. Do not commit or push.
