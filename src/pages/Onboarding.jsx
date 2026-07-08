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

      // app_role/company_id are privileged fields (locked to admin-only writes
      // via field-level RLS on the User entity) — the server-side function
      // validates the caller's email against Employee/Company before assigning
      // them, instead of the client setting them on itself via updateMe.
      try {
        const res = await base44.functions.invoke("completeOnboarding", {});
        const data = res?.data;
        if (data?.error === "not_found") {
          setStatus("not_found");
          return;
        }
        if (data?.founder) {
          window.location.href = "/companies";
          return;
        }
        window.location.href = "/";
      } catch (err) {
        console.error("Error completing onboarding:", err);
        setStatus("not_found");
      }
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