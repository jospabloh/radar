import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function Onboarding() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const run = async () => {
      const user = await base44.auth.me();
      if (user.app_role) {
        window.location.href = "/";
        return;
      }

      const matches = await base44.entities.Employee.filter({ email: user.email });
      if (matches.length > 0) {
        const emp = matches[0];
        await base44.entities.Employee.update(emp.id, { user_id: user.id });
        await base44.auth.updateMe({ app_role: emp.role, company_id: emp.company_id });
        window.location.href = "/";
        return;
      }

      const companies = await base44.entities.Company.list();
      if (companies.length === 0) {
        await base44.auth.updateMe({ app_role: "super_admin" });
        window.location.href = "/companies";
        return;
      }

      setStatus("not_found");
    };
    run();
  }, []);

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center bg-card rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">No encontramos tu cuenta</h1>
          <p className="text-muted-foreground">Contacta a tu administrador para que te dé acceso a AsistApp.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}