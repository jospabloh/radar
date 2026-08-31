import React from "react";
import PageHeader from "@/components/PageHeader";
import { APP_VERSION, RELEASE_DATE } from "@/lib/appConfig";

const CHANGES = [
  { date: "2026-08-31", title: "Auditoría programada: verificación de despliegue y una etiqueta corregida", items: ["Corregido: el formulario para dar de alta un empleado mostraba 'Store Manager' (en inglés) en vez de 'Gerente de tienda' al elegir el rol — el resto de la app ya usaba la etiqueta correcta", "Verificado contra el backend desplegado: las dos correcciones de seguridad del 24 de agosto (permisos de empresa, arranque de plataforma) están activas en producción"] },
  { date: "2026-08-24", title: "Roles, permisos granulares y cierre de brechas de seguridad", items: ["Nuevo: roles y permisos declarados en un solo lugar — un administrador puede ahora decidir, por rol, quién aprueba solicitudes, edita horarios o exporta los datos de la empresa", "Nuevo: selector de tema con opción 'Sistema' que sigue las preferencias de tu dispositivo", "Corregido: cerrada una vía por la que un empleado podía concederse permisos que no le correspondían", "Corregido: cerrada una vía de arranque que, tras un incidente de mantenimiento, podía asignar el rol de administrador de plataforma a un registro nuevo", "Corregido: las notificaciones hacia el panel central de ACACIA ahora usan una firma propia de RADAR en vez de una compartida entre todas las apps"] },
  { date: "2026-08-18", title: "Facturación, exportación de datos y zona de peligro", items: ["Las acciones de registrar asistencia, aprobar solicitudes, crear turnos e invitar empleados ahora se bloquean si la empresa está suspendida o en modo solo lectura — antes solo se validaba el rol, no el estado de la licencia", "Nuevo: descargar todos los datos de tu empresa desde Configuración", "Nuevo: solicitar la eliminación de la empresa desde Configuración (se envía a soporte, no es instantáneo)"] },
  { date: "2026-07-28", title: "Auditoría de seguridad", items: ["Corregido: un empleado ya no puede aprobar su propia solicitud de PTO, cambio de horario o extensión", "Corregido: un empleado ya no puede modificar el plan/licencia de su empresa directamente", "Corregido: los datos de otro usuario (incluido su email) ya no son editables por cualquier compañero", "Corregido: las preferencias de notificación de otro usuario ya no son modificables por cualquier compañero", "Corregido: un empleado ya no puede autoasignarse el rol de administrador (ni al crear ni al editar)", "Corregido: una solicitud de PTO o extensión ya no puede registrarse a nombre de otro compañero", "Corregido: el botón para eliminar un turno predeterminado, que nunca había funcionado, ahora funciona para gerentes/administradores", "Corregido: solo administradores de empresa pueden cambiar el estado de un ticket de soporte", "Corregido: la barra lateral ya no desaparece al navegar a Analítica, Incidencias, Calendario, Horarios, Empresa, Licencias, Notificaciones, Manual, Soporte o Historial"] },
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
        <p className="text-center text-xs text-muted-foreground pt-2 pb-6">
          Versión {APP_VERSION} · {RELEASE_DATE}
        </p>
      </div>
    </div>
  );
}