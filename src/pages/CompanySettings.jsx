import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Download, AlertTriangle } from "lucide-react";

const MANAGER_ROLES = new Set(["company_admin", "store_manager", "super_admin"]);

const TIMEZONES = [
  "America/Mexico_City",
  "America/Tijuana",
  "America/Hermosillo",
  "America/Cancun",
  "America/Chihuahua",
];

export default function CompanySettings() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.company_id) base44.entities.Company.get(user.company_id).then(setCompany);
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await base44.entities.Company.update(company.id, {
        name: company.name,
        timezone: company.timezone,
        whatsapp_enabled: company.whatsapp_enabled,
      });
      setSaved(true);
    } catch (error) {
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Data export — module 7 (cuenta y zona de peligro).
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const resp = await base44.functions.invoke("exportCompanyData", {});
      if (!resp?.data?.success) {
        toast({ title: "No se pudo exportar", description: resp?.data?.error || "Intenta de nuevo", variant: "destructive" });
        return;
      }
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `radar-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Datos exportados" });
    } catch (error) {
      toast({ title: "Error al exportar", description: error.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Solicitar eliminación de la empresa — no es un borrado inmediato: Company.delete
  // en RLS requiere role:admin (dueño de la plataforma), así que la única vía real
  // es pedirlo a soporte, igual que el resto de los flujos de baja de tenant en el
  // portafolio pasan por un humano cuando la acción es irreversible y de alto impacto.
  const [requestingDelete, setRequestingDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const handleRequestDeletion = async () => {
    setRequestingDelete(true);
    try {
      const ticket = await base44.entities.SupportTicket.create({
        company_id: company.id,
        employee_name: user.full_name,
        created_by_id: user.id,
        created_by_email: user.email,
        category: "account",
        priority: "high",
        subject: `Solicitud de eliminación de empresa: ${company.name}`,
        description: `${user.full_name} (${user.email}) solicitó eliminar permanentemente la empresa "${company.name}" (${company.id}). Verificar identidad y confirmar antes de proceder — esta acción es irreversible.`,
      });
      base44.functions.invoke("notifyTicketCreated", { ticketId: ticket.id }).catch(() => {});
      setDeleteRequested(true);
      setConfirmDelete(false);
    } catch (error) {
      toast({ title: "No se pudo enviar la solicitud", description: error.message, variant: "destructive" });
    } finally {
      setRequestingDelete(false);
    }
  };

  if (!company) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Configuración de Empresa" subtitle="Actualiza los datos generales de tu organización" />
      <div className="max-w-md mx-auto px-6 bg-card rounded-2xl border border-border p-6 space-y-5">
        <div>
          <Label>Nombre de la empresa</Label>
          <Input
            value={company.name || ""}
            onChange={(e) => setCompany({ ...company, name: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Zona horaria</Label>
          <Select value={company.timezone} onValueChange={(v) => setCompany({ ...company, timezone: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona zona horaria" /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <Label>Notificaciones por WhatsApp</Label>
            <p className="text-xs text-muted-foreground">Integra tu cuenta para recibir avisos</p>
          </div>
          <Switch
            checked={!!company.whatsapp_enabled}
            onCheckedChange={(v) => setCompany({ ...company, whatsapp_enabled: v })}
          />
        </div>
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saved && <p className="text-sm text-success text-center">Cambios guardados</p>}
      </div>

      {MANAGER_ROLES.has(user?.app_role) && (
        <div className="max-w-md mx-auto px-6 mt-6 bg-card rounded-2xl border border-border p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Download className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Descargar mis datos</p>
              <p className="text-xs text-muted-foreground">Exporta empleados, asistencias, solicitudes y turnos de tu empresa en formato JSON.</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exportando..." : "Descargar datos"}
          </Button>
        </div>
      )}

      {MANAGER_ROLES.has(user?.app_role) && (
        <div className="max-w-md mx-auto px-6 mt-6 mb-6 bg-destructive/5 rounded-2xl border border-destructive/40 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Zona de peligro</p>
              <p className="text-xs text-muted-foreground">
                Eliminar la empresa es permanente. Enviamos tu solicitud a soporte para verificar tu identidad antes de proceder — no es un borrado instantáneo.
              </p>
            </div>
          </div>
          {deleteRequested ? (
            <p className="text-sm text-success">Solicitud enviada. Soporte te contactará para confirmar.</p>
          ) : !confirmDelete ? (
            <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
              Solicitar eliminación de la empresa
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">¿Seguro? Esto inicia el proceso de eliminación permanente.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={requestingDelete}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleRequestDeletion} disabled={requestingDelete}>
                  {requestingDelete ? "Enviando..." : "Sí, solicitar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}