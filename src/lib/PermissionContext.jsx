import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { resolvePermission } from "@/lib/permissionRegistry";
import { ROLES } from "@/lib/rbac";

/**
 * Module 3's client half: `usePermissions().can("Section:action")`.
 *
 * This hides and disables UI — it is NOT the enforcement boundary. Every key
 * it answers is independently re-checked server-side by the function that
 * performs the write (each function's colocated _permissions.ts), in the same
 * precedence order, so a client bypassed from devtools gains nothing.
 *
 * Overrides are loaded once per (company_id, app_role) and are deliberately
 * fail-CLOSED-to-defaults rather than fail-open: if the PermissionProfile read
 * fails, `can()` falls back to the registry default for the role, which is the
 * same answer the server computes when no override row exists.
 */
const PermissionContext = createContext({
  can: () => false,
  overrides: {},
  loading: true,
  refreshOverrides: () => {},
});

export function PermissionProvider({ children }) {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const companyId = user?.company_id || null;
  const role = user?.app_role || null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // super_admin bypasses every check, and a user with no tenant yet has no
      // profile to read — skip the round-trip in both cases.
      if (!user || !role || role === ROLES.SUPER_ADMIN || !companyId) {
        if (!cancelled) {
          setOverrides({});
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const rows = await base44.entities.PermissionProfile.filter({
          company_id: companyId,
          role_key: role,
        });
        if (!cancelled) setOverrides(rows?.[0]?.permissions || {});
      } catch {
        // Fall back to registry defaults — the same answer the server gives
        // when no override row exists.
        if (!cancelled) setOverrides({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, role, companyId, nonce]);

  const value = useMemo(
    () => ({
      can: (key) => (role ? resolvePermission(key, role, overrides) : false),
      overrides,
      loading,
      refreshOverrides: () => setNonce((n) => n + 1),
    }),
    [role, overrides, loading],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionContext);
}
