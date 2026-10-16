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
