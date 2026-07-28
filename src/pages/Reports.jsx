import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Reports() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [ptos, setPtos] = useState([]);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const load = useCallback(async (cid) => {
    const emps = await base44.entities.Employee.filter({ company_id: cid });
    const recs = await base44.entities.AttendanceRecord.filter({ company_id: cid });
    const p = await base44.entities.PTORequest.filter({ company_id: cid, status: "approved" });
    setEmployees(emps);
    setRecords(recs);
    setPtos(p);
  }, []);

  useEffect(() => {
    if (companyId) load(companyId);
  }, [companyId, load]);

  const inRange = records.filter((r) => r.date >= startDate && r.date <= endDate);

  const rows = employees.map((emp) => {
    const empRecords = inRange.filter((r) => r.employee_id === emp.id);
    const totalHours = empRecords.reduce((sum, r) => sum + (r.hours_worked || 0), 0);
    const daysPresent = empRecords.filter((r) => r.check_in_time).length;
    const late = empRecords.filter((r) => r.status === "late").length;
    const absent = empRecords.filter((r) => r.status === "absent").length;
    const ptoCount = ptos.filter((p) => p.employee_id === emp.id && p.start_date <= endDate && p.end_date >= startDate).length;
    return { emp, totalHours, daysPresent, late, absent, ptoCount };
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Reportes</h1>
      <div className="flex gap-4 mb-6">
        <div><Label>Desde</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background text-muted-foreground text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-3">Empleado</th>
              <th className="text-right px-5 py-3">Horas</th>
              <th className="text-right px-5 py-3">Días presentes</th>
              <th className="text-right px-5 py-3">Tardanzas</th>
              <th className="text-right px-5 py-3">Ausencias</th>
              <th className="text-right px-5 py-3">PTOs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.emp.id}>
                <td className="px-5 py-3 font-medium text-foreground">{r.emp.full_name}</td>
                <td className="px-5 py-3 text-right">{r.totalHours.toFixed(1)}</td>
                <td className="px-5 py-3 text-right">{r.daysPresent}</td>
                <td className="px-5 py-3 text-right text-warning">{r.late}</td>
                <td className="px-5 py-3 text-right text-destructive">{r.absent}</td>
                <td className="px-5 py-3 text-right text-accent-foreground">{r.ptoCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">Sin datos en este rango</p>}
      </div>
    </div>
  );
}