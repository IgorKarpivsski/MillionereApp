#!/usr/bin/env bash
# New modes: survival, true or false, market, invite. Plays a few answers in each mode.
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
# tap the centre of the first view whose text contains $1
tapText() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep -F "text=\"$1" | head -1 | sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/')
  if [ -z "$b" ]; then echo "no text $1"; return 1; fi
  set -- $b
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}
shot 02_home
swipe 540 1800 540 700; sleep 2
shot 03_home_modes
swipe 540 1800 540 900; sleep 2
shot 04_home_invite
go() { adb shell am start -W -a android.intent.action.VIEW -d "footballmillionaire://$1" "$PKG" >/dev/null; sleep 8; }
go survival
shot 10_survival_intro
swipe 540 1800 540 600; sleep 2
shot 11_survival_board
swipe 540 600 540 1800; sleep 2
tapText "עלה לגבעה"; sleep 6
shot 12_survival_q1
tap 540 1950; sleep 3
shot 13_survival_after1
sleep 20
shot 14_survival_timeout
adb shell input keyevent KEYCODE_BACK; sleep 2
tapText "צא"; sleep 3
go truefalse
shot 20_tf_intro
tapText "צא לדרך"; sleep 6
shot 21_tf_q1
tapText "נכון"; sleep 2
shot 22_tf_after
tapText "לא נכון"; sleep 2
shot 23_tf_after2
adb shell input keyevent KEYCODE_BACK; sleep 2
tapText "צא" || true; sleep 3
go market
shot 30_market
tapText "ההצעות שלי"; sleep 4
shot 31_market_mine
tapText "הצעה חדשה"; sleep 3
shot 32_market_new
go invite
shot 40_invite
swipe 540 1800 540 700; sleep 2
shot 41_invite_goals
swipe 540 1800 540 700; sleep 2
shot 42_invite_bottom
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
exit 0
