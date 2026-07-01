import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { WEEKDAYS } from "@/lib/schedule";
import { Trash2 } from "lucide-react";

export default function ShiftSettings() {
  const [companyId, setCompanyId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ name: "", start: "09:00", end: "18:00", days_of_week: [] });

  const load = useCallback(async (cid) => {
    const list = await base44.entities.ShiftTemplate.filter({ company_id: cid }, "-created_date");
    setTemplates(list);
  }, []);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setCompanyId(u.company_id);
      load(u.company_id);
    });
  }, [load]);

  const toggleDay = (key) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(key) ? f.days_of_week.filter((d) => d !== key) : [...f.days_of_week, key],
    }));
  };

  const handleCreate = async () => {
    if (!form.name) return;
    await base44.entities.ShiftTemplate.create({ ...form, company_id: companyId });
    setForm({ name: "", start: "09:00", end: "18:00", days_of_week: [] });
    load(companyId);
  };

  const handleDelete = async (id) => {
    await base44.entities.ShiftTemplate.delete(id);
    load(companyId);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Configuración de Horarios" subtitle="Define los turnos predeterminados de tu empresa" />
      <div className="max-w-2xl mx-auto px-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <Input placeholder="Nombre del turno (ej. Matutino)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-slate-500">Entrada</label>
              <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500">Salida</label>
              <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <label key={d.key} className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox checked={form.days_of_week.includes(d.key)} onCheckedChange={() => toggleDay(d.key)} />
                {d.label}
              </label>
            ))}
          </div>
          <Button onClick={handleCreate}>Crear turno</Button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-5">
              <div>
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">
                  {t.start} - {t.end} · {(t.days_of_week || []).map((d) => WEEKDAYS.find((w) => w.key === d)?.label).join(", ")}
                </p>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {templates.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">No hay turnos configurados</p>}
        </div>
      </div>
    </div>
  );
}