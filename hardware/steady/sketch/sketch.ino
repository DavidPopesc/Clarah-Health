// Clarah Steady — fall prediction and fall detection on the Arduino UNO Q.
//
// The microcontroller does everything that must keep working even if Linux is
// busy or the dashboard is closed: it samples the accelerometer, detects falls,
// runs the help button and drives the buzzer and LED matrix. Raw samples are
// streamed to the Linux side (python/main.py), which scores balance while you
// walk and watches the trend.
//
// Wiring (Seeed Grove Base Shield v2, switch on 5V):
//   A0 port  Grove button                     (A0, HIGH while pressed)
//   A1 port  Grove 3-Axis Digital Accel 1.5g  (MMA7660FC, I2C 0x4C; SCL=A1, SDA=A2)
//   D5 port  Grove buzzer                     (D5). Not A2: A2 is the accelerometer's SDA line.

#include <Arduino_RouterBridge.h>
#include <Arduino_LED_Matrix.h>
#include "state.h"

const int PIN_BUTTON = A0;
const int PIN_SCL = A1;
const int PIN_SDA = A2;
const int PIN_BUZZER = 5;

const uint8_t MMA7660_ADDR = 0x4C;
const float COUNTS_PER_G = 21.33f;
const uint32_t SAMPLE_MS = 20;  // 50 Hz
const int BATCH = 10;           // samples per message to Linux (5 messages a second)

// ---------- Software I2C on the A1 Grove port ----------

static inline void i2cDelay() { delayMicroseconds(4); }
static inline void lineHigh(int p) { pinMode(p, INPUT_PULLUP); }
static inline void lineLow(int p) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }

void i2cStart() { lineHigh(PIN_SDA); lineHigh(PIN_SCL); i2cDelay(); lineLow(PIN_SDA); i2cDelay(); lineLow(PIN_SCL); i2cDelay(); }
void i2cStop() { lineLow(PIN_SDA); i2cDelay(); lineHigh(PIN_SCL); i2cDelay(); lineHigh(PIN_SDA); i2cDelay(); }

bool i2cWrite(uint8_t b) {
  for (int i = 7; i >= 0; i--) {
    if (b & (1 << i)) lineHigh(PIN_SDA); else lineLow(PIN_SDA);
    i2cDelay(); lineHigh(PIN_SCL); i2cDelay(); lineLow(PIN_SCL); i2cDelay();
  }
  lineHigh(PIN_SDA); i2cDelay(); lineHigh(PIN_SCL); i2cDelay();
  bool ack = digitalRead(PIN_SDA) == LOW;
  lineLow(PIN_SCL); i2cDelay();
  return ack;
}

uint8_t i2cRead(bool ack) {
  uint8_t b = 0;
  lineHigh(PIN_SDA);
  for (int i = 7; i >= 0; i--) {
    lineHigh(PIN_SCL); i2cDelay();
    if (digitalRead(PIN_SDA)) b |= (1 << i);
    lineLow(PIN_SCL); i2cDelay();
  }
  if (ack) lineLow(PIN_SDA); else lineHigh(PIN_SDA);
  i2cDelay(); lineHigh(PIN_SCL); i2cDelay(); lineLow(PIN_SCL); lineHigh(PIN_SDA); i2cDelay();
  return b;
}

bool mmaWrite(uint8_t reg, uint8_t val) {
  i2cStart();
  bool ok = i2cWrite(MMA7660_ADDR << 1) && i2cWrite(reg) && i2cWrite(val);
  i2cStop();
  return ok;
}

bool mmaBegin() {
  return mmaWrite(0x07, 0x00)     // standby
      && mmaWrite(0x08, 0x00)     // 120 samples/s
      && mmaWrite(0x07, 0x01);    // active
}

