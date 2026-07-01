// Cosmetic-only memory of the last signed-in user, used solely to greet a
// returning user on the login screen ("welcome back" + prefilled email).
//
// SECURITY: this NEVER stores the access token or anything used for
// authorization. The real session is always the Base44 token + RLS. Having a
// remembered identity does NOT mean the user is authenticated. Cleared on
// logout and on "usar otra cuenta".
const KEY = "acacia_last_identity_v1";

function ls() {
  return (typeof globalThis !== "undefined" && globalThis.localStorage) ? globalThis.localStorage : null;
}

export function rememberIdentity(user) {
  const store = ls();
  if (!store || !user) return;
  try {
    const identity = {
      name: user.full_name || user.name || null,
      email: user.email || null,
      avatar: user.avatar_url || user.picture || user.photo_url || null,
    };
    if (!identity.name && !identity.email) return;
    store.setItem(KEY, JSON.stringify(identity));
  } catch { /* storage unavailable — non-fatal */ }
}

export function getRememberedIdentity() {
  const store = ls();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const id = JSON.parse(raw);
    return id && (id.name || id.email) ? id : null;
  } catch { return null; }
}

export function clearRememberedIdentity() {
  const store = ls();
  if (!store) return;
  try { store.removeItem(KEY); } catch { /* ignore */ }
}
