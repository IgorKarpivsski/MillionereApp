#!/usr/bin/env bash
# The sloth's house after the picture-size fix: room, list, hats.
set -u
mkdir -p shots
adb install -r apk/*.apk
PKG=$(adb shell pm list packages | tr -d '\r' | sed 's/package://' | grep -i haaluf | head -1)
SIZE=$(adb shell wm size | tr -d '\r' | awk '{print $NF}')
W=${SIZE%x*}; H=${SIZE#*x}
tap() { adb shell input tap $(( $1 * W / 1080 )) $(( $2 * H / 2400 )); }
swipe() { adb shell input swipe $(( $1 * W / 1080 )) $(( $2 * H / 2400 )) $(( $3 * W / 1080 )) $(( $4 * H / 2400 )) 600; }
shot() { adb exec-out screencap -p > "shots/$1.png"; echo "shot $1"; }
link() { adb shell "am start -W -a android.intent.action.VIEW -d '$1' $PKG" >/dev/null; }
sleep 60
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 50
tap 540 2200; sleep 4
swipe 540 1500 540 1180; sleep 3
tap 540 2200; sleep 4
tap 110 150; sleep 4
tap 110 150; sleep 8
adb shell input keyevent KEYCODE_BACK; sleep 2
link 'footballmillionaire://house'; sleep 6
shot 10_house
tap 540 430; sleep 3
shot 12_sheet
adb shell input keyevent KEYCODE_BACK; sleep 2
swipe 540 1900 540 900; sleep 2
tap 810 1250; sleep 2
shot 15_hats
exit 0
