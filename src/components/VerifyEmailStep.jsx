import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import { otpErrorMessage, resendErrorMessage } from "@/lib/emailVerification";

// Code screen shared by Register (right after signing up) and Login (an
// unverified account trying to sign in). After a good code it signs the person
// in; if that last step fails the code is still valid, so the caller is told
// `needsLogin` and sends them to /login instead of leaving them stuck.
export default function VerifyEmailStep({ email, password, onVerified, onCancel }) {
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      let result;
      try {
        result = await base44.auth.verifyOtp({ email, otpCode });
      } catch (err) {
        setError(otpErrorMessage(err));
        return;
      }
      try {
        if (result?.access_token) {
          base44.auth.setToken(result.access_token);
        } else if (password) {
          await base44.auth.loginViaEmailPassword(email, password);
        } else {
          onVerified({ needsLogin: true });
          return;
        }
        toast({ title: "Correo verificado" });
        onVerified({ needsLogin: false });
      } catch {
        toast({ title: "Correo verificado", description: "Inicia sesión para continuar." });
        onVerified({ needsLogin: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Código enviado", description: "Revisa tu correo para ver el nuevo código." });
    } catch (err) {
      setError(resendErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Verifica tu correo" subtitle={`Enviamos un código a ${email}`}>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}
      <div className="flex justify-center mb-6">
        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          "Verificar"
        )}
      </Button>
      <div className="flex justify-between text-sm mt-4">
        <button type="button" onClick={handleResend} disabled={resending} className="text-primary font-medium hover:underline">
          {resending ? "Enviando..." : "Reenviar código"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            Usar otro correo
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
