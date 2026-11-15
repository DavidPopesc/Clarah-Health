# Clarah Steady: fall prediction on the Arduino UNO Q

A wearable that watches how steadily you walk. As your balance gets worse, it warns you, and if you opt in, it tells your doctor. It also detects falls, gives you a help button, and alerts your emergency contact if you don't respond. It's built for older adults and for people relearning to walk after a hospital stay.

## Hardware

Arduino UNO Q with a Seeed Grove Base Shield v2 (power switch on **5V**):

| Grove port | Module | Notes |
|---|---|---|
| A0 | Grove Button | HIGH while pressed |
| A1 | Grove 3-Axis Digital Accelerometer ±1.5g (MMA7660FC, I2C 0x4C) | Read with software I2C: SCL = A1, SDA = A2 |
| A2 | *(leave empty)* | Its first pin, A2, is the accelerometer's SDA: each Grove port carries two pins |
| A3 | Grove Buzzer | Uses pin A3 only |

In **fall prevention** mode, clip the accelerometer at your waist or lower back. In **prosthetic** mode, clip it firmly to the prosthetic leg's socket or shank. It can face any direction. Fall detection and the help button remain active in both modes.

## How it works

**Microcontroller (`sketch/`)** runs on its own, even if Linux or the dashboard is down:
- Samples the accelerometer at 50 Hz and streams the samples to Linux.
- **Fall detection:** a free fall (|a| < 0.5 g for 100 ms) followed within 1 s by an impact (|a| ≥ 1.8 g), or a single very hard impact (≥ 2.3 g). It then watches for 3 s, silently. It counts as a fall only if the body ends up tilted 50° or more from before and lies fairly still (the spread of the acceleration stays under 0.15 g).
- **Hard fall tier:** after free fall, an impact must have at least 3 consecutive 50 Hz samples (60 ms) at ≥2.4 g total magnitude with at least two axes each at |a| ≥1.4 g, near the MMA7660's saturation. The same 50° tilt and stillness check must pass. Isolated bumps and saturated impacts without free fall remain on the normal path. A hard fall uses a fast buzzer and a 10 s countdown by default (`harsh_countdown_s`, 5–30 s); the button still cancels it.
- **After a fall:** the buzzer counts down for 30 s (configurable) and the LED matrix flashes "!". Press the button if you're OK. If you don't respond, an emergency starts: the buzzer plays SOS, the matrix shows SOS, and your contact is alerted.
- **Help button:** press once and a 5 s countdown starts (press again to cancel); when it ends, your contact is alerted. During an alarm, a short press quiets the buzzer, and holding for 3 s resolves the alarm.
- **LED matrix:** shows a heart while all is well, a wobble icon when fall risk is high, and a bar along the bottom for the balance score.

