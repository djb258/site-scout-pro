import { Link, useLocation } from "react-router-dom";
import { Database, Radio, Layers, Compass, Hammer, Map } from "lucide-react";
import { cn } from "@/utils";

const navLinks = [
  { to: "/pass0", label: "Pass 0", icon: Radio },
  { to: "/pass1", label: "Pass 1", icon: Layers },
  { to: "/pass2", label: "Pass 2", icon: Compass },
  { to: "/pass3", label: "Pass 3", icon: Hammer },
  { to: "/map", label: "Map", icon: Map },
];

export function AppNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <header className="border-b border-border bg-card px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <Database className="w-7 h-7 text-primary" />
          <span className="text-2xl font-bold text-foreground">HIVE</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition",
                path === to || (to === "/pass0" && path === "/")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
