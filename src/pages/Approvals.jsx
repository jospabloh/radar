import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { Check, X } from "lucide-react";
import { usePermissions } from "@/lib/PermissionContext";

function Row({ title, subtitle, onApprove, onReject, canResolve }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {canResolve && (
        <div className="flex gap-2">
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={onApprove}><Check className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={onReject}><X className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}


export default function Approvals() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const companyId = user?.company_id ?? null;
  // Module 3: the same two keys resolveApprovalRequest re-checks server-side,
  // so a company_admin who denied their store_managers `Aprobaciones:resolve`
  // no longer sees buttons the backend would refuse. `null` until the user
  // loads, which the render below distinguishes from an outright `false`.
  const canView = user ? can("Aprobaciones:view") : null;
  const canResolve = user ? can("Aprobaciones:resolve") : false;
  const [ptos, setPtos] = useState([]);
  const [scheduleReqs, setScheduleReqs] = useState([]);
  const [extensions, setExtensions] = useState([]);

  const load = useCallback(async (cid) => {
    setPtos(await base44.entities.PTORequest.filter({ company_id: cid, status: "pending" }, "-created_date"));
    setScheduleReqs(await base44.entities.ScheduleChangeRequest.filter({ company_id: cid, status: "pending" }, "-created_date"));
    setExtensions(await base44.entities.ExtensionRequest.filter({ company_id: cid, status: "pending" }, "-created_date"));
  }, []);

  useEffect(() => {
    if (canView) load(companyId);
  }, [canView, companyId, load]);

  // Actual authorization is enforced server-side by resolveApprovalRequest
  // (app_role, tenant, the granular permission key, then the billing gate);
  // these gates just keep a non-manager from seeing pending requests or a
  // confusing "approve" button that the backend would reject.
  const resolve = async (entity, requestId, status) => {
    try {
      await base44.functions.invoke("resolveApprovalRequest", { entity, requestId, status });
      load(companyId);
    } catch (error) {
      toast({ title: "No se pudo procesar la solicitud", description: error.message, variant: "destructive" });
    }
  };
  const resolvePto = (id, status) => resolve("PTORequest", id, status);
  const resolveSchedule = (req, status) => resolve("ScheduleChangeRequest", req.id, status);
  const resolveExtension = (req, status) => resolve("ExtensionRequest", req.id, status);

  if (canView === false) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-center text-muted-foreground text-sm mt-12">No tienes permiso para ver esta página.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Aprobaciones</h1>
      <Tabs defaultValue="pto">
        <TabsList>
          <TabsTrigger value="pto">PTOs ({ptos.length})</TabsTrigger>
          <TabsTrigger value="schedule">Horarios ({scheduleReqs.length})</TabsTrigger>
          <TabsTrigger value="extension">Extensiones ({extensions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pto">
          <div className="bg-card rounded-2xl border border-border divide-y divide-border mt-4">
            {ptos.map((p) => (
              <Row canResolve={canResolve}
                key={p.id}
                title={`${p.employee_name} · ${p.type}`}
                subtitle={`${p.start_date} a ${p.end_date} — ${p.reason || ""}`}
                onApprove={() => resolvePto(p.id, "approved")}
                onReject={() => resolvePto(p.id, "rejected")}
              />
            ))}
            {ptos.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Sin solicitudes pendientes</p>}
          </div>
        </TabsContent>
        <TabsContent value="schedule">
          <div className="bg-card rounded-2xl border border-border divide-y divide-border mt-4">
            {scheduleReqs.map((s) => (
              <Row canResolve={canResolve}
                key={s.id}
                title={s.employee_name}
                subtitle={s.reason || "Cambio de horario"}
                onApprove={() => resolveSchedule(s, "approved")}
                onReject={() => resolveSchedule(s, "rejected")}
              />
            ))}
            {scheduleReqs.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Sin solicitudes pendientes</p>}
          </div>
        </TabsContent>
        <TabsContent value="extension">
          <div className="bg-card rounded-2xl border border-border divide-y divide-border mt-4">
            {extensions.map((e) => (
              <Row canResolve={canResolve}
                key={e.id}
                title={`${e.employee_name} · +${e.requested_minutes} min`}
                subtitle={e.reason || ""}
                onApprove={() => resolveExtension(e, "approved")}
                onReject={() => resolveExtension(e, "rejected")}
              />
            ))}
            {extensions.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Sin solicitudes pendientes</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}