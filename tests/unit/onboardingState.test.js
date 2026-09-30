import test from "node:test";
import assert from "node:assert/strict";
import { onboardingOutcome } from "../../src/lib/onboardingState.js";

test("a 404 not_found (email without Employee row) means 'not associated'", () => {
  assert.equal(onboardingOutcome({ err: { response: { status: 404, data: { error: "not_found" } } } }), "not_associated");
  assert.equal(onboardingOutcome({ err: { status: 404, data: { error: "not_found" } } }), "not_associated");
  assert.equal(onboardingOutcome({ res: { data: { error: "not_found" } } }), "not_associated");
});

test("real failures are not disguised as 'not associated'", () => {
  assert.equal(onboardingOutcome({ err: new Error("Network Error") }), "error");
  assert.equal(onboardingOutcome({ err: { response: { status: 500, data: { error: "Failed to complete onboarding" } } } }), "error");
  assert.equal(onboardingOutcome({ err: { response: { status: 401, data: { error: "Unauthorized" } } } }), "error");
});

test("success paths", () => {
  assert.equal(onboardingOutcome({ res: { data: { success: true, app_role: "company_admin" } } }), "done");
  assert.equal(onboardingOutcome({ res: { data: { success: true, founder: true } } }), "founder");
});
