import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";
import EmployeeFormDialog from "@/components/employees/EmployeeFormDialog";
import ScheduleChangeDialog from "@/components/employees/ScheduleChangeDialog";

const ROLE_LABEL = { employee: "Empleado", store_manager: "Store Manager", company_admin: "Admin" };

export default function Employees() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);

  const load = async (companyId) => {
    const list = await base44.entities.Employee.filter({ company_id: companyId }, "-created_date");
    setEmployees(list);
  };

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      load(u.company_id);
    });
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Empleados</h1>
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />Nuevo empleado
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-slate-900">{emp.full_name}</p>
              <p className="text-sm text-slate-500">{emp.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{ROLE_LABEL[emp.role]}</Badge>
              <Button variant="outline" size="sm" onClick={() => setScheduleTarget(emp)}>
                <Clock className="w-4 h-4 mr-1" />Horario
              </Button>
            </div>
          </div>
        ))}
        {employees.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">Aún no hay empleados</p>}
      </div>

      {user && (
        <EmployeeFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          companyId={user.company_id}
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