// Reads raw 6-bit counts. Returns false if the sensor didn't answer.
bool mmaRead(int8_t out[3]) {
  for (int attempt = 0; attempt < 4; attempt++) {
    i2cStart();
    if (!i2cWrite(MMA7660_ADDR << 1)) { i2cStop(); return false; }
    i2cWrite(0x00);
    i2cStart();
    i2cWrite((MMA7660_ADDR << 1) | 1);
    uint8_t raw[3];
    for (int i = 0; i < 3; i++) raw[i] = i2cRead(i < 2);
    i2cStop();
    // Bit 6 is set when the register was being updated while read; try again.
    if ((raw[0] | raw[1] | raw[2]) & 0x40) continue;
    for (int i = 0; i < 3; i++) {
      int v = raw[i] & 0x3F;
      out[i] = (v & 0x20) ? v - 64 : v;
    }
    return true;
  }
  return false;
}

// ---------- Buzzer patterns (non-blocking) ----------
// Each pattern is on/off durations in ms, starting with "on".

const uint16_t PAT_CHIRP[] = {60, 0};
const uint16_t PAT_OK[] = {60, 80, 60, 0};
const uint16_t PAT_WARN[] = {120, 120, 120, 120, 120, 600};
const uint16_t PAT_COUNTDOWN[] = {150, 850};
const uint16_t PAT_COUNTDOWN_FAST[] = {120, 280};
const uint16_t PAT_SOS[] = {150, 150, 150, 150, 150, 400, 450, 150, 450, 150, 450, 400, 150, 150, 150, 150, 150, 1200};
const uint16_t PAT_LOCATE[] = {80, 80, 80, 80, 80, 80, 80, 600};

const uint16_t* patSteps = nullptr;
uint8_t patLen = 0, patIdx = 0;
bool patLoop = false;
uint32_t patStepAt = 0;
bool buzzerSilenced = false;

void playPattern(const uint16_t* steps, uint8_t len, bool loop) {
  if (patSteps == steps && patLoop && loop) return;  // already playing
  patSteps = steps; patLen = len; patIdx = 0; patLoop = loop; patStepAt = millis();
  digitalWrite(PIN_BUZZER, steps[0] ? HIGH : LOW);
}
#define PLAY(p, loop) playPattern(p, sizeof(p) / sizeof(p[0]), loop)

void stopPattern() { patSteps = nullptr; digitalWrite(PIN_BUZZER, LOW); }

void updateBuzzer() {
  if (!patSteps) return;
  if (millis() - patStepAt < patSteps[patIdx]) return;
  patStepAt = millis();
  patIdx++;
  if (patIdx >= patLen) {
    if (!patLoop) { stopPattern(); return; }
    patIdx = 0;
  }
  bool on = (patIdx % 2 == 0) && patSteps[patIdx] > 0 && !buzzerSilenced;
  digitalWrite(PIN_BUZZER, on ? HIGH : LOW);
}

// ---------- LED matrix (13 x 8) ----------

Arduino_LED_Matrix matrix;
uint8_t frame[104];

const char* ICON_HEART[8] = {
  ".............", "...##...##...", "..####.####..", "..#########..",
  "...#######...", "....#####....", ".....###.....", "......#......"};
const char* ICON_ALERT[8] = {
  "......#......", ".....###.....", ".....###.....", ".....###.....",
  "......#......", ".............", "......#......", ".....###....."};
const char* ICON_HELP[8] = {
  ".....###.....", "....#...#....", "........#....", ".......#.....",
  "......#......", "......#......", ".............", "......#......"};
const char* ICON_SOS[8] = {
  ".............", ".###.###.###.", ".#...#.#.#...", ".###.#.#.###.",
  "...#.#.#...#.", ".###.###.###.", ".............", "............."};
const char* ICON_WOBBLE[8] = {
  ".............", ".............", "..##.....##..", ".#..#...#..#.",
  "#....#.#....#", "......#......", ".............", "............."};

int balanceScore = -1;  // set by Linux; -1 = unknown
char riskLevel = 'u';   // l / m / h / u

