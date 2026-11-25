#!/bin/bash
# Downloads the generated edits (Higgsfield, GPT Image 2.6) into raw/ — see README.md
cd "$(dirname "$0")"; mkdir -p raw
tr ';' '\n' < urls.txt | while read i s; do [ -z "$i" ] && continue
  [ -f raw/$i.png ] || curl -sSfL -o raw/$i.png "https://d8j0ntlcm91z4.cloudfront.net/user_2x1UegQvignkIVXKpKcIQL2jkLf/hf_20261125_$s.png"; done
