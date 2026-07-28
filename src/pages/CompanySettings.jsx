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
    </div>
  );
}