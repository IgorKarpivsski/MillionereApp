#!/usr/bin/env bash
# Home, play tab, worlds, missions, albums, packs, league: the October redesign.
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
go() { adb shell "am start -W -a android.intent.action.VIEW -d 'footballmillionaire://$1' $PKG" >/dev/null; sleep 8; }
back() { adb shell input keyevent KEYCODE_BACK; sleep 3; }
page() { shot "$1"; swipe 540 1900 540 800; sleep 2; shot "$1_b"; swipe 540 1900 540 800; sleep 2; shot "$1_c"; }
# Full tour B: every game mode, played.
tap 540 2200; sleep 4
swipe 540 1500 540 1180; sleep 3
tap 540 2200; sleep 4
tap 110 150; sleep 4
tap 110 150; sleep 8
back
playq() { # $1 name, $2 questions, $3 answer y
  for q in $(seq 1 $2); do
    [ $q -le 3 ] || [ $q -eq $2 ] && shot "$1_q$(printf %02d $q)"
    tap 540 $3; sleep 4
    [ $q -le 2 ] && shot "$1_q$(printf %02d $q)_reveal"
    tap 540 2160; sleep 4
  done
  sleep 3; shot "$1_result"; swipe 540 1800 540 900; sleep 2; shot "$1_result_b"
}
go "session?world=mix"; playq 100_quick 10 1585; back
go "session?world=geography&level=1"; playq 110_world 10 1765; back
go "quiz?mode=daily"; playq 120_daily 10 1765; back
go blitz; shot 130_blitz_intro; tap 540 2100; sleep 4; for i in 1 2 3 4 5 6 7 8; do tap 540 1700; sleep 3; done; shot 131_blitz_mid; sleep 60; shot 132_blitz_end; back
go survival; shot 140_survival_intro; tap 540 2100; sleep 4; for i in 1 2 3 4; do shot "141_surv_$i"; tap 540 1700; sleep 5; tap 540 2160; sleep 3; done; sleep 30; shot 142_surv_end; back
go truefalse; shot 150_tf_intro; tap 540 2100; sleep 4; for i in 1 2 3 4 5; do tap 300 1800; sleep 3; done; shot 151_tf_mid; sleep 45; shot 152_tf_end; back
go "match?mode=random"; shot 160_match_random; sleep 20; shot 161_match_wait; sleep 30; shot 162_match_later; back; back
go match; page 163_match_friend; back
go family; page 170_family; back
go packs; shot 180_packs; tap 540 1500; sleep 6; shot 181_pack_tap; tap 540 1200; sleep 3; shot 182_pack_open; for i in 1 2 3 4 5; do tap 540 1200; sleep 2; done; shot 183_pack_done; back
true
