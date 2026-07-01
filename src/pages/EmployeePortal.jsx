import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { getTodaysSchedule, WEEKDAYS, getTodayKey } from "@/lib/schedule";
import { LogOut, PlaneTakeoff, Timer } from "lucide-react";
import PTORequestDialog from "@/components/portal/PTORequestDialog";
import ExtensionRequestDialog from "@/components/portal/ExtensionRequestDialog";

export default function EmployeePortal() {
  const [employee, setEmployee] = useState(null);
  const [record, setRecord] = useState(null);
  const [now, setNow] = useState(new Date());
  const [showPto, setShowPto] = useState(false);
  const [showExt, setShowExt] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const load = async () => {
    const user = await base44.auth.me();
    const emps = await base44.entities.Employee.filter({ user_id: user.id });
    const emp = emps[0];
    setEmployee(emp);
    if (emp) {
      const recs = await base44.entities.AttendanceRecord.filter({ employee_id: emp.id, date: today });
      setRecord(recs[0] || null);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCheckIn = async () => {
    const time = now.toTimeString().slice(0, 5);
    const schedule = getTodaysSchedule(employee);
    const isLate = schedule && time > schedule.start;
    const newRecord = await base44.entities.AttendanceRecord.create({
      employee_id: employee.id,
      company_id: employee.company_id,
      date: today,
      check_in_time: time,
      status: isLate ? "late" : "on_time",
    });
    setRecord(newRecord);
  };

  const handleCheckOut = async () => {
    const time = now.toTimeString().slice(0, 5);
    const [inH, inM] = record.check_in_time.split(":").map(Number);
    const [outH, outM] = time.split(":").map(Number);
    const hours = Math.max(0, (outH * 60 + outM - (inH * 60 + inM)) / 60);
    const updated = await base44.entities.AttendanceRecord.update(record.id, { check_out_time: time, hours_worked: Number(hours.toFixed(2)) });
    setRecord(updated);
  };

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">Cargando...</p>
      </div>
    );
  }

  const todaySchedule = getTodaysSchedule(employee);
  const dayLabel = WEEKDAYS.find((d) => d.key === getTodayKey())?.label;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm flex justify-between items-center mb-8">
        <div>
          <p className="text-sm text-slate-500">Hola,</p>
          <p className="font-semibold text-slate-900">{employee.full_name}</p>
        </div>
        <button onClick={() => base44.auth.logout("/login")} className="text-slate-400">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <p className="text-5xl font-bold text-slate-900 tabular-nums mb-1">
        {now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-slate-500 mb-8">
        {dayLabel} · {todaySchedule?.works ? `${todaySchedule.start} - ${todaySchedule.end}` : "Sin horario hoy"}
      </p>

      {!record?.check_in_time ? (
        <button
          onClick={handleCheckIn}
          className="w-56 h-56 rounded-full bg-green-600 hover:bg-green-700 text-white text-xl font-semibold shadow-lg transition-transform active:scale-95"
        >
          Registrar Entrada
        </button>
      ) : !record?.check_out_time ? (
        <>
          <div className="text-center mb-6">
            <p className="text-sm text-green-600 font-medium">Entrada registrada {record.check_in_time}</p>
          </div>
          <button
            onClick={handleCheckOut}
            className="w-56 h-56 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xl font-semibold shadow-lg transition-transform active:scale-95"
          >
            Registrar Salida
          </button>
          <Button variant="outline" className="mt-6" onClick={() => setShowExt(true)}>
            <Timer className="w-4 h-4 mr-2" />Solicitar extensión 30 min
          </Button>
        </>
      ) : (
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Jornada completada</p>
          <p className="text-sm text-slate-500 mt-1">Entrada {record.check_in_time} · Salida {record.check_out_time}</p>
          <p className="text-sm text-slate-500">{record.hours_worked} horas trabajadas</p>
        </div>
      )}

      <Button variant="ghost" className="mt-10" onClick={() => setShowPto(true)}>
        <PlaneTakeoff className="w-4 h-4 mr-2" />Solicitar días/permiso (PTO)
      </Button>

      <PTORequestDialog open={showPto} onOpenChange={setShowPto} employee={employee} />
      <ExtensionRequestDialog open={showExt} onOpenChange={setShowExt} employee={employee} record={record} />
    </div>
  );
}