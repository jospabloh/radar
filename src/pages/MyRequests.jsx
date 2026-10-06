import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";

const STATUS_STYLE = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};
const STATUS_LABEL = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado" };
const TYPE_LABEL = { pto: "Días/Permiso", schedule: "Cambio de horario", extension: "Extensión" };

export default function MyRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const emps = await base44.entities.Employee.filter({ user_id: user.id });
      const emp = emps[0];
      if (!emp) return;
      const [ptos, schedules, extensions] = await Promise.all([
        base44.entities.PTORequest.filter({ employee_id: emp.id }, "-created_date"),
        base44.entities.ScheduleChangeRequest.filter({ employee_id: emp.id }, "-created_date"),
        base44.entities.ExtensionRequest.filter({ employee_id: emp.id }, "-created_date"),
      ]);
      const all = [
        ...ptos.map((r) => ({ ...r, type: "pto", detail: `${r.start_date} → ${r.end_date}` })),
        ...schedules.map((r) => ({ ...r, type: "schedule", detail: r.reason || "Cambio de horario propuesto" })),
        ...extensions.map((r) => ({ ...r, type: "extension", detail: `${r.date} · ${r.requested_minutes} min` })),
      ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setRequests(all);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Mis Solicitudes" subtitle="Estado de tus solicitudes de PTO, horario y extensiones" backTo="/portal" />
      <div className="max-w-2xl mx-auto px-6">
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {requests.map((r) => (
            <div key={`${r.type}-${r.id}`} className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{TYPE_LABEL[r.type]}</p>
                <p className="text-sm text-muted-foreground">{r.detail}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
          {requests.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">No tienes solicitudes</p>}
        </div>
      </div>
    </div>
  );
}