import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Users, CheckCircle2, Clock, XCircle, PlaneTakeoff, Hourglass } from "lucide-react";
import { computeStatus, ATTENDANCE_STATUS_STYLE, ATTENDANCE_STATUS_LABEL } from "@/lib/schedule";

export default function CompanyDashboard() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [ptoToday, setPtoToday] = useState(0);
  const [extPending, setExtPending] = useState(0);

  const loadAll = useCallback(async (cid) => {
    const today = new Date().toISOString().split("T")[0];
    const emps = await base44.entities.Employee.filter({ company_id: cid, status: "active" });
    const recs = await base44.entities.AttendanceRecord.filter({ company_id: cid, date: today });
    const ptos = await base44.entities.PTORequest.filter({ company_id: cid, status: "approved" });
    const exts = await base44.entities.ExtensionRequest.filter({ company_id: cid, status: "pending" });
    setEmployees(emps);
    setRecords(recs);
    setPtoToday(ptos.filter((p) => p.start_date <= today && p.end_date >= today).length);
    setExtPending(exts.length);
  }, []);

  useEffect(() => {
    if (companyId) loadAll(companyId);
  }, [companyId, loadAll]);

  useEffect(() => {
    if (!companyId) return;
    const unsubscribe = base44.entities.AttendanceRecord.subscribe(() => loadAll(companyId));
    return unsubscribe;
  }, [companyId, loadAll]);

  const recordFor = (empId) => records.find((r) => r.employee_id === empId);
  const rows = employees.map((emp) => {
    const record = recordFor(emp.id);
    const status = record?.check_out_time ? record.status || "on_time" : computeStatus(emp, record);
    return { emp, record, status };
  });

  const presentes = rows.filter((r) => r.record?.check_in_time && !r.record?.check_out_time).length;
  const tardanzas = rows.filter((r) => ["late", "late_pending"].includes(r.status)).length;
  const ausentes = rows.filter((r) => r.status === "absent").length;

  const cards = [
    { label: "Total empleados", value: employees.length, icon: Users, color: "text-muted-foreground" },
    { label: "Presentes ahora", value: presentes, icon: CheckCircle2, color: "text-success" },
    { label: "Tardanzas hoy", value: tardanzas, icon: Clock, color: "text-warning" },
    { label: "Ausentes", value: ausentes, icon: XCircle, color: "text-destructive" },
    { label: "PTOs hoy", value: ptoToday, icon: PlaneTakeoff, color: "text-accent-foreground" },
    { label: "Extensiones pendientes", value: extPending, icon: Hourglass, color: "text-primary" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-2xl border border-border p-4">
            <c.icon className={`w-5 h-5 mb-2 ${c.color}`} />
            <p className="text-2xl font-semibold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {rows.map(({ emp, record, status }) => (
          <div key={emp.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-foreground">{emp.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {record?.check_in_time ? `Entrada ${record.check_in_time}` : "Sin entrada"}
                {record?.check_out_time ? ` · Salida ${record.check_out_time}` : ""}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ATTENDANCE_STATUS_STYLE[status]}`}>{ATTENDANCE_STATUS_LABEL[status]}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">No hay empleados activos</p>}
      </div>
    </div>
  );
}