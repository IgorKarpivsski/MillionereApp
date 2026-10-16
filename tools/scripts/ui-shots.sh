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
sleep 5
shot 01_after
# First-run popups, by position (uiautomator never idles while the backdrop animates):
# age question ("18+"), then the daily gift, then the deal (closed with back).
adb shell input tap 351 2190; sleep 5
shot 02_age_done
adb shell input tap 540 1566; sleep 7
shot 03_gift
sleep 4
adb shell input keyevent KEYCODE_BACK; sleep 3
shot 04_clear

for route in "" play packs collection leaderboard profile shop wheel pass friends settings avatar match "world/history"; do
  name=${route//\//_}
  [ -z "$name" ] && name=home
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
  adb shell am start -W -a android.intent.action.VIEW -d "$SCHEME://$route" "$PKG" >/dev/null
  sleep 10
  shot "r_$name"
  adb shell input swipe 540 1700 540 800 500
  sleep 3
  shot "r_${name}_2"
done
adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
calm
exit 0
