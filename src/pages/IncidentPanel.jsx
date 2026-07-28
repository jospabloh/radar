import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ATTENDANCE_STATUS_STYLE, ATTENDANCE_STATUS_LABEL } from "@/lib/schedule";

export default function IncidentPanel() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [notes, setNotes] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async (cid) => {
    const [records, employees] = await Promise.all([
      base44.entities.AttendanceRecord.filter({ company_id: cid }, "-date", 200),
      base44.entities.Employee.filter({ company_id: cid }),
    ]);
    const nameById = Object.fromEntries(employees.map((e) => [e.id, e.full_name]));
    const filtered = records
      .filter((r) => ["absent", "late"].includes(r.status))
      .map((r) => ({ ...r, employee_name: nameById[r.employee_id] || "Desconocido" }));
    setIncidents(filtered);
    setNotes(Object.fromEntries(filtered.map((r) => [r.id, r.notes || ""])));
  }, []);

  useEffect(() => {
    if (user?.company_id) load(user.company_id);
  }, [user, load]);

  const handleSaveNote = async (id) => {
    setSavingId(id);
    try {
      await base44.functions.invoke("updateAttendanceRecord", { recordId: id, updates: { notes: notes[id] } });
    } catch (error) {
      toast({ title: "No se pudo guardar la nota", description: error.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Panel de Incidencias" subtitle="Ausencias y llegadas tarde agrupadas para revisión" />
      <div className="max-w-3xl mx-auto px-6 space-y-3">
        {incidents.map((r) => (
          <div key={r.id} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-foreground">{r.employee_name}</p>
                <p className="text-sm text-muted-foreground">{r.date}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ATTENDANCE_STATUS_STYLE[r.status]}`}>{ATTENDANCE_STATUS_LABEL[r.status]}</span>
            </div>
            <Textarea
              placeholder="Agregar nota o acción tomada..."
              value={notes[r.id] || ""}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
              rows={2}
              className="mb-2"
            />
            <Button size="sm" variant="outline" disabled={savingId === r.id} onClick={() => handleSaveNote(r.id)}>
              {savingId === r.id ? "Guardando..." : "Guardar nota"}
            </Button>
          </div>
        ))}
        {incidents.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Sin incidencias registradas</p>}
      </div>
    </div>
  );
}