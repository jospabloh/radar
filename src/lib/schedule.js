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