import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const PLANS = [
  { tier: "starter", label: "Starter", price: "$499/mes", employees: 15, features: ["Registro de asistencia", "Reportes básicos"] },
  { tier: "pro", label: "Pro", price: "$999/mes", employees: 50, features: ["Todo en Starter", "Aprobaciones", "Notificaciones WhatsApp"] },
  { tier: "enterprise", label: "Enterprise", price: "Personalizado", employees: 999, features: ["Todo en Pro", "Soporte prioritario", "Empleados ilimitados"] },
];

export default function LicenseManagement() {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      if (!u.company_id) return;
      const c = await base44.entities.Company.get(u.company_id);
      setCompany(c);
      const emps = await base44.entities.Employee.filter({ company_id: u.company_id, status: "active" });
      setEmployeeCount(emps.length);
    });
  }, []);

  const handleUpgradeRequest = async () => {
    const ticket = await base44.entities.SupportTicket.create({
      company_id: company.id,
      company_name: company.name,
      created_by_id: user?.id,
      created_by_email: user?.email,
      category: "billing",
      priority: "normal",
      subject: "Solicitud de upgrade de plan",
      description: `La empresa ${company.name} solicita información para escalar su plan actual (${company.tier}).`,
    });
    // Fire-and-forget: push the new ticket to ACACIA Mission Control in real time.
    base44.functions.invoke("notifyTicketCreated", { ticketId: ticket.id }).catch(() => {});
    setRequested(true);
  };

  if (!company) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Gestión de Licencias" subtitle="Revisa tu plan actual y opciones de escalamiento" />
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="text-lg font-semibold text-slate-900 capitalize">{company.tier}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Empleados</p>
            <p className="text-lg font-semibold text-slate-900">{employeeCount} / {company.max_employees}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Vigencia</p>
            <p className="text-lg font-semibold text-slate-900">{company.license_expiry || "Sin definir"}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <div key={p.tier} className={`bg-white rounded-2xl border p-6 ${company.tier === p.tier ? "border-green-500 ring-1 ring-green-500" : "border-slate-100"}`}>
              <p className="font-semibold text-slate-900">{p.label}</p>
              <p className="text-2xl font-bold text-slate-900 my-2">{p.price}</p>
              <p className="text-xs text-slate-500 mb-4">Hasta {p.employees} empleados</p>
              <ul className="space-y-1 mb-4">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-green-600" /> {f}
                  </li>
                ))}
              </ul>
              {company.tier === p.tier ? (
                <span className="text-xs font-medium text-green-700">Plan actual</span>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleUpgradeRequest} disabled={requested}>
                  {requested ? "Solicitud enviada" : "Solicitar cambio"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}