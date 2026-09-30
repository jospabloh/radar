import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScheduleEditor from "@/components/schedule/ScheduleEditor";
import { toast } from "@/components/ui/use-toast";
import { defaultSchedule } from "@/lib/schedule";
import { ROLES, ROLE_LABELS } from "@/lib/rbac";

export default function EmployeeFormDialog({ open, onOpenChange, onCreated }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(ROLES.EMPLOYEE);
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("createEmployee", {
        email,
        full_name: fullName,
        role,
        schedule,
      });
      setEmail("");
      setFullName("");
      setRole(ROLES.EMPLOYEE);
      setSchedule(defaultSchedule());
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast({ title: "No se pudo crear el empleado", description: error?.response?.data?.message || error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo empleado</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nombre completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLES.EMPLOYEE}>{ROLE_LABELS[ROLES.EMPLOYEE]}</SelectItem>
                <SelectItem value={ROLES.STORE_MANAGER}>{ROLE_LABELS[ROLES.STORE_MANAGER]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Horario</Label>
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          </div>
          <Button className="w-full bg-primary hover:bg-primary/90" disabled={saving || !email || !fullName} onClick={handleSubmit}>
            {saving ? "Guardando..." : "Crear empleado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}