**Linux (`python/`)** runs in the App Lab Python container:
- `gait.py` takes each 10 s of movement and measures how much the trunk is thrown around: **body sway** (RMS tilt from the average posture, in degrees) and **jolt** (spread of the total acceleration, in g). Stride regularity counts a little; cadence is shown but not scored. It combines them into a 0–100 balance score. When you're sitting or standing still, no score is computed. Step-to-step timing isn't used: the sensor's 6-bit readings give double peaks that make it unreliable.
- **Trend / prediction:** smooths the score, fits a line through the last 30 minutes of movement, and projects 10 minutes ahead. It compares the result with your baseline (set automatically once a dozen windows look steady, or reset from the dashboard, e.g. after discharge). Fall risk is **moderate** under 70, 12+ points below baseline or projected under 55; **high** under 45, 25+ below baseline or projected under 35. Each step up (moderate, then high) sounds a buzzer warning and shows a warning on the dashboard. When risk is high and you've turned on doctor sharing, your doctor gets your score, trend and sway numbers (at most once an hour).
- **Alerts** go out as [ntfy](https://ntfy.sh) push notifications. Your contact and doctor install the free ntfy app and subscribe to their channel name. The board usually has no internet, so an open dashboard sends the alerts for it.
- **Hard-fall emergency:** after the short countdown, the usual SOS and contact alert run. The contact message says “(simulated 911 call placed)”. The dashboard shows a clearly labelled staged 911 simulation and records `simulated_911` in the ledger. **No automated real call is made**; the manual Call 911 link is available for the wearer to tap.
- **Prosthetic adaptation:** the leg sensor estimates wear from movement or orientation change each minute, walking time and bouts, and sharp jolts during walking that did not become falls. It charts 14 days of steadiness scores, wear, walking, bouts and stumbles, then compares recent days with the first days as adapting, adjusting or struggling. Quiet wear can be missed. The score reuses the gait calculation, but is called *steadiness* because the sensor is on the leg.
- **Clarah Health sync:** every 10 s when nobody is watching (`STEADY_SYNC_INTERVAL_S`), every second while someone has clarah.health/steady open (the reply's `next_sync_s`), and right away on alert changes, a background worker POSTs version 1 JSON to `{clarah_url}/api/steady/ingest` with a Bearer `STEADY_INGEST_TOKEN`. It skips sync when no token is set, times out after 10 s, and reports the latest result under Device. `clarah_url` defaults to `https://www.clarah.health`; `device_id` defaults to `uno-q`. The sync includes the selected mode, 14-day summaries, warning, events, device and emergency state, plus `motion`: the last 10 s of acceleration (x, y, z averaged and peak magnitude, at 10 Hz) for the live motion graph on clarah.health. The reply can carry `commands` (`cancel` or `resolve`) from the "I'm OK" button on clarah.health, which the board runs right away.
- Serves the dashboard and `GET /api/summary` (JSON with CORS, for the Clarah Health app) on port 7000.

**Dashboard (`assets/`)** is mobile-first, in Clarah Health's style. It shows the live score, risk and trend chart, the two-week view, live motion and an activity ledger with an acceleration trace for each fall. It also has the full-screen fall and emergency screens (I'm OK / Get help / Call 911), alert settings and device tools ("Beep to find it", "Test fall alarm", "Load sample two weeks").

Steady **can't call 911 by itself**. The emergency screen has a one-tap `tel:911` button and alerts your contact. Its hard-fall 911 sequence is explicitly simulated.

## Run it

```bash
./deploy.sh              # compile + flash the sketch over USB, copy the app, start the container
./deploy.sh --python-only
open http://localhost:7070
```

For sync, put `STEADY_INGEST_TOKEN=...` in the gitignored `.env.steady` before deploying. The deploy script passes it to the container without printing it. Dashboard settings include `mode` (`fall_prevention` or `prosthetic`), `countdown_s`, `harsh_countdown_s`, `clarah_url` and `device_id`.

`deploy.sh` uses `arduino-cli` (with the `arduino:zephyr` core) and the core's `adb`. The Python side runs as the Docker container `clarah-steady` (restarts on boot). Logs: `adb shell docker logs -f clarah-steady`. Over Wi-Fi, open `http://<board-ip>:7000` from any device on the same network (find the IP with `adb shell ip -4 addr show wlan0`). On eduroam, `uno-q.local` doesn't resolve, so use the IP. The board joins eduroam on boot; once it has internet, it sends alerts itself.

We don't use `arduino-app-cli app start` because, on a board with no internet, it can't download libraries and its flashing step fails.

Tests: `python3 -m unittest discover -s tests` (needs numpy).

## Limits

- The score is calibrated on recordings from the board (steady movement ~0.15 g jolt = low risk, big swings ~0.52 g = moderate, wild swings at the sensor's limits ~0.66 g = high), not on patients. Calibrate it with real walks.
- The ±1.5 g sensor saturates on impact, so impact detection uses the magnitude of all three axes together.
- This is a hackathon prototype, not a medical device.
