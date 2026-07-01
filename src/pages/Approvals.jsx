import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, X } from "lucide-react";

function Row({ title, subtitle, onApprove, onReject }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onApprove}><Check className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={onReject}><X className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

export default function Approvals() {
  const [companyId, setCompanyId] = useState(null);
  const [ptos, setPtos] = useState([]);
  const [scheduleReqs, setScheduleReqs] = useState([]);
  const [extensions, setExtensions] = useState([]);

  const load = useCallback(async (cid) => {
    setPtos(await base44.entities.PTORequest.filter({ company_id: cid, status: "pending" }, "-created_date"));
    setScheduleReqs(await base44.entities.ScheduleChangeRequest.filter({ company_id: cid, status: "pending" }, "-created_date"));
    setExtensions(await base44.entities.ExtensionRequest.filter({ company_id: cid, status: "pending" }, "-created_date"));
  }, []);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setCompanyId(u.company_id);
      load(u.company_id);
    });
  }, [load]);

  const resolvePto = async (id, status) => {
    await base44.entities.PTORequest.update(id, { status });
    load(companyId);
  };
  const resolveSchedule = async (req, status) => {
    await base44.entities.ScheduleChangeRequest.update(req.id, { status });
    if (status === "approved") {
      await base44.entities.Employee.update(req.employee_id, { schedule: req.proposed_schedule });
    }
    load(companyId);
  };
  const resolveExtension = async (req, status) => {
    await base44.entities.ExtensionRequest.update(req.id, { status });
    if (status === "approved") {
      await base44.entities.AttendanceRecord.update(req.attendance_record_id, { status: "extension", extension_minutes: req.requested_minutes });
    }
    load(companyId);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Aprobaciones</h1>
      <Tabs defaultValue="pto">
        <TabsList>
          <TabsTrigger value="pto">PTOs ({ptos.length})</TabsTrigger>
          <TabsTrigger value="schedule">Horarios ({scheduleReqs.length})</TabsTrigger>
          <TabsTrigger value="extension">Extensiones ({extensions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pto">
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 mt-4">
            {ptos.map((p) => (
              <Row
                key={p.id}
                title={`${p.employee_name} · ${p.type}`}
                subtitle={`${p.start_date} a ${p.end_date} — ${p.reason || ""}`}
                onApprove={() => resolvePto(p.id, "approved")}
                onReject={() => resolvePto(p.id, "rejected")}
              />
            ))}
            {ptos.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">Sin solicitudes pendientes</p>}
          </div>
        </TabsContent>
        <TabsContent value="schedule">
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 mt-4">
            {scheduleReqs.map((s) => (
              <Row
                key={s.id}
                title={s.employee_name}
                subtitle={s.reason || "Cambio de horario"}
                onApprove={() => resolveSchedule(s, "approved")}
                onReject={() => resolveSchedule(s, "rejected")}
              />
            ))}
            {scheduleReqs.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">Sin solicitudes pendientes</p>}
          </div>
        </TabsContent>
        <TabsContent value="extension">
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 mt-4">
            {extensions.map((e) => (
              <Row
                key={e.id}
                title={`${e.employee_name} · +${e.requested_minutes} min`}
                subtitle={e.reason || ""}
                onApprove={() => resolveExtension(e, "approved")}
                onReject={() => resolveExtension(e, "rejected")}
              />
            ))}
            {extensions.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">Sin solicitudes pendientes</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}