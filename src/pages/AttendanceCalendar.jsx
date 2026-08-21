import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths, getDay } from "date-fns";
import { es } from "date-fns/locale";

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function AttendanceCalendar() {
  const { user } = useAuth();
  const isAdmin = user ? [ROLES.COMPANY_ADMIN, ROLES.STORE_MANAGER].includes(user.app_role) : false;
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [month, setMonth] = useState(new Date());
  const [ptos, setPtos] = useState([]);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (isAdmin) {
        const emps = await base44.entities.Employee.filter({ company_id: user.company_id, status: "active" });
        setEmployees(emps);
        setEmployeeId(emps[0]?.id || null);
        setCompanyId(user.company_id);
      } else {
        const emps = await base44.entities.Employee.filter({ user_id: user.id });
        setEmployeeId(emps[0]?.id || null);
        setCompanyId(emps[0]?.company_id);
      }
    })();
  }, [user, isAdmin]);

  const loadEmployeeData = useCallback(async (empId, cid) => {
    if (!empId) return;
    const emp = await base44.entities.Employee.get(empId);
    setEmployee(emp);
    const [ptoList, holidayList] = await Promise.all([
      base44.entities.PTORequest.filter({ employee_id: empId, status: "approved" }),
      base44.entities.Holiday.filter({ company_id: cid }),
    ]);
    setPtos(ptoList);
    setHolidays(holidayList);
  }, []);

  useEffect(() => {
    if (employeeId) loadEmployeeData(employeeId, companyId);
  }, [employeeId, companyId, loadEmployeeData]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks = getDay(startOfMonth(month));

  const dayInfo = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const holiday = holidays.find((h) => h.date === dateStr);
    if (holiday) return { label: holiday.name, color: "bg-primary/10 text-primary" };
    const pto = ptos.find((p) => p.start_date <= dateStr && p.end_date >= dateStr);
    if (pto) return { label: "Vacaciones/Permiso", color: "bg-accent text-accent-foreground" };
    const weekday = WEEKDAY_KEYS[getDay(date)];
    const works = employee?.schedule?.[weekday]?.works;
    return works ? { label: employee.schedule[weekday].start, color: "bg-success/10 text-success" } : { label: "Descanso", color: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Calendario de Asistencias" subtitle="Turnos, días festivos y vacaciones del mes" backTo={isAdmin ? "/dashboard" : "/portal"} />
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          {isAdmin && (
            <Select value={employeeId || ""} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <p className="font-medium text-foreground w-36 text-center capitalize">{format(month, "MMMM yyyy", { locale: es })}</p>
            <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>

        {employee && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <p key={i} className="text-center text-xs font-medium text-muted-foreground">{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
              {days.map((date) => {
                const info = dayInfo(date);
                return (
                  <div key={date.toISOString()} className={`rounded-lg p-2 text-center ${info.color}`}>
                    <p className="text-sm font-medium">{format(date, "d")}</p>
                    <p className="text-[10px] truncate">{info.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}