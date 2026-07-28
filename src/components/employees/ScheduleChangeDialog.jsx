import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ScheduleEditor from "@/components/schedule/ScheduleEditor";
import { defaultSchedule } from "@/lib/schedule";

export default function ScheduleChangeDialog({ open, onOpenChange, employee, onCreated }) {
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) setSchedule(employee.schedule || defaultSchedule());
  }, [employee]);

  if (!employee) return null;

  const handleSubmit = async () => {
    setSaving(true);
    await base44.functions.invoke("createManagedRecord", {
      entity: "ScheduleChangeRequest",
      action: "create",
      data: {
        employee_id: employee.id,
        employee_name: employee.full_name,
        proposed_schedule: schedule,
        reason,
        status: "pending",
      },
    });
    setSaving(false);
    setReason("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cambiar horario de {employee.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          <Textarea placeholder="Motivo del cambio" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button className="w-full bg-primary hover:bg-primary/90" disabled={saving} onClick={handleSubmit}>
            {saving ? "Enviando..." : "Enviar solicitud de aprobación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}