import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Eye } from "lucide-react";

// CompanyStatusBanner — module 10 of the portfolio standard (billing-status
// awareness). Company.status ("active" | "suspended" | "view_only") was
// never read anywhere in the client before this — the module-3 billing
// write-gate (base44/functions/*/​_billingGuard.ts) already rejects writes
// server-side for a suspended/view_only company, but with zero UI
// explanation: a blocked user just saw a generic error toast. This banner
// is the first surface for that state, shown across every page under
// AppLayout so it's visible regardless of where the block happens.
//
// Not shown to super_admin (platform-wide role, no company_id, never
// blocked by this gate) or while status is still loading (null).
export default function CompanyStatusBanner({ status, isSuperAdmin }) {
  if (isSuperAdmin || !status || status === "active") return null;

  const isSuspended = status === "suspended";

  return (
    <div
      className={`flex items-center gap-2 text-sm px-4 py-2.5 border-b ${
        isSuspended
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
      }`}
    >
      {isSuspended ? (
        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : (
        <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {isSuspended
          ? "Tu empresa está suspendida. Registrar asistencia, aprobar solicitudes y otras acciones están pausadas hasta reactivar tu licencia."
          : "Tu empresa está en modo solo lectura. Agregar o editar información está pausado hasta renovar tu licencia."}
      </span>
      <Link to="/gestion-licencias" className="underline font-medium shrink-0 ml-auto">
        Ver licencia
      </Link>
    </div>
  );
}
