import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radar, LogOut, Menu } from "lucide-react";
import {
  Building2, LayoutDashboard, Users, CheckSquare, FileBarChart,
  Settings, LifeBuoy, BadgeDollarSign, BookOpen, History, BarChart3,
  CalendarClock, AlertTriangle, Calendar, Bell,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_BY_ROLE = {
  super_admin: [{ label: "Empresas", path: "/companies", icon: Building2 }],
  company_admin: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Empleados", path: "/employees", icon: Users },
    { label: "Aprobaciones", path: "/approvals", icon: CheckSquare },
    { label: "Reportes", path: "/reports", icon: FileBarChart },
    { label: "Analítica", path: "/analitica-productividad", icon: BarChart3 },
    { label: "Incidencias", path: "/panel-incidencias", icon: AlertTriangle },
    { label: "Calendario", path: "/calendario-asistencias", icon: Calendar },
    { label: "Horarios", path: "/configuracion-horarios", icon: CalendarClock },
    { label: "Empresa", path: "/configuracion-empresa", icon: Settings },
    { label: "Licencias", path: "/gestion-licencias", icon: BadgeDollarSign },
    { label: "Notificaciones", path: "/configuracion-notificaciones", icon: Bell },
    { label: "Manual", path: "/manual-usuario", icon: BookOpen },
    { label: "Soporte", path: "/soporte", icon: LifeBuoy },
    { label: "Historial", path: "/historial-cambios", icon: History },
  ],
  store_manager: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Aprobaciones", path: "/approvals", icon: CheckSquare },
    { label: "Incidencias", path: "/panel-incidencias", icon: AlertTriangle },
    { label: "Calendario", path: "/calendario-asistencias", icon: Calendar },
    { label: "Manual", path: "/manual-usuario", icon: BookOpen },
    { label: "Soporte", path: "/soporte", icon: LifeBuoy },
  ],
};

const ROLE_LABEL = {
  super_admin: "Super administrador",
  company_admin: "Administrador",
  store_manager: "Gerente de tienda",
};

function NavList({ items, currentPath, onNavigate }) {
  return (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const active = currentPath === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ companyName }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shrink-0">
        <Radar className="w-5 h-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h1 className="text-base font-bold tracking-tight text-foreground leading-tight">
          RADAR<span className="text-primary">.</span>
        </h1>
        <p className="text-xs text-muted-foreground truncate">{companyName || "Panel general"}</p>
      </div>
    </div>
  );
}

function UserFooter({ user }) {
  const name = user?.full_name || user?.email || "Usuario";
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div className="p-3 border-t border-border space-y-1">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[user?.app_role] || ""}</p>
        </div>
      </div>
      <ThemeToggle showLabel />
      <button
        onClick={() => base44.auth.logout("/login")}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  );
}

export default function AppLayout() {
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const employees = await base44.entities.Employee.filter({ user_id: u.id });
      const employee = employees[0];
      if (employee?.company_id) {
        const company = await base44.entities.Company.get(employee.company_id);
        setCompanyName(company?.name || null);
      }
    });
  }, []);

  const items = user ? NAV_BY_ROLE[user.app_role] || [] : [];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col shrink-0">
        <div className="p-5">
          <Brand companyName={companyName} />
        </div>
        <NavList items={items} currentPath={location.pathname} />
        <UserFooter user={user} />
      </aside>

      {/* ── Mobile drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col bg-sidebar">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <div className="p-5">
            <Brand companyName={companyName} />
          </div>
          <NavList items={items} currentPath={location.pathname} onNavigate={() => setMobileOpen(false)} />
          <UserFooter user={user} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Mobile top bar ── */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-card/80 backdrop-blur border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl text-muted-foreground hover:bg-muted"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base font-bold tracking-tight text-foreground">
            RADAR<span className="text-primary">.</span>
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
