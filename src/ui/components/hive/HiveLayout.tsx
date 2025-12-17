import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Database,
  LayoutDashboard,
  Map,
  FileText,
  Building2,
  Calculator,
  List,
} from "lucide-react";
import { GlobalToc } from "./GlobalToc";

const navLinks = [
  { to: "/screener", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Map", icon: Map },
  { to: "/report", label: "Report", icon: FileText },
  { to: "/dashboard", label: "Markets", icon: Building2 },
  { to: "/jurisdictions", label: "Intel", icon: List },
  { to: "/calculator", label: "Calculator", icon: Calculator },
];

export function HiveLayout() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <Database className="w-7 h-7 text-primary" />
            <span className="text-2xl font-bold text-foreground">HIVE</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                  path === to || path.startsWith(to + "/")
                    ? "text-primary bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <GlobalToc />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
