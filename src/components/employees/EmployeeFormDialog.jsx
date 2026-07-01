import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScheduleEditor from "@/components/schedule/ScheduleEditor";
import { defaultSchedule } from "@/lib/schedule";

export default function EmployeeFormDialog({ open, onOpenChange, companyId, onCreated }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("employee");
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await base44.users.inviteUser(email, "user");
    await base44.entities.Employee.create({
      email,
      full_name: fullName,
      role,
      schedule,
      company_id: companyId,
      hire_date: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    setEmail("");
    setFullName("");
    setRole("employee");
    setSchedule(defaultSchedule());
    onOpenChange(false);
    onCreated();
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
                <SelectItem value="employee">Empleado</SelectItem>
                <SelectItem value="store_manager">Store Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Horario</Label>
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          </div>
          <Button className="w-full bg-green-600 hover:bg-green-700" disabled={saving || !email || !fullName} onClick={handleSubmit}>
            {saving ? "Guardando..." : "Crear empleado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}