import React from "react";
import { Radar, Clock, CalendarCheck, Users } from "lucide-react";

// Two-column auth layout (family resemblance with FlowFin):
// Left  — form column on a clean background
// Right — brand visual panel (desktop only) with the RADAR identity
export default function AuthLayout({ title, subtitle, footer, children, showSplitPanel = true }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left: form column ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-12 pb-24 lg:pb-12">
        <div className="w-full max-w-sm">
          {/* Wordmark */}
          <div className="flex items-center gap-2 mb-10">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
              <Radar className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">
              RADAR<span className="text-primary">.</span>
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mb-8">{subtitle}</p>}

          {children}

          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
          )}
        </div>
      </div>

      {/* ── Right: brand panel (desktop only) ─────────────────────── */}
      {showSplitPanel && (
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary via-blue-600 to-indigo-700 items-center justify-center">
          {/* Soft depth */}
          <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-400/20 blur-3xl" />
          {/* Concentric radar rings */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-[520px] h-[520px] rounded-full border border-white/40" />
            <div className="absolute w-[380px] h-[380px] rounded-full border border-white/40" />
            <div className="absolute w-[240px] h-[240px] rounded-full border border-white/40" />
            <div className="absolute w-[110px] h-[110px] rounded-full border border-white/40" />
          </div>

          <div className="relative z-10 max-w-md px-12 text-white">
            <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm shadow-xl">
              <Radar className="w-9 h-9" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight mb-3 leading-tight">
              Tu equipo,<br />siempre en foco.
            </h2>
            <p className="text-white/80 text-base mb-8">
              Control de asistencia, horarios y aprobaciones para toda tu empresa en un solo lugar.
            </p>
            <ul className="space-y-3 text-sm text-white/90">
              <li className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/15"><Clock className="w-4 h-4" /></span>
                Registro de asistencia en tiempo real
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/15"><CalendarCheck className="w-4 h-4" /></span>
                Horarios, turnos y solicitudes de permiso
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/15"><Users className="w-4 h-4" /></span>
                Aprobaciones y reportes para tu equipo
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
