import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function getPartsInTz(timezone) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'long',
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = `${get('hour')}:${get('minute')}`;
  const weekday = get('weekday').toLowerCase();
  return { date, time, weekday };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const companies = await base44.asServiceRole.entities.Company.filter({ status: 'active' });
    let absentCreated = 0;
    let autoLogouts = 0;

    for (const company of companies) {
      const timezone = company.timezone || 'America/Mexico_City';
      const { date, time, weekday } = getPartsInTz(timezone);
      const nowMinutes = toMinutes(time);

      const employees = await base44.asServiceRole.entities.Employee.filter({ company_id: company.id, status: 'active' });

      for (const employee of employees) {
        const daySchedule = employee.schedule?.[weekday];
        if (!daySchedule || !daySchedule.works || !daySchedule.start || !daySchedule.end) continue;

        const existing = await base44.asServiceRole.entities.AttendanceRecord.filter({ employee_id: employee.id, date });
        const record = existing[0];

        if (!record) {
          if (nowMinutes > toMinutes(daySchedule.start) + 30) {
            await base44.asServiceRole.entities.AttendanceRecord.create({
              employee_id: employee.id,
              company_id: company.id,
              date,
              status: 'absent',
              notes: 'Marcado automáticamente por falta de check-in',
            });
            absentCreated++;
          }
          continue;
        }

        if (record.check_in_time && !record.check_out_time) {
          if (nowMinutes > toMinutes(daySchedule.end) + 60) {
            const checkInMin = toMinutes(record.check_in_time);
            const endMin = toMinutes(daySchedule.end);
            const hours = Math.max(0, (endMin - checkInMin) / 60);
            await base44.asServiceRole.entities.AttendanceRecord.update(record.id, {
              check_out_time: daySchedule.end,
              status: 'auto_logout',
              hours_worked: Number(hours.toFixed(2)),
              notes: 'Salida automática por falta de check-out',
            });
            autoLogouts++;
          }
        }
      }
    }

    return Response.json({ success: true, absentCreated, autoLogouts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});