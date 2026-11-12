#!/usr/bin/env bash
# 0.2.0 check: level bar + house card on home, the sloth's house (buy an item, hats tab),
# the play tab, and the in-game rewards (coins flying, combo, sloth reactions).
# Coordinates are for a 1080x2400 screen and scaled to the emulator's real size.
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
link() { adb shell "am start -W -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null; }
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
adb shell input keyevent KEYCODE_BACK; sleep 2
swipe 540 1700 540 900; sleep 2
shot 02_home_scrolled

link 'footballmillionaire://house'; sleep 6
shot 10_house
swipe 540 1900 540 900; sleep 2
shot 11_house_list
swipe 540 900 540 1900; sleep 2
# the string lights (cheapest) over the window
tap 540 430; sleep 3
shot 12_buy_sheet
tap 540 2150; sleep 3
shot 13_bought
sleep 3
shot 14_after
swipe 540 1900 540 900; sleep 2
tap 810 1250; sleep 2
shot 15_hats
adb shell input keyevent KEYCODE_BACK; sleep 2

link 'footballmillionaire://play'; sleep 5
shot 20_play
swipe 540 1700 540 900; sleep 2
shot 21_play_scrolled

for run in 1 2; do
  link 'footballmillionaire://session?world=mix'; sleep 8
  for q in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    shot "s${run}_q${q}"
    case $q in
      1|3|5|7|9) tap 540 1700 ;;
      2|6) tap 540 1880 ;;
      *) tap 540 2040 ;;
    esac
    sleep 1; shot "s${run}_q${q}_a"
    sleep 1; shot "s${run}_q${q}_b"
    sleep 2
    tap 540 2160; sleep 3
    tap 540 2160; sleep 2
  done
  sleep 3; shot "s${run}_result"
  swipe 540 1700 540 900; sleep 2
  shot "s${run}_result2"
  adb shell input keyevent KEYCODE_BACK; sleep 3
done
link 'footballmillionaire://'; sleep 5
shot 30_home_after
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
exit 0
