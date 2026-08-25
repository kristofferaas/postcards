#!/usr/bin/env bash

set -euo pipefail

mobile_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
simulator_id="${IOS_SIMULATOR_ID:-}"

if [[ -z "$simulator_id" ]]; then
  simulator_id="$({
    xcrun simctl list devices booted -j
  } | ruby -rjson -e '
    devices = JSON.parse(STDIN.read).fetch("devices").values.flatten
    device = devices.find { |candidate| candidate["state"] == "Booted" }
    abort "No booted iOS simulator found." unless device
    puts device.fetch("udid")
  ')"
fi

result_bundle_path="${PASSKEY_RESULT_BUNDLE_PATH:-/tmp/PostCardsPasskeyTests-$(date +%Y%m%d-%H%M%S).xcresult}"

send_matching_faces() {
  while true; do
    xcrun simctl spawn "$simulator_id" notifyutil \
      -p com.apple.BiometricKit_Sim.pearl.match >/dev/null 2>&1 || true
    sleep 1
  done
}

send_matching_faces &
biometric_pid=$!

cleanup() {
  kill "$biometric_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cd "$mobile_dir"
xcodebuild test \
  -quiet \
  -workspace ios/PostCards.xcworkspace \
  -scheme PostCardsPasskeyUITests \
  -destination "platform=iOS Simulator,id=$simulator_id" \
  -resultBundlePath "$result_bundle_path"
