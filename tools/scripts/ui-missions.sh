#!/usr/bin/env bash
# Mission "go" buttons: each open mission jumps to where it is done.
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
swipe 540 1800 540 1100; sleep 2
shot 10_missions
# uiautomator can't read the animated home screen, so tap by position: after the
# scroll the first mission's button sits at (210, 2034); each extra slow scroll of
# 240 px brings the next mission's button there.
slow() { adb shell input swipe $(( 540 * W / 1080 )) $(( $1 * H / 2400 )) $(( 540 * W / 1080 )) $(( $2 * H / 2400 )) 1800; }
for i in 0 1 2 3; do
  slow 1800 1100; sleep 1
  [ $i -gt 0 ] && { slow $(( 1500 + 240 * i )) 1500; sleep 1; }
  shot "2${i}_before"
  tap 210 2034; sleep 7
  shot "2${i}_went"
  adb shell input keyevent KEYCODE_BACK; sleep 3
  adb shell "am start -W -a android.intent.action.VIEW -d 'footballmillionaire://' $PKG" >/dev/null; sleep 6
done
true
