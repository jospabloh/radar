import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    base44.auth.me().then((user) => {
      if (!user.app_role) {
        setTarget("/onboarding");
      } else if (user.app_role === "super_admin") {
        setTarget("/companies");
      } else if (user.app_role === "employee") {
        setTarget("/portal");
      } else {
        setTarget("/dashboard");
      }
    });
  }, []);

  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return <Navigate to={target} replace />;
}