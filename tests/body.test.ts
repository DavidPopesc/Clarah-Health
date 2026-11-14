import assert from "node:assert/strict";
import { test } from "node:test";
import { detectBodyFocus, normalizeFocus } from "../src/lib/body.ts";

test("sprained left ankle shows the left ankle muscles and ligaments", () => {
  const f = detectBodyFocus("I sprained my left ankle. Can I take ibuprofen?");
  assert.deepEqual(f && { region: f.region, side: f.side, system: f.system, label: f.label }, {
    region: "ankle",
    side: "left",
    system: "muscular",
    label: "Left ankle",
  });
});

test("'right away' does not pick a side", () => {
  const f = detectBodyFocus("My knee hurts, should I see someone right away?");
  assert.equal(f?.region, "knee");
  assert.equal(f?.side, undefined);
});

test("broken wrist uses the skeletal system", () => {
  const f = detectBodyFocus("I think I broke my right wrist");
  assert.equal(f?.region, "wrist");
  assert.equal(f?.side, "right");
  assert.equal(f?.system, "skeletal");
});

test("questions without a body part show nothing", () => {
  assert.equal(detectBodyFocus("Is grapefruit okay with my cholesterol medicine?"), null);
  assert.equal(detectBodyFocus("What does my A1c mean?"), null);
});

test("heartburn maps to the stomach, not the heart", () => {
  assert.equal(detectBodyFocus("I get heartburn after iftar")?.region, "stomach");
});

test("model tool arguments are validated", () => {
  assert.equal(normalizeFocus({ region: "spleen", system: "organs" }), null);
  const f = normalizeFocus({ region: "kidneys", side: "left", system: "bogus", reason: "eGFR" });
  assert.deepEqual(f, { region: "kidneys", side: undefined, system: "organs", label: "Kidneys", reason: "eGFR" });
});
