import React from "react";
import PageHeader from "@/components/PageHeader";

const CHANGES = [
  { date: "2026-07-28", title: "Auditoría de seguridad", items: ["Corregido: un empleado ya no puede aprobar su propia solicitud de PTO, cambio de horario o extensión", "Corregido: un empleado ya no puede modificar el plan/licencia de su empresa directamente", "Corregido: los datos de otro usuario (incluido su email) ya no son editables por cualquier compañero", "Corregido: las preferencias de notificación de otro usuario ya no son modificables por cualquier compañero"] },
  { date: "2026-07-01", title: "RADAR", items: ["La plataforma se renombró a RADAR", "El nombre de la empresa activa ahora se muestra en el panel"] },
  { date: "2026-06-20", title: "Monitoreo automático de asistencia", items: ["Detección automática de ausencias", "Cierre automático de jornadas abiertas cada 15 minutos"] },
  { date: "2026-06-10", title: "Portal del empleado", items: ["Solicitudes de PTO desde el portal", "Solicitudes de extensión de horario"] },
  { date: "2026-05-28", title: "Aprobaciones y reportes", items: ["Panel de aprobaciones para gerentes", "Reportes de asistencia por rango de fechas"] },
  { date: "2026-05-15", title: "Lanzamiento inicial", items: ["Gestión de empresas y empleados", "Registro de entrada y salida"] },
];

export default function ChangeLog() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Historial de Cambios" subtitle="Actualizaciones y mejoras recientes en RADAR" />
      <div className="max-w-2xl mx-auto px-6 space-y-4">
        {CHANGES.map((c) => (
          <div key={c.date} className="bg-card rounded-2xl border border-border p-5">
            <p className="text-xs text-muted-foreground mb-1">{c.date}</p>
            <p className="font-semibold text-foreground mb-2">{c.title}</p>
            <ul className="list-disc list-inside space-y-1">
              {c.items.map((i) => <li key={i} className="text-sm text-muted-foreground">{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}