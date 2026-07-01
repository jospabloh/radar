import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";

export default function EmployeeProfile() {
  const [employee, setEmployee] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadDocs = useCallback(async (empId) => {
    const list = await base44.entities.EmployeeDocument.filter({ employee_id: empId }, "-created_date");
    setDocs(list);
  }, []);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const emps = await base44.entities.Employee.filter({ user_id: u.id });
      const emp = emps[0];
      setEmployee(emp);
      if (emp) loadDocs(emp.id);
    });
  }, [loadDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.EmployeeDocument.create({
      employee_id: employee.id,
      company_id: employee.company_id,
      name: file.name,
      file_url,
    });
    setUploading(false);
    loadDocs(employee.id);
    e.target.value = "";
  };

  if (!employee) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Cargando...</div>;
  }

  const ROLE_LABEL = { company_admin: "Administrador", store_manager: "Gerente de tienda", employee: "Empleado" };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="Perfil de Empleado" subtitle="Tus datos personales y expediente laboral" backTo="/portal" />
      <div className="max-w-2xl mx-auto px-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <p className="font-semibold text-slate-900 mb-4">Datos personales</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-slate-400">Nombre</p><p className="text-slate-900">{employee.full_name}</p></div>
            <div><p className="text-slate-400">Correo</p><p className="text-slate-900">{employee.email}</p></div>
            <div><p className="text-slate-400">Puesto</p><p className="text-slate-900">{ROLE_LABEL[employee.role]}</p></div>
            <div><p className="text-slate-400">Estatus</p><p className="text-slate-900 capitalize">{employee.status}</p></div>
            <div><p className="text-slate-400">Fecha de contratación</p><p className="text-slate-900">{employee.hire_date || "—"}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-slate-900">Documentos</p>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />{uploading ? "Subiendo..." : "Subir documento"}</span>
              </Button>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          <div className="space-y-2">
            {docs.map((d) => (
              <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-700 hover:text-green-700">
                <FileText className="w-4 h-4" /> {d.name}
              </a>
            ))}
            {docs.length === 0 && <p className="text-sm text-slate-400">Sin documentos cargados</p>}
          </div>
        </div>
      </div>
    </div>
  );
}