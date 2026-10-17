#!/usr/bin/env bash
# Called inside the emulator runner: installs the APK, opens screens by deep link, screenshots each.
set -u
mkdir -p shots
adb install -r apk/*.apk
PKG=$(adb shell pm list packages | tr -d '\r' | sed 's/package://' | grep -i haaluf | head -1)
echo "package: $PKG"
SCHEME=footballmillionaire

# Let the emulator settle so the launcher stops raising "isn't responding".
sleep 60
calm() {
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
  # "Wait" button on an ANR dialog, if any.
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
}
# Tap the first on-screen element whose text contains $1 (via a UI dump).
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1 || return 1
  xy=$(python3 - "$1" <<'PY'
import re, sys
want = sys.argv[1]
xml = open('/tmp/ui.xml', encoding='utf-8').read()
for m in re.finditer(r'(?:text|content-desc)="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    if want in m.group(1):
        x1, y1, x2, y2 = map(int, m.groups()[1:])
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
  [ -n "$xy" ] && adb shell input tap $xy && echo "tapped '$1' at $xy"
}
shot() {
  adb exec-out screencap -p > "shots/$1.png"
  echo "shot $1"
}

adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 50
shot 00_launch
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
# First run: notifications → age wheel → about you → nickname → home + the sloth's tour.
shot o1_notif
adb shell input tap 540 2200; sleep 4; shot o1b_after_later
shot o2_age
adb shell input swipe 540 1500 540 1180 600; sleep 3; shot o2b_age_picked
adb shell input tap 540 2200; sleep 4; shot o3_about
adb shell input tap 300 1350; sleep 1
adb shell input swipe 540 1900 540 1100 500; sleep 2; shot o3b_about_scrolled
adb shell input tap 110 150; sleep 4; shot o4_nick
adb shell input tap 110 150; sleep 6; shot o5_home
sleep 3; shot o6_tour1
for i in 2 3 4 5 6 7 8 9 10; do
  adb shell input tap 540 40; sleep 3; shot "o6_tour$i"
done
adb shell input keyevent KEYCODE_BACK; sleep 3
shot 04_clear

open_route() {
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
  adb shell am start -W -a android.intent.action.VIEW -d "$SCHEME://$1" "$PKG" >/dev/null
}

# Game modes, played a little.
open_route ""; sleep 10; shot m_home
adb shell input swipe 540 1700 540 700 500; sleep 3; shot m_home_2
adb shell input swipe 540 1700 540 700 500; sleep 3; shot m_home_3
open_route blitz; sleep 8; shot m_blitz
adb shell input tap 540 1620; sleep 6; shot m_blitz_go
for i in 1 2 3 4 5 6 7 8; do adb shell input tap 540 $((726 + (i % 4) * 168)); sleep 2; done; shot m_blitz_play
sleep 60; shot m_blitz_done
open_route family; sleep 8; shot m_family
adb shell input tap 540 1290; sleep 6; shot m_family_room
adb shell input swipe 540 1700 540 800 500; sleep 2; shot m_family_room_2
open_route "match?mode=random"; sleep 6; shot m_random
sleep 10; shot m_random_offer
adb shell input tap 540 1440; sleep 4; shot m_random_vs
sleep 6; shot m_random_q
adb shell input tap 300 1430; sleep 14; shot m_random_reveal
sleep 120; shot m_random_done

open_route profile; sleep 8; shot s_profile
for k in 1 2 3; do adb shell input swipe 540 1900 540 700 500; sleep 2; shot "s_profile_$k"; done

for route in "session?world=mix" play packs collection leaderboard profile shop wheel pass friends settings avatar match "world/history"; do
  name=${route//\//_}
  name=${name//[?=]/_}
  [ -z "$name" ] && name=home
  open_route "$route"
  sleep 10
  shot "r_$name"
  adb shell input swipe 540 1700 540 800 500
  sleep 3
  shot "r_${name}_2"
done
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
calm
exit 0
