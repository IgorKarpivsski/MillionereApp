#!/usr/bin/env bash
# Launch QA: sign-up straight into the first game, home tour, profile (kid), chat (kid),
# shop deal, settings switches, blitz end, match search clock.
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
# sign-up: age 7, skip "about", pick the first suggested name, finish
shot 00_age
swipe 540 1500 540 1180; sleep 3
tap 540 2200; sleep 4; shot 01_about
tap 540 2200; sleep 4; shot 02_nick
tap 540 1250; sleep 2; shot 03_nick_picked
tap 540 2200; sleep 10; shot 04_first_game
for q in 1 2 3 4 5 6 7 8 9 10; do
  tap 540 1700; sleep 4
  [ $q -eq 1 ] && shot 05_q1_reveal
  tap 540 2160; sleep 4
done
sleep 4; shot 10_result
swipe 540 1800 540 900; sleep 2; shot 11_result_more
back; sleep 6; shot 20_home_tour
tap 540 2200; sleep 3; shot 21_tour_2
tap 540 2200; sleep 3; shot 22_tour_3
tap 540 2200; sleep 3; shot 23_tour_4
tap 540 2200; sleep 3; shot 24_tour_5
tap 540 2200; sleep 3; shot 25_after_tour
go profile; shot 30_profile
swipe 540 1800 540 900; sleep 2; shot 31_profile_more
go settings; shot 40_settings
go shop; shot 50_shop
swipe 540 1800 540 900; sleep 2; shot 51_shop_more
go blitz; shot 60_blitz_intro
tap 540 2160; sleep 70; shot 61_blitz_end
go "match"; shot 70_match
go packs; shot 80_packs
swipe 540 1800 540 900; sleep 2; shot 81_packs_more
true
