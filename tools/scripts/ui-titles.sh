#!/usr/bin/env bash
# Title badges: waits while a title is set on the fresh test account, then shoots top bar, profile and flair picker.
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
tap 216 2190; sleep 4
shot 02_home_before
adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://profile" "$PKG" >/dev/null; sleep 8
shot 10_profile
tap 370 868; sleep 4
shot 13_flair
swipe 540 1900 540 900; sleep 2
shot 14_flair_titles
swipe 540 1900 540 900; sleep 2
shot 15_flair_titles2
adb shell input keyevent KEYCODE_BACK; sleep 2
adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://" "$PKG" >/dev/null; sleep 6
shot 11_home_topbar
adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://survival" "$PKG" >/dev/null; sleep 8
swipe 540 1900 540 700; sleep 2
shot 12_survival_table
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
exit 0