void drawIcon(const char* icon[8], uint8_t level, int barScore) {
  for (int r = 0; r < 8; r++)
    for (int c = 0; c < 13; c++)
      frame[r * 13 + c] = icon[r][c] == '#' ? level : 0;
  if (barScore >= 0) {
    int cols = (barScore * 13 + 50) / 100;
    for (int c = 0; c < 13; c++) frame[7 * 13 + c] = c < cols ? 2 : 0;
  }
  matrix.draw(frame);
}

// ---------- Fall detection state machine ----------

const char* STATE_NAMES[] = {"normal", "fall_check", "fall_countdown", "help_countdown", "emergency"};
State state = NORMAL;
uint32_t stateAt = 0;
String emergencyReason = "";

uint32_t fallCountdownMs = 30000;
const uint32_t HELP_COUNTDOWN_MS = 5000;
const uint32_t FALL_CHECK_MS = 2500;

// Thresholds in g. The sensor saturates at 1.5 g per axis, so impact is judged
// on the magnitude of all three axes together.
const float FREEFALL_G = 0.6f;
const int FREEFALL_SAMPLES = 3;  // 60 ms
const float IMPACT_G = 1.4f;
const float HARD_IMPACT_G = 2.0f;
const uint32_t FREEFALL_TO_IMPACT_MS = 1000;
const float FALL_ANGLE_DEG = 40.0f;

float gLP[3] = {0, 0, 1};    // slow gravity estimate
float refG[3] = {0, 0, 1};   // posture before the event
int freefallRun = 0;
uint32_t freefallAt = 0;
float impactPeak = 0;
float postSum[3];
int postN = 0;

void sendEvent(const char* name, const String& detail) {
  Bridge.notify("fg_event", String(name), detail);
}

void setState(State s) {
  state = s;
  stateAt = millis();
  buzzerSilenced = false;
  Bridge.notify("fg_state", String(STATE_NAMES[s]));
}

