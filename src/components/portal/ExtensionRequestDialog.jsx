import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ExtensionRequestDialog({ open, onOpenChange, employee, record }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSaving(true);
    await base44.entities.ExtensionRequest.create({
      employee_id: employee.id,
      company_id: employee.company_id,
      employee_name: employee.full_name,
      attendance_record_id: record.id,
      date: record.date,
      requested_minutes: 30,
      reason,
      status: "pending",
    });
    setSaving(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onOpenChange(false);
      setReason("");
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Extender jornada 30 min</DialogTitle></DialogHeader>
        {sent ? (
          <p className="text-success font-medium py-6 text-center">Solicitud enviada a tu manager.</p>
        ) : (
          <div className="space-y-4">
            <Textarea placeholder="Motivo de la extensión" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button className="w-full bg-primary hover:bg-primary/90" disabled={saving || !reason} onClick={submit}>
              {saving ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}