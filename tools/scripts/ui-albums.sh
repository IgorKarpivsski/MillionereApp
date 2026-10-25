#!/usr/bin/env bash
# The ten new (v4) sticker albums: shelf, a new album, and a pack opened to show the art.
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
go() { adb shell "am start -W -a android.intent.action.VIEW -d 'footballmillionaire://$1' $PKG" >/dev/null; sleep 8; }
go collection
shot 10_shelf
for i in 1 2 3 4 5 6; do swipe 540 1900 540 700; sleep 2; shot "1$i"_shelf_more; done
go album/farm
shot 20_farm_cover
swipe 900 1200 150 1200; sleep 2
shot 21_farm_page1
go album/oddities
shot 22_oddities_cover
swipe 900 1200 150 1200; sleep 2
shot 23_oddities_page1
# open whatever packs the new player has, then look at what came out
go packs
shot 30_packs
for i in 1 2 3; do
  tapText "פתח" || tapText "לפתוח" || break
  sleep 6; shot "3${i}_opened"
  for k in 1 2 3 4 5 6; do tap 540 1200; sleep 1; done
  sleep 3; shot "3${i}_reveal"
  adb shell input keyevent KEYCODE_BACK; sleep 3
done
go collection
shot 40_shelf_after
