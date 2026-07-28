import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { CheckCircle2, BadgeDollarSign, Users, CalendarClock, Sparkles, Loader2 } from "lucide-react";

const PLANS = [
  {
    tier: "starter",
    label: "Starter",
    price: "$499",
    period: "/mes",
    employees: 15,
    features: ["Registro de asistencia", "Reportes básicos", "Soporte por correo"],
  },
  {
    tier: "pro",
    label: "Pro",
    price: "$999",
    period: "/mes",
    employees: 50,
    recommended: true,
    features: ["Todo en Starter", "Aprobaciones", "Notificaciones WhatsApp", "Analítica de productividad"],
  },
  {
    tier: "enterprise",
    label: "Enterprise",
    price: "Personalizado",
    period: "",
    employees: 999,
    features: ["Todo en Pro", "Soporte prioritario", "Empleados ilimitados", "Integraciones a medida"],
  },
];

export default function LicenseManagement() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!user?.company_id) return;
    (async () => {
      const c = await base44.entities.Company.get(user.company_id);
      setCompany(c);
      const emps = await base44.entities.Employee.filter({ company_id: user.company_id, status: "active" });
      setEmployeeCount(emps.length);
    })();
  }, [user]);

  const handleUpgradeRequest = async () => {
    setRequesting(true);
    try {
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
    } catch (error) {
      toast({ title: "No se pudo enviar la solicitud", description: error.message, variant: "destructive" });
    } finally {
      setRequesting(false);
    }
  };

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const max = company.max_employees || 0;
  const usage = max ? Math.min(100, Math.round((employeeCount / max) * 100)) : 0;
  const nearLimit = usage >= 80;

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader title="Gestión de Licencias" subtitle="Revisa tu plan actual y opciones de escalamiento" />
      <div className="max-w-4xl mx-auto px-6">
        {/* Current plan */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-8 shadow-sm">
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BadgeDollarSign className="w-3.5 h-3.5" /> Plan actual
              </p>
              <p className="text-lg font-semibold text-foreground capitalize mt-1">{company.tier}</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" /> Empleados
              </p>
              <p className="text-lg font-semibold text-foreground mt-1 nums-tabular">
                {employeeCount} <span className="text-muted-foreground font-normal">/ {max || "∞"}</span>
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="w-3.5 h-3.5" /> Vigencia
              </p>
              <p className="text-lg font-semibold text-foreground mt-1">{company.license_expiry || "Sin definir"}</p>
            </div>
          </div>
          {max > 0 && (
            <div className="mt-5">
              <Progress value={usage} className="h-2" />
              <p className={`text-xs mt-2 ${nearLimit ? "text-warning font-medium" : "text-muted-foreground"}`}>
                {nearLimit
                  ? `Estás usando el ${usage}% de tu plan. Considera escalar pronto.`
                  : `${usage}% de la capacidad de tu plan en uso.`}
              </p>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const current = company.tier === p.tier;
            return (
              <div
                key={p.tier}
                className={`relative bg-card rounded-2xl border p-6 flex flex-col shadow-sm transition-colors ${
                  current ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                {p.recommended && !current && (
                  <span className="absolute -top-2.5 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    <Sparkles className="w-3 h-3" /> Recomendado
                  </span>
                )}
                <p className="font-semibold text-foreground">{p.label}</p>
                <p className="mt-2 mb-1">
                  <span className="text-2xl font-bold text-foreground">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-4">Hasta {p.employees} empleados</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <span className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary py-2">
                    <CheckCircle2 className="w-4 h-4" /> Plan actual
                  </span>
                ) : (
                  <Button
                    variant={p.recommended ? "default" : "outline"}
                    className="w-full"
                    onClick={handleUpgradeRequest}
                    disabled={requested || requesting}
                  >
                    {requesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : requested ? (
                      "Solicitud enviada"
                    ) : (
                      "Solicitar cambio"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {requested && (
          <p className="text-center text-sm text-success mt-6">
            ¡Gracias! Tu solicitud fue registrada. El equipo de ACACIA te contactará pronto.
          </p>
        )}
      </div>
    </div>
  );
}
