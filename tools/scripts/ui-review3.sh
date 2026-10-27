#!/usr/bin/env bash
# Reviewers' round 2: nickname picks, home play focus, podium tables, locked buttons, result coins.
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
shot 00_first_screen
swipe 540 1500 540 1180; sleep 3
tap 540 2200; sleep 4; shot 01_about
tap 110 150; sleep 6; shot 02_nick
tap 540 1250; sleep 2; shot 03_nick_picked
tap 110 150; sleep 8; shot 04_home
adb shell input keyevent KEYCODE_BACK; sleep 2
shot 05_home
swipe 540 1900 540 700; sleep 2; shot 06_home_bottom
swipe 540 1900 540 700; sleep 2; shot 07_home_end
go leaderboard; shot 10_league
swipe 540 1800 540 900; sleep 2; shot 11_league_more
go collection; shot 20_albums
swipe 540 1900 540 700; sleep 2; swipe 540 1900 540 700; sleep 2; swipe 540 1900 540 700; sleep 2; shot 21_albums_end
go "album/space"; tap 540 1200; sleep 3; shot 22_album_page
go packs; swipe 540 1900 540 700; sleep 2; shot 30_packs_more
go "session?world=mix"; sleep 2; shot 40_q1
for q in 1 2 3 4 5 6 7 8 9 10; do
  tap 540 1700; sleep 4
  tap 540 2160; sleep 4
done
sleep 4; shot 50_result
swipe 540 1800 540 1000; sleep 2; shot 51_result_more
swipe 540 1800 540 1000; sleep 2; shot 52_result_end
go play; swipe 540 1900 540 700; sleep 2; swipe 540 1900 540 700; sleep 2; shot 60_play_end
go profile; swipe 540 1900 540 700; sleep 2; swipe 540 1900 540 700; sleep 2; shot 70_profile_end
true
