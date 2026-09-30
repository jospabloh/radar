import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingOutcome, SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from "@/lib/onboardingState";

export default function Onboarding() {
  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const run = async () => {
      setStatus("checking");
      let user;
      try {
        user = await base44.auth.me();
      } catch {
        setStatus("error");
        return;
      }
      setEmail(user?.email || "");
      if (user.app_role) {
        window.location.href = "/";
        return;
      }

      // app_role/company_id are privileged fields (locked to admin-only writes
      // via field-level RLS on the User entity) — the server-side function
      // validates the caller's email against Employee/Company before assigning
      // them, instead of the client setting them on itself via updateMe.
      let res;
      let failure;
      try {
        res = await base44.functions.invoke("completeOnboarding", {});
      } catch (err) {
        failure = err;
        console.error("Error completing onboarding:", err);
      }
      const outcome = onboardingOutcome({ res, err: failure });
      if (outcome === "founder") {
        window.location.href = "/companies";
      } else if (outcome === "done") {
        window.location.href = "/";
      } else {
        setStatus(outcome);
      }
    };
    run();
  }, [attempt]);

  const logout = () => base44.auth.logout("/login");

  if (status === "not_associated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center bg-card rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">Tu cuenta aún no está asociada a una empresa</h1>
          <p className="text-muted-foreground mb-4">
            Pide a tu administrador que te dé de alta con este correo
            {email ? <> (<strong className="text-foreground">{email}</strong>)</> : null}. En cuanto lo haga, vuelve a entrar y tendrás acceso.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            ¿Necesitas ayuda? Escríbenos a{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">{SUPPORT_EMAIL}</a>{" "}
            o por{" "}
            <a href={SUPPORT_WHATSAPP_URL} className="text-primary hover:underline" target="_blank" rel="noreferrer">WhatsApp</a>.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>Ya me dieron de alta, reintentar</Button>
            <Button variant="outline" onClick={logout}>Cerrar sesión / usar otro correo</Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center bg-card rounded-2xl shadow-sm border border-border p-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">No pudimos revisar tu cuenta</h1>
          <p className="text-muted-foreground mb-6">Hubo un problema de conexión. Inténtalo de nuevo en un momento.</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>Reintentar</Button>
            <Button variant="outline" onClick={logout}>Cerrar sesión</Button>
          </div>
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