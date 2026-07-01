import React, { useEffect, useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { LifeBuoy, Search, Send, Loader2, Inbox } from "lucide-react";

const STATUS = {
  abierto: { label: "Abierto", className: "bg-warning/10 text-warning border border-warning/20" },
  en_proceso: { label: "En proceso", className: "bg-primary/10 text-primary border border-primary/20" },
  resuelto: { label: "Resuelto", className: "bg-success/10 text-success border border-success/20" },
};

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "abierto", label: "Abiertos" },
  { value: "en_proceso", label: "En proceso" },
  { value: "resuelto", label: "Resueltos" },
];

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.abierto;
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  );
}

export default function SupportCenter() {
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const load = useCallback(async (cid, u, admin) => {
    const all = await base44.entities.SupportTicket.filter({ company_id: cid }, "-created_date");
    setTickets(admin ? all : all.filter((t) => t.created_by_id === u.id));
  }, []);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const admin = u.app_role === "company_admin";
      setIsAdmin(admin);
      let cid = u.company_id;
      if (!cid) {
        const emps = await base44.entities.Employee.filter({ user_id: u.id });
        cid = emps[0]?.company_id;
      }
      setCompanyId(cid);
      load(cid, u, admin);
    });
  }, [load]);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSaving(true);
    await base44.entities.SupportTicket.create({
      company_id: companyId,
      employee_name: user.full_name,
      subject: subject.trim(),
      description: description.trim(),
    });
    setSubject("");
    setDescription("");
    setSaving(false);
    load(companyId, user, isAdmin);
  };

  const handleStatusChange = async (id, status) => {
    await base44.entities.SupportTicket.update(id, { status });
    load(companyId, user, isAdmin);
  };

  const counts = useMemo(() => {
    const c = { todos: tickets?.length || 0, abierto: 0, en_proceso: 0, resuelto: 0 };
    (tickets || []).forEach((t) => { if (c[t.status] != null) c[t.status] += 1; });
    return c;
  }, [tickets]);

  const visible = useMemo(() => {
    let list = tickets || [];
    if (filter !== "todos") list = list.filter((t) => t.status === filter);
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
  }, [tickets, filter, search]);

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
          <Input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea
            placeholder="Describe tu problema con el mayor detalle posible…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={saving || !subject.trim() || !description.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {saving ? "Enviando…" : "Enviar ticket"}
            </Button>
          </div>
        </div>

        {/* Filters + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                {f.value !== "todos" && counts[f.value] > 0 && (
                  <span className="ml-1.5 opacity-70">{counts[f.value]}</span>
                )}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="relative sm:ml-auto sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          )}
        </div>

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
                        <SelectItem value="abierto">Abierto</SelectItem>
                        <SelectItem value="en_proceso">En proceso</SelectItem>
                        <SelectItem value="resuelto">Resuelto</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge status={t.status} />
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
