import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Users, CheckCircle2, Clock, XCircle, PlaneTakeoff, Hourglass } from "lucide-react";
import { computeStatus } from "@/lib/schedule";

const STATUS_STYLE = {
  on_time: "bg-green-100 text-green-700",
  late: "bg-yellow-100 text-yellow-700",
  late_pending: "bg-yellow-100 text-yellow-700",
  absent: "bg-red-100 text-red-700",
  extension: "bg-blue-100 text-blue-700",
  auto_logout: "bg-slate-200 text-slate-600",
  no_laboral: "bg-slate-100 text-slate-400",
  not_started: "bg-slate-100 text-slate-400",
};
const STATUS_LABEL = {
  on_time: "A tiempo", late: "Tarde", late_pending: "Tarde", absent: "Ausente",
  extension: "Extensión", auto_logout: "Auto-logout", no_laboral: "No labora hoy", not_started: "Sin registrar",
};

export default function CompanyDashboard() {
  const [companyId, setCompanyId] = useState(null);
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
    base44.auth.me().then((u) => {
      setCompanyId(u.company_id);
      loadAll(u.company_id);
    });
  }, [loadAll]);

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
    { label: "Total empleados", value: employees.length, icon: Users, color: "text-slate-700" },
    { label: "Presentes ahora", value: presentes, icon: CheckCircle2, color: "text-green-600" },
    { label: "Tardanzas hoy", value: tardanzas, icon: Clock, color: "text-yellow-600" },
    { label: "Ausentes", value: ausentes, icon: XCircle, color: "text-red-600" },
    { label: "PTOs hoy", value: ptoToday, icon: PlaneTakeoff, color: "text-purple-600" },
    { label: "Extensiones pendientes", value: extPending, icon: Hourglass, color: "text-blue-600" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4">
            <c.icon className={`w-5 h-5 mb-2 ${c.color}`} />
            <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
        {rows.map(({ emp, record, status }) => (
          <div key={emp.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-slate-900">{emp.full_name}</p>
              <p className="text-xs text-slate-500">
                {record?.check_in_time ? `Entrada ${record.check_in_time}` : "Sin entrada"}
                {record?.check_out_time ? ` · Salida ${record.check_out_time}` : ""}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">No hay empleados activos</p>}
      </div>
    </div>
  );
}