float angleBetween(const float a[3], const float b[3]) {
  float dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  float na = sqrtf(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  float nb = sqrtf(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
  if (na < 0.1f || nb < 0.1f) return 0;
  float c = dot / (na * nb);
  c = c > 1 ? 1 : (c < -1 ? -1 : c);
  return acosf(c) * 57.2958f;
}

void processSample(const float a[3]) {
  float mag = sqrtf(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);

  if (state == NORMAL) {
    for (int i = 0; i < 3; i++) gLP[i] += 0.02f * (a[i] - gLP[i]);

    if (mag < FREEFALL_G) {
      if (++freefallRun == FREEFALL_SAMPLES) {
        freefallAt = millis();
        memcpy(refG, gLP, sizeof(refG));
      }
    } else {
      freefallRun = 0;
    }

    bool recentFreefall = freefallAt && millis() - freefallAt < FREEFALL_TO_IMPACT_MS;
    if ((mag >= IMPACT_G && recentFreefall) || mag >= HARD_IMPACT_G) {
      if (!recentFreefall) memcpy(refG, gLP, sizeof(refG));
      impactPeak = mag;
      postN = 0;
      postSum[0] = postSum[1] = postSum[2] = 0;
      sendEvent("fall_suspected", "peak=" + String(mag, 2) + " freefall=" + (recentFreefall ? "1" : "0"));
      freefallAt = 0;
      setState(FALL_CHECK);
    }
  } else if (state == FALL_CHECK) {
    uint32_t t = millis() - stateAt;
    if (t < 400) {
      if (mag > impactPeak) impactPeak = mag;
    } else if (t > 1000) {
      // Average posture once the bounce has settled.
      for (int i = 0; i < 3; i++) postSum[i] += a[i];
      postN++;
    }
    if (t >= FALL_CHECK_MS) {
      float post[3] = {postSum[0] / postN, postSum[1] / postN, postSum[2] / postN};
      float angle = postN ? angleBetween(refG, post) : 0;
      String detail = "angle=" + String(angle, 0) + " peak=" + String(impactPeak, 2);
      if (angle >= FALL_ANGLE_DEG) {
        sendEvent("fall_detected", detail);
        setState(FALL_COUNTDOWN);
      } else {
        sendEvent("fall_dismissed", detail);
        setState(NORMAL);
      }
    }
  }
}

// ---------- Button ----------

bool btnStable = false, btnLast = false;
uint32_t btnChangedAt = 0, btnDownAt = 0;
bool holdHandled = false;

void onPress() {
  switch (state) {
    case NORMAL:
      sendEvent("help_pressed", "");
      setState(HELP_COUNTDOWN);
      break;
    case HELP_COUNTDOWN:
      sendEvent("help_cancelled", "button");
      setState(NORMAL);
      PLAY(PAT_OK, false);
      break;
    case FALL_CHECK:
    case FALL_COUNTDOWN:
      sendEvent("fall_cancelled", "button");
      setState(NORMAL);
      PLAY(PAT_OK, false);
      break;
    case EMERGENCY:
      buzzerSilenced = true;  // short press silences; hold 3 s to resolve
      digitalWrite(PIN_BUZZER, LOW);
      sendEvent("silenced", "button");
      break;
  }
}

void updateButton() {
  bool raw = digitalRead(PIN_BUTTON) == HIGH;
  if (raw != btnLast) { btnLast = raw; btnChangedAt = millis(); }
  if (millis() - btnChangedAt > 25 && raw != btnStable) {
    btnStable = raw;
    if (btnStable) { btnDownAt = millis(); holdHandled = false; onPress(); }
  }
  if (btnStable && !holdHandled && state == EMERGENCY && millis() - btnDownAt > 3000) {
    holdHandled = true;
    sendEvent("resolved", "button");
    setState(NORMAL);
    PLAY(PAT_OK, false);
  }
}

// ---------- Commands from Linux ----------

void fg_cmd(String cmd) {
  if (cmd == "cancel") {
    if (state == FALL_CHECK || state == FALL_COUNTDOWN) { sendEvent("fall_cancelled", "app"); setState(NORMAL); PLAY(PAT_OK, false); }
    else if (state == HELP_COUNTDOWN) { sendEvent("help_cancelled", "app"); setState(NORMAL); PLAY(PAT_OK, false); }
  } else if (cmd == "resolve") {
    if (state != NORMAL) { sendEvent("resolved", "app"); setState(NORMAL); PLAY(PAT_OK, false); }
  } else if (cmd == "help") {
    if (state == NORMAL || state == HELP_COUNTDOWN) { emergencyReason = "help"; sendEvent("emergency", "help"); setState(EMERGENCY); }
  } else if (cmd == "silence") {
    buzzerSilenced = true; digitalWrite(PIN_BUZZER, LOW);
  } else if (cmd == "test_fall") {
    if (state == NORMAL) { sendEvent("fall_detected", "test"); setState(FALL_COUNTDOWN); }
  } else if (cmd == "warn") {
    if (state == NORMAL) PLAY(PAT_WARN, false);
  } else if (cmd == "locate") {
    if (state == NORMAL) PLAY(PAT_LOCATE, false);
  } else if (cmd.startsWith("score=")) {
    // score=NN,r  (r = l/m/h/u)
    int comma = cmd.indexOf(',');
    balanceScore = cmd.substring(6, comma > 0 ? comma : cmd.length()).toInt();
    if (comma > 0 && comma + 1 < (int)cmd.length()) riskLevel = cmd.charAt(comma + 1);
  } else if (cmd.startsWith("countdown=")) {
    uint32_t s = cmd.substring(10).toInt();
    if (s >= 5 && s <= 120) fallCountdownMs = s * 1000;
  }
}

String fg_status() {
  return String(STATE_NAMES[state]);
}

// ---------- Main loop ----------

bool sensorOk = false;
uint32_t lastSampleAt = 0, lastStateAt = 0, lastMatrixAt = 0, lastRetryAt = 0;
char batch[BATCH * 3 + 1];
int batchN = 0;
uint32_t seq = 0;

void setup() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_BUTTON, INPUT);

  matrix.begin();
  matrix.setGrayscaleBits(3);
  drawIcon(ICON_HEART, 3, -1);

  Bridge.begin();
  Bridge.provide_safe("fg_cmd", fg_cmd);
  Bridge.provide_safe("fg_status", fg_status);

  sensorOk = mmaBegin();
  PLAY(PAT_CHIRP, false);
}

