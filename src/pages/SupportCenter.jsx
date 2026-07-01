import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const STATUS_STYLE = {
  open: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  waiting_customer: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL = {
  open: "Abierto",
  in_progress: "En proceso",
  waiting_customer: "Esperando cliente",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export default function SupportCenter() {
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!subject || !description) return;
    setSaving(true);
    const ticket = await base44.entities.SupportTicket.create({
      company_id: companyId,
      employee_name: user.full_name,
      created_by_id: user.id,
      created_by_email: user.email,
      priority: "normal",
      subject,
      description,
    });
    // Fire-and-forget: push the new ticket to ACACIA Mission Control in real time.
    base44.functions.invoke("notifyTicketCreated", { ticketId: ticket.id }).catch(() => {});
    setSubject("");
    setDescription("");
    setSaving(false);
    load(companyId, user, isAdmin);
  };

  const handleStatusChange = async (id, status) => {
    await base44.entities.SupportTicket.update(id, { status });
    load(companyId, user, isAdmin);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Centro de Soporte" subtitle="Registra un ticket o consulta el estado de tus reportes" />
      <div className="max-w-2xl mx-auto px-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-3">
          <Input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Describe tu problema" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Enviando..." : "Enviar ticket"}</Button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
          {tickets.map((t) => (
            <div key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{t.subject}</p>
                  <p className="text-sm text-slate-500 mt-1">{t.description}</p>
                  {isAdmin && <p className="text-xs text-slate-400 mt-1">{t.employee_name}</p>}
                </div>
                {isAdmin ? (
                  <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, v)}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
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
          ))}
          {tickets.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">No hay tickets</p>}
        </div>
      </div>
    </div>
  );
}