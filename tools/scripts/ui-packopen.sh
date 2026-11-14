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
# who-are-you sheet: "other"
tap 216 2190; sleep 4
# tap by visible text (uiautomator), falls back to nothing
tapText() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  B=$(adb exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep -F "$1" | head -1 | grep -o 'bounds="[^"]*"' | grep -o '[0-9]\+' | tr '\n' ' ')
  set -- $B
  [ -n "${4:-}" ] && adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 )) && echo "tapped text"
}
adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://pack-open?pack=silver&pay=token" "$PKG" >/dev/null
sleep 8
shot 10_pack
for k in 1 2 3; do tap 540 1150; sleep 1; done
sleep 3
shot 11_cards
tap 210 1785
for k in 1 2 3 4 5 6; do sleep 0.4; shot "12_reveal_$k"; done
sleep 3
shot 13_after
sleep 2
shot 14_end
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
exit 0
