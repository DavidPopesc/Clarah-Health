#!/usr/bin/env bash
# Build and flash the sketch from this computer, copy the app to the UNO Q and run
# the Python side in the App Lab container. Dashboard: http://localhost:7070
# (macOS AirPlay Receiver already uses port 7000, so the board's 7000 is forwarded to 7070.)
#
# Why not `arduino-app-cli app start`? On an offline board it can't fetch libraries
# and its flashing step fails, so we flash over USB with arduino-cli instead.
set -euo pipefail
cd "$(dirname "$0")"

ADB="${ADB:-$(ls -d ~/Library/Arduino15/packages/arduino/tools/adb/*/ 2>/dev/null | tail -1)adb}"
PORT="${PORT:-$(arduino-cli board list | awk '/arduino:zephyr:unoq/ {print $1; exit}')}"
APP=/home/arduino/ArduinoApps/steady
IMAGE=ghcr.io/arduino/app-bricks/python-apps-base:0.5.0

# Local deployment secret. Keep it out of logs and the app directory pushed to the board.
if [[ -f .env.steady ]]; then
  set -a
  source .env.steady
  set +a
fi
TOKEN_OPTION=""
if [[ -n "${STEADY_INGEST_TOKEN:-}" ]]; then
  printf -v QUOTED_TOKEN '%q' "$STEADY_INGEST_TOKEN"
  TOKEN_OPTION="-e STEADY_INGEST_TOKEN=$QUOTED_TOKEN"
fi

if [[ "${1:-}" != "--python-only" ]]; then
  echo "==> Compiling and flashing sketch to $PORT"
  arduino-cli compile --profile default sketch
  arduino-cli upload --profile default -p "$PORT" sketch
fi

echo "==> Copying app to the board"
"$ADB" shell "mkdir -p $APP/data"
for d in app.yaml python assets; do "$ADB" push "$d" "$APP/" >/dev/null; done
# Flush to storage now: the board is often unplugged without a shutdown, and freshly
# pushed files that are still only in memory come back empty.
"$ADB" shell sync

echo "==> (Re)starting the Python container"
# Mount /run rather than the router's socket file: at boot Docker can start before the
# router has made its socket, and binding a missing file path would make a directory there.
"$ADB" shell "docker rm -f clarah-steady >/dev/null 2>&1; docker run -d --name clarah-steady --restart unless-stopped \
  -v $APP:/app -v /run:/host-run -e APP_SOCKET=unix:///host-run/arduino-router.sock $TOKEN_OPTION \
  -p 7000:7000 $IMAGE >/dev/null"

LOCAL_PORT="${LOCAL_PORT:-7070}"
"$ADB" forward tcp:$LOCAL_PORT tcp:7000 >/dev/null
echo "==> Dashboard: http://localhost:$LOCAL_PORT   (logs: $ADB shell docker logs -f clarah-steady)"
