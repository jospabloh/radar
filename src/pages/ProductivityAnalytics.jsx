import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ProductivityAnalytics() {
  const [punctualityData, setPunctualityData] = useState([]);
  const [overtimeData, setOvertimeData] = useState([]);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const [records, employees] = await Promise.all([
        base44.entities.AttendanceRecord.filter({ company_id: u.company_id }, "-date", 500),
        base44.entities.Employee.filter({ company_id: u.company_id }),
      ]);
      const nameById = Object.fromEntries(employees.map((e) => [e.id, e.full_name]));

      const byEmployee = {};
      records.forEach((r) => {
        const name = nameById[r.employee_id] || "Desconocido";
        if (!byEmployee[name]) byEmployee[name] = { name, tarde: 0, ausente: 0, extra: 0 };
        if (r.status === "late") byEmployee[name].tarde += 1;
        if (r.status === "absent") byEmployee[name].ausente += 1;
        byEmployee[name].extra += r.extension_minutes || 0;
      });

      const rows = Object.values(byEmployee);
      setPunctualityData(rows);
      setOvertimeData(rows);
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Analítica de Productividad" subtitle="Puntualidad, horas extra y ausentismo del equipo" />
      <div className="max-w-4xl mx-auto px-6 space-y-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <p className="font-semibold text-slate-900 mb-4">Tardanzas y ausencias por empleado</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={punctualityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="tarde" fill="#eab308" name="Tardanzas" />
              <Bar dataKey="ausente" fill="#ef4444" name="Ausencias" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <p className="font-semibold text-slate-900 mb-4">Minutos de extensión acumulados</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={overtimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="extra" fill="#16a34a" name="Minutos extra" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {punctualityData.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Sin datos suficientes aún</p>}
      </div>
    </div>
  );
}