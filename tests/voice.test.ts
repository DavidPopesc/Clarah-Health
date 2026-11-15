import assert from "node:assert/strict";
import { test } from "node:test";
import { loadRate, speechParts } from "../src/lib/voice.ts";

test("strips markdown so the voice doesn't read symbols", () => {
  const parts = speechParts("Your **glipizide** can lower blood sugar.\n\n**Ask your doctor**\n- Should I change the dose?\n- What if I feel shaky?");
  assert.equal(parts.length, 1);
  assert.equal(parts[0], "Your glipizide can lower blood sugar. Ask your doctor. Should I change the dose? What if I feel shaky?");
});

test("keeps link text and drops the URL", () => {
  assert.deepEqual(speechParts("See [the ADA guide](https://diabetes.org) for more."), ["See the ADA guide for more."]);
});

test("splits long answers into parts of at most 600 characters", () => {
  const sentence = "This is one plain sentence about your blood pressure readings. ";
  const parts = speechParts(sentence.repeat(30));
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 600));
  assert.equal(parts.join(" ").split("blood pressure").length - 1, 30);
});

test("an empty answer has nothing to say", () => {
  assert.deepEqual(speechParts("   \n\n  "), []);
});

test("speed defaults to normal when nothing is saved (no browser storage)", () => {
  assert.equal(loadRate(), 1);
});
