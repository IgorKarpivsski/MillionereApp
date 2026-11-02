#!/usr/bin/env bash
# Launch-day check: new account, then every main screen (game, survival, true/false, league,
# packs + opening a pack, market, invite a friend, shop, profile and titles), screenshots of each.
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
back() { adb shell input keyevent KEYCODE_BACK; sleep 3; }
go() { adb shell "am start -W -a android.intent.action.VIEW -d 'footballmillionaire://$1' $PKG" >/dev/null; sleep 8; }
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

sleep 60
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 50
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
# sign-up (same steps as ui-session.sh): age, then leave the automatic first game
shot 00_launch
tap 540 2200; sleep 4
swipe 540 1500 540 1180; sleep 3
tap 540 2200; sleep 4
shot 01_after_age
tap 110 150; sleep 4
tap 110 150; sleep 8
shot 02_first_game_or_home
tap_text 'צא' && sleep 4
go ""; sleep 3; shot 04_home

go "session?world=nature&level=1"; sleep 4; shot 10_session_q1
tap 540 1700; sleep 4; shot 11_session_reveal
back; back

go survival; shot 20_survival
tap 540 2160; sleep 6; shot 21_survival_q
back; back

go truefalse; shot 30_truefalse
tap 540 2160; sleep 6; shot 31_truefalse_q
back; back

go leaderboard; shot 40_league
swipe 540 1700 540 900; sleep 2; shot 41_league_more

go packs; shot 50_packs
tap_text 'פתחו עכשיו' && { sleep 6; shot 51_pack_opening; sleep 6; tap 540 1200; sleep 4; shot 52_pack_opened; tap 540 2200; sleep 3; shot 53_pack_done; back; }
tap_text 'קנו' && { sleep 3; shot 54_pack_buy_sheet; back; }
go packs; swipe 540 1700 540 900; sleep 2; shot 55_packs_more

go market; shot 60_market
go invite; shot 70_invite
swipe 540 1700 540 900; sleep 2; shot 71_invite_more
go shop; shot 80_shop
swipe 540 1800 540 900; sleep 2; shot 81_shop_more
go profile; shot 90_profile
swipe 540 1800 540 900; sleep 2; shot 91_profile_more
go profile; tap 370 868; sleep 4; shot 92_titles
swipe 540 1900 540 900; sleep 2; shot 93_titles_more

adb logcat -d -s ReactNativeJS:* AndroidRuntime:E > shots/logcat.txt 2>/dev/null || true
exit 0
