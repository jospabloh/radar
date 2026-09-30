// Email verification by code (OTP) for password accounts.
//
// `base44.auth.register` makes Base44 email a code, and until it is entered the
// account is unverified: `loginViaEmailPassword` then rejects with a message
// like "Please verify your email". Register.jsx already had a code screen, but
// Login.jsx surfaced that rejection as raw text, so anyone who closed the tab
// after registering had nowhere to type the code (same failure stockflow had,
// 2026-09-30). Keep the detection and the Spanish messages here so Login and
// Register agree. Pure JS, no imports: node --test loads it directly.

// The platform's wording is English and not a contract, so match loosely.
export const needsEmailVerification = (error) =>
  /verify your email|verification code|email.*not.*verified|not verified/i.test(error?.message || "");

// Keep only digits: people paste "123 456" or "123-456".
export const normalizeOtp = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 6);

// Spanish message for a failed verifyOtp. Never returns the raw platform text.
export function otpErrorMessage(error) {
  const msg = error?.message || "";
  if (/expired|expir/i.test(msg)) return "El código venció. Pulsa Reenviar para recibir uno nuevo.";
  if (/too many|rate|limit|429/i.test(msg)) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  if (/network|failed to fetch|timeout/i.test(msg)) return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
  return "El código no es correcto. Revísalo e inténtalo de nuevo.";
}

export function resendErrorMessage(error) {
  const msg = error?.message || "";
  if (/too many|rate|limit|429/i.test(msg)) return "Ya enviamos un código hace poco. Espera un momento antes de pedir otro.";
  return "No pudimos reenviar el código. Inténtalo de nuevo en unos minutos.";
}
