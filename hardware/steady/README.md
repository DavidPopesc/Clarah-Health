# Clarah Steady: fall prediction on the Arduino UNO Q

A wearable that watches how steadily you walk. As your balance gets worse, it warns you, and if you opt in, it tells your doctor. It also detects falls, gives you a help button, and alerts your emergency contact if you don't respond. It's built for older adults and for people relearning to walk after a hospital stay.

## Hardware

Arduino UNO Q with a Seeed Grove Base Shield v2 (power switch on **5V**):

| Grove port | Module | Notes |
|---|---|---|
| A0 | Grove Button | HIGH while pressed |
| A1 | Grove 3-Axis Digital Accelerometer ±1.5g (MMA7660FC, I2C 0x4C) | Read with software I2C: SCL = A1, SDA = A2 |
| **D5** | Grove Buzzer | **Not A2.** The A2 pin is the accelerometer's SDA line. |

Clip the accelerometer at your waist or lower back. It can face any direction.

## How it works

**Microcontroller (`sketch/`)** runs on its own, even if Linux or the dashboard is down:
- Samples the accelerometer at 50 Hz and streams the samples to Linux.
- **Fall detection:** a free fall (|a| < 0.6 g for 60 ms) followed within 1 s by an impact (|a| ≥ 1.4 g), or a single hard impact (≥ 2.0 g). It then waits 2.5 s and checks the body's angle. A tilt of 40° or more from the posture before the fall counts as a fall.
- **After a fall:** the buzzer counts down for 30 s (configurable) and the LED matrix flashes "!". Press the button if you're OK. If you don't respond, an emergency starts: the buzzer plays SOS, the matrix shows SOS, and your contact is alerted.
- **Help button:** press once and a 5 s countdown starts (press again to cancel); when it ends, your contact is alerted. During an alarm, a short press quiets the buzzer, and holding for 3 s resolves the alarm.
- **LED matrix:** shows a heart while all is well, a wobble icon when fall risk is high, and a bar along the bottom for the balance score.

**Linux (`python/`)** runs in the App Lab Python container:
- `gait.py` takes each 10 s window of walking and measures cadence, **step-time variability** (CV of the time between steps), **stride regularity** (autocorrelation one stride later) and **side-to-side sway** (horizontal vs. vertical motion). It combines them into a 0–100 balance score. When you're not walking, no score is computed.
- **Trend / prediction:** smooths the score, fits a line through the last 30 minutes of walking, and projects 10 minutes ahead. It compares the result with your baseline (set automatically from your first walks, or reset from the dashboard, e.g. after discharge). Fall risk is **high** if the score is under 50, has dropped 20 or more points from your baseline, or is projected to fall below 45. On a rise in risk, the buzzer gives a warning pattern and the dashboard shows a warning. When risk is high and you've turned on doctor sharing, your doctor gets your score, trend and gait numbers (at most once an hour).
- **Alerts** go out as [ntfy](https://ntfy.sh) push notifications. Your contact and doctor install the free ntfy app and subscribe to their channel name. The board usually has no internet, so an open dashboard sends the alerts for it.
- Serves the dashboard and `GET /api/summary` (JSON with CORS, for the Clarah Health app) on port 7000.

**Dashboard (`assets/`)** is mobile-first, in Clarah Health's style. It shows the live score, risk and trend chart, the two-week view, live motion and an activity ledger with an acceleration trace for each fall. It also has the full-screen fall and emergency screens (I'm OK / Get help / Call 911), alert settings and device tools ("Beep to find it", "Test fall alarm", "Load sample two weeks").

Steady **can't call 911 by itself**. The emergency screen has a one-tap `tel:911` button and alerts your contact.

## Run it

```bash
./deploy.sh              # compile + flash the sketch over USB, copy the app, start the container
./deploy.sh --python-only
open http://localhost:7070
```

`deploy.sh` uses `arduino-cli` (with the `arduino:zephyr` core) and the core's `adb`. The Python side runs as the Docker container `clarah-steady` (restarts on boot). Logs: `adb shell docker logs -f clarah-steady`. If the board joins Wi-Fi, you can also open the dashboard at `http://<board-ip>:7000` from a phone.

We don't use `arduino-app-cli app start` because, on a board with no internet, it can't download libraries and its flashing step fails.

Tests: `python3 -m unittest discover -s tests` (needs numpy).

## Limits

- Score thresholds were tuned on synthetic gait and literature ranges, not on patients. Calibrate them with real walks.
- The ±1.5 g sensor saturates on impact, so impact detection uses the magnitude of all three axes together.
- This is a hackathon prototype, not a medical device.
