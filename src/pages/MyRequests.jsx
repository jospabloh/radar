import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";

const STATUS_STYLE = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
const STATUS_LABEL = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado" };
const TYPE_LABEL = { pto: "Días/Permiso", schedule: "Cambio de horario", extension: "Extensión" };

export default function MyRequests() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const emps = await base44.entities.Employee.filter({ user_id: u.id });
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
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Mis Solicitudes" subtitle="Estado de tus solicitudes de PTO, horario y extensiones" backTo="/portal" />
      <div className="max-w-2xl mx-auto px-6">
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
          {requests.map((r) => (
            <div key={`${r.type}-${r.id}`} className="flex items-center justify-between p-5">
              <div>
                <p className="font-medium text-slate-900">{TYPE_LABEL[r.type]}</p>
                <p className="text-sm text-slate-500">{r.detail}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
          {requests.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">No tienes solicitudes</p>}
        </div>
      </div>
    </div>
  );
}