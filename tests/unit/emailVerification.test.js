import test from "node:test";
import assert from "node:assert/strict";
import { needsEmailVerification, normalizeOtp, otpErrorMessage, resendErrorMessage } from "../../src/lib/emailVerification.js";

test("detects the unverified-email rejection on login", () => {
  assert.equal(needsEmailVerification(new Error("Please verify your email before logging in")), true);
  assert.equal(needsEmailVerification({ message: "Invalid verification code" }), true);
  assert.equal(needsEmailVerification({ message: "Email not verified" }), true);
});

test("other login errors keep their own message path", () => {
  assert.equal(needsEmailVerification(new Error("Invalid credentials")), false);
  assert.equal(needsEmailVerification(new Error("Request failed with status code 500")), false);
  assert.equal(needsEmailVerification(undefined), false);
  assert.equal(needsEmailVerification(null), false);
});

test("normalizeOtp keeps only up to six digits", () => {
  assert.equal(normalizeOtp("123 456"), "123456");
  assert.equal(normalizeOtp("12-34-56-78"), "123456");
  assert.equal(normalizeOtp(undefined), "");
});

test("otp errors are Spanish and never leak platform text", () => {
  for (const msg of ["Invalid OTP", "OTP expired", "Too many attempts", "Network Error", ""]) {
    const out = otpErrorMessage({ message: msg });
    assert.match(out, /[áéíóúñ]|código|intentos|conexión/i);
    assert.doesNotMatch(out, /invalid otp|expired|network error/);
  }
  assert.match(otpErrorMessage({ message: "OTP expired" }), /venció/);
  assert.match(otpErrorMessage({ message: "Too many requests" }), /Demasiados/);
  assert.match(resendErrorMessage({ message: "rate limit" }), /Espera/);
  assert.match(resendErrorMessage(new Error("boom")), /No pudimos reenviar/);
});
