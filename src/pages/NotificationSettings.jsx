import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";

export default function NotificationSettings() {
  const [pref, setPref] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const existing = await base44.entities.NotificationPreference.filter({ user_id: u.id });
      if (existing[0]) {
        setPref(existing[0]);
      } else {
        const created = await base44.entities.NotificationPreference.create({ user_id: u.id, company_id: u.company_id });
        setPref(created);
      }
    });
  }, []);

  const handleToggle = async (field, value) => {
    const updated = await base44.entities.NotificationPreference.update(pref.id, { [field]: value });
    setPref(updated);
  };

  if (!pref) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Configuración de Notificaciones" subtitle="Elige cómo quieres recibir tus alertas" />
      <div className="max-w-md mx-auto px-6 bg-card rounded-2xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-foreground">Correo electrónico</p>
            <p className="text-xs text-muted-foreground">Recibe avisos en tu email</p>
          </div>
          <Switch checked={!!pref.email_enabled} onCheckedChange={(v) => handleToggle("email_enabled", v)} />
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-foreground">WhatsApp</p>
            <p className="text-xs text-muted-foreground">Recibe avisos por WhatsApp</p>
          </div>
          <Switch checked={!!pref.whatsapp_enabled} onCheckedChange={(v) => handleToggle("whatsapp_enabled", v)} />
        </div>
      </div>
    </div>
  );
}