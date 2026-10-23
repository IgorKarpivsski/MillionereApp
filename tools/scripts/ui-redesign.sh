#!/usr/bin/env bash
# Home, play tab, worlds, missions, albums, packs, league: the October redesign.
# Coordinates are given for a 1080x2400 screen and scaled to the emulator's real size.
set -u
mkdir -p shots
adb install -r apk/*.apk
PKG=$(adb shell pm list packages | tr -d '\r' | sed 's/package://' | grep -i haaluf | head -1)
SIZE=$(adb shell wm size | tr -d '\r' | awk '{print $NF}')
W=${SIZE%x*}; H=${SIZE#*x}
echo "package: $PKG size: ${W}x${H}"
tap() { adb shell input tap $(( $1 * W / 1080 )) $(( $2 * H / 2400 )); }
swipe() { adb shell input swipe $(( $1 * W / 1080 )) $(( $2 * H / 2400 )) $(( $3 * W / 1080 )) $(( $4 * H / 2400 )) 600; }
shot() { adb exec-out screencap -p > "shots/$1.png"; echo "shot $1"; }
sleep 60
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 50
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
shot 00_launch
# onboarding: later (notifications) → age → skip → skip
tap 540 2200; sleep 4
swipe 540 1500 540 1180; sleep 3
tap 540 2200; sleep 4
tap 110 150; sleep 4
tap 110 150; sleep 8
shot 01_home
# tap the centre of the first view whose text contains $1
tapText() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep -E "(text|content-desc)=\"[^\"]*$1" | head -1 | sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/')
  if [ -z "$b" ]; then echo "no text $1"; return 1; fi
  set -- $b
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}
shot 02_home
swipe 540 1800 540 900; sleep 2
shot 03_home_missions
swipe 540 1800 540 900; sleep 2
shot 04_home_more
# weekly missions tab
swipe 540 900 540 1800; sleep 2
swipe 540 1700 540 1100; sleep 2
tapText "שבועיות" && sleep 2 && shot 05_home_weekly
go() { adb shell "am start -W -a android.intent.action.VIEW -d 'footballmillionaire://$1' $PKG" >/dev/null; sleep 8; }
go play
shot 10_play
swipe 540 1800 540 800; sleep 2
shot 11_play_more
swipe 540 1800 540 800; sleep 2
shot 12_play_end
go worlds
shot 13_worlds
go packs
shot 20_packs
swipe 540 1800 540 900; sleep 2
shot 21_packs_more
go collection
shot 30_albums
swipe 540 1800 540 900; sleep 2
shot 31_albums_more
go album/ocean
shot 32_album_cover
swipe 900 1200 150 1200; sleep 2
shot 33_album_page1
swipe 900 1200 150 1200; sleep 2
shot 34_album_page2
tap 300 900; sleep 3
shot 35_album_sticker
adb shell input keyevent KEYCODE_BACK; sleep 2
go leaderboard
shot 40_league
swipe 540 1800 540 900; sleep 2
shot 41_league_more
swipe 540 900 540 1800; sleep 2
tap 346 400; sleep 5
shot 42_month
swipe 540 1800 540 900; sleep 2
shot 43_month_more
go profile
shot 50_profile
