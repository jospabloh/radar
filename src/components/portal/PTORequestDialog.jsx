import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

export default function PTORequestDialog({ open, onOpenChange, employee }) {
  const [type, setType] = useState("vacaciones");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await base44.entities.PTORequest.create({
        employee_id: employee.id,
        company_id: employee.company_id,
        employee_name: employee.full_name,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: "pending",
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        onOpenChange(false);
        setStartDate("");
        setEndDate("");
        setReason("");
      }, 1200);
    } catch (error) {
      toast({ title: "No se pudo enviar la solicitud", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar PTO / Ausencia</DialogTitle></DialogHeader>
        {sent ? (
          <p className="text-success font-medium py-6 text-center">Solicitud enviada a tu manager.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacaciones">Vacaciones</SelectItem>
                  <SelectItem value="permiso_personal">Permiso personal</SelectItem>
                  <SelectItem value="incapacidad">Incapacidad</SelectItem>
                  <SelectItem value="dia_festivo">Día festivo trabajado</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1"><Label>Desde</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="flex-1"><Label>Hasta</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div><Label>Motivo</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <Button className="w-full bg-primary hover:bg-primary/90" disabled={saving || !startDate || !endDate} onClick={submit}>
              {saving ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}