import React, { useEffect, useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { LifeBuoy, Search, Send, Loader2, Inbox, Sparkles } from "lucide-react";
import { composeTicketBody } from "@/lib/aiIntake";
import AiIntakeChat from "@/components/support/AiIntakeChat";

const STATUS_STYLE = {
  open: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  waiting_customer: "bg-accent text-accent-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};
const STATUS_LABEL = {
  open: "Abierto",
  in_progress: "En proceso",
  waiting_customer: "Esperando cliente",
  resolved: "Resuelto",
  closed: "Cerrado",
};

// Tipos de solicitud. Los marcados con `ai: true` (nueva funcionalidad e
// incidencia) pasan por el asistente BA/PO experto, que entrevista al usuario y
// arma un brief accionable ANTES de escalar. El resto se crea directo.
const TICKET_TYPES = [
  { value: "feature", label: "Nueva funcionalidad o mejora", ai: true },
  { value: "bug", label: "Algo no funciona (incidencia)", ai: true },
  { value: "attendance", label: "Asistencia" },
  { value: "scheduling", label: "Horarios y turnos" },
  { value: "billing", label: "Facturación o plan" },
  { value: "account", label: "Cuenta y accesos" },
  { value: "other", label: "Otra consulta" },
];
const AI_TYPES = new Set(["feature", "bug"]);
// `feature` y `bug` no existen en el enum `category` de SupportTicket; se mapean
// a valores válidos ya desplegados. El tipo real (feature/bug) viaja íntegro en
// `ai_brief.kind` y en el cuerpo Markdown del ticket.
const CATEGORY_FOR_TYPE = { feature: "other", bug: "technical" };
const categoryFor = (type) => CATEGORY_FOR_TYPE[type] || type;

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export default function SupportCenter() {
  const { user } = useAuth();
  const isAdmin = isCompanyAdmin(user);
  const [companyId, setCompanyId] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [ticketType, setTicketType] = useState("other");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (cid, u, admin) => {
    const all = await base44.entities.SupportTicket.filter({ company_id: cid }, "-created_date");
    setTickets(admin ? all : all.filter((t) => t.created_by_id === u.id));
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      let cid = user.company_id;
      if (!cid) {
        const emps = await base44.entities.Employee.filter({ user_id: user.id });
        cid = emps[0]?.company_id;
      }
      setCompanyId(cid);
      load(cid, user, isAdmin);
    })();
  }, [user, isAdmin, load]);

  // Para feature/incidencia abrimos primero la entrevista del asistente; el resto
  // de tipos se crea directo (comportamiento previo intacto).
  const handleSubmit = () => {
    if (!subject.trim() || !description.trim()) return;
    if (AI_TYPES.has(ticketType)) {
      setIntakeOpen(true);
      return;
    }
    createTicket(null);
  };

  /**
   * Crea el ticket. Si viene un `brief` de la IA, el cuerpo se enriquece con la
   * especificación en Markdown (llega a todos lados aunque el esquema no esté
   * desplegado) y se adjunta el brief estructurado en `ai_brief` para el render
   * enriquecido en Mission Control.
   *
   * @param {import("@/lib/aiIntake").IntakeBrief | null} brief
   */
  const createTicket = async (brief) => {
    setSaving(true);
    try {
      /** @type {Record<string, any>} */
      const payload = {
        company_id: companyId,
        employee_name: user.full_name,
        created_by_id: user.id,
        created_by_email: user.email,
        category: categoryFor(ticketType),
        priority: "normal",
        subject,
        description,
      };
      if (brief) {
        payload.description = composeTicketBody(description, brief);
        payload.ai_brief = brief;
      }
      const ticket = await base44.entities.SupportTicket.create(payload);
      // Fire-and-forget: push the new ticket to ACACIA Mission Control in real time.
      base44.functions.invoke("notifyTicketCreated", { ticketId: ticket.id }).catch(() => {});
      setSubject("");
      setDescription("");
      setTicketType("other");
      setIntakeOpen(false);
      load(companyId, user, isAdmin);
    } catch (error) {
      toast({ title: "No se pudo enviar el ticket", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await base44.functions.invoke("updateSupportTicket", { ticketId: id, status });
      load(companyId, user, isAdmin);
    } catch (error) {
      toast({ title: "No se pudo cambiar el estado", description: error.message, variant: "destructive" });
    }
  };

  const visible = useMemo(() => {
    let list = tickets || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.subject?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.employee_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, search]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader
        title="Centro de Soporte"
        subtitle={isAdmin ? "Gestiona los tickets de tu equipo" : "Registra un ticket o consulta el estado de tus reportes"}
      />
      <div className="max-w-2xl mx-auto px-6 space-y-6">
        {/* New ticket */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LifeBuoy className="w-4 h-4 text-primary" /> Nuevo ticket
          </div>
          {intakeOpen ? (
            <AiIntakeChat
              kind={ticketType === "bug" ? "bug" : "feature"}
              subject={subject}
              description={description}
              saving={saving}
              onBack={() => setIntakeOpen(false)}
              onComplete={(brief) => createTicket(brief)}
            />
          ) : (
            <>
              <Select value={ticketType} onValueChange={setTicketType}>
                <SelectTrigger><SelectValue placeholder="Tipo de solicitud" /></SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Textarea
                placeholder="Describe tu solicitud con el mayor detalle posible…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              {AI_TYPES.has(ticketType) && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  Un asistente experto te hará unas preguntas para dejar tu solicitud lista para el equipo.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={saving || !subject.trim() || !description.trim()}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : AI_TYPES.has(ticketType) ? (
                    <Sparkles className="w-4 h-4 mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {saving ? "Enviando…" : AI_TYPES.has(ticketType) ? "Continuar con el asistente" : "Enviar ticket"}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Admin search */}
        {isAdmin && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}

        {/* List */}
        <div className="bg-card rounded-2xl border border-border divide-y divide-border shadow-sm overflow-hidden">
          {tickets === null ? (
            <div className="p-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {tickets.length === 0 ? "Aún no hay tickets. Crea uno arriba." : "No hay tickets que coincidan."}
              </p>
            </div>
          ) : (
            visible.map((t) => (
              <div key={t.id} className="p-5 hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{t.subject}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground/80">
                      {isAdmin && t.employee_name && <span className="font-medium">{t.employee_name}</span>}
                      {isAdmin && t.employee_name && <span>·</span>}
                      <span>{fmtDate(t.created_date)}</span>
                    </div>
                  </div>
                  {isAdmin ? (
                    <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, v)}>
                      <SelectTrigger className="w-32 h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Abierto</SelectItem>
                        <SelectItem value="in_progress">En proceso</SelectItem>
                        <SelectItem value="waiting_customer">Esperando cliente</SelectItem>
                        <SelectItem value="resolved">Resuelto</SelectItem>
                        <SelectItem value="closed">Cerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
