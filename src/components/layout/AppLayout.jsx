import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Building2, LayoutDashboard, Users, CheckSquare, FileBarChart, LogOut } from "lucide-react";

const NAV_BY_ROLE = {
  super_admin: [{ label: "Empresas", path: "/companies", icon: Building2 }],
  company_admin: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Empleados", path: "/employees", icon: Users },
    { label: "Aprobaciones", path: "/approvals", icon: CheckSquare },
    { label: "Reportes", path: "/reports", icon: FileBarChart },
  ],
  store_manager: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Aprobaciones", path: "/approvals", icon: CheckSquare },
  ],
};

export default function AppLayout() {
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState(null);
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
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-slate-900">
            RADAR<span className="text-green-600">.</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {companyName || "Panel general"}
          </p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => base44.auth.logout("/login")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 w-full"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}