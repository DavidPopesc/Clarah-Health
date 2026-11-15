#pragma once

// Lives in a header so the Arduino builder's generated prototypes can see it.
enum State { NORMAL, FALL_CHECK, FALL_COUNTDOWN, HELP_COUNTDOWN, EMERGENCY };
