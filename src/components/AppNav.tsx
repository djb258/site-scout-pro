import { Link, useLocation } from "react-router-dom";
import { Database, Radio, Layers, Compass, Hammer, Map, DollarSign } from "lucide-react";
import { cn } from "@/utils";

const navLinks = [
  { to: "/pass0", label: "Pass 0", icon: Radio },
  { to: "/pass1", label: "Pass 1", icon: Layers },
  { to: "/pass15", label: "Pass 1.5", icon: DollarSign },
  { to: "/pass2", label: "Pass 2", icon: Compass },
  { to: "/pass3", label: "Pass 3", icon: Hammer },
  { to: "/map", label: "Map", icon: Map },
];

export function AppNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <header className="border-b border-border bg-card px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition shrink-0">
          <Database className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold text-foreground">HIVE</span>
        </Link>

        {/* TOC Navigation */}
        <nav className="flex items-center gap-1 border-l border-border pl-6">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = path === to || (to === "/pass0" && path === "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
