import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  const target = !user
    ? null
    : !user.app_role
    ? "/onboarding"
    : user.app_role === "super_admin"
    ? "/companies"
    : user.app_role === "employee"
    ? "/portal"
    : "/dashboard";

  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={target} replace />;
}