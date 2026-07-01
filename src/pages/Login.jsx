import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { getRememberedIdentity, clearRememberedIdentity, rememberIdentity } from "@/lib/lastIdentity";

export default function Login() {
  const [remembered, setRemembered] = useState(() => getRememberedIdentity());
  const [email, setEmail] = useState(remembered?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const useOtherAccount = () => {
    clearRememberedIdentity();
    setRemembered(null);
    setEmail("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      try {
        const me = await base44.auth.me();
        rememberIdentity(me);
      } catch { /* greeting is best-effort */ }
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      subtitle="Ingresa a tu cuenta para continuar"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Crea una
          </Link>
        </>
      }
    >
      {/* ── One-tap returning-user card ── */}
      {remembered && (remembered.name || remembered.email) ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3.5">
            {remembered.avatar ? (
              <img src={remembered.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                {(remembered.name || remembered.email).trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {remembered.name || remembered.email}
              </p>
              {remembered.name && remembered.email && (
                <p className="truncate text-xs text-muted-foreground">{remembered.email}</p>
              )}
            </div>
            <GoogleIcon className="h-5 w-5 shrink-0" />
          </div>
          <div className="border-t border-border px-4 py-3">
            <Button className="w-full h-12 font-medium" onClick={handleGoogle}>
              Continuar como {remembered.name ? remembered.name.split(" ")[0] : remembered.email}
            </Button>
            <button
              type="button"
              onClick={useOtherAccount}
              className="mt-3 block w-full text-center text-xs font-medium text-primary hover:underline"
            >
              Usar otra cuenta
            </button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
          <GoogleIcon className="w-5 h-5 mr-2" />
          Iniciar sesión con Google
        </Button>
      )}

      {/* ── Divider ── */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground">o</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* ── Email + password form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Ingresando...
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