void updateStateMachineTimers() {
  uint32_t t = millis() - stateAt;
  switch (state) {
    case HELP_COUNTDOWN:
      PLAY(PAT_COUNTDOWN_FAST, true);
      if (t >= HELP_COUNTDOWN_MS) { emergencyReason = "help"; sendEvent("emergency", "help"); setState(EMERGENCY); }
      break;
    case FALL_COUNTDOWN:
      if (fallCountdownMs - t < 10000) PLAY(PAT_COUNTDOWN_FAST, true);
      else PLAY(PAT_COUNTDOWN, true);
      if (t >= fallCountdownMs) { emergencyReason = "fall"; sendEvent("emergency", "fall"); setState(EMERGENCY); }
      break;
    case EMERGENCY:
      PLAY(PAT_SOS, true);
      break;
    default:
      if (patLoop) stopPattern();
      break;
  }
}

void updateMatrix() {
  if (millis() - lastMatrixAt < 100) return;
  lastMatrixAt = millis();
  bool blink = (millis() / 400) % 2;
  switch (state) {
    case NORMAL:
      if (!sensorOk) drawIcon(ICON_ALERT, blink ? 2 : 0, -1);
      else if (riskLevel == 'h') drawIcon(ICON_WOBBLE, blink ? 7 : 3, balanceScore);
      else drawIcon(ICON_HEART, riskLevel == 'm' ? 5 : 3, balanceScore);
      break;
    case FALL_CHECK: drawIcon(ICON_ALERT, 4, -1); break;
    case FALL_COUNTDOWN: drawIcon(ICON_ALERT, blink ? 7 : 0, -1); break;
    case HELP_COUNTDOWN: drawIcon(ICON_HELP, blink ? 7 : 0, -1); break;
    case EMERGENCY: drawIcon(ICON_SOS, blink ? 7 : 1, -1); break;
  }
}

void loop() {
  uint32_t now = millis();

  if (now - lastSampleAt >= SAMPLE_MS) {
    lastSampleAt += SAMPLE_MS;
    if (now - lastSampleAt > 200) lastSampleAt = now;  // don't try to catch up after a stall

    int8_t raw[3];
    if (sensorOk && mmaRead(raw)) {
      float a[3] = {raw[0] / COUNTS_PER_G, raw[1] / COUNTS_PER_G, raw[2] / COUNTS_PER_G};
      processSample(a);
      for (int i = 0; i < 3; i++) batch[batchN * 3 + i] = (char)(raw[i] + 64);
      if (++batchN == BATCH) {
        batch[BATCH * 3] = 0;
        Bridge.notify("fg_imu", (int)seq++, String(batch));
        batchN = 0;
      }
    } else if (now - lastRetryAt > 2000) {
      lastRetryAt = now;
      bool was = sensorOk;
      sensorOk = mmaBegin();
      if (was != sensorOk) sendEvent(sensorOk ? "sensor_ok" : "sensor_missing", "");
    }
  }

  updateButton();
  updateStateMachineTimers();
  updateBuzzer();
  updateMatrix();

  if (now - lastStateAt >= 1000) {
    lastStateAt = now;
    Bridge.notify("fg_state", String(STATE_NAMES[state]));
  }
}
