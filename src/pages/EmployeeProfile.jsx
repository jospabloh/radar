import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { FileText, Upload } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";

export default function EmployeeProfile() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [openingDocId, setOpeningDocId] = useState(null);

  const loadDocs = useCallback(async (empId) => {
    const list = await base44.entities.EmployeeDocument.filter({ employee_id: empId }, "-created_date");
    setDocs(list);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const emps = await base44.entities.Employee.filter({ user_id: user.id });
      const emp = emps[0];
      setEmployee(emp);
      if (emp) loadDocs(emp.id);
    })();
  }, [user, loadDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Private storage, not UploadFile: these are HR documents (IDs,
      // contracts) — UploadFile's public URL would be reachable by anyone
      // who ever saw it (browser history, a shared screen, a forwarded
      // link), regardless of the EmployeeDocument row's own RLS. The stored
      // file_uri isn't a fetchable link on its own; handleOpen resolves a
      // short-lived signed URL from it on demand.
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.EmployeeDocument.create({
        employee_id: employee.id,
        company_id: employee.company_id,
        name: file.name,
        file_uri,
      });
      loadDocs(employee.id);
    } catch (error) {
      toast({ title: "No se pudo subir el documento", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleOpen = async (doc) => {
    setOpeningDocId(doc.id);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: doc.file_uri });
      window.open(signed_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({ title: "No se pudo abrir el documento", description: error.message, variant: "destructive" });
    } finally {
      setOpeningDocId(null);
    }
  };

  if (!employee) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  const ROLE_LABEL = ROLE_LABELS;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Perfil de Empleado" subtitle="Tus datos personales y expediente laboral" backTo="/portal" />
      <div className="max-w-2xl mx-auto px-6 space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="font-semibold text-foreground mb-4">Datos personales</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Nombre</p><p className="text-foreground">{employee.full_name}</p></div>
            <div><p className="text-muted-foreground">Correo</p><p className="text-foreground">{employee.email}</p></div>
            <div><p className="text-muted-foreground">Puesto</p><p className="text-foreground">{ROLE_LABEL[employee.role]}</p></div>
            <div><p className="text-muted-foreground">Estatus</p><p className="text-foreground capitalize">{employee.status}</p></div>
            <div><p className="text-muted-foreground">Fecha de contratación</p><p className="text-foreground">{employee.hire_date || "—"}</p></div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-foreground">Documentos</p>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />{uploading ? "Subiendo..." : "Subir documento"}</span>
              </Button>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          <div className="space-y-2">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleOpen(d)}
                disabled={openingDocId === d.id}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary disabled:opacity-60"
              >
                <FileText className="w-4 h-4" /> {openingDocId === d.id ? "Abriendo..." : d.name}
              </button>
            ))}
            {docs.length === 0 && <p className="text-sm text-muted-foreground">Sin documentos cargados</p>}
          </div>
        </div>
      </div>
    </div>
  );
}