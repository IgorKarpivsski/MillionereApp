#!/usr/bin/env bash
# Packs and league screens: pack buttons and the league countdown.
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
adb shell input keyevent KEYCODE_BACK; sleep 2
n=0
for world in mix "nature&level=1"; do
  adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://session?world=$world" "$PKG" >/dev/null
  sleep 7
  for q in 1 2 3 4 5 6 7 8 9 10; do
    n=$((n+1))
for route in packs leaderboard; do
  adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://$route" "$PKG" >/dev/null
  sleep 8
  shot "$route"
  swipe 540 1700 540 900; sleep 3
  shot "${route}_scrolled"
done
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
exit 0
