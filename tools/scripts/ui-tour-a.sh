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
go() { adb shell "am start -W -a android.intent.action.VIEW -d 'footballmillionaire://$1' $PKG" >/dev/null; sleep 8; }
back() { adb shell input keyevent KEYCODE_BACK; sleep 3; }
page() { shot "$1"; swipe 540 1900 540 800; sleep 2; shot "$1_b"; swipe 540 1900 540 800; sleep 2; shot "$1_c"; }
# Full tour A: first run, every tab, every screen.
shot 000_launch
tap 540 2200; sleep 4; shot 001_onb_age
swipe 540 1500 540 1180; sleep 3; shot 002_onb_age_pick
tap 540 2200; sleep 4; shot 003_onb_about
tap 110 150; sleep 4; shot 004_onb_name
tap 110 150; sleep 8; shot 005_tour
for i in 1 2 3 4 5 6; do tap 540 2200; sleep 2; shot "006_tour_$i"; done
back
page 010_home
go play; page 020_play
go worlds; page 030_worlds
go world/geography; page 031_world_geography
go world/football; shot 032_world_football
go packs; page 040_packs
go collection; page 050_albums
go album/wild; shot 051_album_cover; swipe 900 1200 150 1200; sleep 2; shot 052_album_page; tap 300 900; sleep 3; shot 053_sticker; back
go market; page 055_market
go leaderboard; page 060_league
tap 346 400; sleep 5; page 061_board2
tap 734 400; sleep 5; page 062_board3
go profile; page 070_profile
go avatar; page 071_avatar
go friends; page 072_friends
go invite; shot 073_invite
go settings; page 080_settings
go legal/terms; shot 081_terms
go shop; page 090_shop
go pass; page 091_pass
go wheel; shot 092_wheel; tap 540 1700; sleep 8; shot 093_wheel_spun; back
go mistakes; shot 094_mistakes
go submit-question; shot 095_submit
go event; page 096_event
true
