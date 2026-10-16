#!/usr/bin/env bash
# Called inside the emulator runner: installs the APK, opens screens by deep link, screenshots each.
set -u
mkdir -p shots
adb install -r apk/*.apk
PKG=$(adb shell pm list packages | tr -d '\r' | sed 's/package://' | grep -i haaluf | head -1)
echo "package: $PKG"
SCHEME=footballmillionaire

shot() {
  adb exec-out screencap -p > "shots/$1.png"
  echo "shot $1"
}

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 45
shot 00_launch
# Tap through a possible first-run prompt in the middle-bottom of the screen.
sleep 5
shot 01_after

for route in "" play packs collection leaderboard profile shop wheel pass friends settings avatar match "world/history"; do
  name=${route//\//_}
  [ -z "$name" ] && name=home
  adb shell am start -W -a android.intent.action.VIEW -d "$SCHEME://$route" "$PKG" >/dev/null
  sleep 9
  shot "r_$name"
  # A scrolled view too, for long screens.
  adb shell input swipe 540 1700 540 700 400
  sleep 3
  shot "r_${name}_2"
done
exit 0
