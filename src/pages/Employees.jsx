import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import ScheduleChangeDialog from "@/components/employees/ScheduleChangeDialog";
import { ROLE_LABELS } from "@/lib/rbac";

// Labels come from the single role declaration (src/lib/rbac.js) — this file
// used to carry its own copy, which had already drifted ("Store Manager" vs
// "Gerente de tienda" in EmployeeProfile.jsx).
const ROLE_LABEL = ROLE_LABELS;

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);

  const load = async (companyId) => {
    const list = await base44.entities.Employee.filter({ company_id: companyId }, "-created_date");
    setEmployees(list);
  };

  useEffect(() => {
    if (user) load(user.company_id);
  }, [user]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Empleados</h1>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />Nuevo empleado
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {employees.map((emp) => (
          <div key={emp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4">
            <div className="min-w-[12rem] flex-1">
              <p className="font-medium text-foreground">{emp.full_name}</p>
              <p className="text-sm text-muted-foreground break-all">{emp.email}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="secondary">{ROLE_LABEL[emp.role]}</Badge>
              <Button variant="outline" size="sm" onClick={() => setScheduleTarget(emp)}>
                <Clock className="w-4 h-4 mr-1" />Horario
              </Button>
            </div>
          </div>
        ))}
        {employees.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Aún no hay empleados</p>}
      </div>

      {user && (
        <EmployeeFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onCreated={() => load(user.company_id)}
        />
      )}
      <ScheduleChangeDialog
        open={!!scheduleTarget}
        onOpenChange={(v) => !v && setScheduleTarget(null)}
        employee={scheduleTarget}
        onCreated={() => setScheduleTarget(null)}
      />
    </div>
  );
}