# Second batch (top-up)

Same rules as ../new/WRITING_GUIDE.md. Files: kids/new2/<world>.txt and kids/new2/<world>.img.txt
(copy the two `#` header lines from kids/<world>.img.txt / kids/<world>.txt).
Check with: python3 tools/question-gen/check_new.py <world> new2
It also rejects repeats of the first batch (kids/new/).

Photo titles: pick ONLY from the verified lists in ../new/candidates/*.tsv
(each title exists on Hebrew Wikipedia and has a free photo). Use the exact title string.
Prefer the most famous (highest third column) subjects a 10-14 year-old would recognise.
Never invent a title that is not in those lists.
