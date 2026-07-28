export const WEEKDAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

export function defaultSchedule() {
  const s = {};
  WEEKDAYS.forEach((d) => {
    s[d.key] = { works: !["saturday", "sunday"].includes(d.key), start: "09:00", end: "18:00" };
  });
  return s;
}

export function getTodayKey() {
  const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[new Date().getDay()];
}

export function getTodaysSchedule(employee) {
  if (!employee?.schedule) return null;
  return employee.schedule[getTodayKey()] || null;
}

// Shared with CompanyDashboard.jsx (full set) and IncidentPanel.jsx
// (absent/late subset) — both were independently declaring the same
// attendance-status labels/colors; kept alongside computeStatus since
// they describe the values it returns.
export const ATTENDANCE_STATUS_STYLE = {
  on_time: "bg-success/10 text-success",
  late: "bg-warning/10 text-warning",
  late_pending: "bg-warning/10 text-warning",
  absent: "bg-destructive/10 text-destructive",
  extension: "bg-primary/10 text-primary",
  auto_logout: "bg-muted text-muted-foreground",
  no_laboral: "bg-muted text-muted-foreground",
  not_started: "bg-muted text-muted-foreground",
};

export const ATTENDANCE_STATUS_LABEL = {
  on_time: "A tiempo",
  late: "Tarde",
  late_pending: "Tarde",
  absent: "Ausente",
  extension: "Extensión",
  auto_logout: "Auto-logout",
  no_laboral: "No labora hoy",
  not_started: "Sin registrar",
};

export function computeStatus(employee, record) {
  const todaySchedule = getTodaysSchedule(employee);
  if (!todaySchedule || !todaySchedule.works) return "no_laboral";
  if (record?.check_in_time) return record.status || "on_time";

  const now = new Date();
  const [h, m] = todaySchedule.start.split(":").map(Number);
  const scheduledStart = new Date();
  scheduledStart.setHours(h, m, 0, 0);
  const minutesLate = (now - scheduledStart) / 60000;

  if (minutesLate >= 120) return "absent";
  if (minutesLate >= 0) return "late_pending";
  return "not_started";
}